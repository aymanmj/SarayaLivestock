import { Controller, Get, Post, Body, Param, Query, Patch, ParseUUIDPipe } from '@nestjs/common';
import { AnimalsService } from './animals.service';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, requireFarmId } from '../auth/authenticated-user';
import { FindAnimalsQueryDto, UpdateAnimalBarnDto, UpdateAnimalLifeStageDto, UpdateAnimalStatusDto } from './dto/animal-actions.dto';
import { DomainAudited } from '../../common/audit/domain-audited.decorator';
import { CurrentIdempotency, IdempotencyContext, IdempotencyRequired } from '../../common/idempotency/idempotency-context';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { AnimalDetailResponseDto, AnimalRecordResponseDto, AnimalResponseDto } from './dto/animal-response.dto';

@Controller('animals')
export class AnimalsController {
  constructor(private readonly animalsService: AnimalsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER, UserRole.VETERINARIAN)
  @DomainAudited()
  @IdempotencyRequired()
  @ApiCreatedResponse({ type: AnimalResponseDto })
  create(
    @Body() createAnimalDto: CreateAnimalDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.animalsService.create(createAnimalDto, requireFarmId(user), user, idempotency);
  }

  @Get()
  @ApiOkResponse({ type: AnimalResponseDto, isArray: true })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FindAnimalsQueryDto,
  ) {
    return this.animalsService.findAll(requireFarmId(user), query);
  }

  @Get(':id')
  @ApiOkResponse({ type: AnimalDetailResponseDto })
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.animalsService.findOne(id, requireFarmId(user));
  }

  @Patch(':id/life-stage')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER, UserRole.VETERINARIAN)
  @DomainAudited()
  @IdempotencyRequired()
  @ApiOkResponse({ type: AnimalRecordResponseDto })
  updateLifeStage(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateAnimalLifeStageDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.animalsService.updateLifeStage(id, dto.stage, requireFarmId(user), user, idempotency);
  }

  @Patch(':id/barn')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER)
  @DomainAudited()
  @IdempotencyRequired()
  @ApiOkResponse({ type: AnimalRecordResponseDto })
  updateBarn(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateAnimalBarnDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.animalsService.updateBarn(id, dto.barnId, requireFarmId(user), user, idempotency);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER, UserRole.VETERINARIAN)
  @DomainAudited()
  @IdempotencyRequired()
  @ApiOperation({ summary: 'تحديث حالة الحيوان (نشط، مستبعد، تم البيع، نافق)' })
  @ApiOkResponse({ type: AnimalRecordResponseDto })
  updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateAnimalStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.animalsService.updateStatus(id, dto.status, requireFarmId(user), dto.notes, user, idempotency);
  }
}
