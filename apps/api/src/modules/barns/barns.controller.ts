import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser, requireFarmId } from '../auth/authenticated-user';
import { BarnsService } from './barns.service';
import { ApiOkResponse } from '@nestjs/swagger';
import { BarnSummaryResponseDto } from '../animals/dto/animal-response.dto';

@Controller('barns')
export class BarnsController {
  constructor(private readonly barnsService: BarnsService) {}

  @Get()
  @ApiOkResponse({ type: BarnSummaryResponseDto, isArray: true })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.barnsService.findAll(requireFarmId(user));
  }
}
