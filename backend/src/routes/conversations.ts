import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const router = Router();

// Middleware to get user from token
const getUserFromToken = (req: Request) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as {
      id: string;
      email: string;
    };
    return decoded;
  } catch {
    return null;
  }
};

// Get or create a direct conversation with a contact
router.post('/direct/:contactEmail', async (req: Request, res: Response) => {
  const user = getUserFromToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { contactEmail } = req.params;

  try {
    console.log(`[Conversation] User: ${user.id}, Contact email: ${contactEmail}`);

    // Find the other user first
    const otherUser = queryOne(
      'SELECT id FROM users WHERE email = ?',
      [contactEmail]
    );

    if (!otherUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find the contact - check both directions since user could be requester or contactee
    const contact = queryOne(
      `SELECT * FROM contacts
       WHERE ((user_id = ? AND contact_user_id = ?) OR (user_id = ? AND contact_user_id = ?))
       AND status = 'accepted'`,
      [user.id, otherUser.id, otherUser.id, user.id]
    );

    console.log(`[Conversation] Contact found:`, contact ? 'yes' : 'no');

    if (!contact) {
      // Check if contact exists at all
      const anyContact = queryOne(
        `SELECT * FROM contacts
         WHERE (user_id = ? AND contact_user_id = ?) OR (user_id = ? AND contact_user_id = ?)`,
        [user.id, otherUser.id, otherUser.id, user.id]
      );
      console.log(`[Conversation] Any contact (any status):`, anyContact ? { status: anyContact.status } : 'no');
      return res.status(404).json({ error: 'Contact not found or not accepted' });
    }

    // Check if conversation already exists (check both user orderings)
    const existingConv = queryOne(
      `SELECT c.id FROM conversations c
       JOIN conversation_participants p1 ON c.id = p1.conversation_id
       JOIN conversation_participants p2 ON c.id = p2.conversation_id
       WHERE c.type = 'direct'
         AND ((p1.user_id = ? AND p2.user_id = ?) OR (p1.user_id = ? AND p2.user_id = ?))
       LIMIT 1`,
      [user.id, otherUser.id, otherUser.id, user.id]
    );

    if (existingConv) {
      // Get existing messages
      const messages = query(
        `SELECT m.*, u.name as sender_name, u.picture as sender_picture
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         WHERE m.conversation_id = ?
         ORDER BY m.created_at ASC`,
        [existingConv.id]
      );

      return res.json({
        id: existingConv.id,
        messages,
      });
    }

    // Create new conversation
    const conversationId = uuidv4();
    query(
      'INSERT INTO conversations (id, type) VALUES (?, ?)',
      [conversationId, 'direct']
    );

    // Add participants
    const participantId1 = uuidv4();
    const participantId2 = uuidv4();
    query(
      'INSERT INTO conversation_participants (id, conversation_id, user_id) VALUES (?, ?, ?)',
      [participantId1, conversationId, user.id]
    );
    query(
      'INSERT INTO conversation_participants (id, conversation_id, user_id) VALUES (?, ?, ?)',
      [participantId2, conversationId, otherUser.id]
    );

    res.status(201).json({
      id: conversationId,
      messages: [],
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Get all conversations for user
router.get('/', async (req: Request, res: Response) => {
  const user = getUserFromToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const conversations = query(
      `SELECT DISTINCT c.id, c.type, c.created_at, c.updated_at,
             u.email as other_user_email, u.name as other_user_name, u.picture as other_user_picture
      FROM conversations c
      JOIN conversation_participants cp ON c.id = cp.conversation_id
      LEFT JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id != ?
      LEFT JOIN users u ON cp2.user_id = u.id
      WHERE cp.user_id = ? AND c.type = 'direct'
      ORDER BY c.updated_at DESC`,
      [user.id, user.id]
    );

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

export default router;
