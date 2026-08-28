import { PrismaClient, Species, Gender, Purpose, AnimalStatus, LifeStage, SectorType, UserRole, MilkingShift, InseminationType, PregnancyResult, CostCenterType, TransactionType } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

function getDatabaseUrl(): string {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be configured before seeding');
  }
  return process.env.DATABASE_URL;
}

const connectionString = getDatabaseUrl();
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Demo seed is disabled. Set ALLOW_DEMO_SEED=true in a non-production environment.');
  }

  console.log('🌱 جاري ضخ البيانات الأولية الشاملة لمنظومة SarayaLivestock ERP...');

  // 1. إنشاء المؤسسة (Organization)
  const org = await prisma.organization.create({
    data: {
      name: 'مجموعة سرايا للاستثمار والإنتاج الزراعي والحيواني',
      taxNumber: '300987654300003',
      phone: '+966500000000',
    },
  });

  // 2. إنشاء المزرعة (Farm)
  const farm = await prisma.farm.create({
    data: {
      orgId: org.id,
      name: 'مزرعة الوادي النموذجية للألبان والتسمين',
      location: 'القصيم - المملكة العربية السعودية',
      managerName: 'م. أحمد السرايا',
      phone: '+966555123456',
    },
  });

  // 3. إنشاء العنابر والحظائر (Barns)
  const dairyBarn = await prisma.barn.create({
    data: {
      farmId: farm.id,
      name: 'حظيرة الأبقار الحلابة (A1)',
      sectorType: SectorType.DAIRY,
      capacity: 100,
    },
  });

  const dryBarn = await prisma.barn.create({
    data: {
      farmId: farm.id,
      name: 'حظيرة الأبقار الجافة والعشار (B1)',
      sectorType: SectorType.DAIRY,
      capacity: 50,
    },
  });

  const fatteningBarn = await prisma.barn.create({
    data: {
      farmId: farm.id,
      name: 'عنبر تسمين العجول (F1)',
      sectorType: SectorType.FATTENING,
      capacity: 80,
    },
  });

  const isolationBarn = await prisma.barn.create({
    data: {
      farmId: farm.id,
      name: 'عنبر العزل البيطري والمستشفى (H1)',
      sectorType: SectorType.ISOLATION,
      capacity: 20,
    },
  });

  // 4. إنشاء المستخدمين (Users)
  const demoPassword = process.env.DEMO_USER_PASSWORD;
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error('DEMO_USER_PASSWORD must contain at least 12 characters');
  }
  const hashedPassword = await bcrypt.hash(demoPassword, 12);

  await prisma.user.createMany({
    data: [
      {
        orgId: org.id,
        farmId: farm.id,
        username: 'admin',
        fullName: 'مدير عام المزرعة',
        email: 'admin@sarayafarms.com',
        password: hashedPassword,
        role: UserRole.FARM_MANAGER,
      },
      {
        orgId: org.id,
        farmId: farm.id,
        username: 'dr_vet',
        fullName: 'د. محمود - الطبيب البيطري',
        email: 'vet@sarayafarms.com',
        password: hashedPassword,
        role: UserRole.VETERINARIAN,
      },
      {
        orgId: org.id,
        farmId: farm.id,
        username: 'milker1',
        fullName: 'مشرف المحلب والورديات',
        email: 'milker@sarayafarms.com',
        password: hashedPassword,
        role: UserRole.MILKER,
      },
    ],
  });

  // 5. إنشاء قطيع الأبقار الحلابة والتسمين
  const now = new Date();
  const threeDaysAhead = new Date();
  threeDaysAhead.setDate(now.getDate() + 3);

  // بقرة 1: هولشتاين حلابة ممتازة
  const cow1 = await prisma.animal.create({
    data: {
      farmId: farm.id,
      barnId: dairyBarn.id,
      tagNumber: 'SA-1001',
      rfidTag: '982000412345001',
      name: 'نجمة',
      species: Species.CATTLE,
      breed: 'Holstein',
      gender: Gender.FEMALE,
      purpose: Purpose.DAIRY,
      status: AnimalStatus.ACTIVE,
      currentLifeStage: LifeStage.LACTATING,
      birthDate: new Date('2023-01-15'),
      entryWeightKg: 550,
      purchasePrice: 2200,
    },
  });

  // بقرة 2: سيمينتال ثنائية الغرض
  const cow2 = await prisma.animal.create({
    data: {
      farmId: farm.id,
      barnId: dairyBarn.id,
      tagNumber: 'SA-1002',
      rfidTag: '982000412345002',
      name: 'بشاير',
      species: Species.CATTLE,
      breed: 'Simmental',
      gender: Gender.FEMALE,
      purpose: Purpose.DUAL,
      status: AnimalStatus.ACTIVE,
      currentLifeStage: LifeStage.LACTATING,
      birthDate: new Date('2023-03-20'),
      entryWeightKg: 580,
      purchasePrice: 2400,
    },
  });

  // بقرة 3: هولشتاين تحت فترة تحريم دوائي (لاختبار صمام الأمان الحاسم!)
  const cowQuarantined = await prisma.animal.create({
    data: {
      farmId: farm.id,
      barnId: isolationBarn.id,
      tagNumber: 'SA-1042',
      rfidTag: '982000412345042',
      name: 'وردة (تحت العلاج)',
      species: Species.CATTLE,
      breed: 'Holstein',
      gender: Gender.FEMALE,
      purpose: Purpose.DAIRY,
      status: AnimalStatus.ACTIVE,
      currentLifeStage: LifeStage.LACTATING,
      birthDate: new Date('2022-11-10'),
      entryWeightKg: 610,
      purchasePrice: 2100,
      withdrawalEndDate: threeDaysAhead, // فترة سحب نشطة تنتهي بعد 3 أيام
    },
  });

  // عجل تسمين 1
  const beefCalf1 = await prisma.animal.create({
    data: {
      farmId: farm.id,
      barnId: fatteningBarn.id,
      tagNumber: 'BF-2001',
      rfidTag: '982000412345201',
      species: Species.CATTLE,
      breed: 'Angus-Cross',
      gender: Gender.MALE,
      purpose: Purpose.BEEF,
      status: AnimalStatus.ACTIVE,
      currentLifeStage: LifeStage.FATTENING,
      birthDate: new Date('2025-06-01'),
      entryWeightKg: 220,
      purchasePrice: 950,
    },
  });

  // 6. تسجيل أوزان دورية لعجل التسمين لحساب معدل الزيادة اليومية ADG
  const weighDate1 = new Date();
  weighDate1.setDate(now.getDate() - 30);
  const weighDate2 = new Date();

  await prisma.weightLog.createMany({
    data: [
      {
        animalId: beefCalf1.id,
        weighDate: weighDate1,
        weightKg: 220,
        notes: 'وزن الدخول لعنبر التسمين',
      },
      {
        animalId: beefCalf1.id,
        weighDate: weighDate2,
        weightKg: 268,
        dailyGainAdg: 1.60, // (268 - 220) / 30 يوم = 1.6 كجم/يوم
        daysSinceLast: 30,
        notes: 'الوزن الدوري الشهري - استجابة ممتازة للعليقة',
      },
    ],
  });

  // 7. تسجيل إنتاج الحليب لآخر أسبوع
  for (let i = 6; i >= 0; i--) {
    const logDate = new Date();
    logDate.setDate(now.getDate() - i);

    await prisma.milkLog.createMany({
      data: [
        {
          animalId: cow1.id,
          logDate,
          shift: MilkingShift.MORNING,
          yieldLiters: 16.5,
          fatPct: 3.8,
          proteinPct: 3.2,
          isDiscarded: false,
        },
        {
          animalId: cow1.id,
          logDate,
          shift: MilkingShift.EVENING,
          yieldLiters: 14.8,
          fatPct: 3.9,
          proteinPct: 3.3,
          isDiscarded: false,
        },
        {
          animalId: cow2.id,
          logDate,
          shift: MilkingShift.MORNING,
          yieldLiters: 13.5,
          fatPct: 4.1,
          proteinPct: 3.4,
          isDiscarded: false,
        },
        {
          animalId: cow2.id,
          logDate,
          shift: MilkingShift.EVENING,
          yieldLiters: 12.5,
          fatPct: 4.2,
          proteinPct: 3.5,
          isDiscarded: false,
        },
      ],
    });
  }

  // 8. تسجيل علاج بيطري للبقرة 1042 (تأكيد صمام الأمان)
  const treatmentDate = new Date();
  treatmentDate.setDate(now.getDate() - 2);

  await prisma.healthTreatment.create({
    data: {
      animalId: cowQuarantined.id,
      diagnosis: 'التهاب ضرع خفيف (Clinical Mastitis)',
      drugName: 'بنسلين ممتد المفعول (Penicillin LA)',
      dosage: '40 ml عضلي',
      treatmentDate,
      milkWithdrawalDays: 5,
      meatWithdrawalDays: 14,
      withdrawalEndDate: threeDaysAhead,
      vetName: 'د. محمود البيطري',
      treatmentCost: 120,
      notes: 'تم عزل البقرة وحظر خلط حليبها في الخزان العام إجبارياً',
    },
  });

  // 9. تسجيل دورة تناسل وتلقيح
  const insemDate = new Date();
  insemDate.setDate(now.getDate() - 40); // قبل 40 يوماً (حان موعد فحص السونار PD!)

  const expectedCalving = new Date(insemDate);
  expectedCalving.setDate(expectedCalving.getDate() + 282);

  const expectedDryOff = new Date(expectedCalving);
  expectedDryOff.setDate(expectedDryOff.getDate() - 60);

  await prisma.breedingRecord.create({
    data: {
      animalId: cow2.id,
      inseminationDate: insemDate,
      inseminationType: InseminationType.ARTIFICIAL,
      semenCode: 'SEM-HOL-9921',
      inseminatorName: 'م. خالد الملقح',
      pdCheckDate: now,
      pdResult: PregnancyResult.PENDING,
      expectedCalvingDate: expectedCalving,
      expectedDryoffDate: expectedDryOff,
      notes: 'تلقيح صناعي بسائل منوي مجمد عالي الإنتاجية',
    },
  });

  // 10. مخزون الأعلاف ومكونات العليقة TMR
  const corn = await prisma.feedIngredient.create({
    data: {
      farmId: farm.id,
      name: 'ذرة صفراء مجروشة',
      unit: 'KG',
      currentStock: 15000,
      minStockAlert: 3000,
      costPerUnit: 0.32,
      proteinPct: 8.5,
      energyMcal: 3.3,
    },
  });

  const soy = await prisma.feedIngredient.create({
    data: {
      farmId: farm.id,
      name: 'كسب فول صويا 44%',
      unit: 'KG',
      currentStock: 8000,
      minStockAlert: 2000,
      costPerUnit: 0.58,
      proteinPct: 44.0,
      energyMcal: 3.1,
    },
  });

  const silage = await prisma.feedIngredient.create({
    data: {
      farmId: farm.id,
      name: 'سيلاج ذرة عالي الجودة',
      unit: 'KG',
      currentStock: 45000,
      minStockAlert: 10000,
      costPerUnit: 0.10,
      proteinPct: 8.0,
      energyMcal: 2.2,
    },
  });

  // خلطة حلب عالي TMR
  const tmrDairy = await prisma.feedFormula.create({
    data: {
      name: 'خلطة حلب عالي 18% بروتين TMR',
      targetSector: SectorType.DAIRY,
      description: 'عليقة متكاملة مخصصة للأبقار عالية الإنتاج (+28 لتر/يوم)',
      items: {
        create: [
          { ingredientId: corn.id, percentage: 35.0 },
          { ingredientId: soy.id, percentage: 20.0 },
          { ingredientId: silage.id, percentage: 45.0 },
        ],
      },
    },
  });

  // صرف عليقة يومية للحظيرة Dairy
  await prisma.feedDistribution.create({
    data: {
      barnId: dairyBarn.id,
      formulaId: tmrDairy.id,
      dispenseDate: now,
      quantityKg: 1200,
      totalCost: 285.50,
    },
  });

  // 11. مراكز التكلفة والقيود المحاسبية الزراعية (IAS 41)
  const dairyCostCenter = await prisma.costCenter.create({
    data: {
      farmId: farm.id,
      name: 'مركز تكلفة قطاع الألبان',
      type: CostCenterType.DAIRY_PRODUCTION,
    },
  });

  const beefCostCenter = await prisma.costCenter.create({
    data: {
      farmId: farm.id,
      name: 'مركز تكلفة قطاع التسمين',
      type: CostCenterType.FATTENING_PRODUCTION,
    },
  });

  await prisma.financialTransaction.createMany({
    data: [
      {
        costCenterId: dairyCostCenter.id,
        transDate: now,
        type: TransactionType.INCOME,
        category: 'مبيعات حليب طازج',
        amount: 3880.00,
        description: 'توريد 4850 لتر حليب لمصنع الألبان بسعر 0.80 $/لتر',
      },
      {
        costCenterId: dairyCostCenter.id,
        transDate: now,
        type: TransactionType.EXPENSE,
        category: 'أعلاف ومركزات TMR',
        amount: 1450.00,
        description: 'استهلاك أعلاف الحظائر لليوم',
      },
      {
        costCenterId: beefCostCenter.id,
        transDate: now,
        type: TransactionType.EXPENSE,
        category: 'تحصينات وأدوية وقائية',
        amount: 220.00,
        description: 'جرعات تجريع طفيليات لعنابر التسمين',
      },
    ],
  });

  console.log('✅ اكتمل ضخ البيانات النموذجية بنجاح!');
  console.log('📊 تم إنشاء المزرعة، العنابر، الأبقار، التلقيح، الأوزان، المخزون، والعمليات المالية.');
}

main()
  .catch((e) => {
    console.error('❌ خطأ أثناء ضخ البيانات:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
