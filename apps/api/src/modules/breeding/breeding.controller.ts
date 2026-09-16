import { Controller, Get, Post, Body, Param, Patch, ParseUUIDPipe } from '@nestjs/common';
import { BreedingService } from './breeding.service';
import { InseminateDto } from './dto/inseminate.dto';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, requireFarmId } from '../auth/authenticated-user';
import { RecordCalvingDto, RecordPregnancyResultDto } from './dto/breeding-actions.dto';
import { DomainAudited } from '../../common/audit/domain-audited.decorator';
import { CurrentIdempotency, IdempotencyContext, IdempotencyRequired } from '../../common/idempotency/idempotency-context';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { AnimalRecordResponseDto } from '../animals/dto/animal-response.dto';
import {
  BreedingRecordWithAnimalResponseDto,
  BreedingTasksResponseDto,
  RecordCalvingResponseDto,
} from './dto/breeding-response.dto';

@Roles(UserRole.SUPER_ADMIN, UserRole.FARM_MANAGER, UserRole.VETERINARIAN)
@Controller('breeding')
export class BreedingController {
  constructor(private readonly breedingService: BreedingService) {}

  @Post(':id/dry-off')
  @DomainAudited()
  @IdempotencyRequired()
  @ApiCreatedResponse({ type: AnimalRecordResponseDto })
  recordDryOff(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser, @CurrentIdempotency() idempotency: IdempotencyContext) {
    return this.breedingService.recordDryOff(id, requireFarmId(user), user, idempotency);
  }

  @Post('inseminate')
  @DomainAudited()
  @IdempotencyRequired()
  @ApiCreatedResponse({ type: BreedingRecordWithAnimalResponseDto })
  recordInsemination(
    @Body() dto: InseminateDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.breedingService.recordInsemination(dto, requireFarmId(user), user, idempotency);
  }

  @Patch(':id/pd-result')
  @DomainAudited()
  @IdempotencyRequired()
  @ApiOkResponse({ type: BreedingRecordWithAnimalResponseDto })
  recordPdResult(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RecordPregnancyResultDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.breedingService.recordPdResult(id, dto.result, requireFarmId(user), user, idempotency);
  }

  @Post(':id/calving')
  @DomainAudited()
  @IdempotencyRequired()
  @ApiCreatedResponse({ type: RecordCalvingResponseDto })
  recordCalving(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: RecordCalvingDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentIdempotency() idempotency: IdempotencyContext,
  ) {
    return this.breedingService.recordCalving(id, body, requireFarmId(user), user, idempotency);
  }

  @Get('upcoming-tasks')
  @ApiOkResponse({ type: BreedingTasksResponseDto })
  getUpcomingTasks(@CurrentUser() user: AuthenticatedUser) {
    return this.breedingService.getUpcomingTasks(requireFarmId(user));
  }

  @Get('all')
  @ApiOkResponse({ type: BreedingRecordWithAnimalResponseDto, isArray: true })
  getAllRecords(@CurrentUser() user: AuthenticatedUser) {
    return this.breedingService.getAllBreedingRecords(requireFarmId(user));
  }
}
