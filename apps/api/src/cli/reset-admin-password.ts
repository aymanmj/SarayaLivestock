import { PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envPaths = [
  process.env.DOTENV_CONFIG_PATH,
  'C:\\ProgramData\\SarayaLivestock\\config\\server.env',
  path.resolve(__dirname, '..', '..', '..', 'installer', 'server', 'config', 'server.env'),
  path.resolve(process.cwd(), '.env'),
].filter(Boolean) as string[];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined in server.env or environment');
  }

  const newPassword = process.argv[2]?.trim() || 'Admin@123456';
  const targetUsername = process.argv[3]?.trim() || 'admin';

  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: targetUsername },
          { role: UserRole.SUPER_ADMIN }
        ]
      }
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          username: targetUsername,
          password: passwordHash,
          isActive: true
        }
      });
      console.log('\n========================================================');
      console.log('✅ تم تحديث كلمة مرور مدير النظام بنجاح!');
      console.log(`اسم المستخدم (Username): ${user.username}`);
      console.log(`كلمة المرور الجديدة (Password): ${newPassword}`);
      console.log(`الاسم الكامل: ${user.fullName}`);
      console.log('========================================================\n');
    } else {
      let org = await prisma.organization.findFirst();
      if (!org) {
        org = await prisma.organization.create({
          data: { name: 'مجموعة السرايا للإنتاج الحيواني' }
        });
      }
      let farm = await prisma.farm.findFirst({ where: { orgId: org.id } });
      if (!farm) {
        farm = await prisma.farm.create({
          data: { orgId: org.id, name: 'المزرعة الرئيسية' }
        });
      }

      user = await prisma.user.create({
        data: {
          orgId: org.id,
          farmId: farm.id,
          username: targetUsername,
          fullName: 'مدير النظام',
          password: passwordHash,
          role: UserRole.SUPER_ADMIN,
          isActive: true
        }
      });
      console.log('\n========================================================');
      console.log('✅ تم إنشاء حساب مدير النظام الجديد بنجاح!');
      console.log(`اسم المستخدم (Username): ${user.username}`);
      console.log(`كلمة المرور (Password): ${newPassword}`);
      console.log('========================================================\n');
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('\n❌ فشل تعيين كلمة المرور:', err.message);
  process.exit(1);
});
