// src/dashboard/dashboard.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { DatabaseAuthGuard } from 'src/auth/guards/database-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(DatabaseAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  overview(@GetUser('id') userId: string) {
    return this.dashboard.overview(userId);
  }
}
