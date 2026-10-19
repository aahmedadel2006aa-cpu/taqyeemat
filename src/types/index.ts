export type AssessmentType = 'quiz' | 'exam';

export type CalcMethod = 'total_points' | 'average_percentage' | 'weighted';

export interface Student {
  id: string;
  name: string;
  shortName: string;
  gradeLevel: string;
  phone: string;
  parentPhone: string;
  active: boolean;
  notes?: string;
}

export interface Unit {
  id: string;
  name: string;
  order: number;
}

export interface Assessment {
  id: string;
  title: string;
  type: AssessmentType;
  unitId: string;
  maxScore: number;
  date: string;
}

export interface Grade {
  id: string;
  studentId: string;
  assessmentId: string;
  score: number | null;
  status: 'scored' | 'absent' | 'excused';
}

export interface CalcSettings {
  method: CalcMethod;
  includeQuizzes: boolean;
  includeExams: boolean;
  quizWeight: number;
  examWeight: number;
}

export interface AssessmentResult {
  assessment: Assessment;
  score: number | null;
  status: Grade['status'];
  percentage: number | null;
  cumulativePercentage: number | null;
  /** تغير التراكمي مقارنة بالتقييم السابق: up / down / same / null */
  cumulativeTrend: 'up' | 'down' | 'same' | null;
}

export interface ScoreHighlight {
  label: string;
  percentage: number;
  scoreText: string;
}

export interface StudentStats {
  student: Student;
  cumulativePercentage: number;
  quizAverage: number | null;
  examAverage: number | null;
  rank: number;
  quizResults: AssessmentResult[];
  examResults: AssessmentResult[];
  cumulativeProgress: {
    id: string;
    shortLabel: string;
    label: string;
    percentage: number;
  }[];
  bestQuiz: ScoreHighlight | null;
  weakestQuiz: ScoreHighlight | null;
  bestExam: ScoreHighlight | null;
  weakestExam: ScoreHighlight | null;
}

export interface LeaderboardEntry {
  student: Student;
  cumulativePercentage: number;
  rank: number;
  hasGrades?: boolean;
  isTied?: boolean;
}
