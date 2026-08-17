import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/subjects', async (req, res) => {
  const { grade, semester } = req.query;
  const subjects = await prisma.studentSubject.findMany({
    where: {
      active: true,
      ...(typeof grade === 'string' ? { grade } : {}),
      ...(typeof semester === 'string' ? { semester } : {}),
    },
    include: { _count: { select: { questions: true } } },
  });
  res.json({ subjects });
});

router.get('/grades', async (_req, res) => {
  const rows = await prisma.studentSubject.findMany({ select: { grade: true }, distinct: ['grade'] });
  res.json({ grades: rows.map((r) => r.grade) });
});

router.get('/subjects/:id/questions', async (req, res) => {
  const questions = await prisma.studentQuestion.findMany({ where: { subjectId: req.params.id } });
  res.json({
    questions: questions.map((q) => ({ ...q, choices: JSON.parse(q.choices) })),
  });
});

const subjectSchema = z.object({
  name: z.string().min(2),
  grade: z.string().min(2),
  semester: z.string().min(2),
  active: z.boolean().default(true),
});

router.post('/subjects', requireAuth, requireAdmin, async (req, res) => {
  const parsed = subjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });
  const subject = await prisma.studentSubject.create({ data: parsed.data });
  res.status(201).json({ subject });
});

const questionSchema = z.object({
  subjectId: z.string(),
  text: z.string().min(2),
  choices: z.array(z.string().min(1)).min(2).max(6),
  correctIndex: z.number().int().min(0),
});

router.post('/questions', requireAuth, requireAdmin, async (req, res) => {
  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });
  const { choices, ...rest } = parsed.data;
  const question = await prisma.studentQuestion.create({ data: { ...rest, choices: JSON.stringify(choices) } });
  res.status(201).json({ question });
});

export default router;
