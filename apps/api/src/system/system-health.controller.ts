import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../modules/auth/public.decorator';
import { LivenessResponseDto, ReadinessResponseDto } from './system-health.dto';
import { SystemHealthService } from './system-health.service';

@ApiTags('system')
@Public()
@Controller('system/health')
export class SystemHealthController {
  constructor(private readonly health: SystemHealthService) {}

  @Get('live')
  @ApiOkResponse({ type: LivenessResponseDto })
  liveness() {
    return this.health.liveness();
  }

  @Get('ready')
  @ApiOkResponse({ type: ReadinessResponseDto })
  @ApiServiceUnavailableResponse({ description: 'Database is unavailable or the required migration is absent.' })
  readiness() {
    return this.health.readiness();
  }
}
