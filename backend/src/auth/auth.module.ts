// src/auth/auth.module.ts
import { Module, forwardRef } from '@nestjs/common'; // 👈 IMPORT forwardRef HERE
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from 'src/user/user.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { DatabaseAuthGuard } from './guards/database-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    forwardRef(() => UserModule), // 👈 FIX: Wrapped in forwardRef to break circular loop
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService, DatabaseAuthGuard, RolesGuard],
  exports: [AuthService, DatabaseAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
