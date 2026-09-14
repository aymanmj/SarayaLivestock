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
  usersRoute,
  aboutRoute,
]);

// Router Instance
export const router = createRouter({ routeTree });

// Register Router types
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
