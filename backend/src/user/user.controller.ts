import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DatabaseAuthGuard } from 'src/auth/guards/database-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('users')
@UseGuards(DatabaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('change-password')
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: any) {
    return await this.userService.changePassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Post('provision')
  async provisionUser(@Body() dto: CreateManagedUserDto, @Req() req: any) {
    const data = await this.userService.createManagedUser(dto, req.user);
    return { success: true, message: 'User provisioned successfully', data };
  }

  @Get()
  async getAllUsers(@Query() query: any, @Req() req: any) {
    const result = await this.userService.findAllManagedUsers(query, req.user);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Patch(':id')
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateManagedUserDto,
    @Req() req: any,
  ) {
    const data = await this.userService.updateManagedUser(id, dto, req.user);
    return {
      success: true,
      message: 'User configuration updated successfully',
      data,
    };
  }

  @Delete(':id')
  async removeUser(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return await this.userService.deleteManagedUser(id, req.user);
  }
}
