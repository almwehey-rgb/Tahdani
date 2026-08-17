import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth, requireAdmin, AuthedRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req, res) => {
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;
  const categories = await prisma.category.findMany({
    where: { active: true, ...(type ? { type } : {}) },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { questions: true } } },
  });
  res.json({ categories });
});

const upsertSchema = z.object({
  name: z.string().min(2),
  icon: z.string().default('🎯'),
  color: z.string().default('#6C4CE0'),
  type: z.enum(['PERMANENT', 'SEASONAL', 'KIDS', 'DRAWING', 'STUDENT']).default('PERMANENT'),
  seasonTag: z.string().optional().nullable(),
  active: z.boolean().default(true),
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });
  const category = await prisma.category.create({ data: parsed.data });
  res.status(201).json({ category });
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const parsed = upsertSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });
  const category = await prisma.category.update({ where: { id: req.params.id }, data: parsed.data });
  res.json({ category });
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  await prisma.category.update({ where: { id: req.params.id }, data: { active: false } });
  res.json({ ok: true });
});

router.get('/:id/questions', requireAuth, requireAdmin, async (req, res) => {
  const questions = await prisma.question.findMany({ where: { categoryId: req.params.id }, orderBy: { points: 'asc' } });
  res.json({ questions });
});

const questionSchema = z.object({
  categoryId: z.string(),
  text: z.string().min(2),
  answer: z.string().min(1),
  hint: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  points: z.number().int().min(50).max(1000).default(200),
  isDrawing: z.boolean().default(false),
});

router.post('/:id/questions', requireAuth, requireAdmin, async (req, res) => {
  const parsed = questionSchema.safeParse({ ...req.body, categoryId: req.params.id });
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });
  const question = await prisma.question.create({ data: parsed.data });
  res.status(201).json({ question });
});

router.put('/questions/:qid', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = questionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });
  const question = await prisma.question.update({ where: { id: req.params.qid }, data: parsed.data });
  res.json({ question });
});

router.delete('/questions/:qid', requireAuth, requireAdmin, async (req, res) => {
  await prisma.question.delete({ where: { id: req.params.qid } });
  res.json({ ok: true });
});

export default router;
