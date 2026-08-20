import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/', async (_req, res) => {
  const packages = await prisma.package.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
  res.json({ packages });
});

const schema = z.object({
  name: z.string().min(2),
  gamesCount: z.number().int().min(1),
  price: z.number().min(0),
  currency: z.string().default('KWD'),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });
  const pkg = await prisma.package.create({ data: parsed.data });
  res.status(201).json({ package: pkg });
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });
  const pkg = await prisma.package.update({ where: { id: req.params.id }, data: parsed.data });
  res.json({ package: pkg });
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  await prisma.package.update({ where: { id: req.params.id }, data: { active: false } });
  res.json({ ok: true });
});

export default router;
