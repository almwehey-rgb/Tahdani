import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, requireAdmin, AuthedRequest } from '../middleware/auth';

const router = Router();

router.get('/mine', requireAuth, async (req: AuthedRequest, res) => {
  const purchases = await prisma.purchase.findMany({
    where: { userId: req.userId, purpose: 'SELF' },
    include: { package: true, discountCode: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ purchases });
});

router.get('/admin/all', requireAuth, requireAdmin, async (_req, res) => {
  const purchases = await prisma.purchase.findMany({
    include: { package: true, user: { select: { name: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json({ purchases });
});

export default router;
