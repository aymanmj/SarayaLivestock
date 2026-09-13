const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

dotenv.config();

const connectionString = "postgresql://postgres:postgres@localhost:5433/saraya_livestock_db?schema=public";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function reset() {
  const hashedPassword = await bcrypt.hash('Admin@123456', 12);
  const user = await prisma.user.update({
    where: { username: 'admin' },
    data: { password: hashedPassword }
  });
  console.log(`تم تغيير كلمة مرور المستخدم ${user.username} إلى Admin@123456`);
}

reset()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
