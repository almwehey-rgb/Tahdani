import { Router } from 'express';
import express from 'express';
import { prisma } from '../db';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
// The client shrinks pictures before sending, so anything past this is either a
// mistake or a file that would not survive the serverless request limit anyway.
const MAX_BYTES = 3 * 1024 * 1024;

// The admin panel posts the raw bytes with the picture's own content type; the
// global express.json() parser would reject that, so this route takes the body
// as a buffer instead.
router.post(
  '/',
  requireAuth,
  requireAdmin,
  express.raw({ type: ALLOWED, limit: MAX_BYTES }),
  async (req, res) => {
    const mimeType = (req.headers['content-type'] || '').split(';')[0].trim();
    if (!ALLOWED.includes(mimeType)) return res.status(415).json({ error: 'نوع الملف غير مدعوم' });
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'لا يوجد ملف' });
    if (req.body.length > MAX_BYTES) return res.status(413).json({ error: 'حجم الصورة كبير جداً' });

    try {
      const image = await prisma.uploadedImage.create({ data: { mimeType, data: req.body } });
      res.status(201).json({ id: image.id, url: `/api/uploads/${image.id}` });
    } catch (e) {
      res.status(500).json({ error: 'تعذر حفظ الصورة' });
    }
  },
);

// Public: category covers are shown to every player, not just the admin.
router.get('/:id', async (req, res) => {
  const image = await prisma.uploadedImage.findUnique({ where: { id: req.params.id } });
  if (!image) return res.status(404).json({ error: 'الصورة غير موجودة' });
  // The bytes behind an id never change, so let browsers keep it for a year.
  res.setHeader('Content-Type', image.mimeType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(Buffer.from(image.data));
});

export default router;
