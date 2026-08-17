import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

const LIFELINE_TYPES = ['PHONE_A_FRIEND', 'DOUBLE_ANSWER', 'MORE_HINT', 'TRAP', 'PICK_ANSWERER'] as const;

// Picks one random question per point tier (100/200/300) instead of always
// the same fixed questions, so a larger question bank actually adds variety
// across games instead of sitting unused.
function pickBoardQuestions<T extends { points: number }>(questions: T[]): T[] {
  const picked: T[] = [];
  for (const points of [100, 200, 300]) {
    const pool = questions.filter((q) => q.points === points);
    if (pool.length > 0) picked.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return picked;
}

const teamSchema = z.object({
  name: z.string().min(2).max(22),
  color: z.string().default('#6C4CE0'),
  players: z.array(z.string().min(1)).min(1),
  lifelines: z.array(z.enum(LIFELINE_TYPES)).max(3).default([]),
});

const createGameSchema = z.object({
  mode: z.enum(['CLASSIC', 'KIDS', 'STUDENT']).default('CLASSIC'),
  teams: z.array(teamSchema).min(2).max(2),
  categoryIds: z.array(z.string()).min(1).max(8),
});

router.get('/active', requireAuth, async (req: AuthedRequest, res) => {
  const game = await prisma.game.findFirst({
    where: { userId: req.userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ game });
});

router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createGameSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة', details: parsed.error.flatten() });
  const { mode, teams, categoryIds } = parsed.data;

  const names = teams.map((t) => t.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) {
    return res.status(400).json({ error: 'بعض أسماء الفرق متشابهة، يرجى التغيير' });
  }

  const costsCredit = mode !== 'STUDENT';
  if (costsCredit) {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || user.remainingGames < 1) {
      return res.status(402).json({ error: 'لا يوجد لديك ألعاب متبقية، يرجى شراء باقة جديدة' });
    }
  }

  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    include: { questions: { orderBy: { points: 'asc' } } },
  });
  if (categories.length === 0) return res.status(400).json({ error: 'يرجى اختيار الفئات' });

  const game = await prisma.$transaction(async (tx) => {
    if (costsCredit) {
      await tx.user.update({ where: { id: req.userId! }, data: { remainingGames: { decrement: 1 } } });
    }

    const createdGame = await tx.game.create({ data: { userId: req.userId!, mode } });

    for (const team of teams) {
      const createdTeam = await tx.team.create({
        data: {
          gameId: createdGame.id,
          name: team.name.trim(),
          color: team.color,
          players: { create: team.players.map((name) => ({ name: name.trim() })) },
          lifelines: { create: team.lifelines.map((type) => ({ type })) },
        },
      });
      void createdTeam;
    }

    for (const category of categories) {
      await tx.gameCategory.create({ data: { gameId: createdGame.id, categoryId: category.id } });
      for (const question of pickBoardQuestions(category.questions)) {
        await tx.gameQuestion.create({ data: { gameId: createdGame.id, questionId: question.id } });
      }
    }

    return createdGame;
  });

  res.status(201).json({ game });
});

router.get('/:id/board', requireAuth, async (req: AuthedRequest, res) => {
  const game = await prisma.game.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!game) return res.status(404).json({ error: 'اللعبة غير موجودة' });

  const [teams, gameCategories, gameQuestions] = await Promise.all([
    prisma.team.findMany({ where: { gameId: game.id }, include: { players: true, lifelines: true } }),
    prisma.gameCategory.findMany({ where: { gameId: game.id }, include: { category: true } }),
    prisma.gameQuestion.findMany({ where: { gameId: game.id }, include: { question: true } }),
  ]);

  const tiles = gameQuestions.map((gq) => ({
    gameQuestionId: gq.id,
    categoryId: gq.question.categoryId,
    points: gq.question.points,
    isDrawing: gq.question.isDrawing,
    isOpened: gq.isOpened,
    answeredByTeamId: gq.answeredByTeamId,
    isCorrect: gq.isCorrect,
    usedVar: gq.usedVar,
    ...(gq.isOpened ? { text: gq.question.text, hint: gq.question.hint, answer: gq.question.answer } : {}),
  }));

  res.json({
    game,
    teams,
    categories: gameCategories.map((gc) => gc.category),
    tiles,
  });
});

router.post('/:id/questions/:gqId/open', requireAuth, async (req: AuthedRequest, res) => {
  const game = await prisma.game.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!game) return res.status(404).json({ error: 'اللعبة غير موجودة' });

  const gq = await prisma.gameQuestion.update({
    where: { id: req.params.gqId },
    data: { isOpened: true },
    include: { question: true },
  });
  res.json({
    tile: {
      gameQuestionId: gq.id,
      text: gq.question.text,
      hint: gq.question.hint,
      answer: gq.question.answer,
      points: gq.question.points,
      isDrawing: gq.question.isDrawing,
    },
  });
});

const answerSchema = z.object({ teamId: z.string(), isCorrect: z.boolean() });

router.post('/:id/questions/:gqId/answer', requireAuth, async (req: AuthedRequest, res) => {
  const game = await prisma.game.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!game) return res.status(404).json({ error: 'اللعبة غير موجودة' });
  const parsed = answerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });
  const { teamId, isCorrect } = parsed.data;

  const gq = await prisma.gameQuestion.findUnique({ where: { id: req.params.gqId }, include: { question: true } });
  if (!gq) return res.status(404).json({ error: 'السؤال غير موجود' });

  await prisma.$transaction([
    prisma.gameQuestion.update({ where: { id: gq.id }, data: { answeredByTeamId: teamId, isCorrect } }),
    ...(isCorrect
      ? [prisma.team.update({ where: { id: teamId }, data: { score: { increment: gq.question.points } } })]
      : []),
  ]);

  // Must match the shape /board returns (players + lifelines) — the client
  // replaces its whole teams array with this response, so dropping either
  // relation here silently breaks every screen that reads team.lifelines.
  const teams = await prisma.team.findMany({ where: { gameId: game.id }, include: { players: true, lifelines: true } });
  res.json({ teams });
});

router.post('/:id/lifelines/:lifelineId/use', requireAuth, async (req: AuthedRequest, res) => {
  const game = await prisma.game.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!game) return res.status(404).json({ error: 'اللعبة غير موجودة' });
  const lifeline = await prisma.teamLifeline.update({ where: { id: req.params.lifelineId }, data: { used: true } });
  res.json({ lifeline });
});

const varSchema = z.object({ questionId: z.string(), note: z.string().min(2) });

router.post('/:id/var', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = varSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });
  const report = await prisma.varReport.create({
    data: { questionId: parsed.data.questionId, note: parsed.data.note, gameId: req.params.id },
  });
  await prisma.gameQuestion.updateMany({
    where: { gameId: req.params.id, questionId: parsed.data.questionId },
    data: { usedVar: true },
  });
  res.status(201).json({ report });
});

router.post('/:id/finish', requireAuth, async (req: AuthedRequest, res) => {
  const game = await prisma.game.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!game) return res.status(404).json({ error: 'اللعبة غير موجودة' });
  const teams = await prisma.team.findMany({ where: { gameId: game.id }, orderBy: { score: 'desc' } });

  const isTie = teams.length > 1 && teams[0].score === teams[1].score;
  const updated = await prisma.game.update({
    where: { id: game.id },
    data: {
      status: 'FINISHED',
      finishedAt: new Date(),
      isTie,
      winnerTeamId: isTie ? null : teams[0]?.id,
    },
  });
  res.json({ game: updated, teams });
});

router.post('/:id/tiebreak', requireAuth, async (req: AuthedRequest, res) => {
  const game = await prisma.game.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!game || !game.isTie) return res.status(400).json({ error: 'لا يوجد تعادل في هذه اللعبة' });
  const teams = await prisma.team.findMany({ where: { gameId: game.id } });
  const top = Math.max(...teams.map((t) => t.score));
  const tied = teams.filter((t) => t.score === top);
  const winner = tied[Math.floor(Math.random() * tied.length)];
  const updated = await prisma.game.update({ where: { id: game.id }, data: { winnerTeamId: winner.id } });
  res.json({ game: updated, winner });
});

router.post('/:id/abandon', requireAuth, async (req: AuthedRequest, res) => {
  const game = await prisma.game.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!game) return res.status(404).json({ error: 'اللعبة غير موجودة' });
  await prisma.game.update({ where: { id: game.id }, data: { status: 'FINISHED', finishedAt: new Date() } });
  res.json({ ok: true });
});

export default router;
