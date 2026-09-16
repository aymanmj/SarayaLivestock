import { Decimal } from 'decimal.js';
import {
  AccountCategory,
  AnimalStatus,
  Gender,
  LifeStage,
  MilkInventoryPolicy,
  Purpose,
  Species,
  FiscalStatus,
  JournalEntryStatus,
  JournalEntryType,
  Prisma,
} from '@prisma/client';
import { AnimalsService } from '../modules/animals/animals.service';
import { BreedingService } from '../modules/breeding/breeding.service';
import { MilkingService } from '../modules/milking/milking.service';
import { HealthService } from '../modules/health/health.service';
import { SalesService } from '../modules/sales/sales.service';
import { BarnsService } from '../modules/barns/barns.service';
import { AccountingService } from '../modules/accounting/accounting.service';
import { RationService } from '../modules/nutrition/ration.service';
import { Money } from '../common/utils/money.util';

export interface FarmState {
  farms: Map<string, any>;
  barns: Map<string, any>;
  animals: Map<string, any>;
  breedingRecords: Map<string, any>;
  pregnancyChecks: Map<string, any>;
  birthRecords: Map<string, any>;
  milkLogs: Map<string, any>;
  bulkTankLogs: Map<string, any>;
  healthTreatments: Map<string, any>;
  weightLogs: Map<string, any>;
  commercialSales: Map<string, any>;
  animalMortalities: Map<string, any>;
  fiscalYears: Map<string, any>;
  fiscalPeriods: Map<string, any>;
  accounts: Map<string, any>;
  journalEntries: Map<string, any>;
  journalLines: Map<string, any>;
  journalSequences: Map<string, any>;
  costCenters: Map<string, any>;
  auditEvents: Map<string, any>;
  idempotencyRecords: Map<string, any>;
}

export function createInMemoryState(): FarmState {
  return {
    farms: new Map(),
    barns: new Map(),
    animals: new Map(),
    breedingRecords: new Map(),
    pregnancyChecks: new Map(),
    birthRecords: new Map(),
    milkLogs: new Map(),
    bulkTankLogs: new Map(),
    healthTreatments: new Map(),
    weightLogs: new Map(),
    commercialSales: new Map(),
    animalMortalities: new Map(),
    fiscalYears: new Map(),
    fiscalPeriods: new Map(),
    accounts: new Map(),
    journalEntries: new Map(),
    journalLines: new Map(),
    journalSequences: new Map(),
    costCenters: new Map(),
    auditEvents: new Map(),
    idempotencyRecords: new Map(),
  };
}

export function matchesFilter(item: any, where: any, state?: FarmState): boolean {
  if (!where) return true;
  for (const [key, filter] of Object.entries(where)) {
    if (key === 'OR' && Array.isArray(filter)) {
      if (!filter.some(cond => matchesFilter(item, cond, state))) return false;
      continue;
    }
    if (key === 'AND' && Array.isArray(filter)) {
      if (!filter.every(cond => matchesFilter(item, cond, state))) return false;
      continue;
    }
    if (key === 'NOT') {
      if (matchesFilter(item, filter, state)) return false;
      continue;
    }

    // Relation filters
    if (key === 'animal' && state && item.animalId) {
      const related = state.animals.get(item.animalId);
      if (!related || !matchesFilter(related, filter, state)) return false;
      continue;
    }
    if (key === 'barn' && state && item.barnId) {
      const related = state.barns.get(item.barnId);
      if (!related || !matchesFilter(related, filter, state)) return false;
      continue;
    }
    if (key === 'farm' && state && item.farmId) {
      const related = state.farms.get(item.farmId);
      if (!related || !matchesFilter(related, filter, state)) return false;
      continue;
    }
    if (key === 'fiscalYear' && state && item.fiscalYearId) {
      const related = state.fiscalYears.get(item.fiscalYearId);
      if (!related || !matchesFilter(related, filter, state)) return false;
      continue;
    }
    if (key === 'journalEntry' && state && item.journalEntryId) {
      const related = state.journalEntries.get(item.journalEntryId);
      if (!related || !matchesFilter(related, filter, state)) return false;
      continue;
    }

    const val = item[key];

    if (filter && typeof filter === 'object' && !(filter instanceof Date)) {
      if ('equals' in filter && val !== filter.equals) return false;
      if ('not' in filter && val === filter.not) return false;
      if ('in' in filter && (!Array.isArray(filter.in) || !filter.in.includes(val))) return false;
      if ('notIn' in filter && Array.isArray(filter.notIn) && filter.notIn.includes(val)) return false;

      const toTime = (v: any) => (v instanceof Date ? v.getTime() : typeof v === 'string' && !isNaN(Date.parse(v)) ? new Date(v).getTime() : null);
      const valTime = toTime(val);

      if ('gt' in filter) {
        const filterTime = toTime(filter.gt);
        if (valTime !== null && filterTime !== null) {
          if (!(valTime > filterTime)) return false;
        } else if (!(val > filter.gt)) return false;
      }
      if ('gte' in filter) {
        const filterTime = toTime(filter.gte);
        if (valTime !== null && filterTime !== null) {
          if (!(valTime >= filterTime)) return false;
        } else if (!(val >= filter.gte)) return false;
      }
      if ('lt' in filter) {
        const filterTime = toTime(filter.lt);
        if (valTime !== null && filterTime !== null) {
          if (!(valTime < filterTime)) return false;
        } else if (!(val < filter.lt)) return false;
      }
      if ('lte' in filter) {
        const filterTime = toTime(filter.lte);
        if (valTime !== null && filterTime !== null) {
          if (!(valTime <= filterTime)) return false;
        } else if (!(val <= filter.lte)) return false;
      }
      if ('contains' in filter) {
        if (!String(val || '').toLowerCase().includes(String(filter.contains).toLowerCase())) return false;
      }
      if ('startsWith' in filter) {
        if (!String(val || '').startsWith(String(filter.startsWith))) return false;
      }
      if (item[key] && typeof item[key] === 'object' && !('equals' in filter || 'in' in filter || 'gt' in filter || 'gte' in filter || 'lt' in filter || 'lte' in filter)) {
        if (!matchesFilter(item[key], filter, state)) return false;
      }
      continue;
    }

    if (filter instanceof Date) {
      const itemDate = val instanceof Date ? val.getTime() : new Date(val).getTime();
      if (itemDate !== filter.getTime()) return false;
      continue;
    }

    if (val !== filter) return false;
  }
  return true;
}

export function createMockPrismaClient(state: FarmState): any {
  let counter = 1;
  const genId = (prefix: string) => `${prefix}-${counter++}`;

  const populateIncludes = (item: any, include: any) => {
    if (!item || !include) return item;
    const copy = { ...item };
    if (include.barn && copy.barnId) copy.barn = state.barns.get(copy.barnId) || null;
    if (include.mother && copy.motherId) copy.mother = state.animals.get(copy.motherId) || null;
    if (include.children) copy.children = Array.from(state.animals.values()).filter(a => a.motherId === copy.id);
    if (include.animal && copy.animalId) copy.animal = state.animals.get(copy.animalId) || null;
    if (include.journalEntry && copy.journalEntryId) copy.journalEntry = state.journalEntries.get(copy.journalEntryId) || null;
    if (include.lines) copy.lines = Array.from(state.journalLines.values()).filter(l => l.journalEntryId === copy.id);
    if (include.healthTreatments) copy.healthTreatments = Array.from(state.healthTreatments.values()).filter(h => h.animalId === copy.id);
    if (include.weightLogs) copy.weightLogs = Array.from(state.weightLogs.values()).filter(w => w.animalId === copy.id);
    if (include.breedingRecords) copy.breedingRecords = Array.from(state.breedingRecords.values()).filter(b => b.animalId === copy.id);
    if (include.milkLogs) {
      const logsWhere = typeof include.milkLogs === 'object' && include.milkLogs.where ? include.milkLogs.where : {};
      let logs = Array.from(state.milkLogs.values()).filter(m => m.animalId === copy.id && matchesFilter(m, logsWhere, state));
      if (typeof include.milkLogs === 'object' && include.milkLogs.take) logs = logs.slice(0, include.milkLogs.take);
      copy.milkLogs = logs;
    }
    if (include.periods) {
      const periodsWhere = typeof include.periods === 'object' && include.periods.where ? include.periods.where : {};
      copy.periods = Array.from(state.fiscalPeriods.values()).filter(
        p => p.fiscalYearId === copy.id && matchesFilter(p, periodsWhere, state)
      );
    }
    if (include.account && copy.accountId) copy.account = state.accounts.get(copy.accountId) || null;
    if (include.fiscalYear && copy.fiscalYearId) copy.fiscalYear = state.fiscalYears.get(copy.fiscalYearId) || null;
    if (include.fiscalPeriod && copy.fiscalPeriodId) copy.fiscalPeriod = state.fiscalPeriods.get(copy.fiscalPeriodId) || null;
    if (include._count && include._count.select) {
      copy._count = {};
      if (include._count.select.milkLogs) {
        copy._count.milkLogs = Array.from(state.milkLogs.values()).filter(m => m.animalId === copy.id).length;
      }
      if (include._count.select.weightLogs) {
        copy._count.weightLogs = Array.from(state.weightLogs.values()).filter(w => w.animalId === copy.id).length;
      }
      if (include._count.select.breedingRecords) {
        copy._count.breedingRecords = Array.from(state.breedingRecords.values()).filter(b => b.animalId === copy.id).length;
      }
      if (include._count.select.healthTreatments) {
        copy._count.healthTreatments = Array.from(state.healthTreatments.values()).filter(h => h.animalId === copy.id).length;
      }
      if (include._count.select.animals) {
        copy._count.animals = Array.from(state.animals.values()).filter(a => a.barnId === copy.id).length;
      }
    }
    return copy;
  };

  const getDefaults = (mapName: keyof FarmState) => {
    switch (mapName) {
      case 'animals':
        return {
          status: AnimalStatus.ACTIVE,
          species: Species.CATTLE,
          gender: Gender.FEMALE,
          purpose: Purpose.DAIRY,
          currentLifeStage: LifeStage.CALF,
          withdrawalEndDate: null,
        };
      case 'barns':
        return { currentOccupancy: 0 };
      case 'milkLogs':
        return { isDiscarded: false, discardReason: null };
      case 'bulkTankLogs':
        return { calfFeedingLiters: 0, wastedLiters: 0 };
      case 'farms':
        return { milkPolicy: MilkInventoryPolicy.CARRY_OVER };
      case 'accounts':
        return { currentBalance: 0, isSystemLocked: false, isActive: true };
      case 'journalEntries':
        return { status: JournalEntryStatus.POSTED };
      default:
        return {};
    }
  };

  const createTableApi = (mapName: keyof FarmState, idPrefix: string) => ({
    findFirst: async ({ where, include, select, orderBy }: any = {}) => {
      let all = Array.from(state[mapName].values()).filter(item => matchesFilter(item, where, state));
      if (orderBy) {
        const orderArr = Array.isArray(orderBy) ? orderBy : [orderBy];
        all.sort((a, b) => {
          for (const order of orderArr) {
            const orderKey = Object.keys(order)[0];
            const dir = order[orderKey];
            const av = a[orderKey] instanceof Date ? a[orderKey].getTime() : a[orderKey];
            const bv = b[orderKey] instanceof Date ? b[orderKey].getTime() : b[orderKey];
            if (av !== bv) {
              if (dir === 'desc') return av < bv ? 1 : -1;
              return av > bv ? 1 : -1;
            }
          }
          return 0;
        });
      }
      if (!all.length) return null;
      return populateIncludes(all[0], include || select);
    },
    findUnique: async ({ where, include, select }: any = {}) => {
      const inc = include || select;
      if (where.id) return populateIncludes(state[mapName].get(where.id) || null, inc);
      if (where.farmId_code) {
        const item = Array.from(state[mapName].values()).find(
          (i: any) => i.farmId === where.farmId_code.farmId && i.code === where.farmId_code.code
        );
        return populateIncludes(item || null, inc);
      }
      if (where.farmId_fiscalYearId) {
        const item = Array.from(state[mapName].values()).find(
          (i: any) => i.farmId === where.farmId_fiscalYearId.farmId && i.fiscalYearId === where.farmId_fiscalYearId.fiscalYearId
        );
        return populateIncludes(item || null, inc);
      }
      if (where.farmId_yearName) {
        const item = Array.from(state[mapName].values()).find(
          (i: any) => i.farmId === where.farmId_yearName.farmId && i.yearName === where.farmId_yearName.yearName
        );
        return populateIncludes(item || null, inc);
      }
      if (where.orgId_key) {
        const item = Array.from(state[mapName].values()).find(
          (i: any) => i.orgId === where.orgId_key.orgId && i.key === where.orgId_key.key
        );
        return populateIncludes(item || null, inc);
      }
      const found = Array.from(state[mapName].values()).find(item => matchesFilter(item, where, state));
      return populateIncludes(found || null, inc);
    },
    findMany: async ({ where, include, select, orderBy, take }: any = {}) => {
      let items = Array.from(state[mapName].values()).filter(item => matchesFilter(item, where, state));
      if (orderBy) {
        const orderArr = Array.isArray(orderBy) ? orderBy : [orderBy];
        items.sort((a, b) => {
          for (const order of orderArr) {
            const orderKey = Object.keys(order)[0];
            const dir = order[orderKey];
            const av = a[orderKey] instanceof Date ? a[orderKey].getTime() : a[orderKey];
            const bv = b[orderKey] instanceof Date ? b[orderKey].getTime() : b[orderKey];
            if (av !== bv) {
              if (dir === 'desc') return av < bv ? 1 : -1;
              return av > bv ? 1 : -1;
            }
          }
          return 0;
        });
      }
      if (take) items = items.slice(0, take);
      return items.map(it => populateIncludes(it, include || select));
    },
    create: async ({ data, include }: any = {}) => {
      const id = data.id || genId(idPrefix);
      const defaults = getDefaults(mapName);
      const row = { id, ...defaults, ...data, createdAt: new Date(), updatedAt: new Date() };
      if (data.lines && data.lines.create && Array.isArray(data.lines.create)) {
        for (const line of data.lines.create) {
          const lineId = genId('line');
          state.journalLines.set(lineId, { id: lineId, journalEntryId: id, ...line });
        }
      }
      state[mapName].set(id, row);
      return populateIncludes(row, include);
    },
    createMany: async ({ data, skipDuplicates }: any = {}) => {
      const list = Array.isArray(data) ? data : [data];
      let count = 0;
      for (const item of list) {
        if (skipDuplicates) {
          if (mapName === 'fiscalPeriods') {
            const exists = Array.from(state.fiscalPeriods.values()).some(
              (p: any) => p.fiscalYearId === item.fiscalYearId && p.periodNumber === item.periodNumber
            );
            if (exists) continue;
          }
          if (mapName === 'accounts') {
            const exists = Array.from(state.accounts.values()).some(
              (a: any) => a.farmId === item.farmId && a.code === item.code
            );
            if (exists) continue;
          }
        }
        const id = item.id || genId(idPrefix);
        const defaults = getDefaults(mapName);
        const row = { id, ...defaults, ...item, createdAt: new Date(), updatedAt: new Date() };
        state[mapName].set(id, row);
        count++;
      }
      return { count };
    },
    update: async ({ where, data }: any = {}) => {
      const item = where.id
        ? state[mapName].get(where.id)
        : Array.from(state[mapName].values()).find(i => matchesFilter(i, where, state));
      if (!item) throw new Error(`Item not found for update in ${String(mapName)}`);
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === 'object' && 'increment' in (v as any)) {
          item[k] = (item[k] || 0) + (v as any).increment;
        } else if (v && typeof v === 'object' && 'decrement' in (v as any)) {
          item[k] = (item[k] || 0) - (v as any).decrement;
        } else {
          item[k] = v;
        }
      }
      item.updatedAt = new Date();
      state[mapName].set(item.id, item);
      return item;
    },
    updateMany: async ({ where, data }: any = {}) => {
      let count = 0;
      for (const item of state[mapName].values()) {
        if (matchesFilter(item, where, state)) {
          Object.assign(item, data, { updatedAt: new Date() });
          count++;
        }
      }
      return { count };
    },
    upsert: async ({ where, update, create }: any = {}) => {
      const existing = await createTableApi(mapName, idPrefix).findUnique({ where });
      if (existing) {
        return createTableApi(mapName, idPrefix).update({ where: { id: existing.id }, data: update });
      }
      let flatCreate = { ...create };
      if (where.farmId_fiscalYearId) {
        flatCreate.farmId = where.farmId_fiscalYearId.farmId;
        flatCreate.fiscalYearId = where.farmId_fiscalYearId.fiscalYearId;
      }
      if (where.farmId_yearName) {
        flatCreate.farmId = where.farmId_yearName.farmId;
        flatCreate.yearName = where.farmId_yearName.yearName;
      }
      if (where.farmId_code) {
        flatCreate.farmId = where.farmId_code.farmId;
        flatCreate.code = where.farmId_code.code;
      }
      return createTableApi(mapName, idPrefix).create({ data: flatCreate });
    },
    count: async ({ where }: any = {}) => {
      return Array.from(state[mapName].values()).filter(item => matchesFilter(item, where, state)).length;
    },
    aggregate: async ({ where, _sum }: any = {}) => {
      const items = Array.from(state[mapName].values()).filter(item => matchesFilter(item, where, state));
      const res: any = { _sum: {} };
      if (_sum) {
        for (const field of Object.keys(_sum)) {
          res._sum[field] = items.reduce((acc, it) => acc + (Number(it[field]) || 0), 0);
        }
      }
      return res;
    },
    groupBy: async ({ by, where, _sum }: any = {}) => {
      const items = Array.from(state[mapName].values()).filter(item => matchesFilter(item, where, state));
      const groups = new Map<string, any>();
      for (const item of items) {
        const groupKey = by.map((k: string) => item[k]).join(':::');
        if (!groups.has(groupKey)) {
          const entry: any = {};
          for (const k of by) entry[k] = item[k];
          if (_sum) {
            entry._sum = {};
            for (const s of Object.keys(_sum)) entry._sum[s] = 0;
          }
          groups.set(groupKey, entry);
        }
        const g = groups.get(groupKey);
        if (_sum) {
          for (const s of Object.keys(_sum)) {
            g._sum[s] = (g._sum[s] || 0) + (Number(item[s]) || 0);
          }
        }
      }
      return Array.from(groups.values());
    },
  });

  const txClient: any = {
    farm: createTableApi('farms', 'farm'),
    barn: createTableApi('barns', 'barn'),
    animal: createTableApi('animals', 'animal'),
    breedingRecord: createTableApi('breedingRecords', 'breed'),
    pregnancyCheck: createTableApi('pregnancyChecks', 'preg'),
    birthRecord: createTableApi('birthRecords', 'birth'),
    milkLog: createTableApi('milkLogs', 'milk'),
    bulkTankLog: createTableApi('bulkTankLogs', 'tank'),
    healthTreatment: createTableApi('healthTreatments', 'treat'),
    weightLog: createTableApi('weightLogs', 'weight'),
    commercialSale: createTableApi('commercialSales', 'sale'),
    animalMortality: createTableApi('animalMortalities', 'mort'),
    fiscalYear: createTableApi('fiscalYears', 'year'),
    fiscalPeriod: createTableApi('fiscalPeriods', 'period'),
    account: createTableApi('accounts', 'acc'),
    journalEntry: createTableApi('journalEntries', 'jv'),
    journalLine: createTableApi('journalLines', 'jl'),
    journalEntryLine: createTableApi('journalLines', 'jl'),
    journalSequence: createTableApi('journalSequences', 'seq'),
    costCenter: createTableApi('costCenters', 'cc'),
    auditEvent: createTableApi('auditEvents', 'audit'),
    idempotencyRecord: createTableApi('idempotencyRecords', 'idem'),
    $queryRaw: async (sqlObj: any, ...args: any[]) => {
      const sqlText = sqlObj && sqlObj.strings ? sqlObj.strings.join('?') : String(sqlObj || '');
      const values = sqlObj && sqlObj.values ? sqlObj.values : args;

      if (sqlText.includes('idempotency_records')) {
        if (sqlText.includes('INSERT INTO')) {
          const [recordId, orgId, farmId, actorUserId, key, requestHash, method, path, executionToken, expiresAt] = values;
          const existing = Array.from(state.idempotencyRecords.values()).find((r: any) => r.orgId === orgId && r.key === key);
          if (existing) {
            return [];
          }
          const rec = {
            id: recordId,
            orgId,
            farmId,
            actorUserId,
            key,
            requestHash,
            method,
            path,
            status: 'PROCESSING',
            executionToken,
            responseBody: null,
            expiresAt,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          state.idempotencyRecords.set(recordId, rec);
          return [rec];
        }
        if (sqlText.includes('SELECT * FROM')) {
          const [orgId, key] = values;
          const found = Array.from(state.idempotencyRecords.values()).find((r: any) => r.orgId === orgId && r.key === key);
          return found ? [found] : [];
        }
      }
      return [];
    },
  };

  let txQueue = Promise.resolve();

  const prisma: any = {
    ...txClient,
    $transaction: async (callback: any, options?: any) => {
      return new Promise((resolve, reject) => {
        txQueue = txQueue.then(async () => {
          try {
            if (typeof callback === 'function') {
              const res = await callback(txClient);
              resolve(res);
            } else if (Array.isArray(callback)) {
              const results = [];
              for (const op of callback) results.push(await op);
              resolve(results);
            }
          } catch (err) {
            reject(err);
          }
        }).catch(reject);
      });
    },
    $connect: async () => {},
    $disconnect: async () => {},
  };

  return { prisma, txClient };
}

export async function seedTestAccounts(prisma: any, farmId: string, farmName = 'مزرعة السرايا النموذجية') {
  await prisma.farm.create({
    data: {
      id: farmId,
      orgId: 'org-test',
      name: farmName,
      milkPolicy: MilkInventoryPolicy.CARRY_OVER,
    },
  });

  const initialAccountCodes = [
    { code: '1101', name: 'الخزينة النقدية الرئيسية', category: AccountCategory.ASSET },
    { code: '1102', name: 'الحساب البنكي للمزرعة', category: AccountCategory.ASSET },
    { code: '1103', name: 'العملاء ومدينو المبيعات', category: AccountCategory.ASSET },
    { code: '1104', name: 'مخزون الأعلاف', category: AccountCategory.ASSET },
    { code: '1201', name: 'الأصول البيولوجية - قطيع الألبان', category: AccountCategory.ASSET },
    { code: '1202', name: 'الأصول البيولوجية - قطيع التسمين', category: AccountCategory.ASSET },
    { code: '1203', name: 'الأصول البيولوجية - العجول والمواليد', category: AccountCategory.ASSET },
    { code: '2101', name: 'الموردون والدائنون', category: AccountCategory.LIABILITY },
    { code: '3101', name: 'رأس مال المزرعة', category: AccountCategory.EQUITY },
    { code: '4101', name: 'إيرادات مبيعات الحليب', category: AccountCategory.REVENUE },
    { code: '4102', name: 'إيرادات مبيعات الماشية الحية', category: AccountCategory.REVENUE },
    { code: '4103', name: 'إيرادات الأسمدة العضوية', category: AccountCategory.REVENUE },
    { code: '5101', name: 'تكلفة استهلاك الأعلاف', category: AccountCategory.EXPENSE },
    { code: '5102', name: 'مصروفات الرعاية البيطرية', category: AccountCategory.EXPENSE },
    { code: '5105', name: 'خسائر نفوق واستبعاد الماشية', category: AccountCategory.EXPENSE },
    { code: '5106', name: 'القيمة الدفترية للماشية المباعة', category: AccountCategory.EXPENSE },
  ];

  const accounts: Record<string, string> = {};
  for (const a of initialAccountCodes) {
    const acc = await prisma.account.create({
      data: {
        farmId,
        code: a.code,
        name: a.name,
        category: a.category,
        currentBalance: 0,
        isActive: true,
      },
    });
    accounts[a.code] = acc.id;
  }

  const year = await prisma.fiscalYear.create({
    data: {
      farmId,
      yearName: '2026',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T23:59:59.999Z'),
      status: FiscalStatus.OPEN,
      isCurrent: true,
    },
  });

  for (let m = 0; m < 12; m++) {
    const start = new Date(Date.UTC(2026, m, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(2026, m + 1, 0, 23, 59, 59, 999));
    await prisma.fiscalPeriod.create({
      data: {
        fiscalYearId: year.id,
        periodNumber: m + 1,
        periodName: `شهر ${m + 1} - 2026`,
        startDate: start,
        endDate: end,
        status: FiscalStatus.OPEN,
      },
    });
  }

  await prisma.costCenter.create({
    data: { farmId, code: 'CC-DAIRY', name: 'قطاع إنتاج الألبان', type: 'DAIRY_PRODUCTION' },
  });
  await prisma.costCenter.create({
    data: { farmId, code: 'CC-FATTENING', name: 'قطاع التسمين', type: 'FATTENING_PRODUCTION' },
  });

  return { accounts, yearId: year.id };
}

export function buildServices(prisma: any) {
  const animalsService = new AnimalsService(prisma);
  const breedingService = new BreedingService(prisma);
  const milkingService = new MilkingService(prisma);
  const healthService = new HealthService(prisma);
  const salesService = new SalesService(prisma);
  const barnsService = new BarnsService(prisma);
  const accountingService = new AccountingService(prisma);
  const rationService = new RationService(prisma);

  return {
    animalsService,
    breedingService,
    milkingService,
    healthService,
    salesService,
    barnsService,
    accountingService,
    rationService,
  };
}
