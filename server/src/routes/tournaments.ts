import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const tournaments = await prisma.tournament.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
    include: { teams: true, _count: { select: { matches: true } } },
  });
  res.json({ tournaments });
});

router.get('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const tournament = await prisma.tournament.findFirst({
    where: { id: req.params.id, userId: req.userId },
    include: { teams: true, matches: { orderBy: [{ round: 'asc' }, { orderInRound: 'asc' }] } },
  });
  if (!tournament) return res.status(404).json({ error: 'البطولة غير موجودة' });
  res.json({ tournament });
});

const createSchema = z.object({
  name: z.string().min(2).max(10),
  format: z.enum(['KNOCKOUT', 'ROUND_ROBIN']).default('KNOCKOUT'),
  teamNames: z.array(z.string().min(2).max(22)).min(3).max(16),
});

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });
  const { name, format, teamNames } = parsed.data;

  if (new Set(teamNames.map((n) => n.trim().toLowerCase())).size !== teamNames.length) {
    return res.status(400).json({ error: 'يجب كتابة أسماء جميع الفرق' });
  }

  const shuffled = [...teamNames].sort(() => Math.random() - 0.5);

  const tournament = await prisma.tournament.create({
    data: {
      userId: req.userId!,
      name,
      format,
      status: 'IN_PROGRESS',
      teams: { create: teamNames.map((n) => ({ name: n.trim() })) },
    },
  });

  if (format === 'KNOCKOUT') {
    const slots = nextPowerOfTwo(shuffled.length);
    const byes = slots - shuffled.length;
    const padded: (string | null)[] = [...shuffled, ...Array(byes).fill(null)];

    const round1Matches = [];
    for (let i = 0; i < padded.length; i += 2) {
      round1Matches.push({ teamA: padded[i], teamB: padded[i + 1] });
    }

    let orderIdx = 0;
    for (const m of round1Matches) {
      const isBye = m.teamA === null || m.teamB === null;
      await prisma.tournamentMatch.create({
        data: {
          tournamentId: tournament.id,
          round: 1,
          orderInRound: orderIdx++,
          teamAName: m.teamA,
          teamBName: m.teamB,
          status: isBye ? 'BYE' : 'PENDING',
          winnerName: isBye ? m.teamA ?? m.teamB : null,
        },
      });
    }

    let remainingSlots = slots / 2;
    let round = 2;
    while (remainingSlots >= 1) {
      for (let i = 0; i < remainingSlots; i++) {
        await prisma.tournamentMatch.create({
          data: { tournamentId: tournament.id, round, orderInRound: i, status: 'PENDING' },
        });
      }
      remainingSlots = Math.floor(remainingSlots / 2);
      round++;
      if (remainingSlots < 1) break;
    }

    await propagateByes(tournament.id);
  } else {
    let orderIdx = 0;
    for (let i = 0; i < shuffled.length; i++) {
      for (let j = i + 1; j < shuffled.length; j++) {
        await prisma.tournamentMatch.create({
          data: {
            tournamentId: tournament.id,
            round: 1,
            orderInRound: orderIdx++,
            teamAName: shuffled[i],
            teamBName: shuffled[j],
            status: 'PENDING',
          },
        });
      }
    }
  }

  const full = await prisma.tournament.findUnique({
    where: { id: tournament.id },
    include: { teams: true, matches: { orderBy: [{ round: 'asc' }, { orderInRound: 'asc' }] } },
  });
  res.status(201).json({ tournament: full });
});

async function propagateByes(tournamentId: string) {
  const matches = await prisma.tournamentMatch.findMany({
    where: { tournamentId },
    orderBy: [{ round: 'asc' }, { orderInRound: 'asc' }],
  });
  const maxRound = Math.max(...matches.map((m) => m.round));
  for (let round = 1; round < maxRound; round++) {
    const roundMatches = matches.filter((m) => m.round === round);
    for (const m of roundMatches) {
      if (m.status === 'BYE' && m.winnerName) {
        const nextRound = round + 1;
        const nextOrder = Math.floor(m.orderInRound / 2);
        const isTeamA = m.orderInRound % 2 === 0;
        const nextMatch = matches.find((x) => x.round === nextRound && x.orderInRound === nextOrder);
        if (nextMatch) {
          await prisma.tournamentMatch.update({
            where: { id: nextMatch.id },
            data: isTeamA ? { teamAName: m.winnerName } : { teamBName: m.winnerName },
          });
        }
      }
    }
  }
}

const resultSchema = z.object({ teamAScore: z.number().int().min(0), teamBScore: z.number().int().min(0) });

router.post('/:id/matches/:matchId/result', requireAuth, async (req: AuthedRequest, res) => {
  const tournament = await prisma.tournament.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!tournament) return res.status(404).json({ error: 'البطولة غير موجودة' });
  const parsed = resultSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات غير صالحة' });

  const match = await prisma.tournamentMatch.findUnique({ where: { id: req.params.matchId } });
  if (!match || !match.teamAName || !match.teamBName) return res.status(400).json({ error: 'المباراة غير مكتملة الفرق بعد' });

  const { teamAScore, teamBScore } = parsed.data;
  if (teamAScore === teamBScore) return res.status(400).json({ error: 'لا يمكن التعادل، حدد فريق فائز' });
  const winnerName = teamAScore > teamBScore ? match.teamAName : match.teamBName;

  await prisma.tournamentMatch.update({
    where: { id: match.id },
    data: { teamAScore, teamBScore, winnerName, status: 'DONE' },
  });

  if (tournament.format === 'KNOCKOUT') {
    const allMatches = await prisma.tournamentMatch.findMany({ where: { tournamentId: tournament.id } });
    const maxRound = Math.max(...allMatches.map((m) => m.round));

    if (match.round === maxRound) {
      await prisma.tournament.update({
        where: { id: tournament.id },
        data: { status: 'FINISHED', championTeam: winnerName },
      });
    } else {
      const nextRound = match.round + 1;
      const nextOrder = Math.floor(match.orderInRound / 2);
      const isTeamA = match.orderInRound % 2 === 0;
      const nextMatch = allMatches.find((m) => m.round === nextRound && m.orderInRound === nextOrder);
      if (nextMatch) {
        await prisma.tournamentMatch.update({
          where: { id: nextMatch.id },
          data: isTeamA ? { teamAName: winnerName } : { teamBName: winnerName },
        });
      }
    }
  } else {
    const remaining = await prisma.tournamentMatch.count({ where: { tournamentId: tournament.id, status: 'PENDING' } });
    if (remaining === 0) {
      const teams = await prisma.tournamentTeam.findMany({ where: { tournamentId: tournament.id } });
      const allMatches = await prisma.tournamentMatch.findMany({ where: { tournamentId: tournament.id, status: 'DONE' } });
      const points = new Map<string, number>();
      teams.forEach((t) => points.set(t.name, 0));
      for (const m of allMatches) {
        if (m.winnerName) points.set(m.winnerName, (points.get(m.winnerName) || 0) + 3);
      }
      const champion = [...points.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      await prisma.tournament.update({ where: { id: tournament.id }, data: { status: 'FINISHED', championTeam: champion } });
    }
  }

  const full = await prisma.tournament.findUnique({
    where: { id: tournament.id },
    include: { teams: true, matches: { orderBy: [{ round: 'asc' }, { orderInRound: 'asc' }] } },
  });
  res.json({ tournament: full });
});

export default router;
