import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Safely removes mock seed data from Supabase/PostgreSQL while preserving
 * real user accounts and the System Admin account.
 */
export async function cleanMockData() {
  console.log('🔍 Identifying mock seed data...');

  // Identify mock users by known seed patterns
  const mockUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { endsWith: '@example.com' } },
        { email: { endsWith: '@test.com' } },
        { id: { startsWith: 'user-host-' } },
        { id: { startsWith: 'demo-' } },
      ],
    },
    select: { id: true, email: true, name: true },
  });

  const mockUserIds = mockUsers.map((u) => u.id);

  // Identify mock listings
  const mockListings = await prisma.listing.findMany({
    where: {
      OR: [
        { id: { startsWith: 'listing-' } },
        { hostId: { in: mockUserIds } },
      ],
    },
    select: { id: true, title: true },
  });

  const mockListingIds = mockListings.map((l) => l.id);

  console.log(`Found ${mockUsers.length} mock user(s) and ${mockListings.length} mock listing(s).`);

  if (mockUserIds.length === 0 && mockListingIds.length === 0) {
    console.log('✨ No mock data found. Database is already clean.');
    return;
  }

  console.log('🗑️  Deleting mock data respecting foreign key dependency hierarchy...');

  await prisma.$transaction(async (tx) => {
    // 1. Delete Messages linked to mock chat rooms or sent by mock users
    const deletedMessages = await tx.message.deleteMany({
      where: {
        OR: [
          { senderId: { in: mockUserIds } },
          { chatRoom: { matchRequest: { listingId: { in: mockListingIds } } } },
          { chatRoom: { matchRequest: { requesterId: { in: mockUserIds } } } },
        ],
      },
    });

    // 2. Delete ChatRooms linked to mock match requests
    const deletedChatRooms = await tx.chatRoom.deleteMany({
      where: {
        OR: [
          { matchRequest: { listingId: { in: mockListingIds } } },
          { matchRequest: { requesterId: { in: mockUserIds } } },
        ],
      },
    });

    // 3. Delete MatchRequests linked to mock listings or mock users
    const deletedMatchRequests = await tx.matchRequest.deleteMany({
      where: {
        OR: [
          { listingId: { in: mockListingIds } },
          { requesterId: { in: mockUserIds } },
        ],
      },
    });

    // 4. Delete Bookings linked to mock listings or made by mock users
    const deletedBookings = await tx.booking.deleteMany({
      where: {
        OR: [
          { listingId: { in: mockListingIds } },
          { userId: { in: mockUserIds } },
        ],
      },
    });

    // 5. Delete Reviews
    const deletedReviews = await tx.review.deleteMany({
      where: {
        OR: [
          { authorId: { in: mockUserIds } },
          { subjectId: { in: mockUserIds } },
          { listingId: { in: mockListingIds } },
        ],
      },
    });

    // 6. Delete UserPreferences
    const deletedPrefs = await tx.userPreference.deleteMany({
      where: { userId: { in: mockUserIds } },
    });

    // 7. Delete mock Listings
    const deletedListings = await tx.listing.deleteMany({
      where: { id: { in: mockListingIds } },
    });

    // 8. Delete mock Users
    const deletedUsers = await tx.user.deleteMany({
      where: { id: { in: mockUserIds } },
    });

    console.log('Deleted records summary:');
    console.log({
      messages: deletedMessages.count,
      chatRooms: deletedChatRooms.count,
      matchRequests: deletedMatchRequests.count,
      bookings: deletedBookings.count,
      reviews: deletedReviews.count,
      userPreferences: deletedPrefs.count,
      listings: deletedListings.count,
      users: deletedUsers.count,
    });
  });

  console.log('✅ Mock data cleanup completed successfully!');
}

async function verify() {
  console.log('\n📊 Current Database Row Counts:');
  const [users, listings, bookings, matchRequests, chatRooms, messages] = await Promise.all([
    prisma.user.count(),
    prisma.listing.count(),
    prisma.booking.count(),
    prisma.matchRequest.count(),
    prisma.chatRoom.count(),
    prisma.message.count(),
  ]);

  console.log({
    'public.User': users,
    'public.Listing': listings,
    'public.Booking': bookings,
    'public.MatchRequest': matchRequests,
    'public.ChatRoom': chatRooms,
    'public.Message': messages,
  });

  const activeUsers = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
  });
  console.log('\nActive Users:', activeUsers);
}

async function run() {
  try {
    await cleanMockData();
    await verify();
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith('cleanupMockData.ts') || process.argv[1]?.endsWith('cleanupMockData.js')) {
  run();
}
