// src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Res,
  Get,
} from '@nestjs/common';
import * as express from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Cookies } from './decorators/cookies.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Centralized configuration manager for dropping secure session cookies
  private setAuthCookies(
    res: express.Response,
    accessToken: string,
    refreshToken: string,
  ) {
    // 1. Short-lived Access Cookie (15 Minutes)
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: false, // Set true in production environments using HTTPS
      sameSite: 'lax',
      path: '/', // 👈 ADD THIS LINE TO MAKE IT GLOBALLY ACCESSIBLE
      maxAge: 15 * 60 * 1000,
    });

    // 2. Long-lived Refresh Cookie (7 Days)
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false, // Set true in production environments using HTTPS
      sameSite: 'lax',
      path: '/', // 👈 ADD THIS LINE TO MAKE IT GLOBALLY ACCESSIBLE
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  @Get('me')
  async getMe(@Cookies('access_token') accessToken: string | undefined) {
    if (!accessToken) {
      throw new UnauthorizedException(
        'Access token missing from session context',
      );
    }

    const user = await this.authService.validateSessionUser(accessToken);
    return { success: true, data: user };
  }
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const tokens = await this.authService.login(loginDto);
    this.setAuthCookies(res, tokens.access_token, tokens.refresh_token);
    return { success: true, message: 'Logged in successfully' };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Cookies('refresh_token') refreshToken: string | undefined,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    if (!refreshToken) {
      throw new UnauthorizedException(
        'Refresh token missing from session cookies',
      );
    }

    const tokens = await this.authService.refreshSession(refreshToken);
    this.setAuthCookies(res, tokens.access_token, tokens.refresh_token);
    return { success: true, message: 'Session token rotated successfully' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Cookies('access_token') accessToken: string | undefined,
    @Cookies('refresh_token') refreshToken: string | undefined,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    // 1. Immediately wipe both target cookies from browser storage containers
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    // 2. Purge the matching track record row out of PostgreSQL if present
    if (accessToken || refreshToken) {
      await this.authService.logout(accessToken, refreshToken);
    }

    return { success: true, message: 'Logged out successfully' };
  }
}
