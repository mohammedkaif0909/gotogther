import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function setExactEmails() {
  console.log('Setting exact Admin and Moderator emails & credentials...');

  const adminPasswordHash = await bcrypt.hash('Sha@7867', 10);
  const modPasswordHash = await bcrypt.hash('kaif@6036', 10);

  // 1. Clean up or reassign old placeholder emails if present
  await prisma.user.deleteMany({
    where: {
      email: { in: ['admin@gotogether.com', 'moderator@gotogether.com'] },
    },
  });

  // 2. Upsert Admin: shabaazsyed47@gotogether.com
  const admin = await prisma.user.upsert({
    where: { email: 'shabaazsyed47@gotogether.com' },
    update: {
      name: 'shabaazsyed',
      password: adminPasswordHash,
      role: 'ADMIN',
      isVerified: true,
      verificationStatus: 'ID_VERIFIED',
    },
    create: {
      id: 'user-admin-shabaaz',
      name: 'shabaazsyed',
      email: 'shabaazsyed47@gotogether.com',
      password: adminPasswordHash,
      role: 'ADMIN',
      isVerified: true,
      verificationStatus: 'ID_VERIFIED',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=shabaazsyed`,
    },
  });
  console.log('✅ Admin configured:', {
    name: admin.name,
    email: admin.email,
    role: admin.role,
  });

  // 3. Upsert Moderator: mohammadkaif13@gotogether.com
  const moderator = await prisma.user.upsert({
    where: { email: 'mohammadkaif13@gotogether.com' },
    update: {
      name: 'mohammadkaif',
      password: modPasswordHash,
      role: 'MODERATOR',
      isVerified: true,
      verificationStatus: 'ID_VERIFIED',
    },
    create: {
      id: 'user-mod-kaif',
      name: 'mohammadkaif',
      email: 'mohammadkaif13@gotogether.com',
      password: modPasswordHash,
      role: 'MODERATOR',
      isVerified: true,
      verificationStatus: 'ID_VERIFIED',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=mohammadkaif`,
    },
  });
  console.log('✅ Moderator configured:', {
    name: moderator.name,
    email: moderator.email,
    role: moderator.role,
  });

  // Verification test
  const adminCheck = await bcrypt.compare('Sha@7867', admin.password);
  const modCheck = await bcrypt.compare('kaif@6036', moderator.password);
  console.log('\nPassword verification:');
  console.log(`Admin (${admin.email}):`, adminCheck ? 'VERIFIED ✅' : 'FAILED ❌');
  console.log(`Moderator (${moderator.email}):`, modCheck ? 'VERIFIED ✅' : 'FAILED ❌');

  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
  });
  console.log('\nAll registered users now:');
  console.log(allUsers);
}

setExactEmails()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
