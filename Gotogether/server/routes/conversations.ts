import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { verifyToken } from '../middleware/auth.middleware';
import { scanMessageSafety } from '../../src/lib/chatSafety';

export const conversationsRouter = Router();

/**
 * GET /api/conversations
 * Returns all conversations the authenticated user is a participant of.
 */
conversationsRouter.get('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const conversations = await prisma.$queryRaw<Array<{
      id: string;
      ride_id: string | null;
      type: 'ride_group' | 'direct_inquiry' | 'support_ticket';
      title: string | null;
      is_closed: boolean;
      created_at: Date;
      last_message: string | null;
      last_message_at: Date | null;
      participant_count: number;
    }>>`
      SELECT 
        c.id,
        c.ride_id,
        c.type,
        c.title,
        c.is_closed,
        c.created_at,
        (SELECT content FROM public.messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
        (SELECT created_at FROM public.messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
        (SELECT COUNT(*)::int FROM public.conversation_participants cp2 WHERE cp2.conversation_id = c.id) AS participant_count
      FROM public.conversations c
      JOIN public.conversation_participants cp ON cp.conversation_id = c.id
      WHERE cp.user_id = ${userId} OR EXISTS (
        SELECT 1 FROM public."User" u WHERE u.id = ${userId} AND u.role IN ('ADMIN', 'MODERATOR')
      )
      ORDER BY COALESCE(
        (SELECT created_at FROM public.messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1),
        c.created_at
      ) DESC
    `;

    return res.json({ conversations });
  } catch (error) {
    console.error('Failed to list conversations:', error);
    return res.status(500).json({ error: 'Failed to retrieve conversations' });
  }
});

/**
 * POST /api/conversations
 * Creates or gets an existing conversation (direct inquiry, support ticket, or ride group).
 */
conversationsRouter.post('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { rideId, type = 'direct_inquiry', title } = req.body ?? {};

    // 1. Direct Inquiry between Rider & Driver
    if (type === 'direct_inquiry') {
      if (!rideId) {
        return res.status(400).json({ error: 'rideId is required for direct inquiries' });
      }

      // Check ride capacity and status
      const ride = await prisma.listing.findUnique({
        where: { id: rideId },
        select: { id: true, hostId: true, status: true, capacity: true, seatsBooked: true },
      });

      if (!ride) {
        return res.status(404).json({ error: 'Ride not found' });
      }

      if (ride.status !== 'OPEN') {
        return res.status(400).json({ error: 'Inquiries can only be initiated for open, active rides.' });
      }

      if (ride.seatsBooked >= ride.capacity) {
        return res.status(400).json({ error: 'This ride is currently full.' });
      }

      // Check if direct inquiry conversation already exists between this rider and driver
      const existing = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT c.id FROM public.conversations c
        JOIN public.conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = ${userId}
        JOIN public.conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = ${ride.hostId}
        WHERE c.type = 'direct_inquiry' AND c.ride_id = ${rideId}
        LIMIT 1
      `;

      if (existing.length > 0) {
        return res.json({ conversationId: existing[0].id, type: 'direct_inquiry' });
      }

      // Create new direct inquiry
      const newConv = await prisma.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.conversations (ride_id, type, title, is_closed)
        VALUES (${rideId}, 'direct_inquiry', ${title || 'Direct Inquiry'}, false)
        RETURNING id
      `;

      const convId = newConv[0].id;

      // Add participants: rider and driver
      await prisma.$executeRaw`
        INSERT INTO public.conversation_participants (conversation_id, user_id)
        VALUES 
          (${convId}::uuid, ${userId}),
          (${convId}::uuid, ${ride.hostId})
        ON CONFLICT DO NOTHING
      `;

      return res.status(201).json({ conversationId: convId, type: 'direct_inquiry' });
    }

    // 2. Support Ticket
    if (type === 'support_ticket') {
      const newTicket = await prisma.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.conversations (type, title, is_closed)
        VALUES ('support_ticket', ${title || 'Support / Dispute Request'}, false)
        RETURNING id
      `;

      const convId = newTicket[0].id;

      // Add user as participant
      await prisma.$executeRaw`
        INSERT INTO public.conversation_participants (conversation_id, user_id)
        VALUES (${convId}::uuid, ${userId})
        ON CONFLICT DO NOTHING
      `;

      return res.status(201).json({ conversationId: convId, type: 'support_ticket' });
    }

    // 3. Ride Group Chat
    if (type === 'ride_group' && rideId) {
      const existingGroup = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM public.conversations 
        WHERE ride_id = ${rideId} AND type = 'ride_group'
        LIMIT 1
      `;

      if (existingGroup.length > 0) {
        return res.json({ conversationId: existingGroup[0].id, type: 'ride_group' });
      }

      // If group chat doesn't exist yet, create it
      const newGroup = await prisma.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.conversations (ride_id, type, title, is_closed)
        VALUES (${rideId}, 'ride_group', ${title || 'Ride Discussion'}, false)
        RETURNING id
      `;

      const groupConvId = newGroup[0].id;

      await prisma.$executeRaw`
        INSERT INTO public.conversation_participants (conversation_id, user_id)
        VALUES (${groupConvId}::uuid, ${userId})
        ON CONFLICT DO NOTHING
      `;

      return res.status(201).json({ conversationId: groupConvId, type: 'ride_group' });
    }

    return res.status(400).json({ error: 'Invalid conversation parameters' });
  } catch (error) {
    console.error('Failed to create/get conversation:', error);
    return res.status(500).json({ error: 'Could not initialize chat channel' });
  }
});

/**
 * GET /api/conversations/:id/messages
 * Fetches messages in a conversation with sender details.
 */
conversationsRouter.get('/:id/messages', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const conversationId = req.params.id;

    // Check participation or admin access
    const access = await prisma.$queryRaw<Array<{ id: string; is_closed: boolean }>>`
      SELECT c.id, c.is_closed FROM public.conversations c
      WHERE c.id = ${conversationId}::uuid AND (
        EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = c.id AND cp.user_id = ${userId})
        OR EXISTS (SELECT 1 FROM public."User" u WHERE u.id = ${userId} AND u.role IN ('ADMIN', 'MODERATOR'))
      )
      LIMIT 1
    `;

    if (access.length === 0) {
      return res.status(403).json({ error: 'You are not a participant in this conversation' });
    }

    const messages = await prisma.$queryRaw<Array<{
      id: string;
      content: string;
      created_at: Date;
      sender_id: string;
      sender_name: string | null;
      sender_avatar: string | null;
      is_read: boolean;
    }>>`
      SELECT 
        m.id,
        m.content,
        m.created_at,
        m.sender_id,
        COALESCE(u.name, 'User') as sender_name,
        u."avatarUrl" as sender_avatar,
        m.is_read
      FROM public.messages m
      LEFT JOIN public."User" u ON u.id = m.sender_id
      WHERE m.conversation_id = ${conversationId}::uuid
      ORDER BY m.created_at ASC
    `;

    return res.json({
      conversationId,
      isClosed: access[0].is_closed,
      messages,
    });
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return res.status(500).json({ error: 'Could not load messages' });
  }
});

/**
 * POST /api/conversations/:id/messages
 * Sends a message with automated safety scanning and lifecycle checks.
 */
conversationsRouter.post('/:id/messages', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const conversationId = req.params.id;
    const { content } = req.body ?? {};

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Check conversation status
    const conv = await prisma.$queryRaw<Array<{ id: string; is_closed: boolean }>>`
      SELECT id, is_closed FROM public.conversations
      WHERE id = ${conversationId}::uuid
      LIMIT 1
    `;

    if (conv.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conv[0].is_closed) {
      return res.status(403).json({
        error: 'This conversation has been closed/archived. Messages are read-only.',
      });
    }

    // Safety and Word Filter Scanning
    const scan = scanMessageSafety(content);
    if (!scan.safe) {
      return res.status(422).json({
        error: scan.flaggedReason,
        flagged: true,
      });
    }

    // Insert message into public.messages
    const newMessage = await prisma.$queryRaw<Array<{ id: string; created_at: Date }>>`
      INSERT INTO public.messages (conversation_id, sender_id, content, is_read)
      VALUES (${conversationId}::uuid, ${userId}, ${scan.sanitizedContent}, false)
      RETURNING id, created_at
    `;

    return res.status(201).json({
      id: newMessage[0].id,
      content: scan.sanitizedContent,
      createdAt: newMessage[0].created_at,
      senderId: userId,
    });
  } catch (error) {
    console.error('Failed to post message:', error);
    return res.status(500).json({ error: 'Could not send message' });
  }
});
