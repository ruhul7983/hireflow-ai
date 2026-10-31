import { Role } from '@prisma/client';
export declare class UpdateManagedUserDto {
    email?: string;
    name?: string;
    password?: string;
    role?: Role;
    outletId?: string;
}
