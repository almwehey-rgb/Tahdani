import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/', async (_req, res) => {
  const episodes = await prisma.episode.findMany({ orderBy: { number: 'asc' } });
  res.json({ episodes });
});

const schema = z.object({
  title: z.string().min(2),
  number: z.number().int().min(1),
  airDate: z.string().datetime().optional().nullable(),
  description: z.string().optional().nullable(),
  videoUrl: z.string().url().optional().nullable(),
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });
  const { airDate, ...rest } = parsed.data;
  const episode = await prisma.episode.create({ data: { ...rest, airDate: airDate ? new Date(airDate) : null } });
  res.status(201).json({ episode });
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  await prisma.episode.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;
