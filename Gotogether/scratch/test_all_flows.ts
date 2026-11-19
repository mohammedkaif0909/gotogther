import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import ioClient from 'socket.io-client';
import { authRouter } from '../server/routes/auth';
import { usersRouter } from '../server/routes/users';
import { matchesRouter } from '../server/routes/matches';
import { listingsRouter } from '../server/routes/listings';
import { conversationsRouter } from '../server/routes/conversations';
import { registerChatHandlers } from '../server/sockets/chatSocket';
import { prisma } from '../server/lib/prisma';
import bcrypt from 'bcryptjs';

async function runTestSuite() {
  console.log('====================================================');
  console.log('   GoTogether Comprehensive End-to-End Test Suite   ');
  console.log('====================================================\n');

  // 1. Setup Express + Socket.IO test server
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/conversations', conversationsRouter);
  app.use('/api', matchesRouter);
  app.use('/api', listingsRouter);

  const server = http.createServer(app);
  const io = new SocketIOServer(server, { cors: { origin: '*' } });
  registerChatHandlers(io);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`[SETUP] Test server running at ${baseUrl}`);

  let adminToken = '';
  let riderToken = '';
  let driverToken = '';
  let testRideId = '';
  let testMatchRequestId = '';
  let testConversationId = '';

  try {
    // ---------------------------------------------------------------
    // TEST 1: AUTHENTICATION FLOW
    // ---------------------------------------------------------------
    console.log('\n--- 1. Testing Authentication Flow ---');

    // 1.1 Login as Admin
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'shabaazsyed47@gotogether.com',
        password: 'Sha@7867',
      }),
    });
    const adminLoginData = await adminLoginRes.json();
    if (adminLoginRes.status !== 200 || !adminLoginData.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginData)}`);
    }
    adminToken = adminLoginData.token;
    console.log(`✅ [PASS] Admin login successful: ${adminLoginData.user.name} (${adminLoginData.user.role})`);

    // 1.2 Login as Moderator
    const modLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'mohammadkaif13@gotogether.com',
        password: 'kaif@6036',
      }),
    });
    const modLoginData = await modLoginRes.json();
    if (modLoginRes.status !== 200 || !modLoginData.token) {
      throw new Error(`Moderator login failed: ${JSON.stringify(modLoginData)}`);
    }
    console.log(`✅ [PASS] Moderator login successful: ${modLoginData.user.name} (${modLoginData.user.role})`);

    // 1.3 Register a dynamic test rider
    const testRiderEmail = `rider_${Date.now()}@gotogether.local`;
    const riderRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Automated Test Rider',
        email: testRiderEmail,
        password: 'TestPassword123!',
        role: 'TRAVELER',
        phone: '+91 98888 11111',
      }),
    });
    const riderRegData = await riderRegRes.json();
    if (riderRegRes.status !== 201 || !riderRegData.token) {
      throw new Error(`Rider registration failed: ${JSON.stringify(riderRegData)}`);
    }
    riderToken = riderRegData.token;
    console.log(`✅ [PASS] New Rider registration successful: ${riderRegData.user.email}`);

    // 1.4 Test Profile Fetch (/api/auth/me)
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${riderToken}` },
    });
    const meData = await meRes.json();
    if (meRes.status !== 200 || meData.user.email !== testRiderEmail) {
      throw new Error(`Auth me check failed: ${JSON.stringify(meData)}`);
    }
    console.log(`✅ [PASS] /api/auth/me verified for current session`);

    // 1.5 Test Dynamic Role Switch (TRAVELER -> HOST)
    const roleSwitchRes = await fetch(`${baseUrl}/api/auth/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${riderToken}`,
      },
      body: JSON.stringify({ role: 'HOST' }),
    });
    const roleSwitchData = await roleSwitchRes.json();
    if (roleSwitchRes.status !== 200 || roleSwitchData.user.role !== 'HOST') {
      throw new Error(`Role switch failed: ${JSON.stringify(roleSwitchData)}`);
    }
    driverToken = roleSwitchData.token;
    console.log(`✅ [PASS] Role switch to HOST successful: token re-issued`);

    // ---------------------------------------------------------------
    // TEST 2: RIDE PUBLISHING & GEOCODING CREATION FLOW
    // ---------------------------------------------------------------
    console.log('\n--- 2. Testing Ride Publishing & Search Flow ---');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    const createRideRes = await fetch(`${baseUrl}/api/listings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({
        type: 'CAR',
        hostId: roleSwitchData.user.id,
        title: 'Indiranagar to Whitefield Tech Park',
        description: 'Smooth EV commute via Old Airport Road. AC on, safe driving.',
        originLabel: 'Indiranagar Metro Station, Bengaluru',
        originLatitude: 12.9784,
        originLongitude: 77.6408,
        destinationLabel: 'ITPL Main Gate, Whitefield, Bengaluru',
        destinationLatitude: 12.9863,
        destinationLongitude: 77.7338,
        departureTime: tomorrow.toISOString(),
        capacity: 2,
        pricePerSeat: 150,
        currency: '₹',
        paceLevel: 'INTERMEDIATE',
        tags: ['AC', 'EV', 'No Smoking'],
      }),
    });
    const createRideData = await createRideRes.json();
    testRideId = createRideData.id || createRideData.listing?.id;
    if (createRideRes.status !== 201 || !testRideId) {
      throw new Error(`Create ride failed: ${JSON.stringify(createRideData)}`);
    }
    console.log(`✅ [PASS] Ride published successfully: "${createRideData.title}" (ID: ${testRideId})`);

    // 2.2 Search Listings with Dynamic Filters
    const searchRes = await fetch(`${baseUrl}/api/listings/search?type=CAR&q=Indiranagar&maxBudget=200`);
    const searchData = await searchRes.json();
    if (searchRes.status !== 200 || !Array.isArray(searchData.results)) {
      throw new Error(`Search failed: ${JSON.stringify(searchData)}`);
    }
    const found = searchData.results.some((r: any) => r.id === testRideId);
    if (!found) {
      throw new Error('Created ride was not found in filtered search results');
    }
    console.log(`✅ [PASS] 7-Dimension Search returned ${searchData.results.length} ranked result(s), including new ride`);

    // ---------------------------------------------------------------
    // TEST 3: ATOMIC SEAT BOOKING & CAPACITY TRANSITION FLOW
    // ---------------------------------------------------------------
    console.log('\n--- 3. Testing Atomic Booking & Capacity Flow ---');

    // 3.1 Book 1st Seat (capacity: 2, booked: 0 -> 1, status: OPEN)
    const book1Res = await fetch(`${baseUrl}/api/listings/${testRideId}/book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ seats: 1 }),
    });
    const book1Data = await book1Res.json();
    if (book1Res.status !== 200 || book1Data.seatsBooked !== 1 || book1Data.status !== 'OPEN') {
      throw new Error(`First booking failed: ${JSON.stringify(book1Data)}`);
    }
    console.log(`✅ [PASS] 1st seat booked. Seats booked: 1/2. Status remains OPEN.`);

    // 3.2 Book 2nd Seat (capacity: 2, booked: 1 -> 2 == capacity -> status becomes FULL)
    const book2Res = await fetch(`${baseUrl}/api/listings/${testRideId}/book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ seats: 1 }),
    });
    const book2Data = await book2Res.json();
    if (book2Res.status !== 200 || book2Data.seatsBooked !== 2 || book2Data.status !== 'FULL') {
      throw new Error(`Capacity threshold booking failed: ${JSON.stringify(book2Data)}`);
    }
    console.log(`✅ [PASS] 2nd seat booked. Capacity reached! Listing status transitioned to FULL.`);

    // 3.3 Over-booking rejection test (Should fail with 400 when FULL)
    const overBookRes = await fetch(`${baseUrl}/api/listings/${testRideId}/book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ seats: 1 }),
    });
    if (overBookRes.status !== 400) {
      throw new Error(`Expected 400 rejection for over-booking on FULL listing, got ${overBookRes.status}`);
    }
    console.log(`✅ [PASS] Over-booking rejected with HTTP 400 when capacity is exhausted.`);

    // ---------------------------------------------------------------
    // TEST 4: MY RIDES DASHBOARD FLOW
    // ---------------------------------------------------------------
    console.log('\n--- 4. Testing "My Rides" Dashboard Endpoints ---');

    // 4.1 Hosted rides endpoint for the driver
    const hostedRes = await fetch(`${baseUrl}/api/users/me/hosted-rides`, {
      headers: { Authorization: `Bearer ${driverToken}` },
    });
    const hostedData = await hostedRes.json();
    if (hostedRes.status !== 200 || !Array.isArray(hostedData) || hostedData.length === 0) {
      throw new Error(`Hosted rides fetch failed: ${JSON.stringify(hostedData)}`);
    }
    console.log(`✅ [PASS] /api/users/me/hosted-rides returned ${hostedData.length} hosted ride(s) with passenger rosters`);

    // 4.2 Joined rides endpoint for the booker (Admin)
    const joinedRes = await fetch(`${baseUrl}/api/users/me/joined-rides`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const joinedData = await joinedRes.json();
    if (joinedRes.status !== 200 || !Array.isArray(joinedData) || joinedData.length === 0) {
      throw new Error(`Joined rides fetch failed: ${JSON.stringify(joinedData)}`);
    }
    console.log(`✅ [PASS] /api/users/me/joined-rides returned ${joinedData.length} joined ride(s)`);

    // ---------------------------------------------------------------
    // TEST 5: MULTI-CHANNEL CONVERSATIONS & CHAT LIFECYCLE
    // ---------------------------------------------------------------
    console.log('\n--- 5. Testing Multi-Channel Conversations & Safety ---');

    // 5.1 Initialize Support Ticket
    const supportConvRes = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${riderToken}`,
      },
      body: JSON.stringify({
        type: 'support_ticket',
        title: 'Query regarding KYC approval',
      }),
    });
    const supportConvData = await supportConvRes.json();
    if (supportConvRes.status !== 201 || !supportConvData.conversationId) {
      throw new Error(`Support conversation creation failed: ${JSON.stringify(supportConvData)}`);
    }
    testConversationId = supportConvData.conversationId;
    console.log(`✅ [PASS] Support Ticket channel created: ${testConversationId}`);

    // 5.2 Test Safety Filter: Reject Phone Number Scraping
    const unsafePhoneRes = await fetch(`${baseUrl}/api/conversations/${testConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${riderToken}`,
      },
      body: JSON.stringify({
        content: 'Call me on 9876543210 immediately.',
      }),
    });
    if (unsafePhoneRes.status !== 422) {
      throw new Error(`Expected safety scanner to flag phone number with HTTP 422, got ${unsafePhoneRes.status}`);
    }
    console.log(`✅ [PASS] Safety Filter blocked phone number scraping with HTTP 422 Unprocessable Entity`);

    // 5.3 Test Safety Filter: Reject External Payment Bypass
    const unsafePaymentRes = await fetch(`${baseUrl}/api/conversations/${testConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${riderToken}`,
      },
      body: JSON.stringify({
        content: 'Please pay me via GPay directly to bypass platform fee.',
      }),
    });
    if (unsafePaymentRes.status !== 422) {
      throw new Error(`Expected safety scanner to flag off-platform payment with HTTP 422, got ${unsafePaymentRes.status}`);
    }
    console.log(`✅ [PASS] Safety Filter blocked off-platform payment circumvention`);

    // 5.4 Send Valid Message
    const validMsgRes = await fetch(`${baseUrl}/api/conversations/${testConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${riderToken}`,
      },
      body: JSON.stringify({
        content: 'Hello Support team, I have uploaded my driver license.',
      }),
    });
    const validMsgData = await validMsgRes.json();
    if (validMsgRes.status !== 201 || !validMsgData.id) {
      throw new Error(`Sending valid message failed: ${JSON.stringify(validMsgData)}`);
    }
    console.log(`✅ [PASS] Valid message sent and recorded with ID: ${validMsgData.id}`);

    // 5.5 Fetch Message History
    const fetchMsgRes = await fetch(`${baseUrl}/api/conversations/${testConversationId}/messages`, {
      headers: { Authorization: `Bearer ${riderToken}` },
    });
    const fetchMsgData = await fetchMsgRes.json();
    if (fetchMsgRes.status !== 200 || !Array.isArray(fetchMsgData.messages) || fetchMsgData.messages.length === 0) {
      throw new Error(`Fetch messages failed: ${JSON.stringify(fetchMsgData)}`);
    }
    console.log(`✅ [PASS] Message history retrieved successfully (${fetchMsgData.messages.length} messages)`);

    // ---------------------------------------------------------------
    // TEST 6: REAL-TIME SOCKET.IO INTERACTION
    // ---------------------------------------------------------------
    console.log('\n--- 6. Testing Real-Time Socket.IO Handshake & Messaging ---');

    // Create match request for Socket room
    const matchReqRes = await fetch(`${baseUrl}/api/match-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${riderToken}`,
      },
      body: JSON.stringify({ listingId: testRideId }),
    });
    const matchReqData = await matchReqRes.json();
    testMatchRequestId = matchReqData.matchRequestId;

    // Connect Socket.IO client
    const socket = ioClient(baseUrl, {
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Socket.IO connection timeout')), 5000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        console.log(`✅ [PASS] Socket.IO client connected with socket ID: ${socket.id}`);
        resolve();
      });
    });

    // Join room
    let chatRoomId = '';
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Socket join_room timeout')), 5000);

      socket.emit('join_room', {
        matchRequestId: testMatchRequestId,
        userId: roleSwitchData.user.id,
      });

      socket.on('room_joined', (payload: any) => {
        clearTimeout(timeout);
        chatRoomId = payload.roomId;
        console.log(`✅ [PASS] Socket room_joined received for room: ${payload.roomId}`);
        resolve();
      });
    });

    // Send and receive message over Socket.io
    const receivedMsgPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Socket message timeout')), 5000);
      socket.on('receive_message', (msg: any) => {
        clearTimeout(timeout);
        console.log(`✅ [PASS] Real-time message broadcast received: "${msg.content}" from ${msg.sender?.name}`);
        resolve();
      });
    });

    socket.emit('send_message', {
      roomId: chatRoomId,
      senderId: roleSwitchData.user.id,
      content: 'Real-time test message through Socket.IO',
    });

    await receivedMsgPromise;

    // ---------------------------------------------------------------
    // TEST 7: STAGE 5 LIVE TRIP STATE MACHINE & TELEMETRY
    // ---------------------------------------------------------------
    console.log('\n--- 7. Testing Stage 5 Live Trip Lifecycle & State Machine ---');

    // 7.1 Transition: FULL -> BOARDING
    const boardingRes = await fetch(`${baseUrl}/api/listings/${testRideId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ status: 'BOARDING' }),
    });
    const boardingData = await boardingRes.json();
    if (boardingRes.status !== 200 || boardingData.listing?.status !== 'BOARDING') {
      throw new Error(`Transition to BOARDING failed: ${JSON.stringify(boardingData)}`);
    }
    console.log(`✅ [PASS] Strict State Transition: FULL -> BOARDING verified.`);

    // 7.2 Boarding & Check-in with 4-digit PIN
    const testPin = book1Data.checkInPin;
    const checkInRes = await fetch(`${baseUrl}/api/listings/${testRideId}/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ pin: testPin }),
    });
    const checkInData = await checkInRes.json();
    if (checkInRes.status !== 200 || !checkInData.booking?.isCheckedIn) {
      throw new Error(`Passenger 4-digit PIN check-in failed: ${JSON.stringify(checkInData)}`);
    }
    console.log(`✅ [PASS] Driver checked in passenger using 4-digit PIN: ${testPin} (isCheckedIn: true).`);

    // 7.3 Transition: BOARDING -> IN_TRANSIT
    const inTransitRes = await fetch(`${baseUrl}/api/listings/${testRideId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ status: 'IN_TRANSIT' }),
    });
    const inTransitData = await inTransitRes.json();
    if (inTransitRes.status !== 200 || inTransitData.listing?.status !== 'IN_TRANSIT') {
      throw new Error(`Transition to IN_TRANSIT failed: ${JSON.stringify(inTransitData)}`);
    }
    console.log(`✅ [PASS] Strict State Transition: BOARDING -> IN_TRANSIT verified.`);

    // 7.4 Live Telemetry Coordinate Ping over Socket.IO
    const telemetryPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Telemetry ping timeout')), 5000);
      socket.on(`ride:telemetry:${testRideId}`, (payload: any) => {
        clearTimeout(timeout);
        console.log(`✅ [PASS] In-Transit Telemetry received: Lat ${payload.lat}, Lng ${payload.lng}, Speed ${payload.speed} km/h`);
        resolve();
      });
    });

    socket.emit('ride:telemetry', {
      rideId: testRideId,
      lat: 12.9784,
      lng: 77.6408,
      bearing: 45,
      speed: 48,
    });
    await telemetryPromise;

    // 7.5 Transition: IN_TRANSIT -> COMPLETED
    const completedRes = await fetch(`${baseUrl}/api/listings/${testRideId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    const completedData = await completedRes.json();
    if (completedRes.status !== 200 || completedData.listing?.status !== 'COMPLETED') {
      throw new Error(`Transition to COMPLETED failed: ${JSON.stringify(completedData)}`);
    }
    console.log(`✅ [PASS] Strict State Transition: IN_TRANSIT -> COMPLETED (Chat Auto-Archived).`);

    // 7.6 Reciprocal Review Submission
    const reviewRes = await fetch(`${baseUrl}/api/listings/${testRideId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        subjectId: roleSwitchData.user.id,
        rating: 5,
        comment: 'Excellent commute, punctual and smooth driving.',
      }),
    });
    const reviewData = await reviewRes.json();
    if (reviewRes.status !== 201 || reviewData.review?.rating !== 5) {
      throw new Error(`Review submission failed: ${JSON.stringify(reviewData)}`);
    }
    console.log(`✅ [PASS] Reciprocal 5-star review recorded. New rating avg: ${reviewData.newRatingAvg}★.`);

    socket.disconnect();

    // ---------------------------------------------------------------
    // TEST 8: RIDE CANCELLATION FLOW
    // ---------------------------------------------------------------
    console.log('\n--- 8. Testing Ride Cancellation Flow ---');

    // Create a temporary ride to test cancellation
    const cancelListingRes = await fetch(`${baseUrl}/api/listings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({
        type: 'CAR',
        hostId: roleSwitchData.user.id,
        title: 'Temporary Ride for Cancellation Test',
        originLabel: 'HSR Layout, Bengaluru',
        originLatitude: 12.9121,
        originLongitude: 77.6446,
        destinationLabel: 'Bellandur, Bengaluru',
        destinationLatitude: 12.9304,
        destinationLongitude: 77.6784,
        departureTime: new Date(Date.now() + 86400000).toISOString(),
        capacity: 3,
        pricePerSeat: 100,
      }),
    });
    const cancelListingData = await cancelListingRes.json();
    const tempRideId = cancelListingData.id;

    const cancelRes = await fetch(`${baseUrl}/api/listings/${tempRideId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${driverToken}` },
    });
    const cancelData = await cancelRes.json();
    if (cancelRes.status !== 200 || (cancelData.status !== 'CANCELLED' && cancelData.listing?.status !== 'CANCELLED')) {
      throw new Error(`Ride cancellation failed: ${JSON.stringify(cancelData)}`);
    }
    console.log(`✅ [PASS] Ride cancelled successfully. Status transitioned to CANCELLED.`);

    console.log('\n====================================================');
    console.log('   🎉 ALL 8 STAGES TESTED & PASSED 100%!           ');
    console.log('====================================================\n');
  } finally {
    // Clean up test ride
    if (testRideId) {
      await prisma.listing.delete({ where: { id: testRideId } }).catch(() => {});
    }
    server.close();
    await prisma.$disconnect();
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED WITH ERROR:', err);
  process.exit(1);
});
