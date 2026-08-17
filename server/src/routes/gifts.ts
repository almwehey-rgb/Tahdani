import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { activeGateway } from '../utils/payment';
import { generateCode } from '../utils/codes';

const router = Router();

router.get('/sent', requireAuth, async (req: AuthedRequest, res) => {
  const gifts = await prisma.giftCode.findMany({
    where: { fromUserId: req.userId },
    include: { package: true, redeemedByUser: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ gifts });
});

router.get('/received', requireAuth, async (req: AuthedRequest, res) => {
  const gifts = await prisma.giftCode.findMany({
    where: { redeemedByUserId: req.userId },
    include: { package: true, fromUser: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ gifts });
});

const purchaseGiftSchema = z.object({
  packageId: z.string(),
  toPhone: z.string().optional(),
});

router.post('/purchase', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = purchaseGiftSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });
  const { packageId, toPhone } = parsed.data;

  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg || !pkg.active) return res.status(404).json({ error: 'الباقة غير متوفرة' });

  const result = await activeGateway.charge(pkg.price, pkg.currency);
  if (!result.success) return res.status(402).json({ error: 'فشل في عملية الدفع' });

  const gift = await prisma.giftCode.create({
    data: {
      code: generateCode('GIFT'),
      packageId,
      fromUserId: req.userId!,
      toPhone,
    },
    include: { package: true },
  });

  res.status(201).json({ gift });
});

const redeemSchema = z.object({ code: z.string().min(4) });

router.post('/redeem', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = redeemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'الرجاء إدخال رمز الهدية' });

  const gift = await prisma.giftCode.findUnique({ where: { code: parsed.data.code.trim().toUpperCase() }, include: { package: true } });
  if (!gift) return res.status(404).json({ error: 'لم يتم العثور على هذا الكود' });
  if (gift.status === 'REDEEMED') return res.status(400).json({ error: 'تم استلام هذه الهدية مسبقا' });
  if (gift.fromUserId === req.userId) return res.status(400).json({ error: 'لا يمكنك استلام هدية أرسلتها بنفسك' });

  await prisma.$transaction([
    prisma.giftCode.update({
      where: { id: gift.id },
      data: { status: 'REDEEMED', redeemedByUserId: req.userId!, redeemedAt: new Date() },
    }),
    prisma.user.update({ where: { id: req.userId! }, data: { remainingGames: { increment: gift.package.gamesCount } } }),
  ]);

  res.json({ ok: true, gamesAdded: gift.package.gamesCount });
});

export default router;
