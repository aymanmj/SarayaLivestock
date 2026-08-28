import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateJournalEntryDto } from '../../modules/accounting/dto/accounting.dto';
import { DispenseFeedDto, FormulateLeastCostDto } from '../../modules/nutrition/dto/nutrition.dto';
import { RecordCalvingDto } from '../../modules/breeding/dto/breeding-actions.dto';
import { RotateSecretDto } from '../security/dto/rotate-secret.dto';
import { ActivateLicenseDto } from '../../modules/license/dto/license.dto';
import { ReportExportParamsDto } from '../../modules/reports/dto/reports.dto';
import { MilkingSummaryQueryDto } from '../../modules/milking/dto/milking-query.dto';

describe('Operational DTO validation', () => {
  it('rejects invalid nested journal lines', async () => {
    const dto = plainToInstance(CreateJournalEntryDto, {
      entryDate: '2026-08-27',
      description: 'قيد غير صالح',
      lines: [
        { accountId: 'not-a-uuid', debit: -10, credit: 0 },
        { accountId: 'b4d2b60e-a6af-4ec8-a145-e5cc0a5c1221', debit: 0, credit: 10 },
      ],
    });

    const errors = await validate(dto);
    expect(errors.some(error => error.property === 'lines' && error.children?.length)).toBe(true);
  });

  it('accepts a structurally valid balanced journal request', async () => {
    const dto = plainToInstance(CreateJournalEntryDto, {
      entryDate: '2026-08-27',
      description: 'قيد اختبار',
      lines: [
        { accountId: 'b4d2b60e-a6af-4ec8-a145-e5cc0a5c1221', debit: 10, credit: 0 },
        { accountId: 'f9e10a8e-d166-47ec-842f-06d1691ea1e4', debit: 0, credit: 10 },
      ],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects negative feed dispensing quantities', async () => {
    const dto = plainToInstance(DispenseFeedDto, {
      barnId: 'b4d2b60e-a6af-4ec8-a145-e5cc0a5c1221',
      formulaId: 'f9e10a8e-d166-47ec-842f-06d1691ea1e4',
      quantityKg: -1,
    });

    expect((await validate(dto)).some(error => error.property === 'quantityKg')).toBe(true);
  });

  it('validates nested ration ingredients', async () => {
    const dto = plainToInstance(FormulateLeastCostDto, {
      ingredients: [
        { id: 'invalid', name: '', costPerKg: -1, proteinPct: 101, energyMcal: 2 },
        { id: 'f9e10a8e-d166-47ec-842f-06d1691ea1e4', name: 'ذرة', costPerKg: 1, proteinPct: 8, energyMcal: 3 },
      ],
      target: { targetProteinPct: 18, batchTotalKg: 1000 },
    });

    expect((await validate(dto)).some(error => error.property === 'ingredients' && error.children?.length)).toBe(true);
  });

  it('rejects malformed calving data', async () => {
    const dto = plainToInstance(RecordCalvingDto, {
      actualCalvingDate: 'not-a-date',
      offspringTagNumber: '<script>',
      offspringGender: 'UNKNOWN',
      offspringWeightKg: -2,
    });

    expect(await validate(dto)).toHaveLength(4);
  });

  it('allows rotation only for explicitly supported secret names', async () => {
    await expect(validate(plainToInstance(RotateSecretDto, { keyName: 'JWT_SECRET' }))).resolves.toHaveLength(0);
    expect(await validate(plainToInstance(RotateSecretDto, { keyName: 'ENCRYPTION_KEY' }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(RotateSecretDto, { keyName: 'DATABASE_URL' }))).not.toHaveLength(0);
  });

  it('rejects empty or oversized license activation payloads', async () => {
    expect(await validate(plainToInstance(ActivateLicenseDto, { licenseKey: '' }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(ActivateLicenseDto, { licenseKey: 'x'.repeat(16_385) }))).not.toHaveLength(0);
  });

  it('accepts the culling export type and rejects unknown exports', async () => {
    await expect(validate(plainToInstance(ReportExportParamsDto, { type: 'culling' }))).resolves.toHaveLength(0);
    expect(await validate(plainToInstance(ReportExportParamsDto, { type: 'unknown' }))).not.toHaveLength(0);
  });

  it('accepts only calendar dates for the daily milking boundary', async () => {
    await expect(validate(plainToInstance(MilkingSummaryQueryDto, { date: '2026-08-28' }))).resolves.toHaveLength(0);
    expect(await validate(plainToInstance(MilkingSummaryQueryDto, { date: '2026-08-28T22:00:00Z' }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(MilkingSummaryQueryDto, { date: '2026-99-99' }))).not.toHaveLength(0);
  });
});
