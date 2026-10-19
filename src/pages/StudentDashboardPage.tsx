import { Link, useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  FileCheck,
  Hash,
  Minus,
  Sparkles,
  Award,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import {
  formatPct,
  formatScore,
  getGpaGrade,
  GPA_DISPLAY,
  calculateGpa4,
  formatGpa4,
  shortAssessmentLabel,
} from '../utils/calculations';
import { EmptyState } from '../components/ui/EmptyState';
import type { AssessmentResult } from '../types';

/* ─── Trend Arrow ─────────────────────────────────── */
function TrendArrow({
  trend,
}: {
  trend: AssessmentResult['cumulativeTrend'];
}) {
  if (trend === 'up') {
    return (
      <span className="trend-arrow trend-up" title="تحسن">
        <ArrowUp size={14} strokeWidth={2.75} aria-label="تحسن" />
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span className="trend-arrow trend-down" title="انخفاض">
        <ArrowDown size={14} strokeWidth={2.75} aria-label="انخفاض" />
      </span>
    );
  }
  if (trend === 'same') {
    return (
      <span className="trend-arrow trend-same" title="بدون تغيير">
        <Minus size={14} aria-label="بدون تغيير" />
      </span>
    );
  }
  return <span className="trend-arrow trend-none">—</span>;
}


/* ─── Quiz Card ───────────────────────────────────── */
function QuizCard({
  result,
  shortLabel,
}: {
  result: AssessmentResult;
  shortLabel: string;
}) {
  return (
    <article className="assess-card">
      <h3>{shortLabel}</h3>
      <div className="assess-card-row">
        <div className="assess-metric">
          <span className="metric-label">الدرجة</span>
          <strong>
            {formatScore(result.score, result.assessment.maxScore, result.status)}
          </strong>
        </div>
        <div className="assess-metric">
          <span className="metric-label">المعدل</span>
          <strong>{formatPct(result.percentage)}</strong>
        </div>
        <div className="assess-metric">
          <span className="metric-label">التراكمي</span>
          <strong>{formatPct(result.cumulativePercentage)}</strong>
        </div>
        <div className="assess-metric assess-trend">
          <span className="metric-label">الترتيب</span>
          <TrendArrow trend={result.cumulativeTrend} />
        </div>
      </div>
    </article>
  );
}

/* ─── Exam Card ───────────────────────────────────── */
function ExamCard({
  result,
  shortLabel,
}: {
  result: AssessmentResult;
  shortLabel: string;
}) {
  return (
    <article className="assess-card">
      <h3>{shortLabel}</h3>
      <div className="assess-card-row">
        <div className="assess-metric">
          <span className="metric-label">الدرجة</span>
          <strong>
            {formatScore(result.score, result.assessment.maxScore, result.status)}
          </strong>
        </div>
        <div className="assess-metric">
          <span className="metric-label">النسبة</span>
          <strong
            style={{
              color: result.percentage !== null && result.percentage >= 60
                ? 'var(--success)'
                : result.percentage !== null
                  ? 'var(--danger)'
                  : undefined,
            }}
          >
            {formatPct(result.percentage)}
          </strong>
        </div>
        <div className="assess-metric">
          <span className="metric-label">التراكمي</span>
          <strong>{formatPct(result.cumulativePercentage)}</strong>
        </div>
        <div className="assess-metric assess-trend">
          <span className="metric-label">الترتيب</span>
          <TrendArrow trend={result.cumulativeTrend} />
        </div>
      </div>
    </article>
  );
}

/* ─── Main Page ───────────────────────────────────── */
export function StudentDashboardPage() {
  const { studentId } = useParams();
  const { getStudentStats, assessments } = useData();
  const stats = studentId ? getStudentStats(studentId) : null;

  if (!stats) {
    return (
      <section className="page">
        <Link to="/" className="back-link">
          <ArrowRight size={18} />
          العودة للترتيب
        </Link>
        <EmptyState
          title="الطالب غير موجود"
          description="تحقق من الرابط أو عد إلى لوحة الترتيب."
        />
      </section>
    );
  }

  const quizOrder = assessments.filter((a) => a.type === 'quiz');
  const examOrder = assessments.filter((a) => a.type === 'exam');

  const gpaGrade = getGpaGrade(stats.cumulativePercentage);
  const gpa4 = calculateGpa4(stats.cumulativePercentage);

  return (
    <section className="page student-page">
      {/* Breadcrumb */}
      <nav className="breadcrumb" aria-label="التنقل">
        <Link to="/" className="back-link">
          <ArrowRight size={18} />
          العودة للترتيب
        </Link>
        <span className="crumb-sep">/</span>
        <span>{stats.student.name}</span>
      </nav>

      {/* Page Header */}
      <header className="page-header student-page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1>{stats.student.name}</h1>
            <p>لوحة التقييم الأكاديمي والأداء</p>
          </div>
          {gpaGrade && (
            <div className="student-header-metrics-duo">
              <div className="student-header-stat-pill gpa-pill-box">
                <span className="stat-pill-label">المعدل (GPA من 4.0)</span>
                <strong className="stat-pill-value">{formatGpa4(gpa4)} / 4.0</strong>
              </div>
              <div className="student-header-stat-pill grade-pill-box">
                <span className="stat-pill-label">التقدير العام</span>
                <span className={`gpa-pill gpa-${gpaGrade} gpa-pill-header`}>
                  {GPA_DISPLAY[gpaGrade]}
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ══ HERO SECTION — منفصلة تماماً لكل مقياس ══ */}
      <div className="hero-grid">

        {/* 1. الترتيب */}
        <article className="hero-card">
          <div className="hero-card-icon violet">
            <Hash size={18} />
          </div>
          <p className="hero-label">الترتيب</p>
          <p className="hero-value rank-num">
            {stats.rank > 0 ? `#${stats.rank}` : '—'}
          </p>
          <p className="hero-sub">بين الطلاب النشطين</p>
        </article>

        {/* 2. نسبة الكويزات */}
        <article className="hero-card">
          <div className="hero-card-icon cyan">
            <BookOpen size={18} />
          </div>
          <p className="hero-label">نسبة الكويزات</p>
          <p className="hero-value quiz-pct">
            {formatPct(stats.quizAverage)}
          </p>
          <p className="hero-sub">متوسط جميع الكويزات</p>
        </article>

        {/* 3. المعدل التراكمي */}
        <article className="hero-card hero-card-cumulative">
          <div className="hero-card-icon green">
            <Award size={18} />
          </div>
          <p className="hero-label">المعدل التراكمي</p>
          <p className="hero-value total-pct">
            {formatPct(stats.cumulativePercentage)}
          </p>
          <p className="hero-sub">النسبة المئوية الإجمالية</p>
        </article>

        {/* 4. معدل GPA من 4.0 — خالص لوحده */}
        <article className="hero-card hero-card-gpa-spotlight">
          <div className="hero-card-icon gold">
            <Sparkles size={18} />
          </div>
          <p className="hero-label">معدل GPA (من 4.0)</p>
          <div className="hero-gpa-standalone-box">
            <p className="hero-value gpa-standalone-val">
              {formatGpa4(gpa4)}
              <span className="gpa-out-of"> / 4.0</span>
            </p>
          </div>
        </article>

        {/* 5. التقدير الأكاديمي — في بوكس لوحده ومميز */}
        {gpaGrade && (
          <article className="hero-card hero-card-grade-standalone">
            <div className="hero-card-icon grade-icon">
              <span className="grade-icon-char">{GPA_DISPLAY[gpaGrade]}</span>
            </div>
            <p className="hero-label">التقدير الأكاديمي</p>
            <div className="hero-grade-box">
              <span className={`gpa-pill gpa-${gpaGrade} gpa-pill-hero-standalone`}>
                {GPA_DISPLAY[gpaGrade]}
              </span>
            </div>
            <p className="hero-sub">
              {gpaGrade === 'A'
                ? 'امتياز (Excellent)'
                : gpaGrade === 'B'
                  ? 'جيد جداً (Very Good)'
                  : gpaGrade === 'C'
                    ? 'جيد (Good)'
                    : gpaGrade === 'D'
                      ? 'مقبول (Pass)'
                      : 'راسب (Fail)'}
            </p>
          </article>
        )}
      </div>

      {/* ══ QUIZ SECTION ══ */}
      <article className="panel">
        <h2>
          <BookOpen size={16} aria-hidden />
          نتائج الكويزات
        </h2>
        {stats.quizResults.length === 0 ? (
          <EmptyState title="لا توجد درجات كويز لهذا الطالب" />
        ) : (
          <div className="assess-cards">
            {stats.quizResults.map((r) => {
              const idx = quizOrder.findIndex((a) => a.id === r.assessment.id);
              return (
                <QuizCard
                  key={r.assessment.id}
                  result={r}
                  shortLabel={shortAssessmentLabel(r.assessment, idx)}
                />
              );
            })}
          </div>
        )}
      </article>

      {/* ══ EXAM SECTION ══ */}
      <article className="panel">
        <h2>
          <FileCheck size={16} aria-hidden />
          الامتحان الشامل
        </h2>
        {stats.examResults.length === 0 ? (
          <EmptyState title="لا توجد درجة امتحان شامل لهذا الطالب" />
        ) : (
          <div className="assess-cards">
            {stats.examResults.map((r) => {
              const idx = examOrder.findIndex((a) => a.id === r.assessment.id);
              return (
                <ExamCard
                  key={r.assessment.id}
                  result={r}
                  shortLabel={shortAssessmentLabel(r.assessment, idx)}
                />
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}
