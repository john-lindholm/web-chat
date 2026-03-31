import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Message } from '../types/index.js';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  sendMessage: (
    conversationId: string,
    content: string,
    messageType?: 'text' | 'image',
    mediaUrl?: string
  ) => Promise<Message>;
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children, token }: { children: ReactNode; token: string | null }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token]);

  const joinConversation = (conversationId: string) => {
    socket?.emit('conversation:join', conversationId);
  };

  const leaveConversation = (conversationId: string) => {
    socket?.emit('conversation:leave', conversationId);
  };

  const sendMessage = (
    conversationId: string,
    content: string,
    messageType: 'text' | 'image' = 'text',
    mediaUrl?: string
  ): Promise<Message> => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      socket.emit(
        'message:send',
        { conversationId, content, messageType, mediaUrl },
        (response: { success?: boolean; message?: Message; error?: string }) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.message as Message);
          }
        }
      );
    });
  };

  const startTyping = (conversationId: string) => {
    socket?.emit('typing:start', conversationId);
  };

  const stopTyping = (conversationId: string) => {
    socket?.emit('typing:stop', conversationId);
  };

  return (
    <SocketContext.Provider
      value={{ socket, isConnected, joinConversation, leaveConversation, sendMessage, startTyping, stopTyping }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
