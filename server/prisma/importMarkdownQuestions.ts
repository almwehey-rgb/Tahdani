import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import categoryMapRaw from './import-data/categoryMap.json';
import flagCodesRaw from './import-data/flagCodes.json';

const prisma = new PrismaClient();

// The markdown source files live at the repo root, not inside server/.
const QUESTIONS_DIR = path.join(__dirname, '..', '..', 'questions');

// Color stamped on the empty placeholder categories created by the
// "Bulk category import" block in seed.ts — used to disambiguate when a
// category name has more than one row (an intentional pattern in this repo).
const BULK_MARKER_COLOR = '#5B6472';

// Without --commit this only prints what it would do; no writes happen.
const DRY_RUN = !process.argv.includes('--commit');

type CategoryMapEntry = { file: string; dbCategoryName: string; format: 'qa' | 'word' | 'flags' };
const categoryMap = categoryMapRaw as CategoryMapEntry[];
const flagCodes = flagCodesRaw as Record<string, string>;

type ParsedQuestion = { text: string; answer: string; points: number; imageUrl?: string };

const CHARADE_PROMPT = 'مثّل الكلمة أو العبارة بالحركات فقط دون أي كلام، ودع فريقك يخمنها خلال الوقت المحدد';

// Every source file uses the same tier structure: "#### <emoji> <points> نقطة"
// blocks, each holding one question. Splitting on that heading is enough to
// walk every tier without caring about the "### N. subtopic" grouping above it.
function tierBlocks(raw: string): string[] {
  return raw.split(/^####\s/m).slice(1);
}

function parseQA(raw: string): ParsedQuestion[] {
  const out: ParsedQuestion[] = [];
  for (const block of tierBlocks(raw)) {
    const points = Number(block.match(/(\d+)\s*نقطة/)?.[1]);
    const question = block.match(/\*\*السؤال:\*\*\s*(.+)/)?.[1]?.trim();
    const answer = block.match(/\*\*الإجابة:\*\*\s*\|\|([^|]+)\|\|/)?.[1]?.trim();
    if (!points || !question || !answer) continue;
    out.push({ text: question, answer, points });
  }
  return out;
}

function parseWord(raw: string): ParsedQuestion[] {
  const out: ParsedQuestion[] = [];
  for (const block of tierBlocks(raw)) {
    const points = Number(block.match(/(\d+)\s*نقطة/)?.[1]);
    const word = block.match(/\*\*الكلمة\/العبارة:\*\*\s*\|\|([^|]+)\|\|/)?.[1]?.trim();
    if (!points || !word) continue;
    out.push({ text: CHARADE_PROMPT, answer: word, points });
  }
  return out;
}

// أعلام.md only: every answer is a country/territory name already covered by
// flagCodes.json (built from the same name->ISO mapping the seeded "أعلام
// الدول" category uses, extended with the extra territories this file has).
function parseFlags(raw: string): ParsedQuestion[] {
  return parseQA(raw).map((q) => {
    const code = flagCodes[q.answer];
    return code ? { ...q, imageUrl: `https://flagcdn.com/w320/${code}.png` } : q;
  });
}

function parseFile(entry: CategoryMapEntry): ParsedQuestion[] {
  const raw = fs.readFileSync(path.join(QUESTIONS_DIR, entry.file), 'utf-8');
  if (entry.format === 'word') return parseWord(raw);
  if (entry.format === 'flags') return parseFlags(raw);
  return parseQA(raw);
}

async function main() {
  const report: string[] = [];
  let totalQuestions = 0;
  let categoriesTouched = 0;

  for (const entry of categoryMap) {
    const parsed = parseFile(entry);
    if (parsed.length === 0) {
      report.push(`⚠️  ${entry.dbCategoryName} (${entry.file}): parsed 0 questions — skipped, check the file's format`);
      continue;
    }

    const rows = await prisma.category.findMany({
      where: { name: entry.dbCategoryName },
      include: { _count: { select: { questions: true } } },
    });
    const empties = rows.filter((r) => r._count.questions === 0);

    if (rows.length === 0) {
      report.push(`⛔ ${entry.dbCategoryName} (${entry.file}): no category with this name exists in the DB — SKIPPED (this script never creates new categories)`);
      continue;
    }
    if (empties.length === 0) {
      report.push(`⛔ ${entry.dbCategoryName} (${entry.file}): ${rows.length} row(s) found, all already have questions — SKIPPED, nothing written`);
      continue;
    }

    const target = empties.find((r) => r.color === BULK_MARKER_COLOR) ?? empties[0];
    if (empties.length > 1) {
      report.push(`ℹ️  ${entry.dbCategoryName}: ${empties.length} empty rows matched this name, used id=${target.id}`);
    }

    report.push(`✅ ${entry.dbCategoryName}: ${parsed.length} questions -> category id=${target.id}`);
    totalQuestions += parsed.length;
    categoriesTouched += 1;

    if (!DRY_RUN) {
      for (const q of parsed) {
        const exists = await prisma.question.findFirst({
          where: { categoryId: target.id, text: q.text, answer: q.answer },
        });
        if (!exists) {
          await prisma.question.create({ data: { categoryId: target.id, ...q } });
        }
      }
    }
  }

  console.log(report.join('\n'));
  console.log(
    `\n${DRY_RUN ? '[DRY RUN] Would create' : 'Created'} ${totalQuestions} questions across ${categoriesTouched}/${categoryMap.length} categories.`,
  );
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
