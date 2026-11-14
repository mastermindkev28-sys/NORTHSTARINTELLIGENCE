import pg from "pg";
import { migrate } from "./migrate.js";

const [command] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

if (command === "migrate") {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const applied = await migrate(client);
    console.warn(applied.length ? `Applied: ${applied.join(", ")}` : "Database is up to date.");
  } finally {
    await client.end();
  }
} else {
  console.error("usage: cli.ts migrate");
  process.exit(2);
}
