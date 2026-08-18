export interface User {
  id: string;
  name: string;
  role: 'USER' | 'ADMIN';
  remainingGames: number;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  imageUrl?: string | null;
  type: 'PERMANENT' | 'SEASONAL' | 'KIDS' | 'DRAWING' | 'STUDENT';
  seasonTag?: string | null;
  active: boolean;
  _count?: { questions: number };
}

export interface Question {
  id: string;
  categoryId: string;
  text: string;
  answer: string;
  hint?: string | null;
  points: number;
  isDrawing: boolean;
}

export interface Package {
  id: string;
  name: string;
  gamesCount: number;
  price: number;
  currency: string;
  active: boolean;
  sortOrder: number;
}

export interface Purchase {
  id: string;
  packageId: string;
  package: Package;
  amount: number;
  status: 'PENDING' | 'PAID' | 'FAILED';
  createdAt: string;
  paidAt?: string | null;
}

export interface GiftCode {
  id: string;
  code: string;
  packageId: string;
  package: Package;
  toPhone?: string | null;
  status: 'SENT' | 'REDEEMED';
  createdAt: string;
  redeemedAt?: string | null;
  fromUser?: { name: string };
  redeemedByUser?: { name: string } | null;
}

export interface DiscountCode {
  id: string;
  code: string;
  percentOff: number;
  maxUses: number;
  usedCount: number;
  active: boolean;
  expiresAt?: string | null;
  createdAt: string;
}

export const LIFELINE_TYPES = ['PHONE_A_FRIEND', 'DOUBLE_ANSWER', 'MORE_HINT', 'TRAP', 'PICK_ANSWERER', 'STEAL_POINTS'] as const;
export type LifelineType = (typeof LIFELINE_TYPES)[number];

export const LIFELINE_LABELS: Record<LifelineType, { label: string; icon: string; desc: string }> = {
  PHONE_A_FRIEND: { label: 'اتصال بصديق', icon: '📞', desc: 'دقيقة واحدة تتصل فيها على شخص يعرف الإجابة' },
  DOUBLE_ANSWER: { label: 'جاوب جوابين', icon: '🔁', desc: 'يمكن للفريق تجربة إجابتين لنفس السؤال' },
  MORE_HINT: { label: 'وضحلي أكثر', icon: '💡', desc: 'احصل على تلميح إضافي للسؤال' },
  TRAP: { label: 'الفخ', icon: '🕳️', desc: 'أعط السؤال للفريق المنافس مع وقت أقل' },
  PICK_ANSWERER: { label: 'اختر المجيب', icon: '🎯', desc: 'حدد لاعبا معينا من فريقك ليجيب' },
  STEAL_POINTS: { label: 'اسرق النقاط', icon: '💰', desc: 'اسحب نقاط السؤال الحالي من رصيد الفريق المنافس لصالحك' },
};

export interface Player {
  id: string;
  teamId: string;
  name: string;
}

export interface TeamLifeline {
  id: string;
  teamId: string;
  type: LifelineType;
  used: boolean;
}

export interface Team {
  id: string;
  gameId: string;
  name: string;
  color: string;
  score: number;
  players: Player[];
  lifelines: TeamLifeline[];
}

export interface GameTile {
  gameQuestionId: string;
  categoryId: string;
  points: number;
  isDrawing: boolean;
  isOpened: boolean;
  answeredByTeamId: string | null;
  isCorrect: boolean | null;
  usedVar: boolean;
  text?: string;
  hint?: string | null;
  answer?: string;
  imageUrl?: string | null;
}

export interface Game {
  id: string;
  userId: string;
  mode: 'CLASSIC' | 'KIDS' | 'STUDENT';
  status: 'ACTIVE' | 'FINISHED';
  winnerTeamId: string | null;
  isTie: boolean;
  createdAt: string;
  finishedAt?: string | null;
}

export interface GameBoard {
  game: Game;
  teams: Team[];
  categories: Category[];
  tiles: GameTile[];
}

export interface Tournament {
  id: string;
  name: string;
  format: 'KNOCKOUT' | 'ROUND_ROBIN';
  status: 'SETUP' | 'IN_PROGRESS' | 'FINISHED';
  championTeam?: string | null;
  createdAt: string;
  teams: { id: string; name: string }[];
  matches: TournamentMatch[];
}

export interface TournamentMatch {
  id: string;
  round: number;
  orderInRound: number;
  teamAName: string | null;
  teamBName: string | null;
  teamAScore: number;
  teamBScore: number;
  winnerName: string | null;
  status: 'PENDING' | 'DONE' | 'BYE';
}

export interface StudentSubject {
  id: string;
  name: string;
  grade: string;
  semester: string;
  _count?: { questions: number };
}

export interface StudentQuestion {
  id: string;
  subjectId: string;
  text: string;
  choices: string[];
  correctIndex: number;
}

export interface Episode {
  id: string;
  title: string;
  number: number;
  airDate?: string | null;
  description?: string | null;
  videoUrl?: string | null;
}
