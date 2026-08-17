import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { activeProvider, generateOtp } from '../utils/sms';
import { signToken } from '../utils/jwt';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

const requestOtpSchema = z.object({
  phone: z.string().min(6),
  countryCode: z.string().min(2).default('+973'),
});

router.post('/request-otp', async (req, res) => {
  const parsed = requestOtpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'رقم الهاتف غير صالح' });
  const { phone, countryCode } = parsed.data;
  const fullPhone = `${countryCode}${phone}`;

  const code = generateOtp();
  await prisma.otpCode.create({
    data: { phone: fullPhone, code, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
  });
  await activeProvider.send(fullPhone, `رمز التحقق الخاص بك في تحدّني: ${code}`);

  // devCode is only exposed because this project has no real SMS account wired up yet.
  // Remove this field once `activeProvider` is swapped for a real gateway.
  res.json({ ok: true, devCode: code });
});

const verifyOtpSchema = z.object({
  phone: z.string().min(6),
  countryCode: z.string().min(2).default('+973'),
  code: z.string().length(6),
  name: z.string().min(2).max(40).optional(),
});

router.post('/verify-otp', async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });
  const { phone, countryCode, code, name } = parsed.data;
  const fullPhone = `${countryCode}${phone}`;

  const otp = await prisma.otpCode.findFirst({
    where: { phone: fullPhone, code, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) return res.status(400).json({ error: 'الرمز غير صحيح أو منتهي الصلاحية' });

  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });

  let user = await prisma.user.findUnique({ where: { phone: fullPhone } });
  if (!user) {
    user = await prisma.user.create({
      data: { phone: fullPhone, countryCode, name: name?.trim() || 'لاعب جديد', remainingGames: 1 },
    });
  }

  const token = signToken({ userId: user.id, role: user.role });
  res.json({ token, user });
});

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  res.json({ user });
});

const updateMeSchema = z.object({ name: z.string().min(2).max(40) });

router.put('/me', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'الاسم مطلوب' });
  const user = await prisma.user.update({ where: { id: req.userId }, data: { name: parsed.data.name.trim() } });
  res.json({ user });
});

export default router;
