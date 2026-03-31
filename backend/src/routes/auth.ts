import { Router, Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { query, queryOne } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const logAuth = (message: string, data?: any) => {
  console.log(`[AUTH] ${message}`, data ? JSON.stringify(data) : '');
};

const router = Router();

// Google OAuth callback
router.get('/google/callback', async (req: Request, res: Response) => {
  const { code } = req.query;

  logAuth('OAuth callback received', { code: code ? 'present' : 'missing' });

  if (!code) {
    logAuth('Error: No code provided');
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`);
  }

  try {
    logAuth('Exchanging code for token', {
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      client_id: process.env.GOOGLE_CLIENT_ID?.slice(0, 20) + '...',
      has_client_secret: !!process.env.GOOGLE_CLIENT_SECRET
    });

    // Exchange code for tokens
    const params = new URLSearchParams({
      code: code as string,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    });

    logAuth('Request params', { code_length: code?.length, redirect_uri: process.env.GOOGLE_REDIRECT_URI });

    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      params
    );

    logAuth('Token response received', {
      has_id_token: !!tokenResponse.data.id_token,
      has_access_token: !!tokenResponse.data.access_token
    });

    if (tokenResponse.data.error) {
      logAuth('Token response contains error', tokenResponse.data);
      throw new Error(tokenResponse.data.error_description || tokenResponse.data.error);
    }

    const { id_token, access_token } = tokenResponse.data;

    // Decode id_token to get user info (it's a JWT with user claims)
    const base64Url = id_token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf-8');
    const userInfo = JSON.parse(jsonPayload);

    logAuth('User info decoded from id_token', {
      email: userInfo.email,
      sub: userInfo.sub,
      name: userInfo.name
    });

    const userId = uuidv4();

    // Find or create user
    let user = queryOne(
      'SELECT * FROM users WHERE google_id = ?',
      [userInfo.sub]
    );

    if (user) {
      logAuth('Existing user found', { id: user.id });
      // Update existing user
      query(
        'UPDATE users SET email = ?, name = ?, picture = ?, updated_at = CURRENT_TIMESTAMP WHERE google_id = ?',
        [userInfo.email, userInfo.name, userInfo.picture, userInfo.sub]
      );
    } else {
      logAuth('Creating new user', { email: userInfo.email });
      // Create new user
      query(
        'INSERT INTO users (id, google_id, email, name, picture) VALUES (?, ?, ?, ?, ?)',
        [userId, userInfo.sub, userInfo.email, userInfo.name, userInfo.picture]
      );
      user = queryOne('SELECT * FROM users WHERE google_id = ?', [userInfo.sub]);
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '7d' }
    );

    logAuth('JWT token generated, redirecting', {
      userId: user.id,
      frontend: process.env.FRONTEND_URL,
      token_length: token.length
    });

    // Redirect to frontend with token
    const redirectUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:5173');
    redirectUrl.searchParams.set('token', token);

    logAuth('Redirect URL', { url: redirectUrl.toString() });

    // Set cookie (7 days expiry, same as token)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    });

    res.redirect(redirectUrl.toString());
  } catch (error: any) {
    logAuth('OAuth error', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
  }
});

// Get current user
router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as {
      id: string;
      email: string;
    };

    const user = queryOne('SELECT id, email, name, picture, created_at FROM users WHERE id = ?', [decoded.id]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  res.json({ success: true });
});

export default router;
