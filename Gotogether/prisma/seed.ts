import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Supabase database...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  // 1. Create sample host users
  const host1 = await prisma.user.upsert({
    where: { email: 'arjun.sharma@example.com' },
    update: {},
    create: {
      id: 'user-host-1',
      name: 'Arjun Sharma',
      email: 'arjun.sharma@example.com',
      password: hashedPassword,
      role: 'HOST',
      phone: '+91 98765 43210',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      bio: 'Daily tech corridor commuter. Safe driving guaranteed.',
      gender: 'MALE',
      isVerified: true,
      verificationStatus: 'ID_VERIFIED',
      organization: 'Tech Park SEZ',
      homeLatitude: 12.9279,
      homeLongitude: 77.6271,
      ratingAvg: 4.9,
      ratingCount: 38,
      tripsCompleted: 42,
    },
  });

  const host2 = await prisma.user.upsert({
    where: { email: 'priya.patel@example.com' },
    update: {},
    create: {
      id: 'user-host-2',
      name: 'Priya Patel',
      email: 'priya.patel@example.com',
      password: hashedPassword,
      role: 'HOST',
      phone: '+91 91234 56789',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      bio: 'Electric car enthusiast commuting Koramangala to Whitefield.',
      gender: 'FEMALE',
      isVerified: true,
      verificationStatus: 'ID_VERIFIED',
      organization: 'Startup Hub',
      homeLatitude: 12.9352,
      homeLongitude: 77.6245,
      ratingAvg: 4.8,
      ratingCount: 22,
      tripsCompleted: 27,
    },
  });

  const traveler = await prisma.user.upsert({
    where: { email: 'rohit.kumar@example.com' },
    update: {},
    create: {
      id: 'demo-current-user',
      name: 'Rohit Kumar',
      email: 'rohit.kumar@example.com',
      password: hashedPassword,
      role: 'TRAVELER',
      phone: '+91 99887 76655',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      gender: 'MALE',
      isVerified: true,
      verificationStatus: 'PHONE_VERIFIED',
    },
  });

  // Admin account
  const adminHashedPassword = await bcrypt.hash('Sha@7867', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'shabaazsyed47@gotogether.com' },
    update: {
      name: 'shabaazsyed',
      password: adminHashedPassword,
      role: 'ADMIN',
    },
    create: {
      id: 'user-admin-shabaaz',
      name: 'shabaazsyed',
      email: 'shabaazsyed47@gotogether.com',
      password: adminHashedPassword,
      role: 'ADMIN',
      phone: '+91 90000 00001',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      isVerified: true,
      verificationStatus: 'ID_VERIFIED',
    },
  });

  // Moderator account
  const modHashedPassword = await bcrypt.hash('kaif@6036', 10);
  const moderator = await prisma.user.upsert({
    where: { email: 'mohammadkaif13@gotogether.com' },
    update: {
      name: 'mohammadkaif',
      password: modHashedPassword,
      role: 'MODERATOR',
    },
    create: {
      id: 'user-mod-kaif',
      name: 'mohammadkaif',
      email: 'mohammadkaif13@gotogether.com',
      password: modHashedPassword,
      role: 'MODERATOR',
      phone: '+91 90000 00002',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      isVerified: true,
      verificationStatus: 'ID_VERIFIED',
    },
  });

  // 2. Create sample listings
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 30, 0, 0);

  const tomorrowEvening = new Date();
  tomorrowEvening.setDate(tomorrowEvening.getDate() + 1);
  tomorrowEvening.setHours(18, 0, 0, 0);

  await prisma.listing.upsert({
    where: { id: 'listing-car-1' },
    update: {},
    create: {
      id: 'listing-car-1',
      type: 'CAR',
      title: 'Koramangala to Electronic City Expressway',
      description: 'Morning commute via Elevated Expressway. AC car, smooth ride, AC on, good music.',
      hostId: host1.id,
      originLabel: 'Koramangala 4th Block, Bengaluru',
      originLatitude: 12.9345,
      originLongitude: 77.6253,
      destinationLabel: 'Electronic City Phase 1, Bengaluru',
      destinationLatitude: 12.8399,
      destinationLongitude: 77.6770,
      departureTime: tomorrow,
      capacity: 3,
      seatsBooked: 1,
      pricePerSeat: 120,
      currency: '₹',
      paceLevel: 'INTERMEDIATE',
      tags: JSON.stringify(['AC', 'Non-smoking', 'Luggage space', 'Pet-friendly']),
      status: 'OPEN',
    },
  });

  await prisma.listing.upsert({
    where: { id: 'listing-bike-1' },
    update: {},
    create: {
      id: 'listing-bike-1',
      type: 'BIKE',
      title: 'Indiranagar to Manyata Tech Park Quick Ride',
      description: 'Quick morning bike commute. Spare sanitized helmet provided. Safe rider.',
      hostId: host1.id,
      originLabel: 'Indiranagar 100ft Road, Bengaluru',
      originLatitude: 12.9784,
      originLongitude: 77.6408,
      destinationLabel: 'Manyata Tech Park, Hebbal, Bengaluru',
      destinationLatitude: 13.0475,
      destinationLongitude: 77.6200,
      departureTime: tomorrow,
      capacity: 1,
      seatsBooked: 0,
      pricePerSeat: 70,
      currency: '₹',
      paceLevel: 'BEGINNER',
      tags: JSON.stringify(['Helmet provided', 'Express transit', 'No smoking']),
      status: 'OPEN',
    },
  });

  await prisma.listing.upsert({
    where: { id: 'listing-car-2' },
    update: {},
    create: {
      id: 'listing-car-2',
      type: 'CAR',
      title: 'HSR Layout to Bellandur EcoSpace',
      description: 'Zero emission EV ride along Outer Ring Road. Quiet and comfortable.',
      hostId: host2.id,
      originLabel: 'HSR Layout Sector 1, Bengaluru',
      originLatitude: 12.9121,
      originLongitude: 77.6446,
      destinationLabel: 'RMZ EcoSpace, Bellandur, Bengaluru',
      destinationLatitude: 12.9260,
      destinationLongitude: 77.6833,
      departureTime: tomorrowEvening,
      capacity: 4,
      seatsBooked: 1,
      pricePerSeat: 90,
      currency: '₹',
      paceLevel: 'INTERMEDIATE',
      tags: JSON.stringify(['Electric Vehicle', 'Women only option', 'Silent ride']),
      status: 'OPEN',
    },
  });

  console.log('✅ Supabase database successfully seeded with users and listings!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
