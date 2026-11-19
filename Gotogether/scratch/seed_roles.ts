import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedRoleAccounts() {
  console.log('Seeding / updating dedicated accounts for each role...');

  const accounts = [
    {
      id: 'user-admin-1',
      name: 'System Admin',
      email: 'admin@gotogether.com',
      passwordPlain: 'admin123',
      role: 'ADMIN',
      rolesArray: ['admin', 'moderator', 'driver', 'rider'],
      activeRole: 'admin',
      isVerifiedDriver: true,
      verificationStatus: 'ID_VERIFIED',
    },
    {
      id: 'user-moderator-1',
      name: 'Community Moderator',
      email: 'moderator@gotogether.com',
      passwordPlain: 'moderator123',
      role: 'MODERATOR',
      rolesArray: ['moderator', 'rider'],
      activeRole: 'moderator',
      isVerifiedDriver: false,
      verificationStatus: 'ID_VERIFIED',
    },
    {
      id: 'user-driver-1',
      name: 'Vikram Singh (Verified Driver)',
      email: 'driver@gotogether.com',
      passwordPlain: 'driver123',
      role: 'HOST',
      rolesArray: ['driver', 'rider'],
      activeRole: 'driver',
      isVerifiedDriver: true,
      verificationStatus: 'ID_VERIFIED',
    },
    {
      id: 'user-rider-1',
      name: 'Ananya Sharma (Rider)',
      email: 'rider@gotogether.com',
      passwordPlain: 'rider123',
      role: 'TRAVELER',
      rolesArray: ['rider'],
      activeRole: 'rider',
      isVerifiedDriver: false,
      verificationStatus: 'PHONE_VERIFIED',
    },
  ];

  for (const acc of accounts) {
    const hashedPassword = await bcrypt.hash(acc.passwordPlain, 10);

    // 1. Upsert into public."User"
    const user = await prisma.user.upsert({
      where: { email: acc.email },
      update: {
        name: acc.name,
        password: hashedPassword,
        role: acc.role,
        isVerified: acc.isVerifiedDriver || acc.verificationStatus === 'ID_VERIFIED',
        verificationStatus: acc.verificationStatus,
      },
      create: {
        id: acc.id,
        name: acc.name,
        email: acc.email,
        password: hashedPassword,
        role: acc.role,
        isVerified: acc.isVerifiedDriver || acc.verificationStatus === 'ID_VERIFIED',
        verificationStatus: acc.verificationStatus,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(acc.name)}`,
      },
    });

    console.log(`✅ User table: ${user.email} (${user.role})`);
  }

  // Also ensure admin@gotogether.com has role ADMIN
  await prisma.user.update({
    where: { email: 'admin@gotogether.com' },
    data: { role: 'ADMIN' },
  });

  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
  });
  console.log('\nAll users in database:');
  console.log(allUsers);
}

seedRoleAccounts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
