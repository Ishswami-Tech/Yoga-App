// Starts a local PostgreSQL for development (no Docker/system install needed).
// Usage: bun run db:dev   (leave running; Ctrl+C to stop)
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const dataDir = process.env.PGDATA_DIR || ".pgdata";
const port = Number(process.env.PGPORT || 54329);
const user = process.env.PGUSER || "yoga";
const password = process.env.PGPASSWORD || "yoga";
const database = process.env.PGDATABASE || "yoga";

const pg = new EmbeddedPostgres({ databaseDir: dataDir, user, password, port, persistent: true, initdbFlags: ["--encoding=UTF8", "--locale=C"] });
const fresh = !existsSync(`${dataDir}/PG_VERSION`);
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase(database);

console.log(`Postgres ready: postgresql://${user}:${password}@localhost:${port}/${database}`);
const stop = async () => { await pg.stop(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
