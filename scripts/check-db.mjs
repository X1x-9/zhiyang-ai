import "./load-env.mjs";
import mariadb from "mariadb";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("缺少 DATABASE_URL。请先写入 .env.local。");
  process.exit(1);
}

const url = new URL(connectionString);
const database = url.pathname.replace(/^\//, "");

let client;
try {
  client = await mariadb.createConnection({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    allowPublicKeyRetrieval: true,
    connectTimeout: 5_000,
  });
  const [version] = await client.query("SELECT VERSION() AS version");
  console.log("CONNECT_OK", String(version.version).slice(0, 48));
  const [tables] = await client.query(
    "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ?",
    [database],
  );
  console.log("TABLES", Number(tables.count));
  const [chunks] = await client.query("SELECT COUNT(*) AS total, COUNT(embedding) AS embedded FROM `KnowledgeChunk`");
  console.log("KNOWLEDGE_CHUNKS", Number(chunks.total), "EMBEDDED", Number(chunks.embedded));
} catch (error) {
  console.log("CONNECT_FAIL", error.code ?? error.message);
} finally {
  await client?.end().catch(() => {});
}
