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
  const categoryDefs: { name: string; icon: string; color: string; imageUrl?: string; type?: string; seasonTag?: string; questions: Q[] }[] = [
    {
      name: 'رياضة',
      icon: '⚽',
      color: '#2FBF71',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Football_in_Bloomington%2C_Indiana%2C_1995.jpg/330px-Football_in_Bloomington%2C_Indiana%2C_1995.jpg',
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
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Main_Cast_%28206644687%29.jpeg/330px-Main_Cast_%28206644687%29.jpeg',
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
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Denis_Bourez_-_British_Museum%2C_London_%288747049029%29_%282%29.jpg/330px-Denis_Bourez_-_British_Museum%2C_London_%288747049029%29_%282%29.jpg',
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
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/The_Great_Globe%2C_Guyot_Hall%2C_Princeton_University.jpg/330px-The_Great_Globe%2C_Guyot_Hall%2C_Princeton_University.jpg',
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
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Carina_Nebula.jpg/330px-Carina_Nebula.jpg',
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
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Steinway_Vienna_002.JPG/330px-Steinway_Vienna_002.JPG',
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
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/SanDiegoCityCollegeLearningResource_-_bookshelf.jpg/330px-SanDiegoCityCollegeLearningResource_-_bookshelf.jpg',
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
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/HONDA_ASIMO.jpg/330px-HONDA_ASIMO.jpg',
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
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Set_of_various_puzzles.jpg/330px-Set_of_various_puzzles.jpg',
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
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Dhow_znz.jpg/330px-Dhow_znz.jpg',
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
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Colouring_pencils.jpg/330px-Colouring_pencils.jpg',
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
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/United_Nations_Flags_-_cropped.jpg/330px-United_Nations_Flags_-_cropped.jpg',
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
    {
      name: 'عالم الحيوان',
      icon: '🦁',
      color: '#5C8A3A',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/020_The_lion_king_Snyggve_in_the_Serengeti_National_Park_Photo_by_Giles_Laurent.jpg/330px-020_The_lion_king_Snyggve_in_the_Serengeti_National_Park_Photo_by_Giles_Laurent.jpg',
      questions: [
        { text: 'ما هو الحيوان الملقب بملك الغابة؟', answer: 'الأسد', points: 100 },
        { text: 'ما أطول حيوان في العالم؟', answer: 'الزرافة', points: 100 },
        { text: 'كم عدد أرجل العنكبوت؟', answer: '8 أرجل', points: 100 },
        { text: 'ما هو أسرع حيوان بري في العالم؟', answer: 'الفهد الصياد', points: 100 },
        { text: 'بماذا يُلقب الجمل بسبب تحمله الحر والعطش؟', answer: 'سفينة الصحراء', points: 100 },
        { text: 'ما هو أكبر حيوان في العالم؟', answer: 'الحوت الأزرق', points: 100 },
        { text: 'أي حيوان يستطيع تغيير لون جلده؟', answer: 'الحرباء', points: 100 },
        { text: 'ما هو الطائر الذي لا يطير ويعيش في القطب الجنوبي؟', answer: 'البطريق', points: 100 },
        { text: 'أي حيوان ينام واقفا على قدميه غالبا؟', answer: 'الحصان', points: 100 },
        { text: 'ما اسم صغير الأسد؟', answer: 'الشبل', points: 100 },
        { text: 'أي حشرة تنتج العسل؟', answer: 'النحلة', points: 100 },
        { text: 'أي حيوان له خرطوم طويل يستخدمه كيد؟', answer: 'الفيل', points: 100 },
        { text: 'ما الحيوان الذي يمتلك أقوى عضة في المملكة الحيوانية؟', answer: 'التمساح', points: 200 },
        { text: 'ما اسم صغير الحصان؟', answer: 'المهر', points: 200 },
        { text: 'أي حيوان بحري يُعرف بذكائه العالي وتواصله بالأصوات؟', answer: 'الدلفين', points: 200 },
        { text: 'ما أكبر طائر في العالم من حيث الحجم رغم أنه لا يستطيع الطيران؟', answer: 'النعامة', points: 200 },
        { text: 'ماذا يخزن الجمل في سنامه؟', answer: 'الدهون', points: 200 },
        { text: 'ما اسم أنثى الأسد؟', answer: 'اللبؤة', points: 200 },
        { text: 'ما يسمى التجمع الذي تعيش فيه الذئاب؟', answer: 'القطيع', points: 200 },
        { text: 'أي حيوان يشتهر بالنوم لمعظم يومه (نحو 20 ساعة)؟', answer: 'الكوالا', points: 200 },
        { text: 'ما اسم صغير البقرة؟', answer: 'العجل', points: 200 },
        { text: 'أي حيوان يمتلك حاسة شم قوية جدا تُستخدم في التقصي والبحث؟', answer: 'الكلب', points: 200 },
        { text: 'ما هو الثديي الوحيد القادر على الطيران الحقيقي؟', answer: 'الخفاش', points: 200 },
        { text: 'ما أكبر سمكة في العالم؟', answer: 'القرش الحوتي', points: 200 },
        { text: 'ما اسم أكبر قارض في العالم؟', answer: 'الكابيبارا', points: 300 },
        { text: 'كم عدد "القلوب" (الأقواس الأبهرية) التي تمتلكها دودة الأرض؟', answer: '5 أزواج (10)', points: 300 },
        { text: 'ما يسمى تخلص بعض الحيوانات من جلدها القديم بشكل دوري؟', answer: 'الانسلاخ', points: 300 },
        { text: 'أي حيوان يمتلك أكبر عدد من الأسنان بين الثدييات (يصل إلى نحو 100 سن)؟', answer: 'الأرماديلو العملاق', points: 300 },
        { text: 'كم يبلغ متوسط فترة حمل الفيلة؟', answer: 'نحو 22 شهرا', points: 300, hint: 'أطول فترة حمل بين الثدييات' },
        { text: 'أي حيوان يدخل في سبات شتوي طويل معتمدا على الدهون المخزنة في جسمه؟', answer: 'الدب البني', points: 300 },
        { text: 'ما أطول أنواع الثعابين في العالم؟', answer: 'الثعبان الشبكي', points: 300 },
        { text: 'ما اسم الطائر الذي يقطع أطول مسافة هجرة سنوية بين جميع الكائنات، من القطب الشمالي إلى الجنوبي؟', answer: 'الخرشنة القطبية', points: 300 },
        { text: 'ما يسمى انتقال بعض الحيوانات مسافات طويلة بشكل موسمي؟', answer: 'الهجرة', points: 300 },
        { text: 'كم عدد فقرات رقبة الزرافة رغم طولها الكبير؟', answer: '7 فقرات فقط', points: 300, hint: 'نفس عدد فقرات رقبة الإنسان' },
        { text: 'ما اسم صغير الأرنب؟', answer: 'الخرنق', points: 300 },
        { text: 'أي حيوان يتلفف على شكل كرة شوكية للدفاع عن نفسه؟', answer: 'القنفذ', points: 300 },
      ],
    },
    {
      name: 'سيرة ذاتية',
      icon: '👤',
      color: '#D9534F',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/WALDST3.jpg/330px-WALDST3.jpg',
      questions: [
        { text: 'عالم ألماني اشتهر بنظرية النسبية، من هو؟', answer: 'ألبرت أينشتاين', points: 100 },
        { text: 'رسام إيطالي رسم لوحة الموناليزا، من هو؟', answer: 'ليوناردو دافنشي', points: 100 },
        { text: 'رئيس أمريكي سابق، أول رئيس أسود للولايات المتحدة، من هو؟', answer: 'باراك أوباما', points: 100 },
        { text: 'لاعب كرة قدم أرجنتيني فاز بكأس العالم 2022، من هو؟', answer: 'ليونيل ميسي', points: 100 },
        { text: 'مطربة مصرية لُقبت بكوكب الشرق، من هي؟', answer: 'أم كلثوم', points: 100 },
        { text: 'مؤسس شركة مايكروسوفت، من هو؟', answer: 'بيل غيتس', points: 100 },
        { text: 'ملاكم أمريكي لُقب بـ"الأعظم"، من هو؟', answer: 'محمد علي كلاي', points: 100 },
        { text: 'عالم فيزياء بريطاني ألّف كتاب "موجز تاريخ الزمن"، من هو؟', answer: 'ستيفن هوكينغ', points: 100 },
        { text: 'ملكة بريطانيا التي حكمت لأطول فترة في التاريخ البريطاني حتى وفاتها عام 2022، من هي؟', answer: 'الملكة إليزابيث الثانية', points: 100 },
        { text: 'رئيس جنوب أفريقيا الأسبق والمناضل ضد الفصل العنصري الذي سُجن 27 عاما، من هو؟', answer: 'نيلسون مانديلا', points: 100 },
        { text: 'مخترع أمريكي يُنسب إليه اختراع المصباح الكهربائي، من هو؟', answer: 'توماس إديسون', points: 100 },
        { text: 'مؤسس شركة أبل ومصمم الآيفون، من هو؟', answer: 'ستيف جوبز', points: 100 },
        { text: 'شاعر عربي عباسي لُقب بـ"المتنبي"، من هو؟', answer: 'أبو الطيب المتنبي', points: 200 },
        { text: 'عالم مسلم يُلقب بـ"أبي الجبر"، من هو؟', answer: 'الخوارزمي', points: 200 },
        { text: 'قائد مسلم قاد فتح الأندلس، من هو؟', answer: 'طارق بن زياد', points: 200 },
        { text: 'ملحن مصري لُقب بـ"موسيقار الأجيال"، من هو؟', answer: 'محمد عبد الوهاب', points: 200 },
        { text: 'عالمة فيزياء وكيمياء بولندية-فرنسية، أول من فاز بجائزة نوبل مرتين في مجالين مختلفين، من هي؟', answer: 'ماري كوري', points: 200 },
        { text: 'رسام هولندي اشتهر بلوحة "الليلة المرصعة بالنجوم"، من هو؟', answer: 'فنسنت فان جوخ', points: 200 },
        { text: 'رئيس وزراء بريطانيا خلال الحرب العالمية الثانية، من هو؟', answer: 'ونستون تشرشل', points: 200 },
        { text: 'طبيب وفيلسوف مسلم ألّف كتاب "القانون في الطب"، من هو؟', answer: 'ابن سينا', points: 200 },
        { text: 'لاعبة تنس أمريكية فازت بـ23 لقب غراند سلام فردي، من هي؟', answer: 'سيرينا ويليامز', points: 200 },
        { text: 'مؤرخ ومفكر عربي وضع أسس علم الاجتماع في كتابه "المقدمة"، من هو؟', answer: 'ابن خلدون', points: 200 },
        { text: 'مصممة أزياء فرنسية أسست دار أزياء شانيل، من هي؟', answer: 'كوكو شانيل', points: 200 },
        { text: 'عالم مسلم يُعرف بأبي علم البصريات، له كتاب "المناظر"، من هو؟', answer: 'ابن الهيثم', points: 200 },
        { text: 'شاعر عربي هاجر إلى أمريكا مع جبران خليل جبران وأحيا ما يُعرف بأدب المهجر، من هو؟', answer: 'إيليا أبو ماضي', points: 300 },
        { text: 'قائد قرطاجي عبر جبال الألب بالفيلة لغزو روما، من هو؟', answer: 'حنبعل', points: 300 },
        { text: 'رسامة مكسيكية اشتهرت بلوحاتها الذاتية وتأثرت بحادث حافلة مروع، من هي؟', answer: 'فريدا كاهلو', points: 300 },
        { text: 'عالم إنجليزي وضع نظرية التطور بالانتخاب الطبيعي، من هو؟', answer: 'تشارلز داروين', points: 300 },
        { text: 'خليفة عباسي أسس بيت الحكمة رسميا وازدهرت في عهده حركة الترجمة، من هو؟', answer: 'المأمون', points: 300 },
        { text: 'مصممة أزياء ومهندسة معمارية عراقية-بريطانية فازت بجائزة بريتزكر، من هي؟', answer: 'زها حديد', points: 300 },
        { text: 'فيلسوف يوناني كان تلميذا لسقراط ومعلما لأرسطو، من هو؟', answer: 'أفلاطون', points: 300 },
        { text: 'عالمة رياضيات بريطانية تُعد أول مبرمجة حاسوب في التاريخ، وهي ابنة الشاعر اللورد بايرون، من هي؟', answer: 'أدا لوفليس', points: 300 },
        { text: 'مغني وقائد فرقة "كوين" البريطانية، اشتهر بصوته القوي وأدائه المسرحي، من هو؟', answer: 'فريدي ميركوري', points: 300 },
        { text: 'شاعر مصري لُقب بـ"أمير الشعراء"، من هو؟', answer: 'أحمد شوقي', points: 300 },
        { text: 'رحالة مسلم زار معظم العالم الإسلامي المعروف في القرن الرابع عشر ودوّن رحلته الشهيرة، من هو؟', answer: 'ابن بطوطة', points: 300 },
        { text: 'رسام إسباني رائد الحركة التكعيبية، رسم لوحة "غرنيكا"، من هو؟', answer: 'بابلو بيكاسو', points: 300 },
      ],
    },
    {
      name: 'عالم الشعر',
      icon: '🖋️',
      color: '#4C6FE0',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Fountain_pen_writing_%28literacy%29.jpg/330px-Fountain_pen_writing_%28literacy%29.jpg',
      questions: [
        { text: 'من الشاعر الجاهلي صاحب المعلقة المشهورة، الملقب بـ"الملك الضليل"؟', answer: 'امرؤ القيس', points: 100 },
        { text: 'من الشاعر المصري الملقب بـ"أمير الشعراء"؟', answer: 'أحمد شوقي', points: 100 },
        { text: 'ما اسم القصائد العربية السبع الطويلة التي كانت تُعلَّق تقليديا على أستار الكعبة؟', answer: 'المعلقات', points: 100 },
        { text: 'من الشاعر العباسي الملقب بـ"المتنبي"؟', answer: 'أبو الطيب المتنبي', points: 100 },
        { text: 'ما يسمى البيت الأول من القصيدة العربية التقليدية؟', answer: 'المطلع', points: 100 },
        { text: 'من الشاعر اللبناني مؤلف كتاب "النبي" الشعري؟', answer: 'جبران خليل جبران', points: 100 },
        { text: 'ما اسم الفن الشعري الذي يُقال بلا وزن ولا قافية تقليدية؟', answer: 'الشعر الحر', points: 100 },
        { text: 'من الشاعرة الجاهلية التي اشتهرت برثاء أخيها صخر؟', answer: 'الخنساء', points: 100 },
        { text: 'ما يسمى الحرف المتكرر في نهاية كل بيت من أبيات القصيدة؟', answer: 'الروي', points: 100 },
        { text: 'من الشاعر المصري الملقب بـ"شاعر النيل"؟', answer: 'حافظ إبراهيم', points: 100 },
        { text: 'ما اسم الفن الشعري الذي يمدح فيه الشاعر شخصا؟', answer: 'المديح', points: 100 },
        { text: 'ما اسم الشعر الذي يُقال في رثاء الموتى؟', answer: 'الرثاء', points: 100 },
        { text: 'من الشاعر الأموي الذي اشتهر بشعر الغزل العذري بمحبوبته "بثينة"؟', answer: 'جميل بثينة', points: 200 },
        { text: 'ما اسم الشعر الشعبي الذي يُلقى باللهجة المحلية ومرتبط بالبيئة البدوية في الخليج؟', answer: 'الشعر النبطي', points: 200 },
        { text: 'من الشاعر العربي الملقب بـ"شاعر القطرين" لارتباطه الأدبي بمصر ولبنان؟', answer: 'خليل مطران', points: 200 },
        { text: 'ما اسم علم الشعر الذي يدرس أوزان الشعر العربي وبحوره؟', answer: 'العروض', points: 200 },
        { text: 'من واضع علم العروض العربي؟', answer: 'الخليل بن أحمد الفراهيدي', points: 200 },
        { text: 'ما اسم البحر الشعري الأكثر استخداما في الشعر العربي الكلاسيكي؟', answer: 'البحر الطويل', points: 200 },
        { text: 'من شاعر إنجليزي كتب السوناتات ومسرحيات شعرية، ويُعد من أعظم كتّاب اللغة الإنجليزية؟', answer: 'وليام شكسبير', points: 200 },
        { text: 'ما يسمى نوع الشعر الذي يعبّر عن مشاعر الحب؟', answer: 'الغزل', points: 200 },
        { text: 'من الشاعر الفارسي مؤلف الملحمة الشعرية "الشاهنامة"؟', answer: 'الفردوسي', points: 200 },
        { text: 'ما اسم الشعر الذي يهجو فيه الشاعر شخصا أو جماعة؟', answer: 'الهجاء', points: 200 },
        { text: 'من الشاعر الأندلسي المعروف بوصفه الدقيق للطبيعة والبساتين؟', answer: 'ابن خفاجة', points: 200 },
        { text: 'ما اسم النمط الشعري الياباني القصير المكوّن من 17 مقطعا صوتيا؟', answer: 'الهايكو', points: 200 },
        { text: 'من الشاعر العربي الذي هاجر إلى أمريكا مع جبران خليل جبران وأحيا ما يُعرف بأدب المهجر؟', answer: 'إيليا أبو ماضي', points: 300 },
        { text: 'ما اسم الحركة الشعرية العربية الحديثة التي كسرت نظام الشطرين التقليدي في منتصف القرن العشرين؟', answer: 'حركة الشعر الحر', points: 300 },
        { text: 'من الشاعرة العراقية الرائدة في الشعر الحر إلى جانب بدر شاكر السياب؟', answer: 'نازك الملائكة', points: 300 },
        { text: 'من الشاعر العراقي الرائد في حركة الشعر الحر، صاحب قصيدة "أنشودة المطر"؟', answer: 'بدر شاكر السياب', points: 300 },
        { text: 'من الشاعر الروماني الذي كتب الملحمة الشعرية "الإنيادة"؟', answer: 'فرجيل', points: 300 },
        { text: 'من الشاعر الإغريقي الذي يُنسب إليه تأليف ملحمتي الإلياذة والأوديسة؟', answer: 'هوميروس', points: 300 },
        { text: 'ما يسمى نوع الشعر الذي يُغنى ويرافقه لحن موسيقي في التراث الأندلسي؟', answer: 'الموشح', points: 300 },
        { text: 'في أي بلاد نشأ فن الموشحات الشعرية؟', answer: 'الأندلس', points: 300 },
        { text: 'من الشاعر الفلسطيني الملقب بـ"شاعر المقاومة"؟', answer: 'محمود درويش', points: 300 },
        { text: 'من الشاعر السوري الذي اشتهر بشعر الحب والغزل الحديث ولُقب بـ"شاعر المرأة"؟', answer: 'نزار قباني', points: 300 },
        { text: 'من الشاعر العربي الجاهلي الذي يُنسب إليه لقب "شاعر الحكمة" لكثرة الحكم في شعره؟', answer: 'زهير بن أبي سلمى', points: 300 },
        { text: 'ما اسم فن الشعر الذي يعتمد على المفارقة والتورية اللفظية بذكاء وتزيين الكلام؟', answer: 'البديع', points: 300 },
      ],
    },
  ];

  for (const c of categoryDefs) {
    let category = await prisma.category.findFirst({ where: { name: c.name } });
    if (!category) {
      category = await prisma.category.create({
        data: { name: c.name, icon: c.icon, color: c.color, imageUrl: c.imageUrl, type: c.type || 'PERMANENT' },
      });
    } else if (c.imageUrl && category.imageUrl !== c.imageUrl) {
      // Backfills the cover image on categories seeded before imageUrl existed.
      category = await prisma.category.update({ where: { id: category.id }, data: { imageUrl: c.imageUrl } });
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
  const ramadanImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Breaking_the_Fast_%282%29_%2827351979537%29.jpg/330px-Breaking_the_Fast_%282%29_%2827351979537%29.jpg';
  let ramadan = await prisma.category.findFirst({ where: { name: 'رمضانيات' } });
  if (!ramadan) {
    ramadan = await prisma.category.create({
      data: { name: 'رمضانيات', icon: '🌙', color: '#6C4CE0', imageUrl: ramadanImageUrl, type: 'SEASONAL', seasonTag: 'RAMADAN_2026' },
    });
  } else if (ramadan.imageUrl !== ramadanImageUrl) {
    ramadan = await prisma.category.update({ where: { id: ramadan.id }, data: { imageUrl: ramadanImageUrl } });
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
  const kidsImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/ToyCars.jpg/330px-ToyCars.jpg';
  let kids = await prisma.category.findFirst({ where: { name: 'عالم الأطفال' } });
  if (!kids) {
    kids = await prisma.category.create({
      data: { name: 'عالم الأطفال', icon: '🧸', color: '#3FC6FF', imageUrl: kidsImageUrl, type: 'KIDS' },
    });
  } else if (kids.imageUrl !== kidsImageUrl) {
    kids = await prisma.category.update({ where: { id: kids.id }, data: { imageUrl: kidsImageUrl } });
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
