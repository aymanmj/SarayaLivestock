import { PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured`);
  return value;
}

async function main() {
  const databaseUrl = required('DATABASE_URL');
  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      console.log('Administrator account already exists; skipping provisioning.');
      return;
    }

    const username = process.env.INITIAL_ADMIN_USERNAME?.trim();
    const password = process.env.INITIAL_ADMIN_PASSWORD?.trim();
    const fullName = process.env.INITIAL_ADMIN_FULL_NAME?.trim() || 'مدير النظام';
    const organizationName = process.env.INITIAL_ORG_NAME?.trim() || 'مزارع السرايا للإنتاج الحيواني';
    const farmName = process.env.INITIAL_FARM_NAME?.trim() || 'المزرعة الرئيسية';

    if (!username || !password) {
      console.log('No initial admin credentials specified; skipping provisioning.');
      return;
    }

    if (password.length < 12) {
      throw new Error('INITIAL_ADMIN_PASSWORD must contain at least 12 characters');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await prisma.$transaction(async (tx) => {
      const organization =
        (await tx.organization.findFirst({ orderBy: { createdAt: 'asc' } })) ||
        (await tx.organization.create({ data: { name: organizationName } }));

      const farm =
        (await tx.farm.findFirst({
          where: { orgId: organization.id },
          orderBy: { createdAt: 'asc' },
        })) ||
        (await tx.farm.create({
          data: { orgId: organization.id, name: farmName },
        }));

      return tx.user.create({
        data: {
          orgId: organization.id,
          farmId: farm.id,
          username,
          fullName,
          password: passwordHash,
          role: UserRole.SUPER_ADMIN,
          isActive: true,
        },
        select: { id: true, username: true, farmId: true, orgId: true },
      });
    });

    console.log(`Initial administrator provisioned: ${admin.username} (${admin.id})`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Administrator provisioning failed: ${error.message}`);
  process.exitCode = 1;
});
