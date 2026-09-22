import { Pool } from "pg";

// One shared connection pool, reused across requests. DATABASE_URL comes
// from Azure Database for PostgreSQL's connection string, e.g.:
// postgres://user:password@your-server.postgres.database.azure.com:5432/postgres?sslmode=require
let pool: Pool | undefined;

export function db() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Azure Postgres requires SSL
    });
  }
  return pool;
}
