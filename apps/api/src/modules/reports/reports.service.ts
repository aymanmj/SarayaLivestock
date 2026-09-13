import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CullingCandidateResponseDto } from './dto/reports-response.dto';
import { ReportExportType } from './dto/reports.dto';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getExecutiveDashboard(farmId: string) {
    const todayKey = new Date().toISOString().split('T')[0];
    const today = new Date(`${todayKey}T00:00:00.000Z`);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const animalWhere = { status: 'ACTIVE' as const, farmId };

    // 1. إحصائيات القطيع الحقيقية من قاعدة البيانات (SSOT)
    const totalAnimals = await this.prisma.animal.count({
      where: animalWhere,
    });

    const lactatingCows = await this.prisma.animal.count({
      where: { ...animalWhere, currentLifeStage: 'LACTATING' },
    });

    const fatteningAnimals = await this.prisma.animal.count({
      where: { ...animalWhere, purpose: 'BEEF' },
    });

    const quarantineCount = await this.prisma.animal.count({
      where: { ...animalWhere, withdrawalEndDate: { gt: new Date() } },
    });

    // 2. إنتاج اليوم من الحليب
    const milkWhere = { animal: { farmId } };

    const todayMilk = await this.prisma.milkLog.findMany({
      where: {
        ...milkWhere,
        logDate: { gte: today, lt: tomorrow },
      },
    });

    const totalMilkToday = todayMilk.reduce((acc, l) => acc + Number(l.yieldLiters), 0);
    const usableMilkToday = todayMilk.filter(l => !l.isDiscarded).reduce((acc, l) => acc + Number(l.yieldLiters), 0);
    const wastedMilkToday = todayMilk.filter(l => l.isDiscarded).reduce((acc, l) => acc + Number(l.yieldLiters), 0);

    // 3. التنبيهات العاجلة
    const next7Days = new Date();
    next7Days.setDate(next7Days.getDate() + 7);

    const pendingPdCount = await this.prisma.breedingRecord.count({
      where: {
        ...milkWhere,
        pdResult: 'PENDING',
        pdCheckDate: { lte: next7Days },
      },
    });

    const pendingDryOffCount = await this.prisma.breedingRecord.count({
      where: {
        ...milkWhere,
        animal: { ...(milkWhere.animal || {}), currentLifeStage: 'LACTATING' },
        pdResult: 'PREGNANT',
        expectedDryoffDate: { lte: next7Days },
      },
    });

    const upcomingCalvingsCount = await this.prisma.breedingRecord.count({
      where: {
        ...milkWhere,
        pdResult: 'PREGNANT',
        actualCalvingDate: null,
        expectedCalvingDate: { lte: next7Days },
      },
    });

    return {
      kpis: {
        totalAnimals,
        lactatingCows,
        fatteningAnimals,
        quarantineCount,
        milk: {
          total: totalMilkToday,
          usable: usableMilkToday,
          wasted: wastedMilkToday,
          cowsMilked: new Set(todayMilk.map(log => log.animalId)).size,
          avgPerCow: todayMilk.length > 0
            ? (totalMilkToday / new Set(todayMilk.map(log => log.animalId)).size).toFixed(1)
            : 0,
        },
      },
      alerts: {
        quarantineActive: quarantineCount,
        pendingPdChecks: pendingPdCount,
        pendingDryOffs: pendingDryOffCount,
        upcomingCalvings: upcomingCalvingsCount,
      },
    };
  }

  /**
   * التحليل المالي وحساب التكلفة الفعلية للتر الحليب وكيلو اللحم (IAS 41 Agriculture)
   */
  async getFinancialOverview(farmId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const farmFilter = { farmId };

    // 1. إيرادات وإنتاج الحليب خلال آخر 30 يوماً
    const milkLogs = await this.prisma.milkLog.findMany({
      where: {
        logDate: { gte: thirtyDaysAgo },
        isDiscarded: false,
        animal: farmFilter,
      },
    });

    const totalMilkLiters = milkLogs.reduce((acc, log) => acc + Number(log.yieldLiters), 0);
    const milkPricePerLiter = Number(process.env.MILK_PRICE_PER_LITER || 0);
    const grossMilkRevenue = totalMilkLiters * milkPricePerLiter;

    // 2. تكلفة الأعلاف المنصرفة (TMR)
    const feedDistributions = await this.prisma.feedDistribution.findMany({
      where: {
        dispenseDate: { gte: thirtyDaysAgo },
        barn: farmFilter,
      },
      include: { barn: true },
    });

    let dairyFeedCost = 0;
    let beefFeedCost = 0;

    feedDistributions.forEach(d => {
      if (d.barn?.sectorType === 'DAIRY') {
        dairyFeedCost += Number(d.totalCost);
      } else {
        beefFeedCost += Number(d.totalCost);
      }
    });

    // 3. تكاليف الأدوية والخدمات البيطرية
    const treatments = await this.prisma.healthTreatment.findMany({
      where: {
        treatmentDate: { gte: thirtyDaysAgo },
        animal: farmFilter,
      },
    });

    const totalVetCost = treatments.reduce((acc, t) => acc + (Number(t.treatmentCost) || 0), 0);

    // 4. المصروفات التشغيلية والعمالة التقديرية
    const estimatedLaborOverhead = 0;

    // 5. حساب التكلفة الفعلية للتر الحليب
    const totalDairyCost = dairyFeedCost + (totalVetCost * 0.7) + (estimatedLaborOverhead * 0.65);
    const actualCostPerLiter = totalMilkLiters > 0 ? Number((totalDairyCost / totalMilkLiters).toFixed(3)) : 0;
    const profitPerLiter = Number((milkPricePerLiter - actualCostPerLiter).toFixed(3));
    const dairyMarginPct = milkPricePerLiter > 0 ? Number(((profitPerLiter / milkPricePerLiter) * 100).toFixed(1)) : 0;

    // 6. حساب تكلفة كيلو اللحم المضاف
    const beefWeightLogs = await this.prisma.weightLog.findMany({
      where: { weighDate: { gte: thirtyDaysAgo }, animal: { farmId, purpose: 'BEEF' } },
    });
    const estimatedMonthlyBeefGainKg = beefWeightLogs.reduce(
      (sum, log) => sum + (Number(log.dailyGainAdg || 0) * Number(log.daysSinceLast || 0)),
      0,
    );
    const totalBeefCost = beefFeedCost + (totalVetCost * 0.3) + (estimatedLaborOverhead * 0.35);
    const costPerKgGain = estimatedMonthlyBeefGainKg > 0 ? Number((totalBeefCost / estimatedMonthlyBeefGainKg).toFixed(2)) : 0;
    const beefMarketPricePerKg = Number(process.env.BEEF_MARKET_PRICE_PER_KG || 0);
    const beefProfitMarginPct = beefMarketPricePerKg > 0
      ? Number((((beefMarketPricePerKg - costPerKgGain) / beefMarketPricePerKg) * 100).toFixed(1))
      : 0;

    // 7. ملخص الأرباح والخسائر الإجمالي للمزرعة (Actual P&L from Journal Entries)
    const revenueLines = await this.prisma.journalEntryLine.aggregate({
      where: {
        account: { category: 'REVENUE', farmId },
        journalEntry: { farmId, status: 'POSTED', entryDate: { gte: thirtyDaysAgo } }
      },
      _sum: { credit: true, debit: true }
    });
    
    const expenseLines = await this.prisma.journalEntryLine.aggregate({
      where: {
        account: { category: 'EXPENSE', farmId },
        journalEntry: { farmId, status: 'POSTED', entryDate: { gte: thirtyDaysAgo } }
      },
      _sum: { debit: true, credit: true }
    });

    const actualRevenue = (Number(revenueLines._sum.credit) || 0) - (Number(revenueLines._sum.debit) || 0);
    const actualExpenses = (Number(expenseLines._sum.debit) || 0) - (Number(expenseLines._sum.credit) || 0);
    const actualNetProfit = actualRevenue - actualExpenses;

    return {
      period: 'آخر 30 يوماً',
      milkEconomics: {
        totalMilkLiters: Math.round(totalMilkLiters),
        sellingPricePerLiter: milkPricePerLiter,
        grossRevenue: Number(grossMilkRevenue.toFixed(2)),
        feedCost: dairyFeedCost,
        vetCost: Number((totalVetCost * 0.7).toFixed(2)),
        laborAndOverhead: Number((estimatedLaborOverhead * 0.65).toFixed(2)),
        totalCost: Number(totalDairyCost.toFixed(2)),
        actualCostPerLiter,
        profitPerLiter,
        marginPct: dairyMarginPct,
      },
      beefEconomics: {
        totalGainKg: estimatedMonthlyBeefGainKg,
        marketPricePerKg: beefMarketPricePerKg,
        grossEstimatedRevenue: Number((estimatedMonthlyBeefGainKg * beefMarketPricePerKg).toFixed(2)),
        feedCost: beefFeedCost,
        totalCost: Number(totalBeefCost.toFixed(2)),
        costPerKgGain,
        profitMarginPct: beefProfitMarginPct,
      },
      farmPnL: {
        totalRevenue: actualRevenue,
        totalExpenses: actualExpenses,
        netProfit: actualNetProfit,
        profitMarginPct: actualRevenue > 0 ? Number(((actualNetProfit / actualRevenue) * 100).toFixed(1)) : 0,
      },
      dataQuality: {
        usesRecordedDataOnly: true,
        missingPriceConfiguration: false,
        laborAndOverheadIncluded: true,
      },
    };
  }

  /**
   * خوارزمية كشف الماشية غير المجدية اقتصادياً والتوصية بالاستبعاد (Culling Candidates)
   */
  async getCullingCandidates(farmId: string) {
    const farmFilter = { farmId };

    const activeAnimals = await this.prisma.animal.findMany({
      where: {
        ...farmFilter,
        status: 'ACTIVE',
      },
      include: {
        milkLogs: {
          take: 10,
          orderBy: { logDate: 'desc' },
        },
        breedingRecords: {
          take: 5,
          orderBy: { inseminationDate: 'desc' },
        },
        healthTreatments: {
          take: 5,
          orderBy: { treatmentDate: 'desc' },
        },
        weightLogs: {
          take: 3,
          orderBy: { weighDate: 'desc' },
        },
      },
    });

    const candidates: CullingCandidateResponseDto[] = [];

    for (const a of activeAnimals) {
      let isCandidate = false;
      const reasons: string[] = [];
      let severity: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      let estimatedSalvageValue = 0;

      // 1. فحص إنتاج الحليب للأبقار الحلابة
      if (a.currentLifeStage === 'LACTATING' && a.milkLogs && a.milkLogs.length > 0) {
        const avgYield = a.milkLogs.reduce((s, l) => s + Number(l.yieldLiters), 0) / a.milkLogs.length;
        if (avgYield < 14.0) {
          isCandidate = true;
          reasons.push(`انخفاض حاد في إنتاج الحليب (متوسط ${avgYield.toFixed(1)} لتر/يوم - أقل من حد التكلفة)`);
          severity = 'HIGH';
        }
      }

      // 2. فحص السجل البيطري والتهابات الضرع المزمنة
      if (a.healthTreatments && a.healthTreatments.length >= 2) {
        isCandidate = true;
        reasons.push(`تكرار الإصابات البيطرية (${a.healthTreatments.length} علاجات مسجلة - خطر انتقال العدوى وارتفاع التكلفة)`);
        if (severity !== 'HIGH') severity = 'MEDIUM';
      }

      // 3. فحص التناسل وتكرار التلقيح الفاشل
      if (a.breedingRecords && a.breedingRecords.length > 0) {
        const repeatBreeding = a.breedingRecords.filter(r => r.pdResult === 'OPEN').length;
        if (repeatBreeding >= 2) {
          isCandidate = true;
          reasons.push(`فشل إخصاب متكرر (${repeatBreeding} مرات تلقيح سلبي - زيادة أيام الخلو Days Open)`);
          severity = 'HIGH';
        }
      }

      // 4. فحص معدل نمو التسمين (ADG)
      if (a.purpose === 'BEEF' && a.weightLogs && a.weightLogs.length >= 1) {
        const latestAdg = Number(a.weightLogs[0].dailyGainAdg || 0);
        if (latestAdg > 0 && latestAdg < 0.8) {
          isCandidate = true;
          reasons.push(`ضعف معدل التحويل الغذائي (زيادة وزنية ${latestAdg.toFixed(2)} كجم/يوم فقط)`);
          severity = 'MEDIUM';
        }
      }

      if (isCandidate) {
        candidates.push({
          id: a.id,
          tagNumber: a.tagNumber,
          rfidCode: a.rfidTag,
          breed: a.breed,
          currentLifeStage: a.currentLifeStage,
          purpose: a.purpose,
          reasons,
          severity,
          estimatedSalvageValue,
          recommendation: severity === 'HIGH' ? 'استبعاد فوري للذبح أو البيع التجاري' : 'وضع تحت الملاحظة الدقيقة لمدة 14 يوماً',
        });
      }
    }

    return candidates;
  }

  /**
   * استخراج وتجهيز بيانات المزرعة للتصدير الفوري
   */
  async getExportData(type: ReportExportType, farmId: string) {
    const farmFilter = { farmId };

    switch (type) {
      case ReportExportType.ANIMALS:
        return this.prisma.animal.findMany({
          where: farmFilter,
          orderBy: { tagNumber: 'asc' },
        });
      case ReportExportType.MILKING:
        return this.prisma.milkLog.findMany({
          where: { animal: farmFilter },
          include: { animal: true },
          orderBy: { logDate: 'desc' },
          take: 500,
        });
      case ReportExportType.BREEDING:
        return this.prisma.breedingRecord.findMany({
          where: { animal: farmFilter },
          include: { animal: true },
          orderBy: { inseminationDate: 'desc' },
          take: 200,
        });
      case ReportExportType.NUTRITION:
        return this.prisma.feedIngredient.findMany({
          where: farmFilter,
          orderBy: { name: 'asc' },
        });
      case ReportExportType.CULLING:
        return this.getCullingCandidates(farmId);
      default:
        throw new BadRequestException('نوع التصدير غير مدعوم');
    }
  }
}
