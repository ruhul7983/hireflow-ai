// src/auth/decorators/cookies.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const Cookies = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): any => {
    // 👈 Changed to any
    const request = ctx.switchToHttp().getRequest<Request>();
    return data ? request.cookies?.[data] : request.cookies;
  },
);
