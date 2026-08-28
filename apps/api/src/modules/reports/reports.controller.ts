import { Controller, Get, Param } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, requireFarmId } from '../auth/authenticated-user';
import { ReportExportParamsDto } from './dto/reports.dto';
import {
  CullingCandidateResponseDto,
  ExecutiveDashboardResponseDto,
  FinancialOverviewResponseDto,
} from './dto/reports-response.dto';
import { AnimalRecordResponseDto } from '../animals/dto/animal-response.dto';
import { MilkLogWithAnimalResponseDto } from '../milking/dto/milking-response.dto';
import { BreedingRecordWithAnimalResponseDto } from '../breeding/dto/breeding-response.dto';
import { FeedIngredientResponseDto } from '../nutrition/dto/nutrition-response.dto';

@Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER, UserRole.ACCOUNTANT, UserRole.VETERINARIAN)
@ApiTags('reports')
@ApiExtraModels(
  AnimalRecordResponseDto,
  MilkLogWithAnimalResponseDto,
  BreedingRecordWithAnimalResponseDto,
  FeedIngredientResponseDto,
  CullingCandidateResponseDto,
)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('executive-dashboard')
  @ApiOperation({ summary: 'لوحة المؤشرات التنفيذية للقطيع والإنتاج' })
  @ApiOkResponse({ type: ExecutiveDashboardResponseDto })
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getExecutiveDashboard(requireFarmId(user));
  }

  @Get('financial-overview')
  @ApiOperation({ summary: 'التحليل المالي وحساب تكلفة اللتر وكيلو اللحم (IAS 41)' })
  @ApiOkResponse({ type: FinancialOverviewResponseDto })
  getFinancialOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getFinancialOverview(requireFarmId(user));
  }

  @Get('culling-candidates')
  @ApiOperation({ summary: 'الماشية المرشحة للاستبعاد لعدم الجدوى الاقتصادية' })
  @ApiOkResponse({ type: CullingCandidateResponseDto, isArray: true })
  getCullingCandidates(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getCullingCandidates(requireFarmId(user));
  }

  @Get('export/:type')
  @ApiOperation({ summary: 'تجهيز بيانات التصدير لكشوفات المزرعة' })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        oneOf: [
          { $ref: getSchemaPath(AnimalRecordResponseDto) },
          { $ref: getSchemaPath(MilkLogWithAnimalResponseDto) },
          { $ref: getSchemaPath(BreedingRecordWithAnimalResponseDto) },
          { $ref: getSchemaPath(FeedIngredientResponseDto) },
          { $ref: getSchemaPath(CullingCandidateResponseDto) },
        ],
      },
    },
  })
  getExportData(@Param() params: ReportExportParamsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getExportData(params.type, requireFarmId(user));
  }
}
