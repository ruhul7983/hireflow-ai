import { PrismaService } from "../prisma/prisma.service";
import { User } from '@prisma/client';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';
export declare class UserService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private validateRoleHierarchy;
    findUserByEmail(email: string): Promise<{
        id: string;
        email: string;
        name: string | null;
        role: import("@prisma/client").$Enums.Role;
        createdAt: Date;
    } | null>;
    findUserForAuth(email: string): Promise<User | null>;
    createUser(data: any): Promise<User>;
    createManagedUser(dto: CreateManagedUserDto, requestingUser: any): Promise<Omit<User, 'password'>>;
    findAllManagedUsers(query: any, requestingUser: any): Promise<{
        data: Partial<User>[];
        meta: any;
    }>;
    updateManagedUser(id: string, dto: UpdateManagedUserDto, requestingUser: any): Promise<{
        id: string;
        email: string;
        name: string | null;
        password: string;
        role: import("@prisma/client").$Enums.Role;
        createdAt: Date;
        updatedAt: Date;
        outletId: string | null;
    }>;
    deleteManagedUser(id: string, requestingUser: any): Promise<{
        success: boolean;
        message: string;
    }>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
