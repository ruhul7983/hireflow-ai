// src/queue/redis-options.ts
import { ConfigService } from '@nestjs/config';

export function queueOptions(configService: ConfigService) {
  return {
    connection: {
      host: configService.get<string>('REDIS_HOST'),
      port: Number(configService.get('REDIS_PORT')),
      password: configService.get<string>('REDIS_PASSWORD') || undefined,
      db: Number(configService.get('REDIS_DB') ?? 0),
      maxRetriesPerRequest: null,
    },
    prefix: (configService.get<string>('REDIS_KEY_PREFIX') ?? 'hireflow').replace(
      /:$/,
      '',
    ),
  };
}
