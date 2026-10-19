import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Crown,
  Medal,
  Award,
  ArrowUpRight,
  Flame,
  Terminal,
  Sparkles,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import {
  formatPct,
  getGpaGrade,
  GPA_DISPLAY,
  calculateGpa4,
  formatGpa4,
} from '../utils/calculations';
import { EmptyState } from '../components/ui/EmptyState';
import type { LeaderboardEntry } from '../types';

/* ── شارات الترتيب مع لوجو ملون ومتحرك لأول 3 مراكز (زمردي، بنفسجي، ياقوتي) ──── */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="rank-badge-pill rank-badge-first" title="المركز الأول">
        <Crown size={17} className="rank-floating-icon-1" aria-hidden />
        <span className="rank-num">1</span>
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="rank-badge-pill rank-badge-second" title="المركز الثاني">
        <Medal size={16} className="rank-floating-icon-2" aria-hidden />
        <span className="rank-num">2</span>
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="rank-badge-pill rank-badge-third" title="المركز الثالث">
        <Flame size={16} className="rank-floating-icon-3" aria-hidden />
        <span className="rank-num">3</span>
      </span>
    );
  }
  return (
    <span className="rank-badge-pill rank-normal">
      <span className="rank-num">{rank}</span>
    </span>
  );
}

/* ── محتوى كارت المنصة الموحد ─────────────────────────── */
function PodiumCardContent({
  entry,
  role,
  rankDisplay,
  title,
  icon: Icon,
}: {
  entry: LeaderboardEntry;
  role: 'first' | 'second' | 'third';
  rankDisplay: number;
  title: string;
  icon: typeof Crown;
}) {
  const grade = getGpaGrade(entry.cumulativePercentage);
  const gpa4 = calculateGpa4(entry.cumulativePercentage);

  return (
    <>
      {/* شريط البريق والإضاءة المتوهجة */}
      <div className="podium-shimmer-bar" />
      <div className="podium-glow-aura" />

      {/* رأس الكارت: المركز والشعار الملون */}
      <div className="podium-rank-header">
        <div className="podium-rank-badge">
          <Icon size={18} className="podium-icon" />
          <span className="podium-role-title">{title}</span>
        </div>
        <div className="podium-rank-number-box">
          <span className="rank-hash">#</span>
          <span className="rank-digit">{rankDisplay}</span>
        </div>
      </div>

      {/* اسم الطالب وأفـاتاره + الـ GPA من 4 والتقدير بجانبه مباشرة */}
      <div className="podium-student-box">
        <div className="podium-avatar-wrapper">
          <div className="podium-avatar">
            {entry.student.name.trim().charAt(0) || 'ط'}
          </div>
          {role === 'first' && (
            <span className="avatar-crown-floating" title="الأول">
              👑
            </span>
          )}
          {role === 'second' && (
            <span className="avatar-crown-floating" title="الثاني">
              🥈
            </span>
          )}
          {role === 'third' && (
            <span className="avatar-crown-floating" title="الثالث">
              🥉
            </span>
          )}
        </div>

        <div className="podium-info">
          <h3 className="podium-student-name" title={entry.student.name}>
            {entry.student.name}
          </h3>
        </div>
      </div>

      {/* الإحصائيات: فصل تام إلى 3 أقسام (المعدل / الـ GPA / التقدير) */}
      <div className="podium-metrics-row">
        <div className="podium-metric-item metric-pct">
          <span className="podium-metric-label">المعدل</span>
          <strong className="podium-metric-value">
            {formatPct(entry.cumulativePercentage)}
          </strong>
        </div>

        <div className="podium-metric-divider" />

        <div className="podium-metric-item metric-gpa">
          <span className="podium-metric-label">GPA</span>
          <strong className="podium-gpa-score">{formatGpa4(gpa4)}</strong>
        </div>

        <div className="podium-metric-divider" />

        <div className="podium-metric-item metric-grade">
          <span className="podium-metric-label">التقدير</span>
          <div className="podium-grade-badge-wrap">
            {grade ? (
              <span className={`gpa-pill gpa-${grade}`}>
                {GPA_DISPLAY[grade]}
              </span>
            ) : (
              <span className="text-muted">—</span>
            )}
          </div>
        </div>
      </div>

      {/* ذيل الكارت */}
      <div className="podium-card-footer">
        <span className="footer-link-text">عرض الملف الأكاديمي</span>
        <div className="podium-arrow-circle">
          <ArrowUpRight size={14} className="podium-arrow" />
        </div>
      </div>
    </>
  );
}

interface PodiumCardItem {
  entry: LeaderboardEntry;
  role: 'first' | 'second' | 'third';
  rankDisplay: number;
  title: string;
  icon: typeof Crown;
  delayClass: string;
}

/* ── سكشن THE BEST (عرض كروت المراكز الأولى جنباً إلى جنب مع دعم التعادل) ─ */
function PodiumShowcase({
  cards,
  isAnimated,
}: {
  cards: PodiumCardItem[];
  isAnimated: boolean;
}) {
  if (!cards || cards.length === 0) {
    return null;
  }

  const colClass =
    cards.length === 1
      ? 'grid-cols-1'
      : cards.length === 2
        ? 'grid-cols-2'
        : cards.length === 3
          ? 'grid-cols-3'
          : cards.length === 4
            ? 'grid-cols-4'
            : 'grid-cols-5';

  return (
    <div className={`podium-section the-best-section ${isAnimated ? 'is-animated' : ''}`}>
      {/* ترويسة THE BEST في المنتصف مع تصميم فخم وأنيميشن تفاعلي */}
      <div className="the-best-header-center">
        <div className="the-best-grand-badge" tabIndex={0} role="region" aria-label="قسم The Best">
          <div className="the-best-glow-aura" />
          <Flame size={24} className="the-best-flame-epic" />
          <span className="the-best-grand-title">THE BEST</span>
          <Sparkles size={18} className="the-best-sparkle-epic" />
        </div>
      </div>

      <div className={`podium-grid ${colClass}`}>
        {cards.map(({ entry, role, rankDisplay, title, icon: Icon, delayClass }) => (
          <Link
            key={entry.student.id}
            to={`/student/${entry.student.id}`}
            className={`podium-card podium-${role} ${delayClass}`}
          >
            <PodiumCardContent
              entry={entry}
              role={role}
              rankDisplay={rankDisplay}
              title={title}
              icon={Icon}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function HomePage() {
  const { leaderboard } = useData();
  const navigate = useNavigate();
  const [isLoaded, setIsLoaded] = useState(false);

  // تفعيل أنيميشن التتالي المتتابع
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 40);
    return () => clearTimeout(timer);
  }, []);

  // الطلاب الذين لديهم درجات مسجلة بالفعل
  const scoredEntries = leaderboard.filter(
    (e) => e.hasGrades !== false && e.cumulativePercentage > 0,
  );

  // استخراج الطلاب في المراكز الثلاثة الأولى بناءً على أعلى 3 نسب متميزة
  const distinctPcts = Array.from(
    new Set(scoredEntries.map((e) => e.cumulativePercentage)),
  ).sort((a, b) => b - a);

  const pct1 = distinctPcts[0];
  const pct2 = distinctPcts[1];
  const pct3 = distinctPcts[2];

  const tier1Entries =
    pct1 !== undefined
      ? scoredEntries.filter((e) => e.cumulativePercentage === pct1)
      : [];
  const tier2Entries =
    pct2 !== undefined
      ? scoredEntries.filter((e) => e.cumulativePercentage === pct2)
      : [];
  const tier3Entries =
    pct3 !== undefined
      ? scoredEntries.filter((e) => e.cumulativePercentage === pct3)
      : [];

  // تجهيز كروت المراكز الأولى مع دعم التعادل الكامل
  const tier1Cards: PodiumCardItem[] = tier1Entries.map((entry, idx) => ({
    entry,
    role: 'first',
    rankDisplay: 1,
    title: 'المركز الأول',
    icon: Crown,
    delayClass: idx === 0 ? 'podium-delay-1' : 'podium-delay-2',
  }));

  const tier2Cards: PodiumCardItem[] = tier2Entries.map((entry, idx) => ({
    entry,
    role: 'second',
    rankDisplay: entry.rank,
    title: 'المركز الثاني',
    icon: Medal,
    delayClass: idx === 0 ? 'podium-delay-2' : 'podium-delay-3',
  }));

  const tier3Cards: PodiumCardItem[] = tier3Entries.map((entry) => ({
    entry,
    role: 'third',
    rankDisplay: entry.rank,
    title: 'المركز الثالث',
    icon: Award,
    delayClass: 'podium-delay-3',
  }));

  // في واجهة RTL (من اليمين إلى اليسار):
  // العنصر الأول في الشبكة يُعرض على اليمين (المركز الثاني)
  // والعناصر في المنتصف تُعرض في المركز (المركز الأول - سواء طالب واحد أو طالبان متعادلان)
  // والعنصر الأخير يُعرض على اليسار (المركز الثالث)
  const podiumCards: PodiumCardItem[] =
    tier2Cards.length > 0 && tier1Cards.length > 0
      ? [...tier2Cards, ...tier1Cards, ...tier3Cards]
      : [...tier1Cards, ...tier2Cards, ...tier3Cards];

  return (
    <section className={`page home-page ${isLoaded ? 'page-ready' : 'page-enter'}`}>
      {leaderboard.length === 0 ? (
        <EmptyState
          title="لا توجد نتائج بعد"
          description="أضف درجات للطلاب لعرض الترتيب."
        />
      ) : (
        <>
          {/* سكشن THE BEST جنباً إلى جنب مع دعم التعادل الكامل */}
          <PodiumShowcase
            cards={podiumCards}
            isAnimated={isLoaded}
          />

          {/* جدول ساحة Dev Arena مع اللمعان وفصل الـ GPA في صف مستقل */}
          <div className="table-wrap leaderboard-wrap dev-arena-wrap">
            <div className="table-section-title dev-arena-title-bar">
              <div className="table-title-right">
                <div className="dev-arena-logo-box">
                  <Terminal size={19} className="arena-terminal-icon" />
                </div>
              </div>
            </div>

            <table className="data-table leaderboard-table">
              <thead>
                <tr>
                  <th scope="col" className="col-rank">الترتيب</th>
                  <th scope="col" className="col-student">الاسم</th>
                  <th scope="col" className="col-pct">المعدل التراكمي</th>
                  <th scope="col" className="col-gpa-num">GPA (من 4.0)</th>
                  <th scope="col" className="col-gpa">التقدير</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, idx) => {
                  const grade = getGpaGrade(entry.cumulativePercentage);
                  const gpa4 = calculateGpa4(entry.cumulativePercentage);
                  const topClass =
                    idx === 0
                      ? 'top-row-first'
                      : idx === 1
                        ? 'top-row-second'
                        : idx === 2
                          ? 'top-row-third'
                          : '';

                  return (
                    <tr
                      key={entry.student.id}
                      className={topClass}
                      onClick={() => navigate(`/student/${entry.student.id}`)}
                      style={{
                        animationDelay: isLoaded ? `${(0.95 + Math.min(idx * 0.05, 1.5)).toFixed(3)}s` : '0s',
                        cursor: 'pointer',
                      }}
                    >
                      <td className="col-rank">
                        <RankBadge rank={entry.rank} />
                      </td>
                      <td className="col-student">
                        <Link
                          className="student-clean-link"
                          to={`/student/${entry.student.id}`}
                        >
                          <span className="student-name-text">
                            {entry.student.name}
                          </span>
                          {entry.isTied && (
                            <span className="tie-tag-pill" title="تعادل في المركز">
                              مكرر
                            </span>
                          )}
                          <ArrowUpRight size={15} className="student-hover-arrow" />
                        </Link>
                      </td>
                      <td className="col-pct">
                        <div className="pct-cell-wrapper">
                          {entry.hasGrades !== false ? (
                            <span className="pct-value-badge">
                              {formatPct(entry.cumulativePercentage)}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </div>
                      </td>
                      <td className="col-gpa-num">
                        <div className="gpa-num-cell-wrapper">
                          {entry.hasGrades !== false && gpa4 !== null ? (
                            <span className="gpa-numeric-badge">
                              {formatGpa4(gpa4)}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </div>
                      </td>
                      <td className="col-gpa">
                        <div className="gpa-cell-wrapper">
                          {entry.hasGrades !== false && grade ? (
                            <span className={`gpa-pill gpa-${grade}`}>
                              {GPA_DISPLAY[grade]}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
