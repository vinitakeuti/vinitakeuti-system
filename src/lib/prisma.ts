import { PrismaClient } from "@prisma/client";

const prismaSchemaVersion = "20260930-professional-profile";
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaSchemaVersion?: string };

export const prisma = globalForPrisma.prismaSchemaVersion === prismaSchemaVersion && globalForPrisma.prisma
  ? globalForPrisma.prisma
  : new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaVersion = prismaSchemaVersion;
}
