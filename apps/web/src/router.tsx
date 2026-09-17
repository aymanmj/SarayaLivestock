import React from 'react';
import { createRouter, createRoute, createRootRoute } from '@tanstack/react-router';
import { AppLayout } from './AppLayout';
import { ExecutiveDashboard } from './views/ExecutiveDashboard';
import { MilkingQuickEntry } from './views/MilkingQuickEntry';
import { AnimalsDirectory } from './views/AnimalsDirectory';
import { BreedingCalendar } from './views/BreedingCalendar';
import { FatteningWeights } from './views/FatteningWeights';
import { NutritionRations } from './views/NutritionRations';
import { AccountingGL } from './views/AccountingGL';
import { FinancialReports } from './views/FinancialReports';
import { UsersManagement } from './views/UsersManagement';
import { AboutSystem } from './views/AboutSystem';
import { CommercialSales } from './views/CommercialSales';
import { SettingsView } from './views/SettingsView';
import { HrEmployeesView } from './views/HrEmployeesView';
import { HrPayrollView } from './views/HrPayrollView';

// Root Route (Layout)
export const rootRoute = createRootRoute({
  component: AppLayout,
});

// Routes
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: AnimalsDirectory,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: ExecutiveDashboard,
});

const milkingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/milking',
  component: MilkingQuickEntry,
});

const animalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/animals',
  component: AnimalsDirectory,
});

const breedingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/breeding',
  component: BreedingCalendar,
});

const fatteningRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/fattening',
  component: FatteningWeights,
});

const nutritionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nutrition',
  component: NutritionRations,
});

const accountingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accounting',
  component: AccountingGL,
});

const financialRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/financial',
  component: FinancialReports,
});

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users',
  component: UsersManagement,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsView,
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: AboutSystem,
});

const salesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sales',
  component: CommercialSales,
});

const employeesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employees',
  component: HrEmployeesView,
});

const payrollRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/payroll',
  component: HrPayrollView,
});

// 404 Not Found Component
const NotFoundView: React.FC = () => (
  <div dir="rtl" className="min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-4 text-center">
    <div className="text-6xl font-black text-slate-300 dark:text-slate-700">404</div>
    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">الصفحة غير موجودة</h2>
    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
      الرابط الذي تحاول الوصول إليه غير صالح أو أن الصفحة قد تم نقلها.
    </p>
  </div>
);

// Route Tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  milkingRoute,
  animalsRoute,
  breedingRoute,
  fatteningRoute,
  nutritionRoute,
  salesRoute,
  accountingRoute,
  financialRoute,
  employeesRoute,
  payrollRoute,
  usersRoute,
  settingsRoute,
  aboutRoute,
]);

// Router Instance
export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFoundView,
});

// Register Router types
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
