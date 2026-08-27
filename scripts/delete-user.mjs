import "dotenv/config";
import net from "net";
import postgres from "postgres";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/delete-user.mjs <email>");
  process.exit(1);
}
const url = new URL(process.env.DATABASE_URL);
const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 1,
  ssl: { rejectUnauthorized: false },
  fetch_types: false,
  connect_timeout: 15,
  socket: () =>
    net.connect({ host: url.hostname, port: parseInt(url.port) || 5432, family: 4 }),
});
try {
  const rows = await sql`
    delete from applicant.users where email = ${email.toLowerCase()} returning id, email`;
  console.log(rows.length ? `Deleted ${rows[0].email}` : "No matching user");
} catch (e) {
  console.error("ERROR:", e?.message || String(e));
} finally {
  await sql.end();
}
