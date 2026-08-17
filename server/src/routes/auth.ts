import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { signToken } from '../utils/jwt';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

const loginSchema = z.object({
  name: z.string().min(2).max(40),
  code: z.string().min(1),
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'الاسم والكود مطلوبان' });
  const { name, code } = parsed.data;

  const setting = await prisma.appSetting.findUnique({ where: { id: 'singleton' } });
  if (!setting || code !== setting.accessCode) {
    return res.status(401).json({ error: 'الكود غير صحيح' });
  }

  const trimmedName = name.trim();
  let user = await prisma.user.findUnique({ where: { name: trimmedName } });
  if (!user) {
    user = await prisma.user.create({ data: { name: trimmedName, remainingGames: 1 } });
  }

  const token = signToken({ userId: user.id, role: user.role });
  res.json({ token, user });
});

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  res.json({ user });
});

export default router;
