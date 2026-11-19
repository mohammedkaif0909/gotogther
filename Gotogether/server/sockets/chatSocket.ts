import type { Server, Socket } from 'socket.io';
import { prisma } from '../lib/prisma';

interface JoinRoomPayload {
  matchRequestId: string;
  userId: string;
}

interface SendMessagePayload {
  roomId: string;
  senderId: string;
  content: string;
}

const MAX_MESSAGE_LENGTH = 2000;
const HISTORY_PAGE_SIZE = 50;

/**
 * Registers all chat-related Socket.IO event handlers on the given server.
 *
 * Rooms are keyed by ChatRoom.id — one room per accepted MatchRequest between a
 * searcher and a listing host. `join_room` lazily creates the ChatRoom the first
 * time either participant opens the drawer, then replays recent history so a
 * reconnecting client isn't left with a blank thread.
 */
export function registerChatHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    socket.on('join_room', async (payload: JoinRoomPayload) => {
      try {
        const { matchRequestId, userId } = payload ?? {};
        if (!matchRequestId || !userId) {
          socket.emit('chat_error', { message: 'matchRequestId and userId are required' });
          return;
        }

        const matchRequest = await prisma.matchRequest.findUnique({
          where: { id: matchRequestId },
          include: { listing: true, chatRoom: true },
        });

        if (!matchRequest) {
          socket.emit('chat_error', { message: 'Match request not found' });
          return;
        }

        const isParticipant =
          matchRequest.requesterId === userId || matchRequest.listing.hostId === userId;
        if (!isParticipant) {
          socket.emit('chat_error', { message: 'You are not a participant in this conversation' });
          return;
        }

        const chatRoom =
          matchRequest.chatRoom ?? (await prisma.chatRoom.create({ data: { matchRequestId } }));

        await socket.join(chatRoom.id);
        socket.data.userId = userId;

        const history = await prisma.message.findMany({
          where: { chatRoomId: chatRoom.id },
          orderBy: { createdAt: 'asc' },
          take: HISTORY_PAGE_SIZE,
          include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
        });

        socket.emit('room_joined', { roomId: chatRoom.id, history });
      } catch (error) {
        console.error('join_room failed', error);
        socket.emit('chat_error', { message: 'Could not join the conversation' });
      }
    });

    socket.on('send_message', async (payload: SendMessagePayload) => {
      try {
        const { roomId, senderId, content } = payload ?? ({} as SendMessagePayload);
        const trimmed = content?.trim();

        if (!roomId || !senderId || !trimmed) {
          socket.emit('chat_error', { message: 'roomId, senderId, and content are required' });
          return;
        }
        if (trimmed.length > MAX_MESSAGE_LENGTH) {
          socket.emit('chat_error', { message: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)` });
          return;
        }
        if (!socket.rooms.has(roomId)) {
          socket.emit('chat_error', { message: 'Join the room before sending messages' });
          return;
        }

        const message = await prisma.message.create({
          data: { chatRoomId: roomId, senderId, content: trimmed },
          include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
        });

        io.to(roomId).emit('receive_message', message);
      } catch (error) {
        console.error('send_message failed', error);
        socket.emit('chat_error', { message: 'Could not send message' });
      }
    });

    socket.on('leave_room', (roomId: string) => {
      if (typeof roomId === 'string') {
        socket.leave(roomId);
      }
    });

    /**
     * Real-time ride subscription for live seat sync, status updates & telemetry
     */
    socket.on('subscribe:ride', (rideId: string) => {
      if (typeof rideId === 'string' && rideId.trim()) {
        socket.join(`ride:${rideId.trim()}`);
      }
    });

    socket.on('unsubscribe:ride', (rideId: string) => {
      if (typeof rideId === 'string' && rideId.trim()) {
        socket.leave(`ride:${rideId.trim()}`);
      }
    });

    /**
     * Stage 5 In-Transit Telemetry:
     * Driver device emits periodic coordinate pings (lat, lng, bearing, speed).
     * Server relays to co-riders on channel ride:telemetry:{rideId} and room ride:{rideId}.
     */
    socket.on('ride:telemetry', (payload: { rideId: string; lat: number; lng: number; bearing?: number; speed?: number }) => {
      if (!payload?.rideId || typeof payload.lat !== 'number' || typeof payload.lng !== 'number') return;
      const room = `ride:${payload.rideId}`;
      io.to(room).emit(`ride:telemetry:${payload.rideId}`, payload);
      io.emit(`ride:telemetry:${payload.rideId}`, payload);
    });

    socket.on('disconnect', () => {
      // Socket.IO removes the socket from all joined rooms automatically.
    });
  });
}
