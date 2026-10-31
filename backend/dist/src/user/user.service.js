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
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
let UserService = class UserService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    validateRoleHierarchy(requestorRole, targetRole) {
        if (requestorRole === client_1.Role.ADMIN) {
            return;
        }
        throw new common_1.ForbiddenException('Security violation: You do not possess provisioning permissions');
    }
    async findUserByEmail(email) {
        return await this.prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
            },
        });
    }
    async findUserForAuth(email) {
        return await this.prisma.user.findUnique({ where: { email } });
    }
    async createUser(data) {
        const existingUser = await this.prisma.user.findFirst({
            where: { email: data.email },
        });
        if (existingUser) {
            throw new common_1.ConflictException('Email Already Exists');
        }
        return await this.prisma.user.create({ data });
    }
    async createManagedUser(dto, requestingUser) {
        this.validateRoleHierarchy(requestingUser.role, dto.role);
        const existingUser = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (existingUser) {
            throw new common_1.ConflictException('An account with this email already exists');
        }
        const hashedPassword = await bcrypt.hash(dto.password, 10);
        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                name: dto.name,
                password: hashedPassword,
                role: dto.role,
                outletId: dto.outletId || null,
            },
        });
        const sanitizedUser = { ...user };
        delete sanitizedUser.password;
        return sanitizedUser;
    }
    async findAllManagedUsers(query, requestingUser) {
        if (requestingUser.role !== client_1.Role.ADMIN) {
            throw new common_1.ForbiddenException('Security violation: You do not possess view permissions');
        }
        const where = {};
        if (query?.role) {
            where.role = query.role;
        }
        const page = Number(query?.page) || 1;
        const limit = Number(query?.limit) || 10;
        const skip = (page - 1) * limit;
        const [data, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    outletId: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.user.count({ where }),
        ]);
        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async updateManagedUser(id, dto, requestingUser) {
        const targetUser = await this.prisma.user.findUnique({ where: { id } });
        if (!targetUser) {
            throw new common_1.NotFoundException('User target instance not found');
        }
        this.validateRoleHierarchy(requestingUser.role, targetUser.role);
        if (dto.role) {
            this.validateRoleHierarchy(requestingUser.role, dto.role);
        }
        const updateData = { ...dto };
        if (dto.email && dto.email !== targetUser.email) {
            const emailConflict = await this.prisma.user.findUnique({
                where: { email: dto.email },
            });
            if (emailConflict) {
                throw new common_1.ConflictException('Email is already taken by another user');
            }
        }
        if (dto.password) {
            updateData.password = await bcrypt.hash(dto.password, 10);
        }
        const updatedUser = await this.prisma.user.update({
            where: { id },
            data: updateData,
        });
        const sanitizedUser = { ...updatedUser };
        delete sanitizedUser.password;
        return sanitizedUser;
    }
    async deleteManagedUser(id, requestingUser) {
        if (id === requestingUser.id) {
            throw new common_1.BadRequestException('Security violation: You cannot delete your own account');
        }
        const targetUser = await this.prisma.user.findUnique({ where: { id } });
        if (!targetUser) {
            throw new common_1.NotFoundException('User target instance not found');
        }
        this.validateRoleHierarchy(requestingUser.role, targetUser.role);
        await this.prisma.user.delete({ where: { id } });
        return { success: true, message: 'User account purged completely' };
    }
    async changePassword(userId, currentPassword, newPassword) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            throw new common_1.BadRequestException('Incorrect current password');
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });
        return { success: true, message: 'Password updated successfully' };
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UserService);
//# sourceMappingURL=user.service.js.map