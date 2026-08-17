import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, requireAdmin, async (_req, res) => {
  const codes = await prisma.discountCode.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ codes });
});

const schema = z.object({
  code: z.string().min(3).max(20),
  percentOff: z.number().int().min(1).max(100),
  maxUses: z.number().int().min(1).default(1),
  expiresAt: z.string().datetime().optional().nullable(),
  active: z.boolean().default(true),
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });
  const { code, expiresAt, ...rest } = parsed.data;
  const discount = await prisma.discountCode.create({
    data: { code: code.trim().toUpperCase(), expiresAt: expiresAt ? new Date(expiresAt) : null, ...rest },
  });
  res.status(201).json({ discount });
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });
  const { expiresAt, ...rest } = parsed.data;
  const discount = await prisma.discountCode.update({
    where: { id: req.params.id },
    data: { ...rest, ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}) },
  });
  res.json({ discount });
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  await prisma.discountCode.update({ where: { id: req.params.id }, data: { active: false } });
  res.json({ ok: true });
});

export default router;
