import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function poolConfig(connectionString: string) {
  const url = new URL(connectionString);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: 5,
    idleTimeout: 1800,
    connectTimeout: 10_000,
    acquireTimeout: 15_000,
    allowPublicKeyRetrieval: true,
  };
}

export function getPrisma() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  if (!globalForPrisma.prisma) {
    const adapter = new PrismaMariaDb(poolConfig(process.env.DATABASE_URL));
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
}
