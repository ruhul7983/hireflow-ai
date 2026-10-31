"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../prisma/prisma.service");
let DatabaseAuthGuard = class DatabaseAuthGuard {
    jwtService;
    configService;
    prisma;
    constructor(jwtService, configService, prisma) {
        this.jwtService = jwtService;
        this.configService = configService;
        this.prisma = prisma;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const token = request.cookies?.['access_token'];
        if (!token) {
            throw new common_1.UnauthorizedException('Access token missing from session cookies');
        }
        try {
            this.jwtService.verify(token, {
                secret: this.configService.get('JWT_SECRET'),
            });
            const session = await this.prisma.userToken.findUnique({
                where: { accessToken: token },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            role: true,
                            outletId: true,
                        },
                    },
                },
            });
            if (!session || !session.isValid) {
                throw new common_1.UnauthorizedException('Session revoked or logged out');
            }
            request.user = session.user;
            return true;
        }
        catch {
            throw new common_1.UnauthorizedException('Session token invalid or expired');
        }
    }
};
exports.DatabaseAuthGuard = DatabaseAuthGuard;
exports.DatabaseAuthGuard = DatabaseAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService,
        prisma_service_1.PrismaService])
], DatabaseAuthGuard);
//# sourceMappingURL=database-auth.guard.js.map