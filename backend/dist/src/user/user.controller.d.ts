import { UserService } from './user.service';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
export declare class UserController {
    private readonly userService;
    constructor(userService: UserService);
    changePassword(dto: ChangePasswordDto, req: any): Promise<{
        success: boolean;
        message: string;
    }>;
    provisionUser(dto: CreateManagedUserDto, req: any): Promise<{
        success: boolean;
        message: string;
        data: Omit<{
            id: string;
            email: string;
            name: string | null;
            password: string;
            role: import("@prisma/client").$Enums.Role;
            createdAt: Date;
            updatedAt: Date;
            outletId: string | null;
        }, "password">;
    }>;
    getAllUsers(query: any, req: any): Promise<{
        success: boolean;
        data: Partial<{
            id: string;
            email: string;
            name: string | null;
            password: string;
            role: import("@prisma/client").$Enums.Role;
            createdAt: Date;
            updatedAt: Date;
            outletId: string | null;
        }>[];
        meta: any;
    }>;
    updateUser(id: string, dto: UpdateManagedUserDto, req: any): Promise<{
        success: boolean;
        message: string;
        data: {
            id: string;
            email: string;
            name: string | null;
            password: string;
            role: import("@prisma/client").$Enums.Role;
            createdAt: Date;
            updatedAt: Date;
            outletId: string | null;
        };
    }>;
    removeUser(id: string, req: any): Promise<{
        success: boolean;
        message: string;
    }>;
}
