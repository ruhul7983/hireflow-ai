import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    // Switch the execution context to HTTP and extract the raw request object
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // If a specific property is requested (e.g., @GetUser('id')), return just that property
    return data ? user?.[data] : user;
  },
);
