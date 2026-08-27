import "dotenv/config";
import net from "net";
import postgres from "postgres";

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
    select id, email, role, status, subscription_tier
    from applicant.users order by id`;
  console.log(JSON.stringify(rows, null, 2));
} catch (e) {
  console.error("ERROR:", e?.message || String(e));
} finally {
  await sql.end();
}
