import { Router, Request, Response } from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { saveImage } from '../config/s3.js';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

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

// Upload image endpoint
router.post('/image', upload.single('image'), async (req: Request, res: Response) => {
  const user = getUserFromToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  try {
    const imageUrl = saveImage(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.json({ imageUrl });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

export default router;
