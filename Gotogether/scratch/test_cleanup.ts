import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testSelectiveCleanup() {
  console.log('Testing selective mock cleanup query...');

  const mockUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { endsWith: '@example.com' } },
        { email: { endsWith: '@test.com' } },
        { id: { startsWith: 'user-host-' } },
        { id: { startsWith: 'demo-' } },
      ],
    },
    select: { id: true, email: true },
  });

  console.log('Identified mock users to delete:', mockUsers);

  const mockListings = await prisma.listing.findMany({
    where: {
      OR: [
        { id: { startsWith: 'listing-' } },
        { hostId: { in: mockUsers.map((u) => u.id) } },
      ],
    },
    select: { id: true, title: true },
  });

  console.log('Identified mock listings to delete:', mockListings);

  console.log('\nExecuting selective mock cleanup in a transaction...');
  await prisma.$transaction(async (tx) => {
    const mockUserIds = mockUsers.map((u) => u.id);
    const mockListingIds = mockListings.map((l) => l.id);

    // 1. Delete messages in chat rooms involving mock requests/listings
    await tx.message.deleteMany({
      where: {
        OR: [
          { senderId: { in: mockUserIds } },
          { chatRoom: { matchRequest: { listingId: { in: mockListingIds } } } },
          { chatRoom: { matchRequest: { requesterId: { in: mockUserIds } } } },
        ],
      },
    });

    // 2. Delete chat rooms
    await tx.chatRoom.deleteMany({
      where: {
        OR: [
          { matchRequest: { listingId: { in: mockListingIds } } },
          { matchRequest: { requesterId: { in: mockUserIds } } },
        ],
      },
    });

    // 3. Delete match requests
    await tx.matchRequest.deleteMany({
      where: {
        OR: [
          { listingId: { in: mockListingIds } },
          { requesterId: { in: mockUserIds } },
        ],
      },
    });

    // 4. Delete bookings
    await tx.booking.deleteMany({
      where: {
        OR: [
          { listingId: { in: mockListingIds } },
          { userId: { in: mockUserIds } },
        ],
      },
    });

    // 5. Delete reviews
    await tx.review.deleteMany({
      where: {
        OR: [
          { authorId: { in: mockUserIds } },
          { subjectId: { in: mockUserIds } },
          { listingId: { in: mockListingIds } },
        ],
      },
    });

    // 6. Delete user preferences
    await tx.userPreference.deleteMany({
      where: { userId: { in: mockUserIds } },
    });

    // 7. Delete mock listings
    await tx.listing.deleteMany({
      where: { id: { in: mockListingIds } },
    });

    // 8. Delete mock users
    await tx.user.deleteMany({
      where: { id: { in: mockUserIds } },
    });
  });

  console.log('✅ Selective mock deletion executed cleanly!');

  // Verification counts
  const userCount = await prisma.user.count();
  const listingCount = await prisma.listing.count();
  const bookingCount = await prisma.booking.count();
  const matchRequestCount = await prisma.matchRequest.count();
  const chatRoomCount = await prisma.chatRoom.count();
  const messageCount = await prisma.message.count();

  console.log('\nRemaining counts after selective cleanup:');
  console.log({
    users: userCount,
    listings: listingCount,
    bookings: bookingCount,
    matchRequests: matchRequestCount,
    chatRooms: chatRoomCount,
    messages: messageCount,
  });

  const remainingUsers = await prisma.user.findMany({ select: { name: true, email: true, role: true } });
  console.log('Remaining users:', remainingUsers);
}

testSelectiveCleanup()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
