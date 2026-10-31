// src/auth/guards/database-auth.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../jwt-payload.interface';

@Injectable()
export class DatabaseAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Extract the access token straight out of parsed cookies
    const token = request.cookies?.['access_token'];

    if (!token) {
      throw new UnauthorizedException(
        'Access token missing from session cookies',
      );
    }

    try {
      // 2. Verify token signature is cryptographically valid
      this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // 3. Query DB to confirm the token exists and is valid
      const session = await this.prisma.userToken.findUnique({
        where: { accessToken: token },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      });

      if (!session || !session.isValid) {
        throw new UnauthorizedException('Session revoked or logged out');
      }

      // 4. Append database user identity context straight to request object
      request.user = session.user;
      return true;
    } catch {
      throw new UnauthorizedException('Session token invalid or expired');
    }
  }
}
