import multer, { FileFilterCallback } from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Strict MIME → extension map (only these are allowed)
const MIME_EXT_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const ALLOWED_MIMES = new Set(Object.keys(MIME_EXT_MAP));

// File-type magic bytes signatures for validation
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header (WebP starts with RIFF....WEBP)
};

/**
 * Validates file content matches its declared MIME type by checking magic bytes.
 * Returns true if file content is consistent with the MIME type.
 */
function validateMagicBytes(filePath: string, mime: string): boolean {
  const signatures = MAGIC_BYTES[mime];
  if (!signatures) return false;

  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);

    return signatures.some((sig) =>
      sig.every((byte, i) => buf[i] === byte)
    );
  } catch {
    return false;
  }
}

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    // Derive extension ONLY from validated MIME type — never from user's originalname
    const ext = MIME_EXT_MAP[file.mimetype];
    if (!ext) {
      return cb(new Error('Invalid file type'), '');
    }
    // Cryptographically random filename — no user input in the path
    const name = crypto.randomUUID();
    cb(null, `${name}${ext}`);
  },
});

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  if (!ALLOWED_MIMES.has(file.mimetype)) {
    return cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  }
  cb(null, true);
}

/**
 * Creates a multer upload instance with hardened security defaults.
 * - 5 MB file size limit
 * - MIME whitelist (jpeg, png, webp)
 * - Cryptographically random filenames
 * - Extension derived from MIME, not user filename
 */
export const secureUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,                   // max 1 file per request
  },
  fileFilter,
});

/**
 * Middleware that runs AFTER multer to validate the uploaded file's magic bytes.
 * Deletes the file and returns 400 if content doesn't match declared MIME type.
 */
export function validateUploadedFile(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const file = req.file;
    if (!file) {
      // No file — let the route handler decide if it's required
      return next();
    }

    if (!validateMagicBytes(file.path, file.mimetype)) {
      // Content doesn't match MIME — delete the file and reject
      fs.unlink(file.path, () => {});
      return res.status(400).json({
        error: 'File content does not match its declared type. Upload a valid image.',
      });
    }

    next();
  };
}

/**
 * Error-handling middleware for multer errors (file too large, wrong type, etc.).
 * Place this AFTER routes that use multer.
 */
export function handleUploadError(err: any, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5 MB.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Only one file upload allowed per request.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err?.message?.includes('Only JPEG') || err?.message?.includes('Invalid file type')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
}
