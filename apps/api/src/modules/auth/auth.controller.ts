import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { UserRole } from '@prisma/client';
import { Public } from './public.decorator';
import { Roles } from './roles.decorator';
import { LoginDto, RefreshTokenDto, RegisterUserDto } from './dto/auth.dto';
import { AllowUnlicensedWrite } from '../license/license-access.decorator';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from './current-user.decorator';
import { AuthenticatedUser } from './authenticated-user';
import { DomainAudited } from '../../common/audit/domain-audited.decorator';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import {
  AuthenticationResponseDto,
  LogoutAllResponseDto,
  MessageResponseDto,
  RegisteredUserResponseDto,
  UserProfileResponseDto,
} from './dto/auth-response.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @AllowUnlicensedWrite()
  @Throttle({ default: { limit: 5, ttl: 60_000, blockDuration: 300_000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: AuthenticationResponseDto })
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(body.username, body.password, this.sessionContext(request));
    return this.deliverAuthentication(result, request, response);
  }

  @Public()
  @AllowUnlicensedWrite()
  @Throttle({ default: { limit: 10, ttl: 60_000, blockDuration: 300_000 } })
  @Post('refresh')
  @HttpCode(200)
  @ApiOkResponse({ type: AuthenticationResponseDto })
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = body.refreshToken || this.refreshCookie(request);
    if (!refreshToken) throw new UnauthorizedException('رمز تحديث الجلسة غير موجود');
    const result = await this.authService.refresh(refreshToken, this.sessionContext(request));
    return this.deliverAuthentication(result, request, response);
  }

  @Public()
  @AllowUnlicensedWrite()
  @Post('logout')
  @HttpCode(200)
  @ApiOkResponse({ type: MessageResponseDto })
  async logout(
    @Body() body: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = body.refreshToken || this.refreshCookie(request);
    const result = await this.authService.logout(refreshToken);
    this.clearRefreshCookie(response);
    return result;
  }

  @Post('logout-all')
  @HttpCode(200)
  @DomainAudited()
  @ApiOkResponse({ type: LogoutAllResponseDto })
  logoutAll(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logoutAll(user);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Post('register')
  @DomainAudited()
  @ApiCreatedResponse({ type: RegisteredUserResponseDto })
  register(
    @Body() body: RegisterUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.authService.register(body, user);
  }

  @Get('profile')
  @ApiOkResponse({ type: UserProfileResponseDto })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.id);
  }

  private deliverAuthentication(
    result: Awaited<ReturnType<AuthService['login']>>,
    request: Request,
    response: Response,
  ) {
    const { refreshToken, ...publicResult } = result;
    if (this.isDesktopClient(request)) return { ...publicResult, refreshToken };

    response.cookie('saraya_refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: this.authService.getRefreshTokenTtlMs(),
    });
    return publicResult;
  }

  private clearRefreshCookie(response: Response) {
    response.clearCookie('saraya_refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
    });
  }

  private refreshCookie(request: Request) {
    const cookie = request.headers.cookie?.split(';').map(value => value.trim())
      .find(value => value.startsWith('saraya_refresh_token='));
    return cookie ? decodeURIComponent(cookie.slice('saraya_refresh_token='.length)) : undefined;
  }

  private isDesktopClient(request: Request) {
    const clientHeader = request.get('x-saraya-client');
    const origin = request.get('origin');
    const isDesktopOrigin = !origin || origin === 'null' || origin === 'file://' || origin.startsWith('file:');
    return clientHeader === 'desktop' || isDesktopOrigin;
  }

  private sessionContext(request: Request) {
    return {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    };
  }
}
