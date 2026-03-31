import { Router, Request, Response } from 'express';
import { Server } from 'socket.io';
import { query, queryOne } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

export default function contactRoutes(io: Server) {
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

// Search for a user by email (check if they exist)
router.get('/search', async (req: Request, res: Response) => {
  const user = getUserFromToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email query parameter is required' });
  }

  try {
    const targetUser = queryOne(
      'SELECT id, email, name, picture FROM users WHERE email = ?',
      [email]
    );

    if (!targetUser) {
      return res.json({ exists: false, email });
    }

    // Check if already contacts
    const existingContact = queryOne(
      `SELECT * FROM contacts
       WHERE (user_id = ? AND contact_user_id = ?) OR (user_id = ? AND contact_user_id = ?)`,
      [user.id, targetUser.id, targetUser.id, user.id]
    );

    res.json({
      exists: true,
      user: targetUser,
      alreadyContacts: !!existingContact,
      contactStatus: existingContact?.status,
    });
  } catch (error) {
    console.error('Error searching user:', error);
    res.status(500).json({ error: 'Failed to search user' });
  }
});

// Get all contacts for user
router.get('/', async (req: Request, res: Response) => {
  const user = getUserFromToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Get all contacts where user is either the requester or the contact
    const contacts = query(
      `SELECT c.*,
              u.email as requester_email, u.name as requester_name, u.picture as requester_picture,
              cu.email as contact_email, cu.name as contact_name, cu.picture as contact_picture,
              CASE WHEN c.user_id = ? THEN 'outgoing' ELSE 'incoming' END as direction
       FROM contacts c
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN users cu ON c.contact_user_id = cu.id
       WHERE c.user_id = ? OR c.contact_user_id = ?
       ORDER BY c.created_at DESC`,
      [user.id, user.id, user.id]
    );

    // Format the results - always show the OTHER user as the contact
    const formatted = contacts.map((c: any) => {
      // Determine if current user is the requester or the contact
      const isRequester = c.user_id === user.id;

      return {
        id: c.id,
        requester_id: c.user_id,
        requester_email: c.requester_email,
        requester_name: c.requester_name,
        contact_id: isRequester ? c.contact_user_id : c.user_id,
        contact_email: isRequester ? c.contact_email : c.requester_email,
        contact_name: isRequester ? c.contact_name : c.requester_name,
        contact_picture: isRequester ? c.contact_picture : c.requester_picture,
        status: c.status,
        created_at: c.created_at,
        direction: c.direction,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Add a new contact (send a request)
router.post('/', async (req: Request, res: Response) => {
  const user = getUserFromToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (email === user.email) {
    return res.status(400).json({ error: 'Cannot add yourself as a contact' });
  }

  try {
    // Find the target user
    const targetUser = queryOne('SELECT id FROM users WHERE email = ?', [email]);

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if contact already exists (either direction)
    const existingContact = queryOne(
      `SELECT * FROM contacts
       WHERE (user_id = ? AND contact_user_id = ?) OR (user_id = ? AND contact_user_id = ?)`,
      [user.id, targetUser.id, targetUser.id, user.id]
    );

    if (existingContact) {
      if (existingContact.status === 'accepted') {
        return res.status(400).json({ error: 'Contact already exists' });
      }
      if (existingContact.status === 'pending') {
        return res.status(400).json({ error: 'Contact request already pending' });
      }
    }

    // Create new contact request
    const contactId = uuidv4();
    query(
      `INSERT INTO contacts (id, user_id, contact_user_id, status)
       VALUES (?, ?, ?, 'pending')`,
      [contactId, user.id, targetUser.id]
    );

    const contact = queryOne('SELECT * FROM contacts WHERE id = ?', [contactId]);

    res.status(201).json({
      ...contact,
      contact_email: email,
      contact_id: targetUser.id,
    });
  } catch (error: any) {
    console.error('Error adding contact:', error);
    res.status(500).json({ error: 'Failed to add contact' });
  }
});

// Accept a contact request
router.put('/:id/accept', async (req: Request, res: Response) => {
  const user = getUserFromToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { id } = req.params;

  try {
    // Find the contact request
    const contact = queryOne(
      `SELECT * FROM contacts
       WHERE id = ? AND contact_user_id = ? AND status = 'pending'`,
      [id, user.id]
    );

    if (!contact) {
      return res.status(404).json({ error: 'Contact request not found' });
    }

    // Update status to accepted
    query(
      `UPDATE contacts SET status = 'accepted' WHERE id = ?`,
      [id]
    );

    const updated = queryOne('SELECT * FROM contacts WHERE id = ?', [id]);

    // Emit event to the requester (user_id) that contact was accepted
    // The contact record has user_id (requester) and contact_user_id (acceptor)
    const requesterId = updated.user_id;
    io.to(`user:${requesterId}`).emit('contact:accepted', {
      contactId: updated.id,
      status: 'accepted',
    });

    res.json(updated);
  } catch (error) {
    console.error('Error accepting contact:', error);
    res.status(500).json({ error: 'Failed to accept contact' });
  }
});

// Delete a contact
router.delete('/:id', async (req: Request, res: Response) => {
  const user = getUserFromToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { id } = req.params;

  try {
    // Delete if user is either the requester or contact
    const result = query(
      `DELETE FROM contacts WHERE id = ? AND (user_id = ? OR contact_user_id = ?)`,
      [id, user.id, user.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

  return router;
}
