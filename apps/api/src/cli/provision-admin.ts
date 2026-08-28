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
  const username = required('INITIAL_ADMIN_USERNAME');
  const password = required('INITIAL_ADMIN_PASSWORD');
  const fullName = required('INITIAL_ADMIN_FULL_NAME');
  const organizationName = required('INITIAL_ORG_NAME');
  const farmName = required('INITIAL_FARM_NAME');

  if (password.length < 12) {
    throw new Error('INITIAL_ADMIN_PASSWORD must contain at least 12 characters');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      throw new Error('Provisioning refused because at least one user already exists');
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
