import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const row = await p.booking.findFirst();
  console.log('Booking row:', row);
}
main().finally(() => p.$disconnect());
