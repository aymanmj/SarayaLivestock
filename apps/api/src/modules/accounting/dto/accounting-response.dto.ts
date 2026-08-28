import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AccountCategory,
  CostCenterType,
  FiscalStatus,
  JournalEntryStatus,
  JournalEntryType,
} from '@prisma/client';

const decimalPattern = '^-?\\d+(?:\\.\\d{1,3})?$';

export class AccountResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) farmId: string;
  @ApiProperty() code: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) nameEn: string | null;
  @ApiProperty({ enum: AccountCategory, enumName: 'AccountCategory' }) category: AccountCategory;
  @ApiProperty({ format: 'uuid', nullable: true }) parentId: string | null;
  @ApiProperty({ type: String, pattern: decimalPattern, example: '1250.000' }) currentBalance: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty() isSystemLocked: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
}

export class AccountWithChildrenResponseDto extends AccountResponseDto {
  @ApiProperty({ type: () => [AccountResponseDto] })
  children: AccountResponseDto[];
}

export class CostCenterResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) farmId: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: CostCenterType, enumName: 'CostCenterType' }) type: CostCenterType;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class FiscalPeriodResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) fiscalYearId: string;
  @ApiProperty({ type: Number }) periodNumber: number;
  @ApiProperty() periodName: string;
  @ApiProperty({ format: 'date-time' }) startDate: string;
  @ApiProperty({ format: 'date-time' }) endDate: string;
  @ApiProperty({ enum: FiscalStatus, enumName: 'FiscalStatus' }) status: FiscalStatus;
  @ApiProperty({ format: 'date-time', nullable: true }) closedAt: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class FiscalYearSummaryResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() yearName: string;
  @ApiProperty({ enum: FiscalStatus, enumName: 'FiscalStatus' }) status: FiscalStatus;
}

export class FiscalYearResponseDto extends FiscalYearSummaryResponseDto {
  @ApiProperty({ format: 'uuid' }) farmId: string;
  @ApiProperty({ format: 'date-time' }) startDate: string;
  @ApiProperty({ format: 'date-time' }) endDate: string;
  @ApiProperty() isCurrent: boolean;
  @ApiProperty({ format: 'date-time', nullable: true }) closedAt: string | null;
  @ApiProperty({ nullable: true }) closedBy: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
  @ApiPropertyOptional({ type: () => [FiscalPeriodResponseDto] }) periods?: FiscalPeriodResponseDto[];
}

export class JournalEntryLineResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) journalEntryId: string;
  @ApiProperty({ format: 'uuid' }) accountId: string;
  @ApiProperty({ format: 'uuid', nullable: true }) costCenterId: string | null;
  @ApiProperty({ type: String, pattern: decimalPattern }) debit: string;
  @ApiProperty({ type: String, pattern: decimalPattern }) credit: string;
  @ApiProperty({ nullable: true }) memo: string | null;
  @ApiProperty({ type: () => AccountResponseDto }) account: AccountResponseDto;
  @ApiProperty({ type: () => CostCenterResponseDto, nullable: true }) costCenter: CostCenterResponseDto | null;
}

export class JournalEntryResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) farmId: string;
  @ApiProperty({ format: 'uuid' }) fiscalYearId: string;
  @ApiProperty({ format: 'uuid', nullable: true }) fiscalPeriodId: string | null;
  @ApiProperty() entryNumber: string;
  @ApiProperty({ format: 'date-time' }) entryDate: string;
  @ApiProperty({ enum: JournalEntryType, enumName: 'JournalEntryType' }) type: JournalEntryType;
  @ApiProperty({ enum: JournalEntryStatus, enumName: 'JournalEntryStatus' }) status: JournalEntryStatus;
  @ApiProperty() description: string;
  @ApiProperty({ nullable: true }) referenceId: string | null;
  @ApiProperty({ type: String, pattern: decimalPattern }) totalDebit: string;
  @ApiProperty({ type: String, pattern: decimalPattern }) totalCredit: string;
  @ApiProperty({ format: 'date-time', nullable: true }) postedAt: string | null;
  @ApiProperty({ nullable: true }) postedBy: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
  @ApiProperty({ type: () => [JournalEntryLineResponseDto] }) lines: JournalEntryLineResponseDto[];
  @ApiPropertyOptional({ type: () => FiscalYearResponseDto }) fiscalYear?: FiscalYearResponseDto;
}

export class TrialBalanceRowResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() code: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: AccountCategory, enumName: 'AccountCategory' }) category: AccountCategory;
  @ApiProperty({ type: Number }) totalDebit: number;
  @ApiProperty({ type: Number }) totalCredit: number;
  @ApiProperty({ type: Number }) netDebit: number;
  @ApiProperty({ type: Number }) netCredit: number;
}

export class TrialBalanceResponseDto {
  @ApiProperty({ type: () => FiscalYearSummaryResponseDto }) fiscalYear: FiscalYearSummaryResponseDto;
  @ApiProperty({ format: 'date' }) asOfDate: string;
  @ApiProperty() isBalanced: boolean;
  @ApiProperty({ type: Number }) totalDebits: number;
  @ApiProperty({ type: Number }) totalCredits: number;
  @ApiProperty({ type: () => [TrialBalanceRowResponseDto] }) accounts: TrialBalanceRowResponseDto[];
}

export class IncomeStatementResponseDto {
  @ApiProperty({ type: () => FiscalYearSummaryResponseDto }) fiscalYear: FiscalYearSummaryResponseDto;
  @ApiProperty() period: string;
  @ApiProperty({ type: Number }) totalRevenue: number;
  @ApiProperty({ type: Number }) totalExpenses: number;
  @ApiProperty({ type: Number }) netProfit: number;
  @ApiProperty({ type: Number }) profitMarginPct: number;
  @ApiProperty({ type: () => [TrialBalanceRowResponseDto] }) revenues: TrialBalanceRowResponseDto[];
  @ApiProperty({ type: () => [TrialBalanceRowResponseDto] }) expenses: TrialBalanceRowResponseDto[];
}

export class BalanceSheetResponseDto {
  @ApiProperty({ type: () => FiscalYearSummaryResponseDto }) fiscalYear: FiscalYearSummaryResponseDto;
  @ApiProperty({ format: 'date' }) asOfDate: string;
  @ApiProperty({ type: Number }) totalAssets: number;
  @ApiProperty({ type: Number }) totalLiabilities: number;
  @ApiProperty({ type: Number }) totalEquity: number;
  @ApiProperty() isBalanced: boolean;
  @ApiProperty({ type: () => [TrialBalanceRowResponseDto] }) assets: TrialBalanceRowResponseDto[];
  @ApiProperty({ type: () => [TrialBalanceRowResponseDto] }) liabilities: TrialBalanceRowResponseDto[];
  @ApiProperty({ type: () => [TrialBalanceRowResponseDto] }) equity: TrialBalanceRowResponseDto[];
}

export class FiscalYearRolloverResponseDto {
  @ApiProperty() success: boolean;
  @ApiProperty() message: string;
  @ApiProperty() closedYear: string;
  @ApiProperty() newYear: string;
  @ApiProperty({ type: Number }) netProfitTransferred: number;
}
