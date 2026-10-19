import type {
  Assessment,
  AssessmentResult,
  CalcSettings,
  Grade,
  LeaderboardEntry,
  ScoreHighlight,
  Student,
  StudentStats,
  Unit,
} from '../types';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function getStudentGrades(grades: Grade[], studentId: string): Grade[] {
  return grades.filter((g) => g.studentId === studentId);
}

export function percentageOf(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return round2((score / maxScore) * 100);
}

export function assessmentOrder(assessments: Assessment[]): Assessment[] {
  const seedOrder = ['quiz-1', 'quiz-2', 'quiz-3', 'quiz-4', 'exam-1'];
  return [...assessments].sort((a, b) => {
    // 1. Quizzes come before exams
    if (a.type !== b.type) {
      return a.type === 'quiz' ? -1 : 1;
    }
    // 2. Original seed order
    const ai = seedOrder.indexOf(a.id);
    const bi = seedOrder.indexOf(b.id);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    // 3. Fallback: date or title
    if (a.date && b.date && a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    return a.title.localeCompare(b.title, 'ar');
  });
}

export function shortAssessmentLabel(a: Assessment, indexInType: number): string {
  if (a.type === 'quiz') {
    const names = [
      'الكويز الأول',
      'الكويز الثاني',
      'الكويز الثالث',
      'الكويز الرابع',
      'الكويز الخامس',
      'الكويز السادس',
      'الكويز السابع',
      'الكويز الثامن',
    ];
    return names[indexInType] ?? `كويز ${indexInType + 1}`;
  }
  const examNames = ['الامتحان الشامل', 'الشامل الثاني', 'الشامل الثالث', 'الشامل الرابع'];
  return examNames[indexInType] ?? `شامل ${indexInType + 1}`;
}

function isIncluded(a: Assessment, settings: CalcSettings): boolean {
  if (a.type === 'quiz' && !settings.includeQuizzes) return false;
  if (a.type === 'exam' && !settings.includeExams) return false;
  return true;
}

export function computeCumulative(
  studentId: string,
  assessments: Assessment[],
  grades: Grade[],
  settings: CalcSettings,
  upToAssessmentId?: string,
): number | null {
  const ordered = assessmentOrder(assessments).filter((a) =>
    isIncluded(a, settings),
  );
  let list = ordered;
  if (upToAssessmentId) {
    const idx = ordered.findIndex((a) => a.id === upToAssessmentId);
    if (idx === -1) return null;
    list = ordered.slice(0, idx + 1);
  }

  // التحقق مما إذا كان الطالب لديه أي مشاركة أو تقييم مسجل
  const studentGrades = getStudentGrades(grades, studentId);
  const hasParticipation = studentGrades.some(
    (g) => (g.status === 'scored' && g.score !== null) || g.status === 'absent',
  );

  // إذا لم يكن لدى الطالب أي درجات مسجلة إطلاقاً في النظام، يظل بلا درجات
  if (!hasParticipation) return null;

  // جمع التقييمات: التقييم الذي لم يمتحنه الطالب أو كان غائباً عنه يُحسب 0
  const evaluated = list
    .map((a) => {
      const grade = studentGrades.find((g) => g.assessmentId === a.id);
      if (grade?.status === 'excused') return null; // معذور رسمياً لا يُحسب في المجموع
      if (grade?.status === 'scored' && grade.score !== null) {
        return {
          assessment: a,
          score: Math.max(0, Math.min(a.maxScore, grade.score)),
          maxScore: a.maxScore,
        };
      }
      // غائب أو لم يمتحن هذا التقييم بعد: يُحسب له صفر من الدرجة الكلية
      return { assessment: a, score: 0, maxScore: a.maxScore };
    })
    .filter(Boolean) as { assessment: Assessment; score: number; maxScore: number }[];

  if (evaluated.length === 0) return null;

  if (settings.method === 'average_percentage') {
    const sum = evaluated.reduce(
      (acc, item) => acc + percentageOf(item.score, item.maxScore),
      0,
    );
    return round2(sum / evaluated.length);
  }

  if (settings.method === 'weighted') {
    const quizzes = evaluated.filter((s) => s.assessment.type === 'quiz');
    const exams = evaluated.filter((s) => s.assessment.type === 'exam');
    let quizPct: number | null = null;
    let examPct: number | null = null;

    if (quizzes.length) {
      const earned = quizzes.reduce((a, s) => a + s.score, 0);
      const max = quizzes.reduce((a, s) => a + s.maxScore, 0);
      quizPct = percentageOf(earned, max);
    }
    if (exams.length) {
      const earned = exams.reduce((a, s) => a + s.score, 0);
      const max = exams.reduce((a, s) => a + s.maxScore, 0);
      examPct = percentageOf(earned, max);
    }

    const qw = settings.quizWeight;
    const ew = settings.examWeight;
    if (quizPct !== null && examPct !== null) {
      return round2((quizPct * qw + examPct * ew) / (qw + ew));
    }
    if (quizPct !== null) return quizPct;
    if (examPct !== null) return examPct;
    return null;
  }

  // total_points (الافتراضية)
  const earned = evaluated.reduce((a, s) => a + s.score, 0);
  const max = evaluated.reduce((a, s) => a + s.maxScore, 0);
  return percentageOf(earned, max);
}

export function buildLeaderboard(
  students: Student[],
  assessments: Assessment[],
  grades: Grade[],
  settings: CalcSettings,
): LeaderboardEntry[] {
  const active = students.filter((s) => s.active);
  const entries: LeaderboardEntry[] = active.map((student) => {
    const pct = computeCumulative(
      student.id,
      assessments,
      grades,
      settings,
    );
    return {
      student,
      cumulativePercentage: pct ?? 0,
      hasGrades: pct !== null,
      rank: 0,
      isTied: false,
    };
  });

  // فرز الطلاب: من له درجات أولاً، ثم النسبة الأعلى، ثم الترتيب الأبجدي
  entries.sort((a, b) => {
    if (a.hasGrades && !b.hasGrades) return -1;
    if (!a.hasGrades && b.hasGrades) return 1;

    if (b.cumulativePercentage !== a.cumulativePercentage) {
      return b.cumulativePercentage - a.cumulativePercentage;
    }

    return a.student.name.localeCompare(b.student.name, 'ar');
  });

  // حساب الترتيب بنظام المنافسة القياسي (Competition Ranking: 1, 2, 2, 4)
  let precedingCount = 0;
  let currentRank = 1;
  let prevPct: number | null = null;
  const scoredCount = entries.filter((x) => x.hasGrades).length;

  entries.forEach((e) => {
    if (!e.hasGrades) {
      e.rank = scoredCount + 1;
      return;
    }

    if (prevPct === null) {
      currentRank = 1;
      e.rank = currentRank;
      prevPct = e.cumulativePercentage;
    } else if (Math.abs(e.cumulativePercentage - prevPct) < 0.005) {
      // متساوي تماماً في النسبة التراكمية -> يأخذ نفس الترتيب
      e.rank = currentRank;
    } else {
      // ترتيب المنافسة القياسي: المركز = 1 + عدد الطلاب السابقين
      currentRank = precedingCount + 1;
      e.rank = currentRank;
      prevPct = e.cumulativePercentage;
    }
    precedingCount++;
  });

  // رصد المراكز المكررة وتحديد علامة isTied
  const rankCount: Record<number, number> = {};
  entries.forEach((e) => {
    if (e.hasGrades) {
      rankCount[e.rank] = (rankCount[e.rank] || 0) + 1;
    }
  });
  entries.forEach((e) => {
    if (e.hasGrades && rankCount[e.rank] > 1) {
      e.isTied = true;
    }
  });

  return entries;
}

function averagePct(
  results: {
    score: number | null;
    status: Grade['status'];
    assessment: Assessment;
  }[],
): number | null {
  const valid = results.filter((r) => r.status !== 'excused');
  if (!valid.length) return null;
  const sum = valid.reduce((a, r) => {
    const s = r.status === 'scored' && r.score !== null ? Math.max(0, r.score) : 0;
    return a + percentageOf(s, r.assessment.maxScore);
  }, 0);
  return round2(sum / valid.length);
}

export function buildStudentStats(
  student: Student,
  _students: Student[],
  assessments: Assessment[],
  grades: Grade[],
  _units: Unit[],
  settings: CalcSettings,
  leaderboard: LeaderboardEntry[],
): StudentStats {
  const ordered = assessmentOrder(assessments);
  const studentGrades = getStudentGrades(grades, student.id);
  const hasParticipation = studentGrades.some(
    (g) => (g.status === 'scored' && g.score !== null) || g.status === 'absent',
  );

  // بناء كل النتائج بالتسلسل مع سهم التراكمي مقارنةً بالتقييم السابق
  const allResults: AssessmentResult[] = [];
  let prevCum: number | null = null;

  ordered.forEach((assessment) => {
    const grade = studentGrades.find((g) => g.assessmentId === assessment.id);
    if (!grade && !hasParticipation) return;

    const status: Grade['status'] = grade ? grade.status : 'absent';
    const score = grade && grade.status === 'scored' && grade.score !== null ? grade.score : 0;
    const pct = status === 'excused' ? null : percentageOf(score, assessment.maxScore);

    const cum = computeCumulative(
      student.id,
      assessments,
      grades,
      settings,
      assessment.id,
    );

    let cumulativeTrend: AssessmentResult['cumulativeTrend'] = null;
    if (cum !== null && prevCum !== null) {
      if (cum > prevCum) cumulativeTrend = 'up';
      else if (cum < prevCum) cumulativeTrend = 'down';
      else cumulativeTrend = 'same';
    }
    if (cum !== null) prevCum = cum;

    allResults.push({
      assessment,
      score: grade ? grade.score : 0,
      status,
      percentage: pct,
      cumulativePercentage: cum,
      cumulativeTrend,
    });
  });

  const quizResults = allResults.filter((r) => r.assessment.type === 'quiz');
  const examResults = allResults.filter((r) => r.assessment.type === 'exam');

  const cumulativeProgress = ordered
    .map((assessment) => {
      if (!hasParticipation) return null;
      const pct = computeCumulative(
        student.id,
        assessments,
        grades,
        settings,
        assessment.id,
      );
      if (pct === null) return null;

      const typeIndex = ordered
        .filter((a) => a.type === assessment.type)
        .findIndex((a) => a.id === assessment.id);

      return {
        id: assessment.id,
        shortLabel: shortAssessmentLabel(assessment, typeIndex),
        label: assessment.title,
        percentage: pct,
      };
    })
    .filter(Boolean) as StudentStats['cumulativeProgress'];

  const scoredQuizzes = quizResults.filter(
    (r) => r.status === 'scored' && r.percentage !== null,
  );
  let bestQuiz: ScoreHighlight | null = null;
  let weakestQuiz: ScoreHighlight | null = null;
  scoredQuizzes.forEach((r) => {
    const typeIndex = ordered
      .filter((a) => a.type === 'quiz')
      .findIndex((a) => a.id === r.assessment.id);
    const item: ScoreHighlight = {
      label: shortAssessmentLabel(r.assessment, typeIndex),
      percentage: r.percentage!,
      scoreText: formatScore(r.score, r.assessment.maxScore, r.status),
    };
    if (!bestQuiz || item.percentage > bestQuiz.percentage) bestQuiz = item;
    if (!weakestQuiz || item.percentage < weakestQuiz.percentage)
      weakestQuiz = item;
  });

  let bestExam: ScoreHighlight | null = null;
  let weakestExam: ScoreHighlight | null = null;
  examResults
    .filter((r) => r.status === 'scored' && r.percentage !== null)
    .forEach((r) => {
      const typeIndex = ordered
        .filter((a) => a.type === 'exam')
        .findIndex((a) => a.id === r.assessment.id);
      const item: ScoreHighlight = {
        label: shortAssessmentLabel(r.assessment, typeIndex),
        percentage: r.percentage!,
        scoreText: formatScore(r.score, r.assessment.maxScore, r.status),
      };
      if (!bestExam || item.percentage > bestExam.percentage) bestExam = item;
      if (!weakestExam || item.percentage < weakestExam.percentage)
        weakestExam = item;
    });

  const quizAverage = averagePct(quizResults);
  const examAverage = averagePct(examResults);
  const entry = leaderboard.find((e) => e.student.id === student.id);
  const cumulativePercentage =
    entry?.cumulativePercentage ??
    computeCumulative(student.id, assessments, grades, settings) ??
    0;

  return {
    student,
    cumulativePercentage,
    quizAverage,
    examAverage,
    rank: entry?.rank ?? 0,
    quizResults,
    examResults,
    cumulativeProgress,
    bestQuiz,
    weakestQuiz,
    bestExam,
    weakestExam,
  };
}

export function formatPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`;
}

export function formatScore(
  score: number | null,
  max: number,
  status: Grade['status'],
): string {
  if (status === 'absent') return 'غائب';
  if (status === 'excused') return 'لن يحضر';
  if (score === null) return '—';
  return `${score}/${max}`;
}

export type GpaGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export const GPA_DISPLAY: Record<GpaGrade, string> = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  F: 'F',
};

/**
 * تحويل النسبة المئوية إلى تقدير GPA أساسي (A, B, C, D, F)
 * معيار قياسي دولي:
 *   A  → 90%+
 *   B  → 80–89%
 *   C  → 70–79%
 *   D  → 60–69%
 *   F  → < 60%
 */
export function getGpaGrade(
  percentage: number | null | undefined,
): GpaGrade | null {
  if (percentage === null || percentage === undefined) return null;
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

/**
 * حساب معدل الـ GPA من 4.0 بناءً على النسبة المئوية
 * مقياس قياسي:
 *   100%      → 4.00
 *   90–99%    → 3.50–3.99  (تدريجي)
 *   80–89%    → 3.00–3.49
 *   70–79%    → 2.00–2.99
 *   60–69%    → 1.00–1.99
 *   < 60%     → 0.00–0.99
 */
export function calculateGpa4(percentage: number | null | undefined): number | null {
  if (percentage === null || percentage === undefined) return null;
  const p = Math.min(100, Math.max(0, percentage));
  if (p >= 97)  return 4.00;
  if (p >= 93)  return round2(3.70 + ((p - 93) / 4) * 0.29);
  if (p >= 90)  return round2(3.40 + ((p - 90) / 3) * 0.29);
  if (p >= 87)  return round2(3.20 + ((p - 87) / 3) * 0.20);
  if (p >= 83)  return round2(3.00 + ((p - 83) / 4) * 0.20);
  if (p >= 80)  return round2(2.70 + ((p - 80) / 3) * 0.29);
  if (p >= 77)  return round2(2.30 + ((p - 77) / 3) * 0.39);
  if (p >= 73)  return round2(2.00 + ((p - 73) / 4) * 0.29);
  if (p >= 70)  return round2(1.70 + ((p - 70) / 3) * 0.29);
  if (p >= 67)  return round2(1.30 + ((p - 67) / 3) * 0.39);
  if (p >= 63)  return round2(1.00 + ((p - 63) / 4) * 0.29);
  if (p >= 60)  return round2(0.70 + ((p - 60) / 3) * 0.29);
  return round2(Math.max(0, (p / 60) * 0.69));
}

export function formatGpa4(gpa: number | null | undefined): string {
  if (gpa === null || gpa === undefined) return '—';
  return gpa.toFixed(2);
}
