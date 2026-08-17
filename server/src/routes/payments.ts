import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { getGateway } from '../gateways';
import { generateCode } from '../utils/codes';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const checkoutSchema = z.object({
  packageId: z.string(),
  discountCode: z.string().optional(),
  purpose: z.enum(['SELF', 'GIFT']).default('SELF'),
  giftToPhone: z.string().optional(),
});

router.post('/checkout', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });
  const { packageId, discountCode, purpose, giftToPhone } = parsed.data;

  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg || !pkg.active) return res.status(404).json({ error: 'الباقة غير متوفرة' });

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

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
      purpose,
      giftToPhone: purpose === 'GIFT' ? giftToPhone : undefined,
    },
  });

  // A 100%-off code (or any code that zeroes the price) never needs a real
  // gateway session — payment providers reject zero-amount charges anyway,
  // and there's nothing to collect. Fulfill it immediately instead.
  if (amount <= 0) {
    const { giftCode } = await fulfillPaidPurchase({ ...purchase, package: pkg });
    return res.status(201).json({ purchaseId: purchase.id, redirectUrl: null, free: true, giftCode: giftCode?.code || null });
  }

  const gateway = getGateway();
  const callbackUrl = `${FRONTEND_URL}/payment/callback?purchaseId=${purchase.id}`;

  try {
    const { redirectUrl, providerRef } = await gateway.createPayment({
      purchaseId: purchase.id,
      amount,
      currency: pkg.currency,
      customerName: user.name,
      description: `${pkg.name} — تحدّني`,
      callbackUrl,
      errorUrl: callbackUrl,
      webhookUrl: process.env.SERVER_PUBLIC_URL ? `${process.env.SERVER_PUBLIC_URL}/api/payments/webhook/${gateway.name}` : undefined,
    });

    await prisma.purchase.update({
      where: { id: purchase.id },
      data: { provider: gateway.name, providerRef, redirectUrl },
    });

    res.status(201).json({ purchaseId: purchase.id, redirectUrl, free: false });
  } catch (err) {
    await prisma.purchase.update({ where: { id: purchase.id }, data: { status: 'FAILED' } });
    console.error('Payment createPayment error:', err);
    res.status(502).json({ error: 'تعذر إنشاء عملية الدفع، حاول مرة أخرى' });
  }
});

type PurchaseWithPackage = Prisma.PurchaseGetPayload<{ include: { package: true } }>;

// Shared "mark paid and grant what was purchased" step — used both when a
// real gateway confirms payment and when a 100%-off code skips the gateway
// entirely. Never called with a purchase that's already PAID (callers check
// that first) so it never double-grants credits or mints a second gift code.
async function fulfillPaidPurchase(purchase: PurchaseWithPackage) {
  const giftCode = await prisma.$transaction(async (tx) => {
    await tx.purchase.update({ where: { id: purchase.id }, data: { status: 'PAID', paidAt: new Date() } });
    if (purchase.discountCodeId) {
      await tx.discountCode.update({ where: { id: purchase.discountCodeId }, data: { usedCount: { increment: 1 } } });
    }
    if (purchase.purpose === 'GIFT') {
      return tx.giftCode.create({
        data: {
          code: generateCode('GIFT'),
          purchaseId: purchase.id,
          packageId: purchase.packageId,
          fromUserId: purchase.userId,
          toPhone: purchase.giftToPhone,
        },
      });
    }
    await tx.user.update({ where: { id: purchase.userId }, data: { remainingGames: { increment: purchase.package.gamesCount } } });
    return null;
  });
  return { giftCode };
}

async function finalizePurchase(purchaseId: string) {
  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId }, include: { package: true } });
  if (!purchase) return { error: 'العملية غير موجودة' as const };
  if (purchase.status === 'PAID') {
    const giftCode = purchase.purpose === 'GIFT' ? await prisma.giftCode.findUnique({ where: { purchaseId: purchase.id } }) : null;
    return { purchase, giftCode, alreadyFinalized: true };
  }
  if (!purchase.provider || !purchase.providerRef) return { error: 'لم يتم بدء عملية الدفع بعد' as const };

  const gateway = getGateway();
  const result = await gateway.verifyPayment(purchase.providerRef);

  if (!result.paid) {
    await prisma.purchase.update({ where: { id: purchase.id }, data: { status: 'FAILED' } });
    return { purchase: { ...purchase, status: 'FAILED' as const }, giftCode: null, alreadyFinalized: false };
  }

  const { giftCode } = await fulfillPaidPurchase(purchase);
  const updated = await prisma.purchase.findUnique({ where: { id: purchase.id } });
  return { purchase: updated!, giftCode, alreadyFinalized: false };
}

router.post('/verify/:purchaseId', requireAuth, async (req: AuthedRequest, res) => {
  const purchase = await prisma.purchase.findFirst({ where: { id: req.params.purchaseId, userId: req.userId } });
  if (!purchase) return res.status(404).json({ error: 'العملية غير موجودة' });

  const result = await finalizePurchase(purchase.id);
  if ('error' in result) return res.status(400).json({ error: result.error });

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  res.json({
    status: result.purchase.status,
    purpose: result.purchase.purpose,
    giftCode: result.giftCode?.code || null,
    remainingGames: user?.remainingGames,
  });
});

// Public webhook receivers — best-effort async confirmation. The source of
// truth is always the authenticated verifyPayment() call against the
// gateway's own API, never the webhook payload itself.
router.post('/webhook/:provider', async (req, res) => {
  try {
    const purchaseId =
      req.body?.reference?.order || // tap
      req.body?.CustomerReference || // myfatoorah
      req.query.purchaseId;
    if (typeof purchaseId === 'string') {
      await finalizePurchase(purchaseId);
    }
  } catch (err) {
    console.error('Webhook finalize error:', err);
  }
  res.status(200).json({ received: true });
});

export default router;
