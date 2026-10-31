// prisma/seed.ts
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const MIN_PASSWORD_LENGTH = 8;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is missing. Set it in backend/.env`);
  }
  return value;
}

async function main() {
  const email = requireEnv('ADMIN_EMAIL');
  const password = requireEnv('ADMIN_PASSWORD');
  const name = process.env.ADMIN_NAME?.trim() || 'Admin';

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requireEnv('DATABASE_URL') }),
  });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // Upsert keeps the seed safe to re-run, and makes .env the source of truth
    // for the admin's name and password.
    const admin = await prisma.user.upsert({
      where: { email },
      update: { name, password: hashedPassword, role: Role.ADMIN },
      create: { email, name, password: hashedPassword, role: Role.ADMIN },
    });

    console.log(`Admin ready: ${admin.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: Error) => {
  console.error(`Seed failed: ${error.message}`);
  process.exit(1);
});
