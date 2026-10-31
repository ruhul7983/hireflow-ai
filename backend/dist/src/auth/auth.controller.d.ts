import * as express from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    private setAuthCookies;
    register(registerDto: RegisterDto, res: express.Response): Promise<{
        success: boolean;
        message: string;
    }>;
    getMe(accessToken: string | undefined): Promise<{
        success: boolean;
        data: {
            id: string;
            email: string;
            name: string | null;
            role: import("@prisma/client").$Enums.Role;
            createdAt: Date;
            outletId: string | null;
        };
    }>;
    login(loginDto: LoginDto, res: express.Response): Promise<{
        success: boolean;
        message: string;
    }>;
    refresh(refreshToken: string | undefined, res: express.Response): Promise<{
        success: boolean;
        message: string;
    }>;
    logout(accessToken: string | undefined, res: express.Response): Promise<{
        success: boolean;
        message: string;
    }>;
}
