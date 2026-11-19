import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '../lib/socket';

export interface ChatSender {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface ChatMessage {
  id: string;
  chatRoomId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: ChatSender;
}

export type ChatConnectionState = 'connecting' | 'connected' | 'error';

interface UseChatRoomOptions {
  /** The MatchRequest this conversation belongs to; the server resolves or creates its ChatRoom. */
  matchRequestId: string;
  userId: string;
  /** Only joins the room while true, so the drawer can stay unmounted-cheap when closed. */
  enabled: boolean;
}

interface RoomJoinedPayload {
  roomId: string;
  history: ChatMessage[];
}

export function useChatRoom({ matchRequestId, userId, enabled }: UseChatRoomOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionState, setConnectionState] = useState<ChatConnectionState>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const roomIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const socket = getSocket();
    setConnectionState('connecting');
    setErrorMessage(null);
    setMessages([]);
    roomIdRef.current = null;

    const handleRoomJoined = (data: RoomJoinedPayload) => {
      roomIdRef.current = data.roomId;
      setMessages(data.history);
      setConnectionState('connected');
    };

    const handleReceiveMessage = (message: ChatMessage) => {
      setMessages((previous) => [...previous, message]);
    };

    const handleChatError = (payload: { message: string }) => {
      setErrorMessage(payload.message);
      setConnectionState('error');
    };

    socket.on('room_joined', handleRoomJoined);
    socket.on('receive_message', handleReceiveMessage);
    socket.on('chat_error', handleChatError);

    socket.emit('join_room', { matchRequestId, userId });

    return () => {
      socket.off('room_joined', handleRoomJoined);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('chat_error', handleChatError);
      if (roomIdRef.current) {
        socket.emit('leave_room', roomIdRef.current);
      }
      roomIdRef.current = null;
    };
  }, [matchRequestId, userId, enabled]);

  const sendMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!roomIdRef.current || !trimmed) return;
      getSocket().emit('send_message', {
        roomId: roomIdRef.current,
        senderId: userId,
        content: trimmed,
      });
    },
    [userId]
  );

  return { messages, connectionState, errorMessage, sendMessage };
}
