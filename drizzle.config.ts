import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  schema: "./api/db/schema.ts",
  out: "./api/db/migrations",
  dialect: "postgresql",
  schemaFilter: ["applicant"],
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
