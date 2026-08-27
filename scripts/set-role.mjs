import "dotenv/config";
import net from "net";
import postgres from "postgres";

const email = process.argv[2];
const role = process.argv[3];
if (!email || !["user", "admin"].includes(role)) {
  console.error("Usage: node scripts/set-role.mjs <email> <user|admin>");
  process.exit(1);
}
const url = new URL(process.env.DATABASE_URL);
const sql = postgres(process.env.DATABASE_URL, {
  prepare: false, max: 1, ssl: { rejectUnauthorized: false }, fetch_types: false,
  connect_timeout: 15,
  socket: () => net.connect({ host: url.hostname, port: parseInt(url.port) || 5432, family: 4 }),
});
try {
  const rows = await sql`update applicant.users set role = ${role} where email = ${email.toLowerCase()} returning id, email, role`;
  console.log(rows.length ? `Updated: ${JSON.stringify(rows[0])}` : "No matching user");
} catch (e) {
  console.error("ERROR:", e?.message || String(e));
} finally {
  await sql.end();
}
