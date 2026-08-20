/**
 * Bulk-import questions from markdown files into empty categories.
 *
 * The rule this script exists to enforce: it only ever *adds* questions to a
 * category that already has none. It will not create a category, will not
 * touch a category that already carries questions, and will not update or
 * delete an existing row. That makes a mistaken run a no-op rather than a
 * data loss, which matters because the hand-curated categories in this
 * database have no backup.
 *
 * Usage (from server/):
 *   npm run import:questions              # dry run — parses, checks, reports
 *   npm run import:questions -- --offline # parse/validate files only, no DB
 *   npm run import:questions -- --commit  # actually writes
 *   npm run import:questions -- --only "اسم الفئة"   # restrict to one file
 *
 * By default it talks to Postgres directly via Prisma, which needs
 * DATABASE_URL in server/.env. Pass --api to go through the deployed admin
 * API instead — that only needs the admin access code (ADMIN_NAME /
 * ADMIN_CODE / API_BASE env vars), so it works against production without
 * handing the database password to whoever runs the import.
 *
 * Source files live in prisma/import-data/questions/*.md — see
 * QUESTIONS_IMPORT_PLAN.md at the repo root for the file format.
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const QUESTIONS_DIR = path.join(__dirname, 'import-data', 'questions');
const CATEGORY_MAP_PATH = path.join(__dirname, 'import-data', 'categoryMap.json');

/**
 * Categories whose questions were written by hand and must never be touched,
 * even if one of them somehow ends up empty. The zero-questions check below
 * would normally cover them; this list is the belt to that pair of braces.
 */
const PROTECTED_CATEGORIES = [
  'تاريخ',
  'تكنولوجيا',
  'سيارات',
  'دول وعواصم',
  'عالم الحيوان',
  'قصص الأنبياء',
  'كأس العالم 2026',
  'مسيرة لاعب',
  'مطاعم الكويت',
  'معلومات عامة',
];

const VALID_POINTS = [100, 200, 300, 400, 500, 600];

type ParsedQuestion = {
  text: string;
  answer: string;
  hint?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  grayscale: boolean;
  points: number;
  line: number;
};

type ParsedFile = {
  file: string;
  categoryName: string;
  questions: ParsedQuestion[];
  errors: string[];
};

/** Arabic field labels accepted at the start of a line, mapped to our fields. */
const FIELD_ALIASES: Record<string, keyof ParsedQuestion | 'points'> = {
  'س': 'text',
  'سؤال': 'text',
  'السؤال': 'text',
  'ج': 'answer',
  'جواب': 'answer',
  'الجواب': 'answer',
  'الإجابة': 'answer',
  'الاجابة': 'answer',
  'تلميح': 'hint',
  'التلميح': 'hint',
  'صورة': 'imageUrl',
  'الصورة': 'imageUrl',
  'رابط صورة': 'imageUrl',
  'فيديو': 'videoUrl',
  'الفيديو': 'videoUrl',
  'رابط فيديو': 'videoUrl',
  'نقاط': 'points',
  'النقاط': 'points',
  'أبيض وأسود': 'grayscale',
  'ابيض واسود': 'grayscale',
};

function normalizeLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

function isTruthy(value: string): boolean {
  return ['نعم', 'صح', 'true', '1', 'yes'].includes(value.trim().toLowerCase());
}

/**
 * Parses one markdown file. The format is deliberately forgiving: a `## 200`
 * heading sets the point value for everything under it, and each question is
 * a block of `label: value` lines separated from the next by a blank line.
 * A pipe table (`| السؤال | الإجابة | النقاط |`) is accepted too, since that
 * is what a spreadsheet export tends to look like.
 */
function parseFile(filePath: string): ParsedFile {
  const file = path.basename(filePath);
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);

  const errors: string[] = [];
  const questions: ParsedQuestion[] = [];

  // The category name comes from the first `# heading`, falling back to the
  // filename so a file can be dropped in without any header at all.
  let categoryName = path.basename(file, path.extname(file)).trim();
  const h1 = lines.find((l) => /^#\s+\S/.test(l));
  if (h1) categoryName = h1.replace(/^#\s+/, '').trim();

  let currentPoints = 200;
  let block: { fields: Record<string, string>; line: number } | null = null;

  const flush = () => {
    if (!block) return;
    const f = block.fields;
    const text = (f.text || '').trim();
    const answer = (f.answer || '').trim();
    if (!text && !answer) {
      block = null;
      return;
    }
    if (!text) {
      errors.push(`سطر ${block.line}: سؤال بدون نص`);
      block = null;
      return;
    }
    if (!answer) {
      errors.push(`سطر ${block.line}: السؤال "${text.slice(0, 40)}" بدون إجابة`);
      block = null;
      return;
    }
    let points = currentPoints;
    if (f.points) {
      const p = Number(f.points.replace(/[^\d]/g, ''));
      if (VALID_POINTS.includes(p)) points = p;
      else errors.push(`سطر ${block.line}: نقاط غير صالحة "${f.points}"`);
    }
    questions.push({
      text,
      answer,
      hint: f.hint?.trim() || null,
      imageUrl: f.imageUrl?.trim() || null,
      videoUrl: f.videoUrl?.trim() || null,
      grayscale: f.grayscale ? isTruthy(f.grayscale) : false,
      points,
      line: block.line,
    });
    block = null;
  };

  lines.forEach((rawLine, i) => {
    const lineNo = i + 1;
    const line = rawLine.trim();

    if (!line) {
      flush();
      return;
    }
    if (/^#\s/.test(line)) return; // the title, already consumed

    // `## 300` (or `### 300 نقطة`) switches the running point value.
    const pointsHeading = line.match(/^#{2,}\s*(\d{2,4})/);
    if (pointsHeading) {
      flush();
      const p = Number(pointsHeading[1]);
      if (VALID_POINTS.includes(p)) currentPoints = p;
      else errors.push(`سطر ${lineNo}: عنوان نقاط غير صالح "${line}"`);
      return;
    }

    // Pipe-table row: | question | answer | points? | hint? |
    if (line.startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (!cells.length) return;
      // Skip the header row and the |---|---| separator beneath it.
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) return;
      if (FIELD_ALIASES[normalizeLabel(cells[0])] === 'text') return;
      flush();
      const [text, answer, pts, hint] = cells;
      if (!text || !answer) {
        errors.push(`سطر ${lineNo}: صف جدول ناقص`);
        return;
      }
      let points = currentPoints;
      if (pts) {
        const p = Number(pts.replace(/[^\d]/g, ''));
        if (VALID_POINTS.includes(p)) points = p;
      }
      questions.push({
        text,
        answer,
        hint: hint || null,
        imageUrl: null,
        videoUrl: null,
        grayscale: false,
        points,
        line: lineNo,
      });
      return;
    }

    // `label: value`, optionally after a `-` or `*` bullet.
    const body = line.replace(/^[-*]\s*/, '');
    const sep = body.match(/^([^:：]{1,20})[:：]\s*(.*)$/);
    if (sep) {
      const field = FIELD_ALIASES[normalizeLabel(sep[1])];
      if (field) {
        // A second `text` line means the previous block ended without a blank
        // line between them — a common hand-editing slip, so close it here.
        if (field === 'text' && block && block.fields.text) flush();
        if (!block) block = { fields: {}, line: lineNo };
        block.fields[field] = sep[2];
        return;
      }
    }

    // A continuation line for whichever field was last set.
    if (block) {
      const keys = Object.keys(block.fields);
      if (keys.length) {
        const last = keys[keys.length - 1];
        block.fields[last] = `${block.fields[last]} ${body}`.trim();
        return;
      }
    }
    errors.push(`سطر ${lineNo}: سطر غير مفهوم "${line.slice(0, 50)}"`);
  });
  flush();

  return { file, categoryName, questions, errors };
}

type LiveCategory = { id: string; name: string; questionCount: number };

/**
 * Where the questions actually land. Two implementations: straight to
 * Postgres, or through the deployed admin API. Both re-check that the target
 * category is still empty immediately before writing — between the scan and
 * the write someone could have added a question from the admin panel, and
 * appending to a non-empty category is the one thing this script promises
 * never to do. `insertQuestions` returns -1 when that re-check trips.
 */
type Backend = {
  listCategories(): Promise<LiveCategory[]>;
  insertQuestions(categoryId: string, questions: ParsedQuestion[]): Promise<number>;
  close(): Promise<void>;
};

function prismaBackend(): Backend {
  const prisma = new PrismaClient();
  return {
    async listCategories() {
      const cats = await prisma.category.findMany({
        select: { id: true, name: true, _count: { select: { questions: true } } },
      });
      return cats.map((c) => ({ id: c.id, name: c.name, questionCount: c._count.questions }));
    },
    async insertQuestions(categoryId, questions) {
      return prisma.$transaction(async (tx) => {
        const live = await tx.question.count({ where: { categoryId } });
        if (live > 0) return -1;
        const result = await tx.question.createMany({
          data: questions.map((q) => ({
            categoryId,
            text: q.text,
            answer: q.answer,
            hint: q.hint,
            imageUrl: q.imageUrl,
            videoUrl: q.videoUrl,
            grayscale: q.grayscale,
            points: q.points,
          })),
        });
        return result.count;
      });
    },
    close: () => prisma.$disconnect(),
  };
}

async function apiBackend(): Promise<Backend> {
  const base = (process.env.API_BASE || 'https://tahdani-server.vercel.app').replace(/\/$/, '');
  const name = process.env.ADMIN_NAME || 'مشرف تحدّني';
  const code = process.env.ADMIN_CODE;
  if (!code) {
    console.error('يلزم ضبط ADMIN_CODE (رمز دخول المشرف) عند استخدام --api');
    process.exit(1);
  }

  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, code }),
  });
  const loginBody = (await login.json().catch(() => ({}))) as { token?: string };
  if (!login.ok || !loginBody.token) {
    console.error(`فشل تسجيل الدخول (${login.status}) — تأكد من ADMIN_NAME و ADMIN_CODE`);
    process.exit(1);
  }
  const auth = { Authorization: `Bearer ${loginBody.token}`, 'Content-Type': 'application/json' };

  const countQuestions = async (categoryId: string): Promise<number> => {
    const r = await fetch(`${base}/api/categories/${categoryId}/questions`, { headers: auth });
    const b = (await r.json().catch(() => ({}))) as { questions?: unknown[] };
    return b.questions?.length ?? 0;
  };

  return {
    async listCategories() {
      const r = await fetch(`${base}/api/categories`);
      const b = (await r.json()) as { categories?: { id: string; name: string; _count?: { questions: number } }[] };
      return (b.categories || []).map((c) => ({
        id: c.id,
        name: c.name,
        questionCount: c._count?.questions ?? 0,
      }));
    },
    async insertQuestions(categoryId, questions) {
      if ((await countQuestions(categoryId)) > 0) return -1;
      let ok = 0;
      // One request per question — there is no bulk endpoint — so keep a few
      // in flight to stay well under the serverless function's patience
      // without hammering it.
      const CONCURRENCY = 4;
      for (let i = 0; i < questions.length; i += CONCURRENCY) {
        const slice = questions.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          slice.map(async (q) => {
            const r = await fetch(`${base}/api/categories/${categoryId}/questions`, {
              method: 'POST',
              headers: auth,
              body: JSON.stringify({
                text: q.text,
                answer: q.answer,
                hint: q.hint,
                imageUrl: q.imageUrl || undefined,
                videoUrl: q.videoUrl || undefined,
                grayscale: q.grayscale,
                points: q.points,
              }),
            });
            if (!r.ok) console.log(`      ⚠️ فشل (${r.status}): ${q.text.slice(0, 50)}`);
            return r.ok;
          }),
        );
        ok += results.filter(Boolean).length;
      }
      return ok;
    },
    close: async () => {},
  };
}

function loadCategoryMap(): Record<string, string> {
  if (!fs.existsSync(CATEGORY_MAP_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CATEGORY_MAP_PATH, 'utf8'));
  } catch (e) {
    console.error(`تعذّرت قراءة categoryMap.json: ${(e as Error).message}`);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes('--commit');
  const offline = args.includes('--offline');
  const verbose = args.includes('--verbose');
  const useApi = args.includes('--api');
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

  if (!fs.existsSync(QUESTIONS_DIR)) {
    console.error(`المجلد غير موجود: ${QUESTIONS_DIR}`);
    process.exit(1);
  }

  let files = fs
    .readdirSync(QUESTIONS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.md'))
    .sort();
  if (only) files = files.filter((f) => f.includes(only) || path.basename(f, '.md') === only);

  if (!files.length) {
    console.log(`لا توجد ملفات .md في ${QUESTIONS_DIR}`);
    console.log('ضع ملفات الأسئلة هناك ثم أعد التشغيل. التنسيق موضّح في QUESTIONS_IMPORT_PLAN.md');
    return;
  }

  const categoryMap = loadCategoryMap();
  const parsed = files.map((f) => {
    const p = parseFile(path.join(QUESTIONS_DIR, f));
    const mapped = categoryMap[f] || categoryMap[path.basename(f, '.md')];
    if (mapped) p.categoryName = mapped;
    return p;
  });

  console.log(`\n=== قراءة الملفات (${parsed.length}) ===`);
  let totalQuestions = 0;
  let totalErrors = 0;
  for (const p of parsed) {
    totalQuestions += p.questions.length;
    totalErrors += p.errors.length;
    const flag = p.errors.length ? ` ⚠️ ${p.errors.length} خطأ` : '';
    const tiers = VALID_POINTS.map((pt) => [pt, p.questions.filter((q) => q.points === pt).length])
      .filter(([, n]) => n)
      .map(([pt, n]) => `${pt}×${n}`)
      .join(' ');
    console.log(`  ${p.file}  →  "${p.categoryName}"  (${p.questions.length} سؤال: ${tiers})${flag}`);
    for (const e of p.errors.slice(0, 5)) console.log(`      - ${e}`);
    if (p.errors.length > 5) console.log(`      - ... و${p.errors.length - 5} أخرى`);
    if (verbose) {
      for (const q of p.questions) console.log(`      [${q.points}] ${q.text}  ←  ${q.answer}`);
    }
  }
  console.log(`\nالمجموع: ${totalQuestions} سؤال، ${totalErrors} خطأ في التنسيق`);

  if (offline) {
    console.log('\n(--offline) تم فحص الملفات فقط، بدون الاتصال بقاعدة البيانات.');
    return;
  }

  const backend = useApi ? await apiBackend() : prismaBackend();
  try {
    const categories = await backend.listCategories();
    const byName = new Map<string, LiveCategory[]>();
    for (const c of categories) {
      const list = byName.get(c.name) || [];
      list.push(c);
      byName.set(c.name, list);
    }

    type Plan = { p: ParsedFile; categoryId: string };
    const ready: Plan[] = [];
    const skipped: { p: ParsedFile; why: string }[] = [];

    for (const p of parsed) {
      const matches = byName.get(p.categoryName);
      if (!matches || !matches.length) {
        skipped.push({ p, why: 'لا توجد فئة بهذا الاسم (السكربت لا ينشئ فئات جديدة)' });
        continue;
      }
      if (matches.length > 1) {
        skipped.push({ p, why: `الاسم مكرر في ${matches.length} فئات — وضّح أيّها في categoryMap.json` });
        continue;
      }
      const cat = matches[0];
      if (PROTECTED_CATEGORIES.includes(cat.name)) {
        skipped.push({ p, why: 'فئة محميّة — ممنوع المساس بها' });
        continue;
      }
      if (cat.questionCount > 0) {
        skipped.push({ p, why: `الفئة فيها ${cat.questionCount} سؤال بالفعل — لا يُكتب فوقها` });
        continue;
      }
      if (!p.questions.length) {
        skipped.push({ p, why: 'الملف لا يحتوي أسئلة صالحة' });
        continue;
      }
      ready.push({ p, categoryId: cat.id });
    }

    console.log(`\n=== المطابقة مع قاعدة البيانات ===`);
    console.log(`جاهزة للاستيراد: ${ready.length} فئة (${ready.reduce((n, r) => n + r.p.questions.length, 0)} سؤال)`);
    for (const r of ready) console.log(`  ✅ ${r.p.categoryName}  (${r.p.questions.length})`);
    if (skipped.length) {
      console.log(`\nمتخطّاة: ${skipped.length}`);
      for (const s of skipped) console.log(`  ⛔ ${s.p.categoryName} — ${s.why}`);
    }

    if (!commit) {
      console.log('\n--- تشغيل تجريبي (dry run). لم تُكتب أي بيانات. ---');
      console.log('أضف -- --commit للكتابة فعليًا.');
      return;
    }

    console.log('\n=== الكتابة ===');
    let written = 0;
    for (const r of ready) {
      const inserted = await backend.insertQuestions(r.categoryId, r.p.questions);
      if (inserted < 0) {
        console.log(`  ⛔ ${r.p.categoryName} — امتلأت أثناء التشغيل، تُركت كما هي`);
        continue;
      }
      written += inserted;
      console.log(`  ✅ ${r.p.categoryName} — ${inserted} سؤال`);
    }
    console.log(`\nتمت كتابة ${written} سؤال في ${ready.length} فئة.`);
  } finally {
    await backend.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
