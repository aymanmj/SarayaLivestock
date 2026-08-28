import { Controller, Post, Get, Patch, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RationService } from './ration.service';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, requireFarmId } from '../auth/authenticated-user';
import {
  CreateFeedFormulaDto,
  CreateFeedIngredientDto,
  DispenseFeedDto,
  FormulateLeastCostDto,
  UpdateFeedStockDto,
} from './dto/nutrition.dto';
import { DomainAudited } from '../../common/audit/domain-audited.decorator';
import { CurrentIdempotency, IdempotencyContext, IdempotencyRequired } from '../../common/idempotency/idempotency-context';
import {
  DispenseFeedResponseDto,
  FeedDistributionResponseDto,
  FeedFormulaResponseDto,
  FeedIngredientResponseDto,
  LeastCostRationResponseDto,
} from './dto/nutrition-response.dto';

@Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER, UserRole.ACCOUNTANT, UserRole.WORKER)
@ApiTags('nutrition')
@Controller('nutrition')
export class NutritionController {
  constructor(private readonly rationService: RationService) {}

  @Post('formulate-least-cost')
  @ApiOperation({ summary: 'حساب أرخص تركيبة علفية TMR تغطي الاحتياج البروتيني' })
  @ApiCreatedResponse({ type: LeastCostRationResponseDto })
  calculateLeastCost(@Body() body: FormulateLeastCostDto) {
    return this.rationService.calculateLeastCostRation(body.ingredients, body.target);
  }

  @Post('dispense')
  @DomainAudited()
  @IdempotencyRequired()
  @ApiOperation({ summary: 'صرف عليقة للحظيرة مع الخصم المخزني والترحيل المالي' })
  @ApiCreatedResponse({ type: DispenseFeedResponseDto })
  dispenseFeed(
    @Body() body: DispenseFeedDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.rationService.dispenseFeedToBarn(
      body.barnId, body.formulaId, body.quantityKg, requireFarmId(user), user, idempotency,
    );
  }

  @Get('stock')
  @ApiOperation({ summary: 'عرض أرصدة مخزون المواد العلفية وتنبيهات النواقص' })
  @ApiOkResponse({ type: FeedIngredientResponseDto, isArray: true })
  getStock(@CurrentUser() user: AuthenticatedUser) {
    return this.rationService.getFeedStock(requireFarmId(user));
  }

  @Post('ingredients')
  @DomainAudited()
  @IdempotencyRequired()
  @ApiOperation({ summary: 'إضافة مادة علفية جديدة إلى المستودع' })
  @ApiCreatedResponse({ type: FeedIngredientResponseDto })
  createIngredient(
    @Body() body: CreateFeedIngredientDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.rationService.createIngredient(body, requireFarmId(user), user, idempotency);
  }

  @Patch('ingredients/:id/stock')
  @DomainAudited()
  @IdempotencyRequired()
  @ApiOperation({ summary: 'تغذية رصيد مادة علفية (استلام شحنة واردة)' })
  @ApiOkResponse({ type: FeedIngredientResponseDto })
  updateStock(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateFeedStockDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.rationService.updateIngredientStock(
      id, body.addedKg, body.costPerUnit, requireFarmId(user), user, idempotency,
    );
  }

  @Get('formulas')
  @ApiOperation({ summary: 'عرض قائمة الخلطات والعلائق المعتمدة' })
  @ApiOkResponse({ type: FeedFormulaResponseDto, isArray: true })
  getFormulas(@CurrentUser() user: AuthenticatedUser) {
    return this.rationService.getFormulas(requireFarmId(user));
  }

  @Post('formulas')
  @DomainAudited()
  @IdempotencyRequired()
  @ApiOperation({ summary: 'حفظ تركيبة علفية جديدة TMR' })
  @ApiCreatedResponse({ type: FeedFormulaResponseDto })
  createFormula(
    @Body() body: CreateFeedFormulaDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.rationService.createFormula(body, requireFarmId(user), user, idempotency);
  }

  @Get('distributions')
  @ApiOperation({ summary: 'سجل حركات صرف وتوزيع الأعلاف للحظائر' })
  @ApiOkResponse({ type: FeedDistributionResponseDto, isArray: true })
  getDistributions(@CurrentUser() user: AuthenticatedUser) {
    return this.rationService.getDistributions(requireFarmId(user));
  }
}
