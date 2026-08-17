import { PrismaClient } from '@prisma/client';
import extraQuestionsRaw from './data/extraQuestions.json';

const prisma = new PrismaClient();

// AI-drafted bulk question bank (~50 per category), keyed by category name.
// Merged into the hand-picked starter questions below so every category
// has real variety instead of the same 3 tiles every game.
const extraQuestions = extraQuestionsRaw as unknown as Record<
  string,
  { text: string; answer: string; points: number; hint?: string | null }[]
>;
function extrasFor(categoryName: string) {
  return (extraQuestions[categoryName] ?? []).map((q) => ({ ...q, hint: q.hint ?? undefined, imageUrl: undefined as string | undefined }));
}

async function main() {
  // ---------- Shared access code ----------
  await prisma.appSetting.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', accessCode: 'TAHDANI' },
  });

  // ---------- Admin ----------
  await prisma.user.upsert({
    where: { name: 'مشرف تحدّني' },
    update: { role: 'ADMIN' },
    create: {
      name: 'مشرف تحدّني',
      role: 'ADMIN',
      remainingGames: 999,
    },
  });

  // ---------- Packages ----------
  const packages = [
    { name: 'لعبة واحدة', gamesCount: 1, price: 1.5, sortOrder: 1 },
    { name: 'باقة لعبتين', gamesCount: 2, price: 2.5, sortOrder: 2 },
    { name: 'باقة 5 ألعاب', gamesCount: 5, price: 5.0, sortOrder: 3 },
    { name: 'باقة 10 ألعاب', gamesCount: 10, price: 9.0, sortOrder: 4 },
  ];
  for (const p of packages) {
    const existing = await prisma.package.findFirst({ where: { name: p.name } });
    if (!existing) await prisma.package.create({ data: { ...p, currency: 'BHD' } });
  }

  // ---------- Discount codes ----------
  const existingDiscount = await prisma.discountCode.findUnique({ where: { code: 'WELCOME10' } });
  if (!existingDiscount) {
    await prisma.discountCode.create({
      data: { code: 'WELCOME10', percentOff: 10, maxUses: 500, active: true },
    });
  }

  // 100% off — makes checkout free (no gateway charge at all, see payments.ts)
  const existingTurki = await prisma.discountCode.findUnique({ where: { code: 'TURKI' } });
  if (!existingTurki) {
    await prisma.discountCode.create({
      data: { code: 'TURKI', percentOff: 100, maxUses: 100000, active: true },
    });
  }

  // ---------- Categories & questions ----------
  type Q = { text: string; answer: string; points: number; hint?: string; imageUrl?: string };
  const categoryDefs: { name: string; icon: string; color: string; type?: string; seasonTag?: string; questions: Q[] }[] = [
    {
      name: 'رياضة',
      icon: '⚽',
      color: '#2FBF71',
      questions: [
        { text: 'كم عدد لاعبي الفريق الواحد في كرة القدم داخل الملعب؟', answer: '11 لاعبا', points: 100 },
        { text: 'في أي دولة أقيمت كأس العالم 2022؟', answer: 'قطر', points: 200 },
        { text: 'من الفريق الذي حقق لقب دوري أبطال أوروبا للمرة الأولى موسم 2023-2024؟', answer: 'ريال مدريد', points: 300, hint: 'فريق إسباني ملقب بالملكي' },
      ],
    },
    {
      name: 'سينما وأفلام',
      icon: '🎬',
      color: '#E0526C',
      questions: [
        { text: 'ما اسم الفيلم الذي يدور حول سفينة غارقة عام 1912؟', answer: 'تايتانيك', points: 100 },
        { text: 'من مخرج سلسلة أفلام "The Dark Knight"؟', answer: 'كريستوفر نولان', points: 200 },
        { text: 'ما أول فيلم رسوم متحركة طويل أنتجته ديزني؟', answer: 'سنو وايت والأقزام السبعة', points: 300 },
      ],
    },
    {
      name: 'تاريخ',
      icon: '📜',
      color: '#C98A2E',
      questions: [
        { text: 'في أي عام سقطت الدولة الأموية؟', answer: '750 ميلادي', points: 100 },
        { text: 'من هو أول خليفة راشدي؟', answer: 'أبو بكر الصديق رضي الله عنه', points: 200 },
        { text: 'في أي عام انتهت الحرب العالمية الثانية؟', answer: '1945', points: 300 },
      ],
    },
    {
      name: 'جغرافيا',
      icon: '🌍',
      color: '#2E8FC9',
      questions: [
        { text: 'ما أطول نهر في العالم؟', answer: 'نهر النيل', points: 100 },
        { text: 'ما عاصمة أستراليا؟', answer: 'كانبيرا', points: 200, hint: 'ليست سيدني!' },
        { text: 'ما أصغر دولة في العالم من حيث المساحة؟', answer: 'الفاتيكان', points: 300 },
      ],
    },
    {
      name: 'علوم',
      icon: '🔬',
      color: '#5C7CE0',
      questions: [
        { text: 'ما الغاز الذي يشكل الجزء الأكبر من الغلاف الجوي للأرض؟', answer: 'النيتروجين', points: 100 },
        { text: 'كم عدد عظام جسم الإنسان البالغ؟', answer: '206 عظمة', points: 200 },
        { text: 'ما اسم الجسيم دون الذري الذي يحمل شحنة سالبة؟', answer: 'الإلكترون', points: 300 },
      ],
    },
    {
      name: 'فن وموسيقى',
      icon: '🎨',
      color: '#B15CE0',
      questions: [
        { text: 'من رسم لوحة "الموناليزا"؟', answer: 'ليوناردو دافنشي', points: 100 },
        { text: 'كم عدد أوتار آلة العود عادة؟', answer: '5 أو 6 أوتار', points: 200 },
        { text: 'من الملحن الألماني الذي فقد سمعه وواصل التأليف الموسيقي؟', answer: 'بيتهوفن', points: 300 },
      ],
    },
    {
      name: 'أدب وثقافة',
      icon: '📚',
      color: '#D9A441',
      questions: [
        { text: 'من مؤلف رواية "مدن الملح"؟', answer: 'عبدالرحمن منيف', points: 100 },
        { text: 'من كاتب "ألف ليلة وليلة" الشهيرة (سرد شعبي وليس مؤلفا واحدا) — من الشخصية الراوية للحكايات؟', answer: 'شهرزاد', points: 200 },
        { text: 'من الشاعر الملقب بـ"أمير الشعراء"؟', answer: 'أحمد شوقي', points: 300 },
      ],
    },
    {
      name: 'تكنولوجيا',
      icon: '💻',
      color: '#3FC6C6',
      questions: [
        { text: 'ما اختصار "AI" في مجال التقنية؟', answer: 'الذكاء الاصطناعي', points: 100 },
        { text: 'من مؤسس شركة مايكروسوفت؟', answer: 'بيل غيتس', points: 200 },
        { text: 'ما اسم أول شبكة تواصل اجتماعي انتشرت عالميا قبل فيسبوك؟', answer: 'ماي سبيس (MySpace)', points: 300 },
      ],
    },
    {
      name: 'معلومات عامة',
      icon: '💡',
      color: '#E0C23F',
      questions: [
        { text: 'كم عدد أيام السنة الكبيسة؟', answer: '366 يوما', points: 100 },
        { text: 'ما هي العملة الرسمية لليابان؟', answer: 'الين الياباني', points: 200 },
        { text: 'ما هو أسرع حيوان بري في العالم؟', answer: 'الفهد الصياد (الشيتا)', points: 300 },
      ],
    },
    {
      name: 'تراث خليجي',
      icon: '🏺',
      color: '#C9622E',
      questions: [
        { text: 'ما اسم القارب التقليدي المستخدم في الغوص على اللؤلؤ؟', answer: 'السفينة / السنبوك', points: 100 },
        { text: 'ما اسم اللعبة الشعبية الخليجية التي تستخدم فيها أصداف صغيرة؟', answer: 'الطاب / الحويسات (حسب المنطقة)', points: 200 },
        { text: 'ما اسم السوق التقليدي القديم؟', answer: 'السوق / القيصرية', points: 300 },
      ],
    },
    {
      name: 'رسم وتخمين',
      icon: '✏️',
      color: '#E0526C',
      type: 'DRAWING',
      questions: [
        { text: 'ارسم الكلمة واجعل فريقك يخمنها خلال الوقت المحدد', answer: 'أسد', points: 100 },
        { text: 'ارسم الكلمة واجعل فريقك يخمنها خلال الوقت المحدد', answer: 'طائرة', points: 200 },
        { text: 'ارسم الكلمة واجعل فريقك يخمنها خلال الوقت المحدد', answer: 'قصر', points: 300 },
      ],
    },
    {
      name: 'أعلام الدول',
      icon: '🚩',
      color: '#2E8FC9',
      questions: (
        [
          // [countryCode, country name in Arabic]
          ['sa', 'السعودية'],
          ['ae', 'الإمارات'],
          ['kw', 'الكويت'],
          ['qa', 'قطر'],
          ['bh', 'البحرين'],
          ['om', 'عمان'],
          ['eg', 'مصر'],
          ['us', 'الولايات المتحدة الأمريكية'],
          ['gb', 'بريطانيا'],
          ['fr', 'فرنسا'],
          ['de', 'ألمانيا'],
          ['jp', 'اليابان'],
        ].map(([code, name]) => ({ code, name, points: 100 as const })) as { code: string; name: string; points: 100 | 200 | 300 }[]
      )
        .concat(
          [
            ['br', 'البرازيل'],
            ['it', 'إيطاليا'],
            ['es', 'إسبانيا'],
            ['ca', 'كندا'],
            ['au', 'أستراليا'],
            ['tr', 'تركيا'],
            ['jo', 'الأردن'],
            ['lb', 'لبنان'],
            ['ma', 'المغرب'],
            ['dz', 'الجزائر'],
            ['tn', 'تونس'],
            ['cn', 'الصين'],
          ].map(([code, name]) => ({ code, name, points: 200 as const })),
        )
        .concat(
          [
            ['nz', 'نيوزيلندا'],
            ['ch', 'سويسرا'],
            ['se', 'السويد'],
            ['no', 'النرويج'],
            ['fi', 'فنلندا'],
            ['gr', 'اليونان'],
            ['pt', 'البرتغال'],
            ['nl', 'هولندا'],
            ['be', 'بلجيكا'],
            ['za', 'جنوب أفريقيا'],
            ['ar', 'الأرجنتين'],
            ['mx', 'المكسيك'],
          ].map(([code, name]) => ({ code, name, points: 300 as const })),
        )
        .map(({ code, name, points }) => ({
          text: 'ما اسم الدولة صاحبة هذا العلم؟',
          answer: name,
          points,
          imageUrl: `https://flagcdn.com/w320/${code}.png`,
        })),
    },
  ];

  for (const c of categoryDefs) {
    let category = await prisma.category.findFirst({ where: { name: c.name } });
    if (!category) {
      category = await prisma.category.create({
        data: { name: c.name, icon: c.icon, color: c.color, type: c.type || 'PERMANENT' },
      });
    }
    for (const q of [...c.questions, ...extrasFor(c.name)]) {
      // Drawing questions all share the same instruction text (only the
      // answer differs per word), so text alone — or even text+points,
      // since many words share a tier — can't tell them apart. The answer
      // must be part of the dedup key too.
      const exists = await prisma.question.findFirst({ where: { categoryId: category.id, text: q.text, answer: q.answer } });
      if (!exists) {
        await prisma.question.create({
          data: {
            categoryId: category.id,
            text: q.text,
            answer: q.answer,
            points: q.points,
            hint: q.hint,
            imageUrl: q.imageUrl,
            isDrawing: c.type === 'DRAWING',
          },
        });
      }
    }
  }

  // Seasonal Ramadan category
  let ramadan = await prisma.category.findFirst({ where: { name: 'رمضانيات' } });
  if (!ramadan) {
    ramadan = await prisma.category.create({
      data: { name: 'رمضانيات', icon: '🌙', color: '#6C4CE0', type: 'SEASONAL', seasonTag: 'RAMADAN_2026' },
    });
  }
  const ramadanQuestions: Q[] = [
    { text: 'ما هو اسم الوجبة التي يتناولها الصائم قبل الفجر؟', answer: 'السحور', points: 100 },
    { text: 'كم عدد ركعات صلاة التراويح المتعارف عليها في أغلب المساجد؟', answer: '20 ركعة (يختلف حسب المذهب)', points: 200 },
    { text: 'ما اسم الليلة التي يُستحب فيها إحياء العشر الأواخر من رمضان بحثا عنها؟', answer: 'ليلة القدر', points: 300 },
  ];
  for (const q of [...ramadanQuestions, ...extrasFor('رمضانيات')]) {
    const exists = await prisma.question.findFirst({ where: { categoryId: ramadan.id, text: q.text, answer: q.answer } });
    if (!exists) await prisma.question.create({ data: { categoryId: ramadan.id, ...q } });
  }

  // Kids category
  let kids = await prisma.category.findFirst({ where: { name: 'عالم الأطفال' } });
  if (!kids) {
    kids = await prisma.category.create({
      data: { name: 'عالم الأطفال', icon: '🧸', color: '#3FC6FF', type: 'KIDS' },
    });
  }
  const kidsQuestions: Q[] = [
    { text: 'كم عدد أيام الأسبوع؟', answer: '7 أيام', points: 100 },
    { text: 'ما لون السماء في يوم صافٍ؟', answer: 'أزرق', points: 200 },
    { text: 'كم عدد أرجل العنكبوت؟', answer: '8 أرجل', points: 300 },
  ];
  for (const q of [...kidsQuestions, ...extrasFor('عالم الأطفال')]) {
    const exists = await prisma.question.findFirst({ where: { categoryId: kids.id, text: q.text, answer: q.answer } });
    if (!exists) await prisma.question.create({ data: { categoryId: kids.id, ...q } });
  }

  // ---------- Student subjects ----------
  const subjectDefs = [
    {
      name: 'الرياضيات',
      grade: 'الصف السادس',
      semester: 'الفصل الأول',
      questions: [
        { text: 'ناتج 12 × 8 يساوي؟', choices: ['96', '86', '108', '112'], correctIndex: 0 },
        { text: 'ما هو العدد الأولي من بين التالي؟', choices: ['9', '15', '17', '21'], correctIndex: 2 },
        { text: 'كم يساوي ربع العدد 200؟', choices: ['25', '50', '75', '100'], correctIndex: 1 },
      ],
    },
    {
      name: 'العلوم',
      grade: 'الصف السادس',
      semester: 'الفصل الأول',
      questions: [
        { text: 'ما هو الكوكب الأقرب إلى الشمس؟', choices: ['الأرض', 'عطارد', 'المريخ', 'الزهرة'], correctIndex: 1 },
        { text: 'أي من التالي يعتبر مصدر طاقة متجددة؟', choices: ['الفحم', 'النفط', 'الطاقة الشمسية', 'الغاز الطبيعي'], correctIndex: 2 },
        { text: 'ما وحدة قياس القوة؟', choices: ['نيوتن', 'وات', 'جول', 'كلفن'], correctIndex: 0 },
      ],
    },
  ];
  for (const s of subjectDefs) {
    let subject = await prisma.studentSubject.findFirst({ where: { name: s.name, grade: s.grade, semester: s.semester } });
    if (!subject) {
      subject = await prisma.studentSubject.create({ data: { name: s.name, grade: s.grade, semester: s.semester } });
    }
    for (const q of s.questions) {
      const exists = await prisma.studentQuestion.findFirst({ where: { subjectId: subject.id, text: q.text } });
      if (!exists) {
        await prisma.studentQuestion.create({
          data: { subjectId: subject.id, text: q.text, choices: JSON.stringify(q.choices), correctIndex: q.correctIndex },
        });
      }
    }
  }

  // ---------- TV episodes ----------
  const episodeDefs = [
    { title: 'الحلقة الأولى', number: 1, description: 'أول مواجهة في موسم رمضان بين فريقين متحمسين.' },
    { title: 'الحلقة الثانية', number: 2, description: 'تحدي مثير مع فئات متنوعة ووسائل مساعدة حاسمة.' },
    { title: 'الحلقة الثالثة', number: 3, description: 'جولة رسم مليئة بالضحك والتشويق حتى النهاية.' },
  ];
  for (const e of episodeDefs) {
    const exists = await prisma.episode.findFirst({ where: { number: e.number } });
    if (!exists) await prisma.episode.create({ data: e });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
