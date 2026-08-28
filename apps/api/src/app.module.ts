import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AnimalsModule } from './modules/animals/animals.module';
import { BarnsModule } from './modules/barns/barns.module';
import { MilkingModule } from './modules/milking/milking.module';
import { BreedingModule } from './modules/breeding/breeding.module';
import { HealthModule } from './modules/health/health.module';
import { FatteningModule } from './modules/fattening/fattening.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NutritionModule } from './modules/nutrition/nutrition.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { LicenseModule } from './modules/license/license.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { SecurityModule } from './common/security/security.module';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { RolesGuard } from './modules/auth/roles.guard';
import { LicenseWriteGuard } from './modules/license/license-write.guard';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { AuditService } from './common/audit/audit.service';
import { AuditInterceptor } from './common/audit/audit.interceptor';
import { AuditController } from './common/audit/audit.controller';
import { validateRuntimeConfig } from './config/runtime-config';
import { SystemModule } from './system/system.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateRuntimeConfig,
    }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
    ]),
    DatabaseModule,
    SecurityModule,
    AuthModule,
    UsersModule,
    LicenseModule,
    AccountingModule,
    AnimalsModule,
    BarnsModule,
    MilkingModule,
    BreedingModule,
    HealthModule,
    FatteningModule,
    ReportsModule,
    NutritionModule,
    SystemModule,
  ],
  controllers: [AuditController],
  providers: [
    AuditService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: LicenseWriteGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
