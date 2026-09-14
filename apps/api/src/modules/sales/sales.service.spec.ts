import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SalesService } from './sales.service';
import { AnimalPricingMethod, AnimalStatus, FiscalStatus, PaymentMethod, Purpose, Species } from '@prisma/client';

describe('SalesService - Double Entry Sales & Mortality Calculation (IAS 41)', () => {
  let service: SalesService;
  let prisma: any;
  let tx: any;

  beforeEach(() => {
    tx = {
      fiscalYear: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'fy-2026',
          yearName: '2026',
          status: FiscalStatus.OPEN,
          isCurrent: true,
          periods: [{ id: 'fp-1', status: FiscalStatus.OPEN, periodNumber: 1 }],
        }),
      },
      account: {
        findUnique: jest.fn().mockImplementation(({ where }: any) => {
          const code = where.farmId_code.code;
          return Promise.resolve({ id: `acc-${code}`, code, currentBalance: 0 });
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      costCenter: {
        findFirst: jest.fn().mockResolvedValue({ id: 'cc-dairy' }),
      },
      journalSequence: {
        upsert: jest.fn().mockResolvedValue({ nextNumber: 10 }),
      },
      journalEntry: {
        create: jest.fn().mockImplementation(({ data }: any) => {
          return Promise.resolve({ id: 'je-1', ...data });
        }),
      },
      commercialSale: {
        count: jest.fn().mockResolvedValue(5),
        create: jest.fn().mockImplementation(({ data }: any) => {
          return Promise.resolve({ id: 'sale-1', ...data });
        }),
      },
      animal: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      animalMortality: {
        create: jest.fn().mockImplementation(({ data }: any) => {
          return Promise.resolve({ id: 'mort-1', ...data });
        }),
      },
    };

    prisma = {
      $transaction: jest.fn().mockImplementation(async (callback: any) => {
        return callback(tx);
      }),
      commercialSale: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
      animalMortality: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    service = new SalesService(prisma);
  });

  describe('recordMilkSale', () => {
    it('creates balanced journal entry and records milk sale', async () => {
      const result = await service.recordMilkSale(
        {
          liters: 100,
          pricePerLiter: 3.5,
          paymentMethod: PaymentMethod.CASH,
          buyerName: 'محل البركة للألبان',
        },
        'farm-1',
      );

      expect(result.totalAmount).toBe('350.000');
      expect(result.liters).toBe('100.000');
      expect(result.buyerName).toBe('محل البركة للألبان');

      // التحقق من إنشاء القيد المحاسبي المتوازن (مدين = دائن = 350)
      expect(tx.journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalDebit: 350,
            totalCredit: 350,
            lines: {
              create: expect.arrayContaining([
                expect.objectContaining({ accountId: 'acc-1101', debit: 350, credit: 0 }),
                expect.objectContaining({ accountId: 'acc-4101', debit: 0, credit: 350 }),
              ]),
            },
          }),
        }),
      );

      // التحقق من تحديث رصيد الخزينة والإيراد
      expect(tx.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1101' },
        data: { currentBalance: { increment: 350 } },
      });
      expect(tx.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-4101' },
        data: { currentBalance: { increment: -350 } },
      });
    });

    it('rejects zero or negative liters', async () => {
      await expect(
        service.recordMilkSale(
          {
            liters: 0,
            pricePerLiter: 3.5,
            paymentMethod: PaymentMethod.CASH,
            buyerName: 'عميل',
          },
          'farm-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordAnimalSale', () => {
    it('sells animal by live weight, updates status to SOLD, and posts GL entry', async () => {
      tx.animal.findFirst.mockResolvedValue({
        id: 'animal-1',
        farmId: 'farm-1',
        tagNumber: 'TAG-8821',
        status: AnimalStatus.ACTIVE,
        species: Species.CATTLE,
        breed: 'شاروليه',
      });

      const result = await service.recordAnimalSale(
        {
          animalId: 'animal-1',
          pricingMethod: AnimalPricingMethod.BY_WEIGHT,
          weightKg: 450,
          pricePerKg: 22,
          paymentMethod: PaymentMethod.BANK,
          buyerName: 'شركة النجوم للحوم',
        },
        'farm-1',
      );

      // 450 * 22 = 9900
      expect(result.totalAmount).toBe('9900.000');
      expect(result.weightKg).toBe('450.000');

      // التحقق من نقل حالة الحيوان إلى SOLD
      expect(tx.animal.update).toHaveBeenCalledWith({
        where: { id: 'animal-1' },
        data: { status: AnimalStatus.SOLD },
      });

      // التحقق من القيد المحاسبي (مدين البنك 1102 / دائن إيراد الماشية 4102)
      expect(tx.journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalDebit: 9900,
            totalCredit: 9900,
            lines: {
              create: expect.arrayContaining([
                expect.objectContaining({ accountId: 'acc-1102', debit: 9900, credit: 0 }),
                expect.objectContaining({ accountId: 'acc-4102', debit: 0, credit: 9900 }),
              ]),
            },
          }),
        }),
      );
    });

    it('rejects selling an already sold animal', async () => {
      tx.animal.findFirst.mockResolvedValue({
        id: 'animal-1',
        farmId: 'farm-1',
        tagNumber: 'TAG-8821',
        status: AnimalStatus.SOLD,
      });

      await expect(
        service.recordAnimalSale(
          {
            animalId: 'animal-1',
            pricingMethod: AnimalPricingMethod.PER_HEAD,
            pricePerHead: 3000,
            paymentMethod: PaymentMethod.CASH,
            buyerName: 'مشتري',
          },
          'farm-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordAnimalMortality', () => {
    it('calculates net loss and balances biological asset write-off under IAS 41', async () => {
      tx.animal.findFirst.mockResolvedValue({
        id: 'cow-1',
        farmId: 'farm-1',
        tagNumber: 'COW-401',
        species: Species.CATTLE,
        purpose: Purpose.DAIRY,
        currentLifeStage: 'LACTATING',
        status: AnimalStatus.ACTIVE,
        purchasePrice: 6000,
      });

      const result = await service.recordAnimalMortality(
        {
          animalId: 'cow-1',
          deathDate: '2026-09-14',
          causeOfDeath: 'انتفاخ الكرش الحاد (Acute Bloat)',
          salvageValue: 500, // بيع الجلد / بقايا استرداد
        },
        'farm-1',
      );

      // Book Value = 6000, Salvage = 500 => Net Loss = 5500
      expect(result.bookValue).toBe('6000.000');
      expect(result.salvageValue).toBe('500.000');
      expect(result.netLoss).toBe('5500.000');

      // التحقق من نقل حالة الحيوان إلى DECEASED
      expect(tx.animal.update).toHaveBeenCalledWith({
        where: { id: 'cow-1' },
        data: { status: AnimalStatus.DECEASED },
      });

      // التحقق من القيد المزدوج المتوازن:
      // مدين: 5105 (خسائر نفوق) = 5500
      // مدين: 1101 (صندوق نقدية تخريد) = 500
      // دائن: 1201 (أصل بيولوجي قطيع ألبان) = 6000
      // إجمالي المدين = 6000 = إجمالي الدائن!
      expect(tx.journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalDebit: 6000,
            totalCredit: 6000,
            lines: {
              create: expect.arrayContaining([
                expect.objectContaining({ accountId: 'acc-5105', debit: 5500, credit: 0 }),
                expect.objectContaining({ accountId: 'acc-1101', debit: 500, credit: 0 }),
                expect.objectContaining({ accountId: 'acc-1201', debit: 0, credit: 6000 }),
              ]),
            },
          }),
        }),
      );
    });

    it('rejects salvage value greater than book value', async () => {
      tx.animal.findFirst.mockResolvedValue({
        id: 'sheep-1',
        farmId: 'farm-1',
        tagNumber: 'SHP-10',
        species: Species.SHEEP,
        status: AnimalStatus.ACTIVE,
        purchasePrice: 400,
      });

      await expect(
        service.recordAnimalMortality(
          {
            animalId: 'sheep-1',
            deathDate: '2026-09-14',
            causeOfDeath: 'مرض تنفسي',
            salvageValue: 600, // أكبر من 400
          },
          'farm-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
