// Grants a subscription tier to a user by email. IPv4-forced connection.
// Usage: node scripts/set-tier.mjs <email> <free|basic|pro>
import "dotenv/config";
import net from "net";
import postgres from "postgres";

const email = process.argv[2];
const tier = process.argv[3];
if (!email || !["free", "basic", "pro"].includes(tier)) {
  console.error("Usage: node scripts/set-tier.mjs <email> <free|basic|pro>");
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
    update applicant.users
    set subscription_tier = ${tier}
    where email = ${email.toLowerCase()}
    returning id, email, role, subscription_tier`;
  if (rows.length === 0) {
    console.log(`No user found with email ${email}`);
  } else {
    console.log("Updated:", rows[0]);
  }
} catch (e) {
  console.error("ERROR:", e?.message || String(e));
  process.exitCode = 1;
} finally {
  await sql.end();
}
