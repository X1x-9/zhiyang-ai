import "./load-env.mjs";
import { writeFile } from "node:fs/promises";
import { Client } from "pg";

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("缺少源数据库 DATABASE_URL。");
  process.exit(1);
}
if (!/^postgres(ql)?:\/\//.test(connectionString)) {
  console.error("DATABASE_URL 不是 PostgreSQL，跳过导出。");
  process.exit(1);
}

const tables = ["User", "HealthProfile", "MealRecord", "PlanVersion", "Feedback"];
const client = new Client({ connectionString, connectionTimeoutMillis: 20000 });

try {
  await client.connect();
  const dump = {};
  for (const table of tables) {
    const result = await client.query(`SELECT * FROM "${table}" ORDER BY "createdAt"`);
    dump[table] = result.rows;
  }
  const chunks = await client.query(
    `SELECT "id", "title", "source", "content", "embedding"::text AS "embedding", "reviewedAt", "createdAt" FROM "KnowledgeChunk" ORDER BY "createdAt"`,
  );
  dump.KnowledgeChunk = chunks.rows.map((row) => ({
    ...row,
    embedding: row.embedding ? row.embedding.slice(1, -1).split(",").map(Number) : null,
  }));

  const counts = Object.fromEntries(Object.entries(dump).map(([name, rows]) => [name, rows.length]));
  await writeFile(new URL("../.shots/db-export.json", import.meta.url), JSON.stringify(dump));
  console.log("EXPORT_OK", JSON.stringify(counts));
} catch (error) {
  console.error("EXPORT_FAIL", error.code ?? error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
