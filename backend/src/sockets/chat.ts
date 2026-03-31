import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { query, queryOne } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

interface AuthSocket extends Socket {
  user?: {
    id: string;
    email: string;
  };
}

export const setupSocketHandlers = (io: Server) => {
  // Authentication middleware
  io.use((socket: AuthSocket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as {
        id: string;
        email: string;
      };

      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthSocket) => {
    console.log(`User connected: ${socket.user?.email} (${socket.id})`);

    // Join user's personal room for direct messages
    if (socket.user) {
      socket.join(`user:${socket.user.id}`);

      // Broadcast online status
      io.to(`user:${socket.user.id}`).emit('user:online', { userId: socket.user.id });
    }

    // Handle joining a conversation room
    socket.on('conversation:join', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`User ${socket.user?.email} joined conversation ${conversationId}`);
    });

    // Handle leaving a conversation room
    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Handle sending a message
    socket.on('message:send', async (data: { conversationId: string; content: string; messageType?: string; mediaUrl?: string }, callback: Function) => {
      try {
        const { conversationId, content, messageType = 'text', mediaUrl } = data;

        if (!conversationId) {
          return callback({ error: 'Conversation ID is required' });
        }

        const messageId = uuidv4();

        // Save message to database
        query(
          `INSERT INTO messages (id, conversation_id, sender_id, content, message_type, media_url)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [messageId, conversationId, socket.user!.id, content, messageType, mediaUrl]
        );

        // Update conversation updated_at
        query(
          'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [conversationId]
        );

        // Get message with sender info
        const message = queryOne(
          `SELECT m.*, u.name as sender_name, u.picture as sender_picture
           FROM messages m
           JOIN users u ON m.sender_id = u.id
           WHERE m.id = ?`,
          [messageId]
        );

        // Broadcast to conversation room
        io.to(`conversation:${conversationId}`).emit('message:new', message);

        callback({ success: true, message });
      } catch (error) {
        console.error('Error sending message:', error);
        callback({ error: 'Failed to send message' });
      }
    });

    // Handle typing indicator
    socket.on('typing:start', (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit('typing:started', {
        conversationId,
        userId: socket.user!.id,
      });
    });

    socket.on('typing:stop', (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit('typing:stopped', {
        conversationId,
        userId: socket.user!.id,
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user?.email}`);

      if (socket.user) {
        io.to(`user:${socket.user.id}`).emit('user:offline', { userId: socket.user.id });
      }
    });
  });
};
