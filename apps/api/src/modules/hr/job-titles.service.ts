import { Injectable, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditActor, appendDomainAudit } from '../../common/audit/domain-audit';
import { randomUUID } from 'crypto';

export const DEFAULT_JOB_TITLES: string[] = [
  'مدير المزرعة',
  'طبيب بيطري',
  'مساعد بيطري',
  'مهندس زراعي / تغذية',
  'مشرف حظائر',
  'فني محطة الحلب',
  'عامل حلب',
  'مشرف أعلاف وتغذية',
  'عامل رعاية وتسمين',
  'محاسب مالي',
  'أمين مخزن',
  'فني ميكانيك وصيانة',
  'سائق نقل وتوزيع',
  'حارس أمن',
  'عامل عام',
];

@Injectable()
export class JobTitlesService {
  private readonly logger = new Logger(JobTitlesService.name);
  private tableInitialized = false;

  constructor(private readonly prisma: PrismaService) {}

  private async ensureTable() {
    if (this.tableInitialized) return;
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "hr_job_titles" (
          "id" TEXT PRIMARY KEY,
          "farmId" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "hr_job_titles_farm_title_unique" UNIQUE ("farmId", "title")
        );
        CREATE INDEX IF NOT EXISTS "idx_hr_job_titles_farm" ON "hr_job_titles"("farmId");
      `);
      this.tableInitialized = true;
    } catch (err: any) {
      this.logger.warn(`تعذر فحص أو إنشاء جدول المسميات الوظيفية: ${err.message}`);
    }
  }

  async findAll(farmId: string): Promise<string[]> {
    await this.ensureTable();

    // 1. Custom titles stored in database for this farm
    let customTitles: string[] = [];
    try {
      const rows = await this.prisma.$queryRaw<Array<{ title: string }>>`
        SELECT "title" FROM "hr_job_titles" WHERE "farmId" = ${farmId} ORDER BY "title" ASC
      `;
      customTitles = rows.map(r => r.title);
    } catch {
      // Table query fallback
    }

    // 2. Titles currently assigned to employees in this farm
    let employeeTitles: string[] = [];
    try {
      const empRows = await this.prisma.employee.findMany({
        where: { farmId },
        select: { jobTitle: true },
        distinct: ['jobTitle'],
      });
      employeeTitles = empRows.map(e => e.jobTitle).filter(Boolean);
    } catch {
      // Ignore
    }

    // Merge: Defaults + Custom + Employee titles (deduplicated)
    const set = new Set<string>();
    DEFAULT_JOB_TITLES.forEach(t => set.add(t));
    customTitles.forEach(t => set.add(t));
    employeeTitles.forEach(t => set.add(t));

    return Array.from(set);
  }

  async create(farmId: string, title: string, actor: AuditActor): Promise<{ title: string }> {
    await this.ensureTable();
    const cleanTitle = (title || '').trim();
    if (!cleanTitle || cleanTitle.length < 2) {
      throw new BadRequestException('المسمى الوظيفي يجب أن يكون حرفين على الأقل');
    }

    const id = randomUUID();
    try {
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "hr_job_titles" ("id", "farmId", "title")
        VALUES ($1, $2, $3)
        ON CONFLICT ("farmId", "title") DO NOTHING
      `, id, farmId, cleanTitle);
    } catch (err: any) {
      this.logger.error(`فشل حفظ المسمى الوظيفي: ${err.message}`);
      throw new ConflictException('المسمى الوظيفي مسجل مسبقاً');
    }

    try {
      await appendDomainAudit(this.prisma, actor, {
        action: 'hr.job_title.created',
        entityType: 'jobTitle',
        entityId: id,
        farmId,
        metadata: { title: cleanTitle },
      });
    } catch {}

    return { title: cleanTitle };
  }

  async update(farmId: string, oldTitle: string, newTitle: string, actor: AuditActor): Promise<{ success: boolean }> {
    await this.ensureTable();
    const cleanOld = (oldTitle || '').trim();
    const cleanNew = (newTitle || '').trim();

    if (!cleanOld || !cleanNew || cleanNew.length < 2) {
      throw new BadRequestException('المسمى الوظيفي الجديد غير صالح');
    }

    return this.prisma.$transaction(async tx => {
      // Update in hr_job_titles table
      await tx.$executeRawUnsafe(`
        UPDATE "hr_job_titles"
        SET "title" = $1
        WHERE "farmId" = $2 AND "title" = $3
      `, cleanNew, farmId, cleanOld);

      // If it wasn't in hr_job_titles (e.g. was a default title), insert new one
      const id = randomUUID();
      await tx.$executeRawUnsafe(`
        INSERT INTO "hr_job_titles" ("id", "farmId", "title")
        VALUES ($1, $2, $3)
        ON CONFLICT ("farmId", "title") DO NOTHING
      `, id, farmId, cleanNew);

      // Update all employees having oldTitle to newTitle
      await tx.employee.updateMany({
        where: { farmId, jobTitle: cleanOld },
        data: { jobTitle: cleanNew },
      });

      await appendDomainAudit(tx, actor, {
        action: 'hr.job_title.updated',
        entityType: 'jobTitle',
        entityId: cleanNew,
        farmId,
        metadata: { oldTitle: cleanOld, newTitle: cleanNew },
      });

      return { success: true };
    });
  }

  async delete(farmId: string, title: string, actor: AuditActor): Promise<{ success: boolean }> {
    await this.ensureTable();
    const cleanTitle = (title || '').trim();
    if (!cleanTitle) throw new BadRequestException('المسمى الوظيفي مطلوب');

    // Remove from hr_job_titles table
    await this.prisma.$executeRawUnsafe(`
      DELETE FROM "hr_job_titles"
      WHERE "farmId" = $1 AND "title" = $2
    `, farmId, cleanTitle);

    try {
      await appendDomainAudit(this.prisma, actor, {
        action: 'hr.job_title.deleted',
        entityType: 'jobTitle',
        entityId: cleanTitle,
        farmId,
        metadata: { title: cleanTitle },
      });
    } catch {}

    return { success: true };
  }
}
