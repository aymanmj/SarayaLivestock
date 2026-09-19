import { 
  Animal,
  AnimalDetail,
  DashboardData, 
  BreedingRecord, 
  BreedingTasks,
  QuarantinedAnimal,
  Species,
  Gender,
  Purpose,
  LifeStage,
  MilkingShift,
  InseminationType,
  PregnancyResult,
  FinancialOverviewData,
  CullingCandidate,
  FeedIngredient,
  FeedFormula,
  FeedDistribution,
  BarnSummary
} from './types';
import {
  clearAuthentication,
  desktopClientHeaders,
  getAccessToken,
  getStoredRefreshToken,
  storeAuthentication,
} from '../auth/session';
import createClient from 'openapi-fetch';
import type { components, operations, paths } from './generated/schema';

const desktopRuntimeApi = (window as typeof window & { electronAPI?: { apiBaseUrl?: string } }).electronAPI?.apiBaseUrl;
export const API_BASE_URL = (desktopRuntimeApi || import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');
const browserOrigin = window.location.origin === 'null' ? '' : window.location.origin;
const API_ORIGIN = API_BASE_URL.startsWith('http')
  ? API_BASE_URL.replace(/\/api\/v1$/, '')
  : browserOrigin;

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export type AuthenticationResponse = components['schemas']['AuthenticationResponseDto'];

let refreshInFlight: Promise<AuthenticationResponse | null> | null = null;
const IDEMPOTENCY_STORAGE_KEY = 'saraya.pending-idempotency.v1';
const IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

interface PendingIdempotencyEntry {
  key: string;
  createdAt: number;
}

export async function loginSession(username: string, password: string): Promise<AuthenticationResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...desktopClientHeaders() },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'بيانات الدخول غير صحيحة');
  await storeAuthentication(data.accessToken, data.refreshToken);
  return data;
}

export async function refreshSession(): Promise<AuthenticationResponse | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = await getStoredRefreshToken();
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...desktopClientHeaders() },
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    });
    if (!response.ok) {
      if (response.status === 401) {
        await clearAuthentication();
      }
      return null;
    }
    const data = (await response.json()) as AuthenticationResponse;
    await storeAuthentication(data.accessToken, data.refreshToken);
    return data;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function getUserProfile() {
  const response = await apiFetch('/api/v1/auth/profile', { method: 'GET' });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'تعذر استعادة جلسة المستخدم');
  }
  return response.json();
}

export async function logoutSession() {
  const refreshToken = await getStoredRefreshToken();
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...desktopClientHeaders() },
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    });
  } finally {
    await clearAuthentication();
  }
}

export async function apiFetch(input: RequestInfo | URL, options: RequestInit = {}): Promise<Response> {
  const endpoint = input instanceof Request ? input.url : input.toString();
  const url = endpoint.startsWith('http')
    ? endpoint
    : endpoint.startsWith('/api/v1')
      ? `${API_ORIGIN}${endpoint}`
      : API_BASE_URL.startsWith('http')
        ? `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
        : `${browserOrigin}${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const initialHeaders = new Headers(input instanceof Request ? input.headers : options.headers || {});
  if (!(input instanceof Request) && options.body && !initialHeaders.has('Content-Type')) {
    initialHeaders.set('Content-Type', 'application/json');
  }
  const sourceRequest = input instanceof Request
    ? new Request(input, { ...options, headers: initialHeaders, credentials: 'include' })
    : new Request(url, { ...options, headers: initialHeaders, credentials: 'include' });
  const token = getAccessToken();
  const headers = new Headers(sourceRequest.headers);

  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const requestBody = ['GET', 'HEAD'].includes(sourceRequest.method)
    ? null
    : await sourceRequest.clone().text();
  const pending = await prepareIdempotency(url, sourceRequest.method, requestBody);
  if (pending) headers.set('Idempotency-Key', pending.key);

  const request = new Request(sourceRequest, { headers, credentials: 'include' });
  const retryRequest = request.clone();

  let response = await fetch(request);
  if (response.status === 401 && !url.includes('/auth/refresh')) {
    const refreshed = await refreshSession();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
      response = await fetch(new Request(retryRequest, { headers, credentials: 'include' }));
    }
  }
  if (pending && response.status < 500 && response.status !== 408) {
    removePendingIdempotency(pending.fingerprint);
  }
  if (response.status === 401) {
    await clearAuthentication();
    window.dispatchEvent(new Event('saraya:unauthorized'));
  }
  return response;
}

export interface ExecuteSyncTaskParams {
  url: string;
  method: string;
  body?: unknown;
  idempotencyKey?: string;
}

export interface ExecuteSyncTaskResult {
  ok: boolean;
  status: number;
  shouldRetry: boolean;
}

export async function executeSyncTask(params: ExecuteSyncTaskParams): Promise<ExecuteSyncTaskResult> {
  const token = getAccessToken();
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (params.idempotencyKey) headers.set('Idempotency-Key', params.idempotencyKey);

  const fullUrl = params.url.startsWith('http') ? params.url : `${API_ORIGIN}${params.url}`;

  try {
    let response = await fetch(fullUrl, {
      method: params.method,
      headers,
      body: params.body !== undefined ? JSON.stringify(params.body) : undefined,
    });

    if (response.status === 401 && !fullUrl.includes('/auth/refresh')) {
      const refreshed = await refreshSession();
      if (refreshed) {
        headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
        response = await fetch(fullUrl, {
          method: params.method,
          headers,
          body: params.body !== undefined ? JSON.stringify(params.body) : undefined,
        });
      }
    }

    const isClientError = response.status >= 400 && response.status < 500 && response.status !== 408;
    return {
      ok: response.ok,
      status: response.status,
      shouldRetry: !response.ok && !isClientError,
    };
  } catch (_error) {
    return {
      ok: false,
      status: 0,
      shouldRetry: true,
    };
  }
}

export const generatedApiClient = createClient<paths>({
  baseUrl: API_ORIGIN,
  fetch: apiFetch,
  credentials: 'include',
});

type GeneratedApiResult<T> = {
  data?: T;
  error?: unknown;
  response: Response;
};

export function unwrapGenerated<T>(result: GeneratedApiResult<T>, operation: string): T {
  if (!result.response.ok || result.error !== undefined) {
    const error = result.error as { message?: string | string[] } | undefined;
    const message = Array.isArray(error?.message) ? error.message.join('، ') : error?.message;
    throw new Error(message || `خطأ في الخادم أثناء ${operation}: ${result.response.statusText}`);
  }
  if (result.data === undefined) throw new Error(`لم يُرجع الخادم بيانات أثناء ${operation}`);
  return result.data;
}

async function prepareIdempotency(endpoint: string, method: string, rawBody: string | null) {
  method = method.toUpperCase();
  if (!requiresIdempotency(method, endpoint)) return null;

  const body = canonicalRequestBody(rawBody);
  const identity = accessTokenIdentity();
  const requestPath = new URL(endpoint, API_ORIGIN || 'http://local.invalid').pathname.replace(/^\/api\/v1/, '') || '/';
  const fingerprint = await sha256(`${identity}\n${method}\n${requestPath}\n${body}`);
  const entries = readPendingIdempotency();
  const existing = entries[fingerprint];
  if (existing) return { fingerprint, key: existing.key };

  const key = crypto.randomUUID();
  entries[fingerprint] = { key, createdAt: Date.now() };
  writePendingIdempotency(entries);
  return { fingerprint, key };
}

function requiresIdempotency(method: string, endpoint: string) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return false;
  const path = endpoint.startsWith('http') ? new URL(endpoint).pathname : endpoint.split('?')[0];
  return !path.includes('/auth/')
    && !path.endsWith('/license/activate')
    && !path.endsWith('/nutrition/formulate-least-cost');
}

function canonicalRequestBody(body: string | null): string {
  if (typeof body !== 'string') return body ? String(body) : 'null';
  try {
    return canonicalJson(JSON.parse(body));
  } catch {
    return body;
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function accessTokenIdentity() {
  const token = getAccessToken();
  if (!token) return 'anonymous';
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return `${payload.orgId || 'unknown-org'}:${payload.sub || 'unknown-user'}`;
  } catch {
    return 'authenticated';
  }
}

function readPendingIdempotency(): Record<string, PendingIdempotencyEntry> {
  try {
    const parsed = JSON.parse(localStorage.getItem(IDEMPOTENCY_STORAGE_KEY) || '{}') as Record<string, PendingIdempotencyEntry>;
    const cutoff = Date.now() - IDEMPOTENCY_RETENTION_MS;
    return Object.fromEntries(Object.entries(parsed).filter(([, entry]) =>
      typeof entry?.key === 'string' && Number.isFinite(entry.createdAt) && entry.createdAt >= cutoff,
    ));
  } catch {
    return {};
  }
}

function writePendingIdempotency(entries: Record<string, PendingIdempotencyEntry>) {
  try {
    localStorage.setItem(IDEMPOTENCY_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // The request remains safe for this attempt even when durable browser storage is unavailable.
  }
}

function removePendingIdempotency(fingerprint: string) {
  const entries = readPendingIdempotency();
  delete entries[fingerprint];
  writePendingIdempotency(entries);
}

// ----------------------------------------------------
// 1. التقارير ولوحة القيادة التنفيذية (Dashboard & Reports)
// ----------------------------------------------------
export async function getDashboardData(_farmId?: string): Promise<DashboardData> {
  return unwrapGenerated(
    await generatedApiClient.GET('/api/v1/reports/executive-dashboard'),
    'تحميل لوحة المؤشرات',
  );
}

// ----------------------------------------------------
// 2. سجل القطيع والماشية (Animals & Herd)
// ----------------------------------------------------
export interface CreateAnimalPayload {
  barnId?: string;
  tagNumber: string;
  rfidTag?: string;
  name?: string;
  species: Species;
  breed: string;
  gender: Gender;
  purpose: Purpose;
  currentLifeStage: LifeStage;
  birthDate?: string;
  entryWeightKg?: number;
  purchasePrice?: number;
  motherId?: string;
  fatherSemenCode?: string;
}

export async function getAnimals(params?: { search?: string; status?: string; barnId?: string }): Promise<Animal[]> {
  return unwrapGenerated(await generatedApiClient.GET('/api/v1/animals', {
    params: { query: params as operations['Animals_findAll']['parameters']['query'] },
  }), 'تحميل سجل القطيع');
}

export async function getBarns(): Promise<BarnSummary[]> {
  return [...unwrapGenerated(await generatedApiClient.GET('/api/v1/barns'), 'تحميل الحظائر')];
}

export async function getAnimalById(id: string): Promise<AnimalDetail> {
  return unwrapGenerated(await generatedApiClient.GET('/api/v1/animals/{id}', {
    params: { path: { id } },
  }), 'تحميل الحيوان');
}

export async function createAnimal(payload: CreateAnimalPayload): Promise<Animal> {
  const body: components['schemas']['CreateAnimalDto'] = payload;
  return unwrapGenerated(await generatedApiClient.POST('/api/v1/animals', { body }), 'إنشاء الحيوان');
}

export async function updateAnimalStatus(
  id: string,
  payload: {
    status: 'ACTIVE' | 'SOLD' | 'CULLED' | 'DECEASED' | 'QUARANTINED';
    notes?: string;
  }
) {
  return unwrapGenerated(await generatedApiClient.PATCH('/api/v1/animals/{id}/status', {
    params: { path: { id } },
    body: payload,
  }), 'تحديث حالة الحيوان');
}

export async function updateAnimalLifeStage(
  id: string,
  stage: LifeStage,
) {
  return unwrapGenerated(await generatedApiClient.PATCH('/api/v1/animals/{id}/life-stage', {
    params: { path: { id } },
    body: { stage },
  }), 'تحديث مرحلة الحيوان');
}

export async function recordDryOff(id: string) {
  return unwrapGenerated(await generatedApiClient.POST('/api/v1/breeding/{id}/dry-off', {
    params: { path: { id } },
  }), 'تسجيل التجفيف');
}

export async function getAnimalBookValue(id: string, date: string) {
  return unwrapGenerated(await generatedApiClient.GET('/api/v1/sales/animals/{id}/book-value', {
    params: { path: { id }, query: { date } },
  }), 'تحميل القيمة الدفترية');
}

// ----------------------------------------------------
// 3. محطة الحلب والإنتاج (Milking Station)
// ----------------------------------------------------
export interface LogMilkPayload {
  animalId: string;
  logDate: string;
  shift: MilkingShift;
  yieldLiters: number;
  fatPct?: number;
  proteinPct?: number;
  isDiscarded?: boolean;
  discardReason?: string;
}

export async function logMilkingSession(payload: LogMilkPayload): Promise<components['schemas']['RecordMilkResponseDto']> {
  const body: components['schemas']['LogMilkDto'] = payload;
  return unwrapGenerated(await generatedApiClient.POST('/api/v1/milking/log', { body }), 'تسجيل الحليب');
}

export async function getMilkingDailySummary(
  _farmId?: string,
  date?: string,
): Promise<components['schemas']['DailyMilkingSummaryResponseDto']> {
  return unwrapGenerated(await generatedApiClient.GET('/api/v1/milking/daily-summary', {
    params: { query: { date } },
  }), 'تحميل ملخص الحليب');
}

// ----------------------------------------------------
// 4. التناسل والولادات (Breeding & Calving)
// ----------------------------------------------------
export interface FarmData {
  id: string;
  name: string;
  location?: string | null;
  managerName?: string | null;
  phone?: string | null;
  orgId?: string;
  licenseKey?: string | null;
}

export async function getCurrentFarm(): Promise<FarmData> {
  const response = await apiFetch('/api/v1/farms/current', { method: 'GET' });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'تعذر تحميل بيانات المزرعة');
  }
  return response.json();
}

export const updateFarm = async (id: string, data: Partial<Omit<FarmData, 'id'>>): Promise<FarmData> => {
  const path = id && id !== 'current' ? `/api/v1/farms/${encodeURIComponent(id)}` : '/api/v1/farms/current';
  const response = await apiFetch(path, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = Array.isArray(errorData.message) ? errorData.message.join('، ') : errorData.message;
    throw new Error(message || 'تعذر تحديث بيانات المزرعة');
  }
  return response.json();
};

export interface InseminatePayload {
  animalId: string;
  inseminationDate: string;
  inseminationType: InseminationType;
  semenStrawCode?: string;
  sireName?: string;
  technicianName?: string;
}

export async function recordInsemination(payload: InseminatePayload): Promise<BreedingRecord> {
  const body: components['schemas']['InseminateDto'] = {
    animalId: payload.animalId,
    inseminationDate: payload.inseminationDate,
    inseminationType: payload.inseminationType,
    semenCode: payload.semenStrawCode,
    inseminatorName: payload.technicianName,
  };
  return unwrapGenerated(
    await generatedApiClient.POST('/api/v1/breeding/inseminate', { body }),
    'تسجيل التلقيح',
  );
}

export async function recordPdResult(id: string, result: PregnancyResult): Promise<BreedingRecord> {
  return unwrapGenerated(await generatedApiClient.PATCH('/api/v1/breeding/{id}/pd-result', {
    params: { path: { id } },
    body: { result },
  }), 'تسجيل فحص الحمل');
}

export async function recordCalving(
  id: string,
  payload: {
    actualCalvingDate: string;
    offspringTagNumber: string;
    offspringGender: Gender;
    offspringWeightKg?: number;
    calvingDifficulty?: 'EASY' | 'ASSISTED' | 'SURGICAL' | 'ABORTION';
    notes?: string;
    twins?: Array<{
      tagNumber: string;
      gender: Gender;
      weightKg?: number;
    }>;
  }
) {
  return unwrapGenerated(await generatedApiClient.POST('/api/v1/breeding/{id}/calving', {
    params: { path: { id } },
    body: payload as any,
  }), 'تسجيل الولادة');
}

export async function getBreedingTasks(_farmId?: string): Promise<BreedingTasks> {
  return unwrapGenerated(
    await generatedApiClient.GET('/api/v1/breeding/upcoming-tasks'),
    'تحميل مهام التناسل',
  );
}

// ----------------------------------------------------
// 5. التسمين والنمو (Fattening & Weight)
// ----------------------------------------------------
export interface RecordWeightPayload {
  animalId: string;
  weighDate?: string;
  weightKg: number;
}

export async function recordWeight(payload: RecordWeightPayload): Promise<components['schemas']['RecordedWeightResponseDto']> {
  const body: components['schemas']['RecordWeightDto'] = {
    ...payload,
    weighDate: payload.weighDate || new Date().toISOString().split('T')[0],
  };
  return unwrapGenerated(
    await generatedApiClient.POST('/api/v1/fattening/weight', { body }),
    'تسجيل الوزن',
  );
}

export async function getFatteningPerformance(_farmId?: string) {
  return unwrapGenerated(await generatedApiClient.GET('/api/v1/fattening/performance'), 'تحميل أداء التسمين');
}

// ----------------------------------------------------
// 6. السجل البيطري وصمام الأمان (Health & Safety)
// ----------------------------------------------------
export interface RecordTreatmentPayload {
  animalId: string;
  diagnosis: string;
  drugName: string;
  dosage?: string;
  withdrawalDays: number;
  treatedBy?: string;
  notes?: string;
}

export async function recordTreatment(
  payload: RecordTreatmentPayload,
): Promise<components['schemas']['RecordTreatmentResponseDto']> {
  const body: components['schemas']['CreateTreatmentDto'] = {
    animalId: payload.animalId,
    diagnosis: payload.diagnosis,
    drugName: payload.drugName,
    dosage: payload.dosage || 'غير محدد',
    treatmentDate: new Date().toISOString().split('T')[0],
    milkWithdrawalDays: payload.withdrawalDays,
    meatWithdrawalDays: payload.withdrawalDays,
    vetName: payload.treatedBy,
    notes: payload.notes,
  };
  return unwrapGenerated(
    await generatedApiClient.POST('/api/v1/health/treatment', { body }),
    'تسجيل العلاج',
  );
}

export async function getQuarantineList(_farmId?: string): Promise<QuarantinedAnimal[]> {
  return unwrapGenerated(
    await generatedApiClient.GET('/api/v1/health/quarantine-list'),
    'تحميل قائمة الحجر',
  );
}

// ----------------------------------------------------
// 7. إدارة التغذية ومحرك العلائق الذكي (Nutrition & Least-Cost TMR)
// ----------------------------------------------------
export interface RationIngredientInput {
  id: string;
  name: string;
  costPerKg: number;
  proteinPct: number;
  energyMcal: number;
  minInclusionPct?: number;
  maxInclusionPct?: number;
}

export interface FormulationTarget {
  targetProteinPct: number;
  batchTotalKg: number;
}

export async function calculateLeastCostRation(
  ingredients: RationIngredientInput[],
  target: FormulationTarget
): Promise<components['schemas']['LeastCostRationResponseDto']> {
  const body: components['schemas']['FormulateLeastCostDto'] = { ingredients, target };
  return unwrapGenerated(
    await generatedApiClient.POST('/api/v1/nutrition/formulate-least-cost', { body }),
    'حساب العليقة',
  );
}

export interface DispenseFeedPayload {
  barnId: string;
  formulaId: string;
  quantityKg: number;
}

export async function dispenseFeedToBarn(payload: DispenseFeedPayload) {
  const body: components['schemas']['DispenseFeedDto'] = payload;
  return unwrapGenerated(
    await generatedApiClient.POST('/api/v1/nutrition/dispense', { body }),
    'صرف العليقة',
  );
}

export async function getFeedStock(_farmId?: string): Promise<FeedIngredient[]> {
  return unwrapGenerated(await generatedApiClient.GET('/api/v1/nutrition/stock'), 'تحميل مخزون الأعلاف');
}

export async function getFeedFormulas(): Promise<FeedFormula[]> {
  return unwrapGenerated(await generatedApiClient.GET('/api/v1/nutrition/formulas'), 'تحميل العلائق');
}

export async function createFeedFormula(payload: {
  name: string;
  targetSector?: 'DAIRY' | 'BREEDING' | 'FATTENING' | 'CALVES' | 'ISOLATION';
  description?: string;
  items: { ingredientId: string; percentage: number }[];
}) {
  const body: components['schemas']['CreateFeedFormulaDto'] = payload;
  return unwrapGenerated(
    await generatedApiClient.POST('/api/v1/nutrition/formulas', { body }),
    'إنشاء العليقة',
  );
}

export async function createFeedIngredient(payload: {
  name: string;
  unit?: string;
  currentStock: number;
  minStockAlert?: number;
  costPerUnit: number;
  dryMatterPct?: number;
  proteinPct?: number;
  energyMcal?: number;
}) {
  const body: components['schemas']['CreateFeedIngredientDto'] = payload;
  return unwrapGenerated(
    await generatedApiClient.POST('/api/v1/nutrition/ingredients', { body }),
    'إنشاء مادة علفية',
  );
}

export async function updateIngredientStock(
  id: string,
  payload: { addedKg: number; costPerUnit?: number }
) {
  const body: components['schemas']['UpdateFeedStockDto'] = payload;
  return unwrapGenerated(await generatedApiClient.PATCH('/api/v1/nutrition/ingredients/{id}/stock', {
    params: { path: { id } },
    body,
  }), 'تحديث مخزون العلف');
}

export async function getFeedDistributions(_farmId?: string): Promise<FeedDistribution[]> {
  return unwrapGenerated(
    await generatedApiClient.GET('/api/v1/nutrition/distributions'),
    'تحميل توزيعات الأعلاف',
  );
}

// ----------------------------------------------------
// 8. التقارير التنفيذية والمالية واستبعاد الماشية (Reports & Finance)
// ----------------------------------------------------
export async function getFinancialOverview(_farmId?: string): Promise<FinancialOverviewData> {
  return unwrapGenerated(
    await generatedApiClient.GET('/api/v1/reports/financial-overview'),
    'تحميل الملخص المالي',
  );
}

export async function getCullingCandidates(_farmId?: string): Promise<CullingCandidate[]> {
  return unwrapGenerated(
    await generatedApiClient.GET('/api/v1/reports/culling-candidates'),
    'تحميل مرشحي الاستبعاد',
  );
}

export type ExportDataType = 'animals' | 'milking' | 'breeding' | 'nutrition' | 'culling';
export type ExportDataRow =
  | components['schemas']['AnimalRecordResponseDto']
  | components['schemas']['MilkLogWithAnimalResponseDto']
  | components['schemas']['BreedingRecordWithAnimalResponseDto']
  | components['schemas']['FeedIngredientResponseDto']
  | components['schemas']['CullingCandidateResponseDto'];

export async function getExportData(type: ExportDataType, _farmId?: string): Promise<ExportDataRow[]> {
  return unwrapGenerated(await generatedApiClient.GET('/api/v1/reports/export/{type}', {
    params: { path: { type } },
  }), 'تجهيز بيانات التصدير');
}

// ----------------------------------------------------
// 9. المبيعات التجارية ونفوق الماشية (Commercial Sales & Mortality)
// ----------------------------------------------------

export type CommercialSale = components['schemas']['CommercialSaleResponseDto'];
export type AnimalMortality = components['schemas']['AnimalMortalityResponseDto'];
export type SalesSummary = components['schemas']['SalesSummaryResponseDto'];
export type RecordMilkSalePayload = components['schemas']['RecordMilkSaleDto'];
export type RecordAnimalSalePayload = components['schemas']['RecordAnimalSaleDto'];
export type RecordMortalityPayload = components['schemas']['RecordMortalityDto'];

export async function getCommercialSales(limit = 100): Promise<CommercialSale[]> {
  return unwrapGenerated(
    await generatedApiClient.GET('/api/v1/sales', {
      params: { query: { limit } },
    }),
    'تحميل سجل المبيعات التجارية',
  );
}

export async function getSalesSummary(): Promise<SalesSummary> {
  return unwrapGenerated(
    await generatedApiClient.GET('/api/v1/sales/summary'),
    'تحميل مؤشرات المبيعات والنفوق',
  );
}

export async function getAnimalMortalities(limit = 100): Promise<AnimalMortality[]> {
  return unwrapGenerated(
    await generatedApiClient.GET('/api/v1/sales/mortality', {
      params: { query: { limit } },
    }),
    'تحميل سجل النفوق والخسائر البيولوجية',
  );
}

export async function recordMilkSale(payload: RecordMilkSalePayload): Promise<CommercialSale> {
  return unwrapGenerated(
    await generatedApiClient.POST('/api/v1/sales/milk', { body: payload }),
    'تسجيل فاتورة بيع حليب',
  );
}

export async function recordAnimalSale(payload: RecordAnimalSalePayload): Promise<CommercialSale> {
  return unwrapGenerated(
    await generatedApiClient.POST('/api/v1/sales/animal', { body: payload }),
    'تسجيل فاتورة بيع ماشية حية',
  );
}

export async function recordAnimalMortality(payload: RecordMortalityPayload): Promise<AnimalMortality> {
  return unwrapGenerated(
    await generatedApiClient.POST('/api/v1/sales/mortality', { body: payload }),
    'تسجيل واقعة نفوق واحتساب الخسارة',
  );
}

export async function getSaleById(id: string): Promise<CommercialSale> {
  return unwrapGenerated(
    await generatedApiClient.GET('/api/v1/sales/{id}', {
      params: { path: { id } },
    }),
    'تحميل تفاصيل الفاتورة',
  );
}

export type MilkPolicy = components['schemas']['MilkPolicyResponseDto'];
export type UpdateMilkPolicyPayload = components['schemas']['UpdateMilkPolicyDto'];

export async function getMilkPolicy(): Promise<MilkPolicy> {
  return unwrapGenerated(
    await generatedApiClient.GET('/api/v1/sales/milk-policy'),
    'تحميل سياسة مخزون الحليب',
  );
}

export async function updateMilkPolicy(payload: UpdateMilkPolicyPayload): Promise<MilkPolicy> {
  return unwrapGenerated(
    await generatedApiClient.PUT('/api/v1/sales/milk-policy', { body: payload }),
    'تحديث سياسة مخزون الحليب',
  );
}

// ----------------------------------------------------
// 12. شؤون الموظفين والمرتبات (HR & Payroll)
// ----------------------------------------------------

export async function getJobTitles(): Promise<string[]> {
  const response = await apiFetch('/api/v1/hr/job-titles', { method: 'GET' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'تعذر تحميل المسميات الوظيفية');
  }
  return response.json();
}

export async function createJobTitle(title: string): Promise<{ title: string }> {
  const response = await apiFetch('/api/v1/hr/job-titles', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'تعذر إضافة المسمى الوظيفي');
  }
  return response.json();
}

export async function updateJobTitle(oldTitle: string, newTitle: string): Promise<{ success: boolean }> {
  const response = await apiFetch(`/api/v1/hr/job-titles/${encodeURIComponent(oldTitle)}`, {
    method: 'PATCH',
    body: JSON.stringify({ newTitle }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'تعذر تعديل المسمى الوظيفي');
  }
  return response.json();
}

export async function deleteJobTitle(title: string): Promise<{ success: boolean }> {
  const response = await apiFetch(`/api/v1/hr/job-titles/${encodeURIComponent(title)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'تعذر حذف المسمى الوظيفي');
  }
  return response.json();
}

export async function getPayrollPeriods(): Promise<any[]> {
  const response = await apiFetch('/api/v1/hr/payroll/periods', { method: 'GET' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'تعذر تحميل فترات الرواتب');
  }
  return response.json();
}

export async function getPayrollSlips(periodId: string): Promise<any[]> {
  const response = await apiFetch(`/api/v1/hr/payroll/periods/${encodeURIComponent(periodId)}/slips`, { method: 'GET' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'تعذر تحميل قسائم الرواتب');
  }
  return response.json();
}

export async function generatePayrollPeriod(data: { monthName: string; startDate: string; endDate: string }) {
  const response = await apiFetch('/api/v1/hr/payroll/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'تعذر توليد الرواتب');
  }
  return response.json();
}

export async function approvePayrollPeriod(id: string) {
  const response = await apiFetch(`/api/v1/hr/payroll/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'تعذر اعتماد الرواتب');
  }
  return response.json();
}

export async function deletePayrollPeriodDraft(id: string) {
  const response = await apiFetch(`/api/v1/hr/payroll/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'تعذر حذف مسودة الرواتب');
  }
  return response.json();
}


