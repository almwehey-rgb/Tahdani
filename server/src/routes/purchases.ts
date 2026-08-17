import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth, requireAdmin, AuthedRequest } from '../middleware/auth';
import { activeGateway } from '../utils/payment';

const router = Router();

router.get('/mine', requireAuth, async (req: AuthedRequest, res) => {
  const purchases = await prisma.purchase.findMany({
    where: { userId: req.userId },
    include: { package: true, discountCode: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ purchases });
});

const checkoutSchema = z.object({
  packageId: z.string(),
  discountCode: z.string().optional(),
});

router.post('/checkout', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });
  const { packageId, discountCode } = parsed.data;

  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg || !pkg.active) return res.status(404).json({ error: 'الباقة غير متوفرة' });

  let amount = pkg.price;
  let discount = null as Awaited<ReturnType<typeof prisma.discountCode.findUnique>> | null;

  if (discountCode) {
    discount = await prisma.discountCode.findUnique({ where: { code: discountCode.trim().toUpperCase() } });
    if (!discount || !discount.active || discount.usedCount >= discount.maxUses || (discount.expiresAt && discount.expiresAt < new Date())) {
      return res.status(400).json({ error: 'كود الخصم غير صالح' });
    }
    amount = Math.max(0, amount * (1 - discount.percentOff / 100));
  }

  const purchase = await prisma.purchase.create({
    data: {
      userId: req.userId!,
      packageId,
      amount,
      discountCodeId: discount?.id,
      status: 'PENDING',
    },
  });

  const result = await activeGateway.charge(amount, pkg.currency);

  if (!result.success) {
    await prisma.purchase.update({ where: { id: purchase.id }, data: { status: 'FAILED' } });
    return res.status(402).json({ error: 'فشل في عملية الدفع' });
  }

  await prisma.$transaction([
    prisma.purchase.update({
      where: { id: purchase.id },
      data: { status: 'PAID', providerRef: result.ref, paidAt: new Date() },
    }),
    prisma.user.update({
      where: { id: req.userId! },
      data: { remainingGames: { increment: pkg.gamesCount } },
    }),
    ...(discount ? [prisma.discountCode.update({ where: { id: discount.id }, data: { usedCount: { increment: 1 } } })] : []),
  ]);

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  res.json({ ok: true, purchaseId: purchase.id, remainingGames: user!.remainingGames });
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
