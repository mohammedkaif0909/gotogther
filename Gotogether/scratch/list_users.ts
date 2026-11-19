import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isVerified: true, verificationStatus: true },
  });
  console.log('Current users in DB:', JSON.stringify(users, null, 2));

  // Also check if public.profiles has rows
  try {
    const profiles = await prisma.$queryRaw`SELECT id, full_name, roles, active_role, is_verified_driver FROM public.profiles`;
    console.log('Profiles in DB:', profiles);
  } catch (err: any) {
    console.log('Error querying profiles:', err.message);
  }
}

main().finally(() => prisma.$disconnect());
