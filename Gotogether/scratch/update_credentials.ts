import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function updateCredentials() {
  console.log('Updating Admin and Moderator credentials...');

  const adminHashedPassword = await bcrypt.hash('Sha@7867', 10);
  const modHashedPassword = await bcrypt.hash('kaif@6036', 10);

  // 1. Update Admin (admin@gotogether.com)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@gotogether.com' },
    update: {
      name: 'shabaazsyed',
      password: adminHashedPassword,
      role: 'ADMIN',
      isVerified: true,
      verificationStatus: 'ID_VERIFIED',
    },
    create: {
      id: 'user-admin-1',
      name: 'shabaazsyed',
      email: 'admin@gotogether.com',
      password: adminHashedPassword,
      role: 'ADMIN',
      isVerified: true,
      verificationStatus: 'ID_VERIFIED',
    },
  });
  console.log('✅ Admin updated:', { name: admin.name, email: admin.email, role: admin.role });

  // 2. Also ensure personal account shabaazsyed4422@gmail.com has the same password and admin role if preferred
  const personalAdmin = await prisma.user.findUnique({
    where: { email: 'shabaazsyed4422@gmail.com' },
  });
  if (personalAdmin) {
    await prisma.user.update({
      where: { email: 'shabaazsyed4422@gmail.com' },
      data: {
        name: 'shabaazsyed',
        password: adminHashedPassword,
        role: 'ADMIN',
        isVerified: true,
        verificationStatus: 'ID_VERIFIED',
      },
    });
    console.log('✅ Personal account shabaazsyed4422@gmail.com also updated to ADMIN with password Sha@7867');
  }

  // 3. Update Moderator (moderator@gotogether.com)
  const moderator = await prisma.user.upsert({
    where: { email: 'moderator@gotogether.com' },
    update: {
      name: 'mohammadkaif',
      password: modHashedPassword,
      role: 'MODERATOR',
      isVerified: true,
      verificationStatus: 'ID_VERIFIED',
    },
    create: {
      id: 'user-moderator-1',
      name: 'mohammadkaif',
      email: 'moderator@gotogether.com',
      password: modHashedPassword,
      role: 'MODERATOR',
      isVerified: true,
      verificationStatus: 'ID_VERIFIED',
    },
  });
  console.log('✅ Moderator updated:', { name: moderator.name, email: moderator.email, role: moderator.role });

  console.log('\n--- Verification ---');
  const checkAdmin = await bcrypt.compare('Sha@7867', admin.password);
  const checkMod = await bcrypt.compare('kaif@6036', moderator.password);
  console.log('Admin password verification:', checkAdmin ? 'PASSED ✅' : 'FAILED ❌');
  console.log('Moderator password verification:', checkMod ? 'PASSED ✅' : 'FAILED ❌');
}

updateCredentials()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
