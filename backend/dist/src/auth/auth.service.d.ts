import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from "../prisma/prisma.service";
import { UserService } from "../user/user.service";
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthService {
    private readonly prisma;
    private readonly userService;
    private readonly jwtService;
    private readonly configService;
    constructor(prisma: PrismaService, userService: UserService, jwtService: JwtService, configService: ConfigService);
    private createSession;
    register(registerDto: RegisterDto): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    login(loginDto: LoginDto): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    refreshSession(refreshToken: string): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    logout(accessToken: string): Promise<{
        message: string;
    }>;
    validateSessionUser(accessToken: string): Promise<{
        id: string;
        email: string;
        name: string | null;
        role: import("@prisma/client").$Enums.Role;
        createdAt: Date;
        outletId: string | null;
    }>;
}
