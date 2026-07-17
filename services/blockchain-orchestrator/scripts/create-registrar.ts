import "dotenv/config";
import { hashPassword } from "../src/auth.js";
import { sql, initDb, upsertRegistrar } from "../src/db.js";

const [username, password] = process.argv.slice(2);

if (!username || !/^[a-z0-9_-]{3,32}$/.test(username)) {
  console.error("username must match ^[a-z0-9_-]{3,32}$");
  process.exit(1);
}
if (!password || password.length < 12) {
  console.error("password must be at least 12 characters");
  process.exit(1);
}

await initDb();
await upsertRegistrar(username, hashPassword(password));
console.log(`registrar ${username} saved`);
await sql.end();
