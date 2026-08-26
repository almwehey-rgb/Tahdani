import { PrismaClient, Prisma } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const SOURCE_FILE = path.join(__dirname, '..', '..', 'questions', 'خطر_ونقاط.md');
const CATEGORY_NAME = 'خطر ونقاط';

const DRY_RUN = !process.argv.includes('--commit');

type LadderAnswer = { points: number; answer: string };
type Mine = { points: number; answer: string; reason?: string };
type Round = { title: string; text: string; ladderAnswers: LadderAnswer[]; mines: Mine[] };

// Splits questions/خطر_ونقاط.md into its "### N. <title>" blocks and pulls
// out the main prompt, the 7 ranked answers, and the 3 valued mines from
// each — the exact structure the khatar-wa-niqat prompt spec produces.
function parseRounds(raw: string): Round[] {
  const blocks = raw.split(/^### \d+\.\s*/m).slice(1);
  const rounds: Round[] = [];

  for (const block of blocks) {
    const title = block.split('\n', 1)[0].trim();
    const text = block.match(/\*\*السؤال الرئيسي:\*\*\s*(.+)/)?.[1]?.trim();

    const ladderAnswers: LadderAnswer[] = [];
    for (const m of block.matchAll(/^- (\d+):\s*\|\|([^|]+)\|\|/gm)) {
      ladderAnswers.push({ points: Number(m[1]), answer: m[2].trim() });
    }

    const mines: Mine[] = [];
    for (const m of block.matchAll(/^- 🧨 (-\d+):\s*\|\|([^|]+)\|\|(?:\s*—\s*(.+))?/gm)) {
      mines.push({ points: Number(m[1]), answer: m[2].trim(), reason: m[3]?.trim() });
    }

    if (!text || ladderAnswers.length !== 7 || mines.length !== 3) {
      console.log(`⚠️  "${title}": parsed text=${!!text} ladder=${ladderAnswers.length}/7 mines=${mines.length}/3 — skipped`);
      continue;
    }
    rounds.push({ title, text, ladderAnswers, mines });
  }
  return rounds;
}

async function main() {
  const raw = fs.readFileSync(SOURCE_FILE, 'utf-8');
  const rounds = parseRounds(raw);
  console.log(`Parsed ${rounds.length} round(s) from ${SOURCE_FILE}\n`);
  if (rounds.length === 0) return;

  let category = await prisma.category.findFirst({ where: { name: CATEGORY_NAME } });
  if (!category) {
    console.log(`Category "${CATEGORY_NAME}" doesn't exist yet — ${DRY_RUN ? 'would create it' : 'creating it'}.`);
    if (!DRY_RUN) {
      category = await prisma.category.create({
        data: { name: CATEGORY_NAME, icon: '⚠️', color: '#D64545', type: 'DANGER' },
      });
    }
  } else if (category.type !== 'DANGER') {
    console.log(`⛔ A category named "${CATEGORY_NAME}" already exists but its type is "${category.type}", not "DANGER" — stopping, fix this by hand first.`);
    return;
  }

  let created = 0;
  for (const round of rounds) {
    const exists = category
      ? await prisma.question.findFirst({ where: { categoryId: category.id, text: round.text } })
      : null;
    if (exists) {
      console.log(`↷ "${round.title}": already imported — skipped`);
      continue;
    }
    console.log(`✅ "${round.title}": ${round.ladderAnswers.length} answers + ${round.mines.length} mines${DRY_RUN ? ' (dry run)' : ''}`);
    created += 1;
    if (!DRY_RUN && category) {
      await prisma.question.create({
        data: {
          categoryId: category.id,
          text: round.text,
          answer: round.ladderAnswers.map((a) => a.answer).join(' / '),
          points: 200,
          ladderAnswers: round.ladderAnswers as unknown as Prisma.InputJsonValue,
          mines: round.mines as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN] Would create' : 'Created'} ${created} round(s) in "${CATEGORY_NAME}".`);
  if (DRY_RUN) console.log('Nothing was written. Re-run with --commit to actually write to the database.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
