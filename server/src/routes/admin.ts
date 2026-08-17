import { Router } from 'express';
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
    where: q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ users });
});

export default router;
