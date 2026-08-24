import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth, requireAdmin, AuthedRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req, res) => {
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;
  const categories = await prisma.category.findMany({
    where: { active: true, ...(type ? { type } : {}) },
    // Categories that actually carry questions lead the list; the many empty
    // placeholders fall to the bottom instead of burying the playable ones.
    orderBy: [{ questions: { _count: 'desc' } }, { createdAt: 'asc' }],
    include: { _count: { select: { questions: true } } },
  });
  res.json({ categories });
});

const upsertSchema = z.object({
  name: z.string().min(2),
  icon: z.string().default('🎯'),
  color: z.string().default('#6C4CE0'),
  imageUrl: z.string().optional().nullable(),
  type: z.enum(['PERMANENT', 'SEASONAL', 'KIDS', 'DRAWING', 'STUDENT', 'LIST']).default('PERMANENT'),
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
  const questions = await prisma.question.findMany({
    where: { categoryId: req.params.id },
    orderBy: { points: 'asc' },
    include: { answers: { orderBy: { sortOrder: 'asc' } } },
  });
  res.json({ questions });
});

// A list question carries several hidden answers, each with its own score.
const answerSchema = z.object({
  text: z.string().min(1),
  points: z.number().int().min(0).max(5000).default(100),
});

const questionSchema = z.object({
  categoryId: z.string(),
  text: z.string().min(2),
  // Optional when `answers` is given: the single-answer field is then filled
  // from the list so the existing board and history keep working.
  answer: z.string().min(1).optional(),
  answers: z.array(answerSchema).max(30).optional(),
  hint: z.string().optional().nullable(),
  hint2: z.string().optional().nullable(),
  hint3: z.string().optional().nullable(),
  hint4: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  videoUrl: z.string().url().optional().nullable(), // direct .mp4 or a YouTube link
  grayscale: z.boolean().default(false),
  points: z.number().int().min(50).max(1000).default(200),
  isDrawing: z.boolean().default(false),
});

router.post('/:id/questions', requireAuth, requireAdmin, async (req, res) => {
  const parsed = questionSchema.safeParse({ ...req.body, categoryId: req.params.id });
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });
  const { answers, ...rest } = parsed.data;
  const answer = rest.answer || (answers && answers.length ? answers.map((a) => a.text).join('، ') : '');
  if (!answer) return res.status(400).json({ error: 'الإجابة مطلوبة' });
  const question = await prisma.question.create({
    data: {
      ...rest,
      answer,
      ...(answers && answers.length
        ? { answers: { create: answers.map((a, i) => ({ ...a, sortOrder: i })) } }
        : {}),
    },
    include: { answers: { orderBy: { sortOrder: 'asc' } } },
  });
  res.status(201).json({ question });
});

router.put('/questions/:qid', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = questionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });
  const { answers, ...rest } = parsed.data;
  // Sending `answers` replaces the whole list — editing one row of a list of
  // twenty by hand is not something the panel should have to orchestrate.
  const question = await prisma.$transaction(async (tx) => {
    if (answers) {
      await tx.questionAnswer.deleteMany({ where: { questionId: req.params.qid } });
      if (answers.length) {
        await tx.questionAnswer.createMany({
          data: answers.map((a, i) => ({ ...a, sortOrder: i, questionId: req.params.qid })),
        });
      }
    }
    const data = { ...rest };
    if (answers && answers.length && !rest.answer) data.answer = answers.map((a) => a.text).join('، ');
    return tx.question.update({
      where: { id: req.params.qid },
      data,
      include: { answers: { orderBy: { sortOrder: 'asc' } } },
    });
  });
  res.json({ question });
});

// A question that has ever been dealt into a game is referenced by
// GameQuestion (and possibly VarReport), and nothing here cascades — deleting
// it straight off raises a foreign-key error that this handler used to leave
// unanswered, hanging the request instead of failing it. Clear the children
// first, in one transaction so a half-deleted question is never left behind.
router.delete('/questions/:qid', requireAuth, requireAdmin, async (req, res) => {
  const { qid } = req.params;
  try {
    await prisma.$transaction([
      prisma.varReport.deleteMany({ where: { questionId: qid } }),
      prisma.gameQuestion.deleteMany({ where: { questionId: qid } }),
      prisma.question.delete({ where: { id: qid } }),
    ]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'تعذر حذف السؤال' });
  }
});

router.delete('/:id/questions', requireAuth, requireAdmin, async (req, res) => {
  const categoryId = req.params.id;
  try {
    const ids = (await prisma.question.findMany({ where: { categoryId }, select: { id: true } })).map((q) => q.id);
    const [, , { count }] = await prisma.$transaction([
      prisma.varReport.deleteMany({ where: { questionId: { in: ids } } }),
      prisma.gameQuestion.deleteMany({ where: { questionId: { in: ids } } }),
      prisma.question.deleteMany({ where: { categoryId } }),
    ]);
    res.json({ ok: true, count });
  } catch (e) {
    res.status(400).json({ error: 'تعذر حذف أسئلة الفئة' });
  }
});

export default router;
