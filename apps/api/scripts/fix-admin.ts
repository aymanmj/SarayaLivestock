
import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function fixAdmin() {
  const admin = await prisma.user.findFirst({ where: { username: "admin" } });
  if (admin) {
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: UserRole.SUPER_ADMIN, isActive: true }
    });
    console.log("SUCCESS: admin user role reset to SUPER_ADMIN");
  }
  await prisma.$disconnect();
  await pool.end();
}
fixAdmin().catch(console.error);

