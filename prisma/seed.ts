import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const password = "password123";

async function main() {
  const hashedPassword = await bcrypt.hash(password, 12);

  const users = [
    {
      name: "Admin",
      email: "admin@dropnfly.ph",
      role: "ADMIN" as const,
      isApproved: true,
    },
    {
      name: "Staff",
      email: "staff@dropnfly.ph",
      role: "STAFF" as const,
      isApproved: true,
    },
  ];

  for (const user of users) {
    const existing = await prisma.user.findUnique({ where: { email: user.email } });
    if (existing) {
      console.log(`User ${user.email} already exists, skipping`);
      continue;
    }

    await prisma.user.create({
      data: {
        ...user,
        password: hashedPassword,
      },
    });
    console.log(`Created ${user.role}: ${user.email} / ${password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
