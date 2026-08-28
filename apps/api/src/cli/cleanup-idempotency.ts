import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const BATCH_SIZE = 1_000;

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL must be configured');

  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  let deletedTotal = 0;

  try {
    for (;;) {
      const expired = await prisma.idempotencyRecord.findMany({
        where: { expiresAt: { lt: new Date() } },
        select: { id: true },
        orderBy: { expiresAt: 'asc' },
        take: BATCH_SIZE,
      });
      if (expired.length === 0) break;

      const deleted = await prisma.idempotencyRecord.deleteMany({
        where: { id: { in: expired.map(record => record.id) } },
      });
      deletedTotal += deleted.count;
      if (expired.length < BATCH_SIZE) break;
    }

    console.log(`Expired idempotency records deleted: ${deletedTotal}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(error => {
  console.error(`Idempotency cleanup failed: ${error.message}`);
  process.exitCode = 1;
});
