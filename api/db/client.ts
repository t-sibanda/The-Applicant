import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import net from "net";
import { env } from "../lib/env";
import * as schema from "./schema";

/**
 * Single Postgres connection (pooled, IPv4-forced) shared across the app.
 *
 * IPv4 is forced via a custom socket because Supabase/managed Postgres direct
 * hosts often only resolve over IPv6, which fails on IPv4-only networks. Using
 * the pooled connection string plus this socket avoids the ENOTFOUND class of
 * errors entirely.
 */

let instance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqlClient: ReturnType<typeof postgres> | null = null;

function createClient() {
  // `socket` is supported at runtime by postgres.js to force an IPv4 socket,
  // but is missing from the library's TypeScript Options type, so we widen it.
  const options = {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: { rejectUnauthorized: false },
    fetch_types: false,
    connection: { search_path: "applicant,public" },
    socket: () => {
      const url = new URL(env.databaseUrl);
      return net.connect({
        host: url.hostname,
        port: parseInt(url.port) || 5432,
        family: 4,
      });
    },
  } as unknown as postgres.Options<Record<string, never>>;

  return postgres(env.databaseUrl, options);
}

export function getSql() {
  if (!sqlClient) sqlClient = createClient();
  return sqlClient;
}

export function getDb() {
  if (!instance) {
    instance = drizzle(getSql(), { schema });
  }
  return instance;
}
