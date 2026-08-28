import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDashboardData,
  getAnimals,
  getAnimalById,
  createAnimal,
  getMilkingDailySummary,
  logMilkingSession,
  getBreedingTasks,
  recordPdResult,
  recordCalving,
  getFatteningPerformance,
  recordWeight,
  recordTreatment,
  getQuarantineList,
  getFeedStock,
  getFeedFormulas,
  dispenseFeedToBarn,
  getFinancialOverview,
  getCullingCandidates,
  type CreateAnimalPayload,
  type DispenseFeedPayload,
  type LogMilkPayload,
  type RecordTreatmentPayload,
} from './client';

// ----------------------------------------------------
// Query Keys
// ----------------------------------------------------
export const queryKeys = {
  dashboard: (farmId?: string) => ['dashboard', farmId || 'default'] as const,
  animals: (search?: string, barnId?: string) => ['animals', { search, barnId }] as const,
  animal: (id: string) => ['animal', id] as const,
  milkingSummary: (date?: string) => ['milkingSummary', date || 'today'] as const,
  breedingTasks: (farmId?: string) => ['breedingTasks', farmId || 'default'] as const,
  fattening: (farmId?: string) => ['fattening', farmId || 'default'] as const,
  quarantine: (farmId?: string) => ['quarantine', farmId || 'default'] as const,
  feedStock: (farmId?: string) => ['feedStock', farmId || 'default'] as const,
  feedFormulas: () => ['feedFormulas'] as const,
  financialOverview: (period?: string) => ['financialOverview', period || 'month'] as const,
  cullingCandidates: () => ['cullingCandidates'] as const,
  users: () => ['users'] as const,
  vaultStatus: () => ['vaultStatus'] as const,
};

// ----------------------------------------------------
// React Query Hooks
// ----------------------------------------------------

export function useDashboardQuery(farmId?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard(farmId),
    queryFn: () => getDashboardData(farmId),
    staleTime: 60 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useAnimalsQuery(search?: string, barnId?: string) {
  return useQuery({
    queryKey: queryKeys.animals(search, barnId),
    queryFn: () => getAnimals({ search, barnId }),
    staleTime: 30 * 1000,
  });
}

export function useAnimalQuery(id: string | null) {
  return useQuery({
    queryKey: queryKeys.animal(id || ''),
    queryFn: () => (id ? getAnimalById(id) : null),
    enabled: !!id,
  });
}

export function useMilkingSummaryQuery(date?: string) {
  return useQuery({
    queryKey: queryKeys.milkingSummary(date),
    queryFn: () => getMilkingDailySummary(undefined, date),
    staleTime: 15 * 1000,
  });
}

export function useBreedingTasksQuery(farmId?: string) {
  return useQuery({
    queryKey: queryKeys.breedingTasks(farmId),
    queryFn: () => getBreedingTasks(farmId),
    staleTime: 45 * 1000,
  });
}

export function useFatteningQuery(farmId?: string) {
  return useQuery({
    queryKey: queryKeys.fattening(farmId),
    queryFn: () => getFatteningPerformance(farmId),
    staleTime: 60 * 1000,
  });
}

export function useQuarantineQuery(farmId?: string) {
  return useQuery({
    queryKey: queryKeys.quarantine(farmId),
    queryFn: () => getQuarantineList(farmId),
    staleTime: 30 * 1000,
  });
}

export function useFeedStockQuery(farmId?: string) {
  return useQuery({
    queryKey: queryKeys.feedStock(farmId),
    queryFn: () => getFeedStock(farmId),
    staleTime: 30 * 1000,
  });
}

export function useFeedFormulasQuery() {
  return useQuery({
    queryKey: queryKeys.feedFormulas(),
    queryFn: () => getFeedFormulas(),
    staleTime: 60 * 1000,
  });
}

export function useFinancialOverviewQuery(period?: string) {
  return useQuery({
    queryKey: queryKeys.financialOverview(period),
    queryFn: () => getFinancialOverview(period),
    staleTime: 60 * 1000,
  });
}

export function useCullingCandidatesQuery() {
  return useQuery({
    queryKey: queryKeys.cullingCandidates(),
    queryFn: () => getCullingCandidates(),
    staleTime: 60 * 1000,
  });
}

// ----------------------------------------------------
// Mutation Hooks with Automatic Invalidation
// ----------------------------------------------------

export function useCreateAnimalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAnimalPayload) => createAnimal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['animals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useLogMilkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LogMilkPayload) => logMilkingSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milkingSummary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useRecordTreatmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RecordTreatmentPayload) => recordTreatment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quarantine'] });
      queryClient.invalidateQueries({ queryKey: ['animals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDispenseFeedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DispenseFeedPayload) => dispenseFeedToBarn(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedStock'] });
      queryClient.invalidateQueries({ queryKey: ['financialOverview'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
