import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding checkInPin and isCheckedIn columns to Booking table...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public."Booking" 
    ADD COLUMN IF NOT EXISTS "checkInPin" TEXT,
    ADD COLUMN IF NOT EXISTS "isCheckedIn" BOOLEAN DEFAULT false;
  `);
  console.log('Columns added successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
