import argon2 from "argon2";
import { prisma } from "../client";

const DEMO_USERNAME = "demo";
const DEMO_PASSWORD = "demo-trader-2026";

async function main() {
  const existing = await prisma.user.findUnique({ where: { username: DEMO_USERNAME } });
  if (existing) {
    console.log("Demo user already present, skipping seed.");
    return;
  }

  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  await prisma.user.create({
    data: {
      username: DEMO_USERNAME,
      name: "Demo Trader",
      password: passwordHash,
    },
  });
  console.log("Seeded demo user.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
