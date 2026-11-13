import "./load-env.mjs";
import { readFile } from "node:fs/promises";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) throw new Error("缺少 DATABASE_URL。");
if (!/^mysql:\/\//.test(process.env.DATABASE_URL)) throw new Error("DATABASE_URL 不是 MySQL 连接串。");

const snapshot = JSON.parse(await readFile(new URL("../.shots/db-export.json", import.meta.url), "utf8"));
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });
const reset = process.argv.includes("--reset");

const toDate = (value) => (value ? new Date(value) : null);

try {
  if (reset) {
    await prisma.feedback.deleteMany();
    await prisma.planVersion.deleteMany();
    await prisma.mealRecord.deleteMany();
    await prisma.healthProfile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.knowledgeChunk.deleteMany();
  }

  await prisma.user.createMany({
    data: snapshot.User.map((row) => ({
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      name: row.name,
      createdAt: toDate(row.createdAt),
      updatedAt: toDate(row.updatedAt),
    })),
    skipDuplicates: true,
  });

  await prisma.healthProfile.createMany({
    data: snapshot.HealthProfile.map((row) => ({
      id: row.id,
      userId: row.userId,
      displayName: row.displayName,
      goal: row.goal,
      dietaryNotes: row.dietaryNotes,
      data: row.data,
      createdAt: toDate(row.createdAt),
      updatedAt: toDate(row.updatedAt),
    })),
    skipDuplicates: true,
  });

  await prisma.mealRecord.createMany({
    data: snapshot.MealRecord.map((row) => ({
      id: row.id,
      profileId: row.profileId,
      eatenAt: toDate(row.eatenAt),
      title: row.title,
      mealType: row.mealType,
      items: row.items,
      estimatedKcal: row.estimatedKcal,
      lowerKcal: row.lowerKcal,
      upperKcal: row.upperKcal,
      proteinG: row.proteinG,
      carbsG: row.carbsG,
      fatG: row.fatG,
      notes: row.notes,
      status: row.status,
      createdAt: toDate(row.createdAt),
      updatedAt: toDate(row.updatedAt),
    })),
    skipDuplicates: true,
  });

  await prisma.planVersion.createMany({
    data: snapshot.PlanVersion.map((row) => ({
      id: row.id,
      profileId: row.profileId,
      version: row.version,
      plan: row.plan,
      activeAt: toDate(row.activeAt),
      createdAt: toDate(row.createdAt),
    })),
    skipDuplicates: true,
  });

  await prisma.feedback.createMany({
    data: snapshot.Feedback.map((row) => ({
      id: row.id,
      profileId: row.profileId,
      topic: row.topic,
      rating: row.rating,
      note: row.note,
      createdAt: toDate(row.createdAt),
    })),
    skipDuplicates: true,
  });

  await prisma.knowledgeChunk.createMany({
    data: snapshot.KnowledgeChunk.map((row) => ({
      id: row.id,
      title: row.title,
      source: row.source,
      content: row.content,
      embedding: row.embedding,
      reviewedAt: toDate(row.reviewedAt),
      createdAt: toDate(row.createdAt),
    })),
    skipDuplicates: true,
  });

  const counts = {
    User: await prisma.user.count(),
    HealthProfile: await prisma.healthProfile.count(),
    MealRecord: await prisma.mealRecord.count(),
    PlanVersion: await prisma.planVersion.count(),
    Feedback: await prisma.feedback.count(),
    KnowledgeChunk: await prisma.knowledgeChunk.count(),
  };
  console.log("IMPORT_OK", JSON.stringify(counts));
} catch (error) {
  console.error("IMPORT_FAIL", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
