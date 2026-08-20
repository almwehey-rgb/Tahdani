import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/summary', async (_req, res) => {
  const [users, games, purchases, paidPurchases, tournaments, tvApplications, openVar] = await Promise.all([
    prisma.user.count(),
    prisma.game.count(),
    prisma.purchase.count(),
    prisma.purchase.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
    prisma.tournament.count(),
    prisma.tvApplication.count({ where: { status: 'PENDING' } }),
    prisma.varReport.count({ where: { status: 'OPEN' } }),
  ]);
  res.json({
    users,
    games,
    purchases,
    revenue: paidPurchases._sum.amount || 0,
    tournaments,
    pendingTvApplications: tvApplications,
    openVarReports: openVar,
  });
});

router.get('/var-reports', async (_req, res) => {
  const reports = await prisma.varReport.findMany({
    include: { question: { include: { category: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ reports });
});

router.put('/var-reports/:id/resolve', async (req, res) => {
  const report = await prisma.varReport.update({ where: { id: req.params.id }, data: { status: 'RESOLVED' } });
  res.json({ report });
});

router.get('/users', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const users = await prisma.user.findMany({
    where: q ? { name: { contains: q } } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ users });
});

router.get('/access-code', async (_req, res) => {
  const setting = await prisma.appSetting.findUnique({ where: { id: 'singleton' } });
  res.json({ accessCode: setting?.accessCode || null });
});

const accessCodeSchema = z.object({ accessCode: z.string().min(3).max(40) });

router.put('/access-code', async (req, res) => {
  const parsed = accessCodeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'الكود يجب أن يكون 3 أحرف على الأقل' });
  const setting = await prisma.appSetting.upsert({
    where: { id: 'singleton' },
    update: { accessCode: parsed.data.accessCode },
    create: { id: 'singleton', accessCode: parsed.data.accessCode },
  });
  res.json({ accessCode: setting.accessCode });
});

// Every game created in the app, not just the admin's own — this is the view
// for clearing out test games and old runs.
router.get('/games', async (req, res) => {
  const take = Math.min(Number(req.query.take) || 100, 500);
  const games = await prisma.game.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      user: { select: { name: true } },
      teams: { orderBy: { id: 'asc' }, select: { id: true, name: true, color: true, score: true } },
      _count: { select: { gameCategories: true } },
    },
  });
  const total = await prisma.game.count();
  res.json({
    total,
    games: games.map((g) => ({
      id: g.id,
      mode: g.mode,
      status: g.status,
      createdAt: g.createdAt,
      winnerTeamId: g.winnerTeamId,
      isTie: g.isTie,
      userName: g.user.name,
      teams: g.teams,
      categoryCount: g._count.gameCategories,
    })),
  });
});

// Nothing in the schema cascades, so children go first, and GameQuestion has
// to precede Team because it points at the answering team.
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

// Wipes every finished game in the app. Active ones are left alone so a game
// someone is playing right now doesn't disappear mid-round.
router.delete('/games/finished', async (_req, res) => {
  const games = await prisma.game.findMany({ where: { status: 'FINISHED' }, select: { id: true } });
  await deleteGamesDeep(games.map((g) => g.id));
  res.json({ ok: true, deleted: games.length });
});

router.delete('/games/:id', async (req, res) => {
  const game = await prisma.game.findUnique({ where: { id: req.params.id } });
  if (!game) return res.status(404).json({ error: 'اللعبة غير موجودة' });
  await deleteGamesDeep([game.id]);
  res.json({ ok: true });
});

export default router;
