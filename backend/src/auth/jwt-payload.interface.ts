// src/auth/jwt-payload.interface.ts

import { Role } from '@prisma/client';

export interface JwtPayload {
  /** The unique User ID stored as the token subject */
  sub: string;

  /** The authenticated user's email address */
  email: string;

  /** The explicit application authorization role */
  role: Role;
}
