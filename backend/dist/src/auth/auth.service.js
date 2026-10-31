"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
const user_service_1 = require("../user/user.service");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
let AuthService = class AuthService {
    prisma;
    userService;
    jwtService;
    configService;
    constructor(prisma, userService, jwtService, configService) {
        this.prisma = prisma;
        this.userService = userService;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async createSession(userId, email, role) {
        const payload = {
            sub: userId,
            email,
            role: role,
        };
        const accessToken = this.jwtService.sign(payload, {
            secret: this.configService.get('JWT_SECRET'),
            expiresIn: '15m',
        });
        const refreshToken = this.jwtService.sign(payload, {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
            expiresIn: '7d',
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
    async register(registerDto) {
        const hash = await bcrypt.hash(registerDto.password, 10);
        const user = await this.userService.createUser({
            ...registerDto,
            password: hash,
        });
        return this.createSession(user.id, user.email, user.role);
    }
    async login(loginDto) {
        const user = await this.userService.findUserForAuth(loginDto.email);
        if (!user)
            throw new common_1.UnauthorizedException('Invalid credentials');
        if (user.role !== client_1.Role.ADMIN) {
            throw new common_1.UnauthorizedException('Access denied: Admins only');
        }
        const isMatch = await bcrypt.compare(loginDto.password, user.password);
        if (!isMatch)
            throw new common_1.UnauthorizedException('Invalid credentials');
        return this.createSession(user.id, user.email, user.role);
    }
    async refreshSession(refreshToken) {
        try {
            this.jwtService.verify(refreshToken, {
                secret: this.configService.get('JWT_REFRESH_SECRET'),
            });
            const storedToken = await this.prisma.userToken.findUnique({
                where: { refreshToken },
                include: { user: true },
            });
            if (!storedToken || new Date() > storedToken.expiresAt) {
                throw new common_1.UnauthorizedException('Session expired or untrusted');
            }
            if (!storedToken.isValid) {
                const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000);
                if (storedToken.updatedAt < fifteenSecondsAgo) {
                    throw new common_1.UnauthorizedException('Session has been revoked');
                }
            }
            await this.prisma.userToken.update({
                where: { id: storedToken.id },
                data: { isValid: false },
            });
            return this.createSession(storedToken.user.id, storedToken.user.email, storedToken.user.role);
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid session context');
        }
    }
    async logout(accessToken) {
        await this.prisma.userToken.deleteMany({
            where: { accessToken },
        });
        return { message: 'Logged out successfully' };
    }
    async validateSessionUser(accessToken) {
        try {
            const payload = this.jwtService.verify(accessToken, {
                secret: this.configService.get('JWT_SECRET'),
            });
            const user = await this.prisma.user.findUnique({
                where: { id: payload.sub },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    outletId: true,
                    createdAt: true,
                },
            });
            if (!user) {
                throw new common_1.UnauthorizedException('User account no longer exists');
            }
            return user;
        }
        catch (error) {
            throw new common_1.UnauthorizedException('Session token is invalid or expired', error);
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        user_service_1.UserService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map