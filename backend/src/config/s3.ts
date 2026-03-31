// Local file storage for images (no AWS required)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = process.env.UPLOADS_PATH || path.join(__dirname, '../../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export const saveImage = (buffer: Buffer, fileName: string, mimeType: string): string => {
  const uniqueId = uuidv4();
  const ext = path.extname(fileName) || '.jpg';
  const newFileName = `${uniqueId}${ext}`;
  const userDir = path.join(uploadsDir, 'local');

  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  const filePath = path.join(userDir, newFileName);
  fs.writeFileSync(filePath, buffer);

  // Return URL path for accessing the image
  return `/uploads/local/${newFileName}`;
};

export const getFilePath = (urlPath: string): string => {
  return path.join(uploadsDir, urlPath.replace('/uploads/', ''));
};
