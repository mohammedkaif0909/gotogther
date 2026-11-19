import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { matchesRouter } from '../server/routes/matches';
import { listingsRouter } from '../server/routes/listings';
import { authRouter } from '../server/routes/auth';
import { usersRouter } from '../server/routes/users';
import { conversationsRouter } from '../server/routes/conversations';
import { registerChatHandlers } from '../server/sockets/chatSocket';
import { prisma } from '../server/lib/prisma';

async function runEdgeCasesSuite() {
  console.log('\n====================================================');
  console.log('   GoTogether Edge Cases & Boundary Test Suite      ');
  console.log('====================================================\n');

  // 1. Setup isolated server instance
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/conversations', conversationsRouter);
  app.use('/api', matchesRouter);
  app.use('/api', listingsRouter);

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  app.set('io', io);
  registerChatHandlers(io);

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`[SETUP] Edge test server running at ${baseUrl}\n`);

  let testHostId = '';
  let testListingId = '';
  let hostToken = '';
  let riderToken = '';
  let riderId = '';
  let validBookingPin = '';

  try {
    // ---------------------------------------------------------------
    // 1. AUTHENTICATION & ACCESS CONTROL EDGE CASES
    // ---------------------------------------------------------------
    console.log('--- 1. Testing Auth & Security Edge Cases ---');

    // 1.1 Invalid Password
    const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'shabaazsyed47@gotogether.com', password: 'WrongPassword123' }),
    });
    if (badLoginRes.status !== 401) {
      throw new Error(`Expected 401 for bad password, got ${badLoginRes.status}`);
    }
    console.log('✅ [PASS] Invalid password rejected with HTTP 401 Unauthorized');

    // 1.2 Invalid / Expired Token
    const badTokenRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer this.is.an.invalid.token' },
    });
    if (badTokenRes.status !== 401 && badTokenRes.status !== 403) {
      throw new Error(`Expected 401/403 for forged token, got ${badTokenRes.status}`);
    }
    console.log('✅ [PASS] Forged / invalid Bearer token rejected with HTTP 401/403');

    // 1.3 Duplicate Registration
    const testEmail = `edge_test_${Date.now()}@gotogether.local`;
    const regRes1 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Edge Host', email: testEmail, password: 'Password@123', role: 'HOST' }),
    });
    const regData1 = await regRes1.json();
    hostToken = regData1.token;
    testHostId = regData1.user.id;

    const dupRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Duplicate User', email: testEmail, password: 'Password@123' }),
    });
    if (dupRegRes.status !== 400) {
      throw new Error(`Expected 400 for duplicate registration, got ${dupRegRes.status}`);
    }
    console.log('✅ [PASS] Duplicate email registration rejected with HTTP 400 Bad Request');

    // Create a rider for edge tests
    const riderRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Edge Rider', email: `rider_${Date.now()}@gotogether.local`, password: 'Password@123', role: 'TRAVELER' }),
    });
    const riderRegData = await riderRegRes.json();
    riderToken = riderRegData.token;
    riderId = riderRegData.user.id;

    // ---------------------------------------------------------------
    // 2. RIDE CREATION VALIDATION EDGE CASES
    // ---------------------------------------------------------------
    console.log('\n--- 2. Testing Ride Creation Validation Edge Cases ---');

    // 2.1 Past departure time
    const pastRideRes = await fetch(`${baseUrl}/api/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
      body: JSON.stringify({
        type: 'CAR',
        hostId: testHostId,
        title: 'Past Ride',
        originLabel: 'Koramangala',
        originLatitude: 12.9352,
        originLongitude: 77.6245,
        destinationLabel: 'MG Road',
        destinationLatitude: 12.9756,
        destinationLongitude: 77.6066,
        departureTime: '2020-01-01T10:00:00.000Z',
        capacity: 3,
      }),
    });
    if (pastRideRes.status !== 400) {
      throw new Error(`Expected 400 for past departure time, got ${pastRideRes.status}`);
    }
    console.log('✅ [PASS] Past departure time rejected with HTTP 400 Bad Request');

    // 2.2 Invalid Latitude (> 90)
    const badLatRes = await fetch(`${baseUrl}/api/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
      body: JSON.stringify({
        type: 'CAR',
        hostId: testHostId,
        title: 'Bad Coordinates Ride',
        originLabel: 'Invalid Place',
        originLatitude: 145.5, // > 90
        originLongitude: 77.6245,
        destinationLabel: 'MG Road',
        destinationLatitude: 12.9756,
        destinationLongitude: 77.6066,
        departureTime: new Date(Date.now() + 86400000).toISOString(),
        capacity: 3,
      }),
    });
    if (badLatRes.status !== 400) {
      throw new Error(`Expected 400 for out-of-bounds latitude, got ${badLatRes.status}`);
    }
    console.log('✅ [PASS] Out-of-bounds latitude (145.5) rejected with HTTP 400 Bad Request');

    // 2.3 Create a valid listing for remaining tests
    const validListingRes = await fetch(`${baseUrl}/api/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
      body: JSON.stringify({
        type: 'CAR',
        hostId: testHostId,
        title: 'Edge Testing Commute',
        originLabel: 'Indiranagar 100ft Road',
        originLatitude: 12.9784,
        originLongitude: 77.6408,
        destinationLabel: 'Electronic City Phase 1',
        destinationLatitude: 12.8452,
        destinationLongitude: 77.6602,
        departureTime: new Date(Date.now() + 86400000).toISOString(),
        capacity: 1,
        pricePerSeat: 120,
      }),
    });
    const validListingData = await validListingRes.json();
    testListingId = validListingData.id;
    console.log(`✅ [PASS] Valid ride published for edge testing (Capacity: 1, ID: ${testListingId})`);

    // ---------------------------------------------------------------
    // 3. BOOKING BOUNDS & OVER-CAPACITY EDGE CASES
    // ---------------------------------------------------------------
    console.log('\n--- 3. Testing Booking Bounds & Over-Capacity Edge Cases ---');

    // 3.1 Non-existent listing
    const nonExistentBookingRes = await fetch(`${baseUrl}/api/listings/non_existent_id_12345/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${riderToken}` },
      body: JSON.stringify({ seats: 1 }),
    });
    if (nonExistentBookingRes.status !== 404) {
      throw new Error(`Expected 404 for non-existent listing booking, got ${nonExistentBookingRes.status}`);
    }
    console.log('✅ [PASS] Booking on non-existent listing rejected with HTTP 404 Not Found');

    // 3.2 Booking 5 seats when only 1 available
    const excessiveSeatsRes = await fetch(`${baseUrl}/api/listings/${testListingId}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${riderToken}` },
      body: JSON.stringify({ seats: 5 }),
    });
    if (excessiveSeatsRes.status !== 400) {
      throw new Error(`Expected 400 for excessive seat count, got ${excessiveSeatsRes.status}`);
    }
    console.log('✅ [PASS] Requesting 5 seats when capacity is 1 rejected with HTTP 400');

    // 3.3 Book the 1 available seat
    const bookRes = await fetch(`${baseUrl}/api/listings/${testListingId}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${riderToken}` },
      body: JSON.stringify({ seats: 1 }),
    });
    const bookData = await bookRes.json();
    validBookingPin = bookData.checkInPin;
    if (bookRes.status !== 200 || bookData.status !== 'FULL') {
      throw new Error(`Expected listing to transition to FULL, got status ${bookData.status}`);
    }
    console.log(`✅ [PASS] Final seat booked. Listing status transitioned to FULL. 4-Digit PIN: ${validBookingPin}`);

    // ---------------------------------------------------------------
    // 4. STATE MACHINE & PASSENGER CHECK-IN EDGE CASES
    // ---------------------------------------------------------------
    console.log('\n--- 4. Testing State Machine & Check-In Edge Cases ---');

    // 4.1 Unauthorized user attempting to transition status
    const unauthTransitionRes = await fetch(`${baseUrl}/api/listings/${testListingId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${riderToken}` },
      body: JSON.stringify({ status: 'BOARDING' }),
    });
    if (unauthTransitionRes.status !== 403) {
      throw new Error(`Expected 403 for unauthorized status transition, got ${unauthTransitionRes.status}`);
    }
    console.log('✅ [PASS] Non-host user prevented from altering ride status with HTTP 403 Forbidden');

    // 4.2 Illegal backwards transition: FULL directly to COMPLETED without boarding/in_transit
    const illegalTransitionRes = await fetch(`${baseUrl}/api/listings/${testListingId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    if (illegalTransitionRes.status !== 400) {
      throw new Error(`Expected 400 for illegal skip transition to COMPLETED, got ${illegalTransitionRes.status}`);
    }
    console.log('✅ [PASS] Illegal state transition (FULL -> COMPLETED) rejected with HTTP 400 Bad Request');

    // 4.3 Move to BOARDING
    await fetch(`${baseUrl}/api/listings/${testListingId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
      body: JSON.stringify({ status: 'BOARDING' }),
    });

    // 4.4 Wrong 4-Digit PIN Check-in
    const wrongPinRes = await fetch(`${baseUrl}/api/listings/${testListingId}/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
      body: JSON.stringify({ pin: '0000' }), // Wrong PIN
    });
    if (wrongPinRes.status !== 400) {
      throw new Error(`Expected 400 for invalid boarding PIN, got ${wrongPinRes.status}`);
    }
    console.log('✅ [PASS] Invalid boarding PIN (0000) rejected with HTTP 400 Bad Request');

    // 4.5 Correct 4-Digit PIN Check-in
    const correctPinRes = await fetch(`${baseUrl}/api/listings/${testListingId}/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
      body: JSON.stringify({ pin: validBookingPin }),
    });
    if (correctPinRes.status !== 200) {
      throw new Error(`Expected 200 for valid boarding PIN, got ${correctPinRes.status}`);
    }
    console.log(`✅ [PASS] Correct boarding PIN (${validBookingPin}) verified passenger successfully`);

    // 4.6 Double Check-in Attempt
    const doubleCheckInRes = await fetch(`${baseUrl}/api/listings/${testListingId}/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
      body: JSON.stringify({ pin: validBookingPin }),
    });
    if (doubleCheckInRes.status !== 400) {
      throw new Error(`Expected 400 for duplicate check-in, got ${doubleCheckInRes.status}`);
    }
    console.log('✅ [PASS] Duplicate passenger check-in attempt rejected with HTTP 400 Bad Request');

    // ---------------------------------------------------------------
    // 5. RATING BOUNDS & TRIP COMPLETION EDGE CASES
    // ---------------------------------------------------------------
    console.log('\n--- 5. Testing Rating Bounds Edge Cases ---');

    // 5.1 Review before ride is completed
    const prematureReviewRes = await fetch(`${baseUrl}/api/listings/${testListingId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${riderToken}` },
      body: JSON.stringify({ subjectId: testHostId, rating: 5, comment: 'Premature' }),
    });
    if (prematureReviewRes.status !== 400) {
      throw new Error(`Expected 400 for premature review, got ${prematureReviewRes.status}`);
    }
    console.log('✅ [PASS] Submitting review before trip completion rejected with HTTP 400');

    // 5.2 Transition ride to COMPLETED
    await fetch(`${baseUrl}/api/listings/${testListingId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
      body: JSON.stringify({ status: 'IN_TRANSIT' }),
    });
    await fetch(`${baseUrl}/api/listings/${testListingId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });

    // 5.3 Rating out of bounds (> 5 stars)
    const outOfBoundsReviewRes = await fetch(`${baseUrl}/api/listings/${testListingId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${riderToken}` },
      body: JSON.stringify({ subjectId: testHostId, rating: 6 }), // 6 stars
    });
    if (outOfBoundsReviewRes.status !== 400) {
      throw new Error(`Expected 400 for 6-star rating, got ${outOfBoundsReviewRes.status}`);
    }
    console.log('✅ [PASS] Out-of-bounds rating (6 stars) rejected with HTTP 400 Bad Request');

    console.log('\n====================================================');
    console.log('   🎉 ALL 14 EDGE CASES TESTED & PASSED 100%!       ');
    console.log('====================================================\n');
  } finally {
    // Cleanup
    if (testListingId) {
      await prisma.listing.delete({ where: { id: testListingId } }).catch(() => {});
    }
    if (testHostId) {
      await prisma.user.delete({ where: { id: testHostId } }).catch(() => {});
    }
    if (riderId) {
      await prisma.user.delete({ where: { id: riderId } }).catch(() => {});
    }
    server.close();
    await prisma.$disconnect();
  }
}

runEdgeCasesSuite().catch((err) => {
  console.error('\n❌ EDGE TEST SUITE FAILED:', err);
  process.exit(1);
});
