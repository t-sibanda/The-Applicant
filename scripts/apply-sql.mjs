// Applies a .sql file using an IPv4-forced postgres connection (reliable on
// IPv4-only networks / Supabase pooler). Usage: node scripts/apply-sql.mjs <file>
import "dotenv/config";
import fs from "fs";
import net from "net";
import postgres from "postgres";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-sql.mjs <sql-file>");
  process.exit(1);
}
const sqlText = fs.readFileSync(file, "utf8");

const url = new URL(process.env.DATABASE_URL);
const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 1,
  ssl: { rejectUnauthorized: false },
  fetch_types: false,
  connect_timeout: 15,
  socket: () =>
    net.connect({
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      family: 4,
    }),
});

// Split on the drizzle statement-breakpoint marker; fall back to running whole.
const statements = sqlText
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

try {
  // Ensure the dedicated schema exists before creating tables in it.
  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "applicant"`);

  let applied = 0;
  for (const stmt of statements) {
    try {
      await sql.unsafe(stmt);
      applied++;
    } catch (e) {
      const msg = e?.message || String(e);
      // Idempotent: skip objects that already exist.
      if (/already exists/i.test(msg)) {
        continue;
      }
      throw e;
    }
  }
  console.log(`Applied ${applied}/${statements.length} statement(s) from ${file}`);
} catch (e) {
  console.error("APPLY ERROR:", e?.message || String(e));
  process.exitCode = 1;
} finally {
  await sql.end();
}
