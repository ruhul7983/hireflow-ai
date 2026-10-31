// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * IMPORT NOTE:
 * We import from the folder index '../generated/prisma', NOT from '/client'.
 * This allows TypeScript to resolve the full type definitions for your models.
 */
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private configService: ConfigService) {
    const connectionString = configService.get<string>('DATABASE_URL');

    // Initialize the PostgreSQL pool (Standard for Prisma 7 + PG)
    const pool = new Pool({ connectionString });

    // Initialize the adapter
    const adapter = new PrismaPg(pool);

    // Pass the adapter to the parent PrismaClient class
    super({ adapter });
  }

  async onModuleInit() {
    // Explicitly connect when the module starts
    await this.$connect();
  }

  async onModuleDestroy() {
    // Gracefully disconnect when the app shuts down
    await this.$disconnect();
  }
}
