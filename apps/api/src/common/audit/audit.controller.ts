import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../modules/auth/current-user.decorator';
import { AuthenticatedUser } from '../../modules/auth/authenticated-user';
import { Roles } from '../../modules/auth/roles.decorator';
import { AuditService } from './audit.service';
import { AuditEventsQueryDto } from './dto/audit-events-query.dto';
import { ApiOkResponse } from '@nestjs/swagger';
import { AuditEventPageResponseDto } from './dto/audit-response.dto';

@Roles(UserRole.SUPER_ADMIN)
@Controller('audit-events')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOkResponse({ type: AuditEventPageResponseDto })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: AuditEventsQueryDto) {
    return this.audit.list(user.orgId, query);
  }
}
