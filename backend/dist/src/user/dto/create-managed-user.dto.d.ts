import { Role } from '@prisma/client';
export declare class CreateManagedUserDto {
    email: string;
    name: string;
    password: string;
    role: Role;
    outletId?: string;
}
