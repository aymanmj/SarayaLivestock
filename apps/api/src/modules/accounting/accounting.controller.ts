import { Controller, Get, Post, Body, Param, Patch, Query, ParseUUIDPipe } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { CreateAccountDto, CreateJournalEntryDto, CreateFiscalYearDto, FinancialReportQueryDto, JournalEntriesQueryDto, RolloverFiscalYearDto } from './dto/accounting.dto';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, requireFarmId } from '../auth/authenticated-user';
import { DomainAudited } from '../../common/audit/domain-audited.decorator';
import { CurrentIdempotency, IdempotencyContext, IdempotencyRequired } from '../../common/idempotency/idempotency-context';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import {
  AccountResponseDto,
  AccountWithChildrenResponseDto,
  BalanceSheetResponseDto,
  FiscalPeriodResponseDto,
  FiscalYearResponseDto,
  FiscalYearRolloverResponseDto,
  IncomeStatementResponseDto,
  JournalEntryResponseDto,
  TrialBalanceResponseDto,
} from './dto/accounting-response.dto';

@Roles(UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT)
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('chart-of-accounts')
  @ApiOkResponse({ type: AccountWithChildrenResponseDto, isArray: true })
  getChartOfAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.accountingService.getChartOfAccounts(requireFarmId(user));
  }

  @Post('accounts')
  @DomainAudited()
  @IdempotencyRequired()
  @ApiCreatedResponse({ type: AccountResponseDto })
  createAccount(
    @Body() dto: CreateAccountDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.accountingService.createAccount(dto, requireFarmId(user), user, idempotency);
  }

  @Get('fiscal-years')
  @ApiOkResponse({ type: FiscalYearResponseDto, isArray: true })
  getFiscalYears(@CurrentUser() user: AuthenticatedUser) {
    return this.accountingService.getFiscalYears(requireFarmId(user));
  }

  @Get('journal-entries')
  @ApiOkResponse({ type: JournalEntryResponseDto, isArray: true })
  getJournalEntries(@CurrentUser() user: AuthenticatedUser, @Query() query: JournalEntriesQueryDto) {
    return this.accountingService.getJournalEntries(requireFarmId(user), query.limit);
  }

  @Post('journal-entries')
  @DomainAudited()
  @IdempotencyRequired()
  @ApiCreatedResponse({ type: JournalEntryResponseDto })
  createJournalEntry(
    @Body() dto: CreateJournalEntryDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.accountingService.createJournalEntry(dto, requireFarmId(user), user, idempotency);
  }

  @Get('trial-balance')
  @ApiOkResponse({ type: TrialBalanceResponseDto })
  getTrialBalance(@CurrentUser() user: AuthenticatedUser, @Query() query: FinancialReportQueryDto) {
    return this.accountingService.getTrialBalance(requireFarmId(user), query.fiscalYearId);
  }

  @Get('income-statement')
  @ApiOkResponse({ type: IncomeStatementResponseDto })
  getIncomeStatement(@CurrentUser() user: AuthenticatedUser, @Query() query: FinancialReportQueryDto) {
    return this.accountingService.getIncomeStatement(requireFarmId(user), query.fiscalYearId);
  }

  @Get('balance-sheet')
  @ApiOkResponse({ type: BalanceSheetResponseDto })
  getBalanceSheet(@CurrentUser() user: AuthenticatedUser, @Query() query: FinancialReportQueryDto) {
    return this.accountingService.getBalanceSheet(requireFarmId(user), query.fiscalYearId);
  }

  @Post('fiscal-years')
  @DomainAudited()
  @IdempotencyRequired()
  @ApiCreatedResponse({ type: FiscalYearResponseDto })
  createFiscalYear(
    @Body() dto: CreateFiscalYearDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.accountingService.createFiscalYear(dto, requireFarmId(user), user, idempotency);
  }

  @Patch('periods/:id/close')
  @DomainAudited()
  @IdempotencyRequired()
  @ApiOkResponse({ type: FiscalPeriodResponseDto })
  closePeriod(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.accountingService.closePeriod(id, requireFarmId(user), user, idempotency);
  }

  @Patch('periods/:id/reopen')
  @DomainAudited()
  @IdempotencyRequired()
  @ApiOkResponse({ type: FiscalPeriodResponseDto })
  reopenPeriod(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.accountingService.reopenPeriod(id, requireFarmId(user), user, idempotency);
  }

  @Post('fiscal-years/:id/rollover')
  @DomainAudited()
  @IdempotencyRequired()
  @ApiCreatedResponse({ type: FiscalYearRolloverResponseDto })
  rolloverFiscalYear(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RolloverFiscalYearDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.accountingService.rolloverFiscalYear(id, dto.nextYearName, requireFarmId(user), user, idempotency);
  }
}
