import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

const LIFELINE_TYPES = ['PHONE_A_FRIEND', 'DOUBLE_ANSWER', 'MORE_HINT', 'TRAP', 'PICK_ANSWERER', 'STEAL_POINTS', 'DOUBLE_POINTS'] as const;

const TILES_PER_TIER = 2;

// Picks TILES_PER_TIER random questions per point tier (100/200/300)
// instead of always the same fixed questions, so a larger question bank
// actually adds variety across games instead of sitting unused.
function pickBoardQuestions<T extends { points: number }>(questions: T[]): T[] {
  const picked: T[] = [];
  for (const points of [200, 400, 600]) {
    const pool = questions.filter((q) => q.points === points);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    picked.push(...pool.slice(0, TILES_PER_TIER));
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
  teams: z.array(teamSchema).min(2).max(4),
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
  let unlimited = false;
  if (costsCredit) {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(402).json({ error: 'لا يوجد لديك ألعاب متبقية، يرجى شراء باقة جديدة' });
    // An unlimited account is never gated and never charged below.
    if (user.unlimitedGames) unlimited = true;
    else if (user.remainingGames < 1) {
      return res.status(402).json({ error: 'لا يوجد لديك ألعاب متبقية، يرجى شراء باقة جديدة' });
    }
  }

  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    include: { questions: { orderBy: { points: 'asc' } } },
  });
  if (categories.length === 0) return res.status(400).json({ error: 'يرجى اختيار الفئات' });

  const game = await prisma.$transaction(async (tx) => {
    if (costsCredit && !unlimited) {
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
    prisma.team.findMany({ where: { gameId: game.id }, include: { players: true, lifelines: true }, orderBy: { id: 'asc' } }),
    prisma.gameCategory.findMany({ where: { gameId: game.id }, include: { category: true } }),
    prisma.gameQuestion.findMany({ where: { gameId: game.id }, include: { question: { include: { answers: { orderBy: { sortOrder: 'asc' } } } } } }),
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
    ...(gq.isOpened
      ? {
          text: gq.question.text,
          hint: gq.question.hint,
          hint2: gq.question.hint2,
          hint3: gq.question.hint3,
          hint4: gq.question.hint4,
          answer: gq.question.answer,
          imageUrl: gq.question.imageUrl,
          videoUrl: gq.question.videoUrl,
          grayscale: gq.question.grayscale,
          answers: gq.question.answers,
        }
      : {}),
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
    include: { question: { include: { answers: { orderBy: { sortOrder: 'asc' } } } } },
  });
  res.json({
    tile: {
      gameQuestionId: gq.id,
      text: gq.question.text,
      hint: gq.question.hint,
      hint2: gq.question.hint2,
      hint3: gq.question.hint3,
      hint4: gq.question.hint4,
      answer: gq.question.answer,
      imageUrl: gq.question.imageUrl,
      videoUrl: gq.question.videoUrl,
      grayscale: gq.question.grayscale,
      points: gq.question.points,
      isDrawing: gq.question.isDrawing,
      answers: gq.question.answers,
    },
  });
});

const answerSchema = z.object({
  teamId: z.string(),
  isCorrect: z.boolean(),
  // Extra teams the host also ruled correct on the same question.
  alsoCorrectTeamIds: z.array(z.string()).default([]),
});

router.post('/:id/questions/:gqId/answer', requireAuth, async (req: AuthedRequest, res) => {
  const game = await prisma.game.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!game) return res.status(404).json({ error: 'اللعبة غير موجودة' });
  const parsed = answerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });
  const { teamId, isCorrect } = parsed.data;

  const gq = await prisma.gameQuestion.findUnique({ where: { id: req.params.gqId }, include: { question: true } });
  if (!gq) return res.status(404).json({ error: 'السؤال غير موجود' });

  // Only teams in this game, never the main team twice, and only when the
  // answer was actually ruled correct.
  const gameTeamIds = new Set((await prisma.team.findMany({ where: { gameId: game.id }, select: { id: true } })).map((t) => t.id));
  const alsoCorrectTeamIds = isCorrect
    ? [...new Set(parsed.data.alsoCorrectTeamIds)].filter((tid) => tid !== teamId && gameTeamIds.has(tid))
    : [];

  await prisma.$transaction([
    prisma.gameQuestion.update({ where: { id: gq.id }, data: { answeredByTeamId: teamId, isCorrect, alsoCorrectTeamIds } }),
    ...(isCorrect
      ? [
          prisma.team.update({ where: { id: teamId }, data: { score: { increment: gq.question.points } } }),
          ...alsoCorrectTeamIds.map((tid) =>
            prisma.team.update({ where: { id: tid }, data: { score: { increment: gq.question.points } } }),
          ),
        ]
      : []),
  ]);

  // Must match the shape /board returns (players + lifelines) — the client
  // replaces its whole teams array with this response, so dropping either
  // relation here silently breaks every screen that reads team.lifelines.
  const teams = await prisma.team.findMany({ where: { gameId: game.id }, include: { players: true, lifelines: true }, orderBy: { id: 'asc' } });
  res.json({ teams });
});

router.post('/:id/questions/:gqId/undo', requireAuth, async (req: AuthedRequest, res) => {
  const game = await prisma.game.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!game) return res.status(404).json({ error: 'اللعبة غير موجودة' });

  const gq = await prisma.gameQuestion.findUnique({ where: { id: req.params.gqId }, include: { question: true } });
  if (!gq) return res.status(404).json({ error: 'السؤال غير موجود' });
  if (!gq.answeredByTeamId) return res.status(400).json({ error: 'هذا السؤال ما تم الإجابة عليه بعد' });

  await prisma.$transaction([
    prisma.gameQuestion.update({ where: { id: gq.id }, data: { answeredByTeamId: null, isCorrect: null, alsoCorrectTeamIds: [] } }),
    ...(gq.isCorrect
      ? [
          prisma.team.update({ where: { id: gq.answeredByTeamId }, data: { score: { decrement: gq.question.points } } }),
          // Teams that shared the point on this question lose it too.
          ...gq.alsoCorrectTeamIds.map((tid) =>
            prisma.team.update({ where: { id: tid }, data: { score: { decrement: gq.question.points } } }),
          ),
        ]
      : []),
  ]);

  const teams = await prisma.team.findMany({ where: { gameId: game.id }, include: { players: true, lifelines: true }, orderBy: { id: 'asc' } });
  res.json({
    teams,
    tile: {
      gameQuestionId: gq.id,
      text: gq.question.text,
      hint: gq.question.hint,
      hint2: gq.question.hint2,
      hint3: gq.question.hint3,
      hint4: gq.question.hint4,
      answer: gq.question.answer,
      imageUrl: gq.question.imageUrl,
      videoUrl: gq.question.videoUrl,
      grayscale: gq.question.grayscale,
      points: gq.question.points,
      isDrawing: gq.question.isDrawing,
    },
  });
});

const useLifelineSchema = z.object({ gameQuestionId: z.string().optional() });

router.post('/:id/lifelines/:lifelineId/use', requireAuth, async (req: AuthedRequest, res) => {
  const game = await prisma.game.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!game) return res.status(404).json({ error: 'اللعبة غير موجودة' });

  const lifeline = await prisma.teamLifeline.findUnique({ where: { id: req.params.lifelineId } });
  if (!lifeline) return res.status(404).json({ error: 'وسيلة المساعدة غير موجودة' });

  // Steals points equal to the currently open question's value from the
  // other team, capped at what they actually have so scores never go
  // negative.
  let stolen = 0;
  if (lifeline.type === 'STEAL_POINTS') {
    const parsed = useLifelineSchema.safeParse(req.body);
    const gameQuestionId = parsed.success ? parsed.data.gameQuestionId : undefined;
    if (gameQuestionId) {
      const [gq, team] = await Promise.all([
        prisma.gameQuestion.findUnique({ where: { id: gameQuestionId }, include: { question: true } }),
        prisma.team.findUnique({ where: { id: lifeline.teamId } }),
      ]);
      // With more than 2 teams there's no single "the opponent" — steal from
      // whoever currently has the most points, since that's the team with
      // the most to lose and the most reasonable default without adding a
      // target-picker UI.
      const opponent = team
        ? await prisma.team.findFirst({ where: { gameId: game.id, id: { not: team.id } }, orderBy: { score: 'desc' } })
        : null;
      if (gq && team && opponent) {
        stolen = Math.min(gq.question.points, opponent.score);
        if (stolen > 0) {
          await prisma.$transaction([
            prisma.team.update({ where: { id: opponent.id }, data: { score: { decrement: stolen } } }),
            prisma.team.update({ where: { id: team.id }, data: { score: { increment: stolen } } }),
          ]);
        }
      }
    }
  }

  const updated = await prisma.teamLifeline.update({ where: { id: req.params.lifelineId }, data: { used: true } });
  const teams = await prisma.team.findMany({ where: { gameId: game.id }, include: { players: true, lifelines: true }, orderBy: { id: 'asc' } });
  res.json({ lifeline: updated, teams, stolen });
});

const adjustScoreSchema = z.object({ delta: z.number().int().min(-1000).max(1000) });

router.post('/:id/teams/:teamId/adjust-score', requireAuth, async (req: AuthedRequest, res) => {
  const game = await prisma.game.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!game) return res.status(404).json({ error: 'اللعبة غير موجودة' });
  const parsed = adjustScoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });

  const team = await prisma.team.findFirst({ where: { id: req.params.teamId, gameId: game.id } });
  if (!team) return res.status(404).json({ error: 'الفريق غير موجود' });

  const updated = await prisma.team.update({
    where: { id: team.id },
    data: { score: Math.max(0, team.score + parsed.data.delta) },
  });
  res.json({ team: updated });
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

// Past games, newest first, with just enough detail to recognise one in a list.
router.get('/history', requireAuth, async (req: AuthedRequest, res) => {
  const games = await prisma.game.findMany({
    where: { userId: req.userId, status: 'FINISHED' },
    orderBy: { createdAt: 'desc' },
    include: {
      teams: { orderBy: { id: 'asc' }, select: { id: true, name: true, color: true, score: true } },
      gameCategories: { include: { category: { select: { name: true } } } },
    },
  });
  res.json({
    games: games.map((g) => ({
      id: g.id,
      mode: g.mode,
      createdAt: g.createdAt,
      finishedAt: g.finishedAt,
      winnerTeamId: g.winnerTeamId,
      isTie: g.isTie,
      teams: g.teams,
      categories: g.gameCategories.map((gc) => gc.category.name),
    })),
  });
});

// Nothing in the schema cascades, so a game's children have to go first, and
// GameQuestion has to go before Team because it points at the answering team.
async function deleteGamesDeep(gameIds: string[]) {
  if (gameIds.length === 0) return;
  const teams = await prisma.team.findMany({ where: { gameId: { in: gameIds } }, select: { id: true } });
  const teamIds = teams.map((t) => t.id);
  await prisma.$transaction([
    prisma.player.deleteMany({ where: { teamId: { in: teamIds } } }),
    prisma.teamLifeline.deleteMany({ where: { teamId: { in: teamIds } } }),
    prisma.gameQuestion.deleteMany({ where: { gameId: { in: gameIds } } }),
    prisma.gameCategory.deleteMany({ where: { gameId: { in: gameIds } } }),
    prisma.varReport.deleteMany({ where: { gameId: { in: gameIds } } }),
    prisma.team.deleteMany({ where: { gameId: { in: gameIds } } }),
    prisma.game.deleteMany({ where: { id: { in: gameIds } } }),
  ]);
}

// Clears the whole history at once. Only finished games — an active game is
// still being played and would vanish out from under the host.
router.delete('/history', requireAuth, async (req: AuthedRequest, res) => {
  const games = await prisma.game.findMany({
    where: { userId: req.userId, status: 'FINISHED' },
    select: { id: true },
  });
  await deleteGamesDeep(games.map((g) => g.id));
  res.json({ ok: true, deleted: games.length });
});

router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const game = await prisma.game.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!game) return res.status(404).json({ error: 'اللعبة غير موجودة' });
  if (game.status === 'ACTIVE') return res.status(400).json({ error: 'لا يمكن حذف لعبة نشطة، أنهها أولاً' });
  await deleteGamesDeep([game.id]);
  res.json({ ok: true });
});

router.post('/:id/abandon', requireAuth, async (req: AuthedRequest, res) => {
  const game = await prisma.game.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!game) return res.status(404).json({ error: 'اللعبة غير موجودة' });
  await prisma.game.update({ where: { id: game.id }, data: { status: 'FINISHED', finishedAt: new Date() } });
  res.json({ ok: true });
});

export default router;
