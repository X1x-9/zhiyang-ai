# Neon 连接状态

> 历史文档：应用已于 2026-11-10 切换到本地 MySQL 8；Neon 仅作为迁移前的数据源保留记录，当前运行不再依赖它。MySQL 建库见 `npm run db:setup`，连接串见 `.env.example`。

本项目已通过 `neon init` 连接到你的 Neon 组织。

| 项 | 值 |
|---|---|
| 组织 | `org-morning-shape-55480190`（3359786126@qq.com，Free） |
| 项目 | `withered-tree-06202490`（区域 aws-us-east-2） |
| 分支 | `production` (`br-delicate-salad-be9findq`) |
| 数据库 | PostgreSQL 18.6，pgvector 已启用 |
| 表 | HealthProfile / MealRecord / PlanVersion / Feedback / KnowledgeChunk（5 张） |
| 本地链接 | `.neon`（已加入 `.gitignore`） |
| MCP | 已写入 `~/.cursor/mcp.json`（Neon，`https://mcp.neon.tech/mcp`） |

## 命令

```bash
npm run db:check   # 连接 + pgvector 检查
npm run db:setup   # 建扩展/表/向量索引（幂等）
npm run db:generate
npm run dev
```

## 已验证

- `CONNECT_OK` + `PGVECTOR_AVAILABLE true`
- `db:setup` → `SETUP_OK tables: 5 pgvector: true`
- `GET /api/dashboard` → 200，`calories` 读取真实餐食汇总
- `POST /api/meals` → 201，写入成功（中文内容校验 `TITLE_MATCH true`）

## 待处理

- **未安装 Neon Skills**：`neon skills` 拉取 GitHub 失败（本机无法连接 github.com:443）。网络恢复后重跑：
  `neon skills -s neon -s neon-postgres --agent cursor -y`
- **模型未接入**：`.env.local` 中的 `OPENAI_*` 仍为注释状态；AI 助手与 `rag:ingest` 会返回「未配置」。
- 生产环境仍需接入认证，API 目前对匿名访问默认拒绝。
- Neon 的 SSL 提示：psql 驱动提示 `sslmode=require` 未来会语义变化；生产可显式使用 `sslmode=verify-full`。
