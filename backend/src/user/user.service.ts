import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { User, Role } from '@prisma/client';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  // Centralized hierarchy map to enforce operational boundaries
  private validateRoleHierarchy(requestorRole: Role, targetRole: Role) {
    if (requestorRole === Role.ADMIN) {
      // Allow ADMIN to manage and create both ADMINs and USERs
      return;
    }

    throw new ForbiddenException(
      'Security violation: You do not possess provisioning permissions',
    );
  }

  async findUserByEmail(email: string) {
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

  async findUserForAuth(email: string): Promise<User | null> {
    return await this.prisma.user.findUnique({ where: { email } });
  }

  async createUser(data: any): Promise<User> {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: data.email },
    });
    if (existingUser) {
      throw new ConflictException('Email Already Exists');
    }
    return await this.prisma.user.create({ data });
  }

  async createManagedUser(
    dto: CreateManagedUserDto,
    requestingUser: any,
  ): Promise<Omit<User, 'password'>> {
    // Enforce Role Hierarchy
    this.validateRoleHierarchy(requestingUser.role, dto.role);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        role: dto.role,
      },
    });

    const sanitizedUser = { ...user };
    delete (sanitizedUser as any).password;
    return sanitizedUser;
  }

  async findAllManagedUsers(
    query: any,
    requestingUser: any,
  ): Promise<{ data: Partial<User>[]; meta: any }> {
    if (requestingUser.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Security violation: You do not possess view permissions',
      );
    }

    const where: any = {};
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

  async updateManagedUser(
    id: string,
    dto: UpdateManagedUserDto,
    requestingUser: any,
  ) {
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      throw new NotFoundException('User target instance not found');
    }

    // Validate permission hierarchy on current state
    this.validateRoleHierarchy(requestingUser.role, targetUser.role);

    // Validate permission hierarchy on incoming state modifications
    if (dto.role) {
      this.validateRoleHierarchy(requestingUser.role, dto.role);
    }

    const updateData: any = { ...dto };

    if (dto.email && dto.email !== targetUser.email) {
      const emailConflict = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (emailConflict) {
        throw new ConflictException('Email is already taken by another user');
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
    delete (sanitizedUser as any).password;
    return sanitizedUser;
  }

  async deleteManagedUser(id: string, requestingUser: any) {
    if (id === requestingUser.id) {
      throw new BadRequestException(
        'Security violation: You cannot delete your own account',
      );
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      throw new NotFoundException('User target instance not found');
    }

    this.validateRoleHierarchy(requestingUser.role, targetUser.role);

    await this.prisma.user.delete({ where: { id } });
    return { success: true, message: 'User account purged completely' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Incorrect current password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { success: true, message: 'Password updated successfully' };
  }
}
