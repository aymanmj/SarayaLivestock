import { Controller, Get, Patch, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { ResetPasswordDto, UpdateUserRoleDto } from './dto/users.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { DomainAudited } from '../../common/audit/domain-audited.decorator';
import { ApiOkResponse } from '@nestjs/swagger';
import {
  ResetPasswordResponseDto,
  UserAdministrationResponseDto,
  UserMutationResponseDto,
} from './dto/users-response.dto';

@Roles(UserRole.SUPER_ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOkResponse({ type: UserAdministrationResponseDto, isArray: true })
  findAll(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.usersService.findAll(currentUser.orgId);
  }

  @Get(':id')
  @ApiOkResponse({ type: UserAdministrationResponseDto })
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.usersService.findOne(id, currentUser.orgId);
  }

  @Patch(':id/role')
  @DomainAudited()
  @ApiOkResponse({ type: UserMutationResponseDto })
  updateRole(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdateUserRoleDto, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.usersService.updateRole(id, dto.role, currentUser.orgId, currentUser);
  }

  @Patch(':id/toggle-status')
  @DomainAudited()
  @ApiOkResponse({ type: UserMutationResponseDto })
  toggleStatus(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.usersService.toggleStatus(id, currentUser.orgId, currentUser);
  }

  @Patch(':id/reset-password')
  @DomainAudited()
  @ApiOkResponse({ type: ResetPasswordResponseDto })
  resetPassword(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: ResetPasswordDto, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.usersService.resetPassword(id, dto.password, currentUser.orgId, currentUser);
  }
}
