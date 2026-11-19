import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspect() {
  console.log('--- Inspecting Database Contents ---');

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
  });
  console.log(`\nUsers (${users.length}):`, users);

  const preferences = await prisma.userPreference.findMany();
  console.log(`\nUserPreferences (${preferences.length}):`, preferences);

  const listings = await prisma.listing.findMany({
    select: { id: true, title: true, hostId: true, type: true, status: true },
  });
  console.log(`\nListings (${listings.length}):`, listings);

  const matchRequests = await prisma.matchRequest.findMany({
    select: { id: true, listingId: true, requesterId: true, status: true },
  });
  console.log(`\nMatchRequests (${matchRequests.length}):`, matchRequests);

  const chatRooms = await prisma.chatRoom.findMany({
    select: { id: true, matchRequestId: true },
  });
  console.log(`\nChatRooms (${chatRooms.length}):`, chatRooms);

  const messages = await prisma.message.findMany({
    select: { id: true, chatRoomId: true, senderId: true, content: true },
  });
  console.log(`\nMessages (${messages.length}):`, messages);

  const bookings = await prisma.booking.findMany({
    select: { id: true, listingId: true, userId: true, seats: true, status: true },
  });
  console.log(`\nBookings (${bookings.length}):`, bookings);

  const reviews = await prisma.review.findMany();
  console.log(`\nReviews (${reviews.length}):`, reviews);

  try {
    const authUsers = await prisma.$queryRawUnsafe('SELECT count(*) FROM auth.users');
    console.log(`\nSupabase auth.users count:`, authUsers);
  } catch (err: any) {
    console.log(`\nSupabase auth.users query error:`, err.message);
  }
}

inspect()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
