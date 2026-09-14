import { Controller, Get, Post, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { SalesService } from './sales.service';
import { RecordMilkSaleDto, RecordAnimalSaleDto, RecordMortalityDto, SalesQueryDto } from './dto/sales.dto';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, requireFarmId } from '../auth/authenticated-user';
import { DomainAudited } from '../../common/audit/domain-audited.decorator';
import { CurrentIdempotency, IdempotencyContext, IdempotencyRequired } from '../../common/idempotency/idempotency-context';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  CommercialSaleResponseDto,
  AnimalMortalityResponseDto,
  SalesSummaryResponseDto,
} from './dto/sales-response.dto';

@ApiTags('sales')
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('milk')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER, UserRole.ACCOUNTANT)
  @DomainAudited()
  @IdempotencyRequired()
  @ApiCreatedResponse({ type: CommercialSaleResponseDto })
  recordMilkSale(
    @Body() dto: RecordMilkSaleDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.salesService.recordMilkSale(dto, requireFarmId(user), user, idempotency);
  }

  @Post('animal')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER, UserRole.ACCOUNTANT)
  @DomainAudited()
  @IdempotencyRequired()
  @ApiCreatedResponse({ type: CommercialSaleResponseDto })
  recordAnimalSale(
    @Body() dto: RecordAnimalSaleDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.salesService.recordAnimalSale(dto, requireFarmId(user), user, idempotency);
  }

  @Post('mortality')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER, UserRole.VETERINARIAN, UserRole.ACCOUNTANT)
  @DomainAudited()
  @IdempotencyRequired()
  @ApiCreatedResponse({ type: AnimalMortalityResponseDto })
  recordMortality(
    @Body() dto: RecordMortalityDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.salesService.recordAnimalMortality(dto, requireFarmId(user), user, idempotency);
  }

  @Get('summary')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER, UserRole.ACCOUNTANT, UserRole.VETERINARIAN)
  @ApiOkResponse({ type: SalesSummaryResponseDto })
  getSalesSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.salesService.getSalesSummary(requireFarmId(user));
  }

  @Get('mortality')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER, UserRole.ACCOUNTANT, UserRole.VETERINARIAN)
  @ApiOkResponse({ type: AnimalMortalityResponseDto, isArray: true })
  getMortalities(@CurrentUser() user: AuthenticatedUser, @Query() query: SalesQueryDto) {
    return this.salesService.getMortalities(requireFarmId(user), query.limit);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER, UserRole.ACCOUNTANT, UserRole.VETERINARIAN)
  @ApiOkResponse({ type: CommercialSaleResponseDto, isArray: true })
  getSales(@CurrentUser() user: AuthenticatedUser, @Query() query: SalesQueryDto) {
    return this.salesService.getSales(requireFarmId(user), query.limit);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER, UserRole.ACCOUNTANT, UserRole.VETERINARIAN)
  @ApiOkResponse({ type: CommercialSaleResponseDto })
  getSaleById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesService.getSaleById(id, requireFarmId(user));
  }
}
