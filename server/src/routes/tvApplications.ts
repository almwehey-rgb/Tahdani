import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

const schema = z.object({
  teamName: z.string().min(2).max(22),
  phone: z.string().min(6),
  membersCount: z.number().int().min(4).max(4),
  gender: z.enum(['MALE', 'FEMALE']),
  agreedToTerms: z.literal(true),
});

router.post('/', async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'يجب الموافقة على الشروط وتعبئة جميع الحقول' });
  const application = await prisma.tvApplication.create({ data: parsed.data });
  res.status(201).json({ application });
});

router.get('/', requireAuth, requireAdmin, async (_req, res) => {
  const applications = await prisma.tvApplication.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ applications });
});

router.put('/:id/status', requireAuth, requireAdmin, async (req, res) => {
  const status = req.body?.status === 'REVIEWED' ? 'REVIEWED' : 'PENDING';
  const application = await prisma.tvApplication.update({ where: { id: req.params.id }, data: { status } });
  res.json({ application });
});

export default router;
