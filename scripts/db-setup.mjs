import "./load-env.mjs";
import { readFile } from "node:fs/promises";
import mariadb from "mariadb";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("缺少 DATABASE_URL。请先写入 .env.local。");
  process.exit(1);
}

const url = new URL(connectionString);
const database = url.pathname.replace(/^\//, "");
if (!/^[A-Za-z0-9_]+$/.test(database)) {
  console.error("DATABASE_URL 中的数据库名不合法。");
  process.exit(1);
}

const baseConfig = {
  host: url.hostname,
  port: url.port ? Number(url.port) : 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  allowPublicKeyRetrieval: true,
  connectTimeout: 10_000,
};

const sqlFiles = ["../prisma/setup.sql"];

let admin;
try {
  admin = await mariadb.createConnection(baseConfig);
  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await admin.end();
  admin = undefined;

  const client = await mariadb.createConnection({ ...baseConfig, database });
  for (const file of sqlFiles) {
    const sql = (await readFile(new URL(file, import.meta.url), "utf8")).replace(/^\uFEFF/, "");
    const statements = sql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) {
      try {
        await client.query(statement);
      } catch (error) {
        if (error.errno === 1826 || /Duplicate foreign key constraint name/i.test(error.message)) continue;
        throw error;
      }
    }
  }
  const [check] = await client.query(
    "SELECT (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ?) AS tables, (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = ? AND table_name = 'MealRecord' AND column_name = 'mealType') AS meal_type",
    [database, database],
  );
  console.log("SETUP_OK tables:", Number(check.tables), "mealType:", Number(check.meal_type) === 1);
  await client.end();
} catch (error) {
  console.error("SETUP_FAIL", error.message);
  process.exitCode = 1;
} finally {
  await admin?.end().catch(() => {});
}
