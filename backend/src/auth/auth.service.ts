// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt-payload.interface';
import { Role } from '@prisma/client'; // Import native Prisma Enum
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private async createSession(userId: string, email: string, role: Role) {
    const payload: JwtPayload = {
      sub: userId,
      email,
      role: role,
    };

    // jwtid keeps tokens unique when two sessions start within the same second
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '15m',
      jwtid: randomUUID(),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
      jwtid: randomUUID(),
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.userToken.create({
      data: {
        accessToken,
        refreshToken,
        userId,
        expiresAt,
      },
    });

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  async login(loginDto: LoginDto) {
    const user = await this.userService.findUserForAuth(loginDto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isMatch = await bcrypt.compare(loginDto.password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    // Checked after the password so the response can't reveal an account's role
    if (user.role !== Role.ADMIN) {
      throw new UnauthorizedException('Access denied: Admins only');
    }

    return this.createSession(user.id, user.email, user.role);
  }

  async refreshSession(refreshToken: string) {
    try {
      this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const storedToken = await this.prisma.userToken.findUnique({
        where: { refreshToken },
        include: { user: true },
      });

      if (!storedToken || new Date() > storedToken.expiresAt) {
        throw new UnauthorizedException('Session expired or untrusted');
      }

      // 💡 GRACE PERIOD FIX: If the token was already used less than 15 seconds ago,
      // allow it to pass. This resolves browser refresh/abort race conditions entirely.
      if (!storedToken.isValid) {
        const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000);
        if (storedToken.updatedAt < fifteenSecondsAgo) {
          throw new UnauthorizedException('Session has been revoked');
        }
      }

      // Instead of deleting, mark it invalid. The grace window handles the rest.
      await this.prisma.userToken.update({
        where: { id: storedToken.id },
        data: { isValid: false },
      });

      return this.createSession(
        storedToken.user.id,
        storedToken.user.email,
        storedToken.user.role,
      );
    } catch {
      throw new UnauthorizedException('Invalid session context');
    }
  }
  async logout(accessToken?: string, refreshToken?: string) {
    // Empty strings never match. An undefined filter would match every session.
    await this.prisma.userToken.deleteMany({
      where: {
        OR: [
          { accessToken: accessToken ?? '' },
          { refreshToken: refreshToken ?? '' },
        ],
      },
    });
    return { message: 'Logged out successfully' };
  }

  async validateSessionUser(accessToken: string) {
    try {
      // 1. Verify the access token signature using your secure key
      this.jwtService.verify<JwtPayload>(accessToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // 2. Fetch the live session so logged-out tokens stop working immediately
      const session = await this.prisma.userToken.findUnique({
        where: { accessToken },
        select: {
          isValid: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true, // 👈 CRITICAL FIX: Explicitly fetching role for client-side guards
              createdAt: true,
            },
          },
        },
      });

      if (!session || !session.isValid) {
        throw new UnauthorizedException('Session revoked or logged out');
      }

      return session.user;
    } catch (error) {
      throw new UnauthorizedException(
        'Session token is invalid or expired',
        error,
      );
    }
  }
}
