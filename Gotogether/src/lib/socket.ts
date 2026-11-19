import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || undefined;

let socket: Socket | null = null;

/**
 * Returns the shared Socket.IO client, creating it on first use. Reused across
 * every chat drawer instance so re-opening the drawer doesn't reconnect.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });
  }
  return socket;
}
