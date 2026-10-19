import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import {
  computeCumulative,
  formatPct,
  formatScore,
  percentageOf,
} from '../utils/calculations';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState } from '../components/ui/EmptyState';
import type { AssessmentType, Grade } from '../types';

type SortKey = 'student' | 'assessment' | 'percentage' | 'cumulative';

interface HistoryRow {
  key: string;
  studentId: string;
  studentName: string;
  assessmentId: string;
  assessmentTitle: string;
  type: AssessmentType;
  unitId: string;
  unitName: string;
  score: number | null;
  maxScore: number;
  status: Grade['status'];
  percentage: number | null;
  cumulative: number | null;
  rankAtTime: number | null;
}

export function AssessmentHistoryPage() {
  const { students, assessments, grades, units, settings } = useData();
  const availableUnits = units && units.length >= 4 ? units : [
    { id: 'unit-1', name: 'الوحدة الأولى', order: 1 },
    { id: 'unit-2', name: 'الوحدة الثانية', order: 2 },
    { id: 'unit-3', name: 'الوحدة الثالثة', order: 3 },
    { id: 'unit-4', name: 'الوحدة الرابعة', order: 4 },
  ];
  const [typeFilter, setTypeFilter] = useState<'all' | AssessmentType>('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('percentage');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const rows = useMemo(() => {
    const list: HistoryRow[] = [];

    for (const grade of grades) {
      const student = students.find((s) => s.id === grade.studentId);
      const assessment = assessments.find((a) => a.id === grade.assessmentId);
      if (!student || !assessment) continue;

      const unit = availableUnits.find((u) => u.id === assessment.unitId);
      const percentage =
        grade.status === 'scored' && grade.score !== null
          ? percentageOf(grade.score, assessment.maxScore)
          : null;
      const cumulative = computeCumulative(
        student.id,
        assessments,
        grades,
        settings,
        assessment.id,
      );

      // ترتيب وقت التقييم من الـ leaderboard الجزئي
      const partial = students
        .filter((s) => s.active)
        .map((s) => ({
          id: s.id,
          pct: computeCumulative(
            s.id,
            assessments,
            grades,
            settings,
            assessment.id,
          ),
        }))
        .filter((r) => r.pct !== null) as { id: string; pct: number }[];
      partial.sort((a, b) => b.pct - a.pct);
      let rankAtTime: number | null = null;
      let rank = 0;
      let prev: number | null = null;
      for (let i = 0; i < partial.length; i++) {
        if (prev === null || partial[i].pct !== prev) {
          rank = i + 1;
          prev = partial[i].pct;
        }
        if (partial[i].id === student.id) {
          rankAtTime = rank;
          break;
        }
      }

      list.push({
        key: grade.id,
        studentId: student.id,
        studentName: student.name,
        assessmentId: assessment.id,
        assessmentTitle: assessment.title,
        type: assessment.type,
        unitId: assessment.unitId,
        unitName: unit?.name ?? '',
        score: grade.score,
        maxScore: assessment.maxScore,
        status: grade.status,
        percentage,
        cumulative,
        rankAtTime,
      });
    }

    return list;
  }, [students, assessments, grades, units, settings]);

  const filtered = useMemo(() => {
    let list = rows;
    if (typeFilter !== 'all') list = list.filter((r) => r.type === typeFilter);
    if (unitFilter !== 'all') list = list.filter((r) => r.unitId === unitFilter);

    list = [...list].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'student') return a.studentName.localeCompare(b.studentName, 'ar') * dir;
      if (sortKey === 'assessment')
        return a.assessmentTitle.localeCompare(b.assessmentTitle, 'ar') * dir;
      if (sortKey === 'cumulative')
        return ((a.cumulative ?? -1) - (b.cumulative ?? -1)) * dir;
      return ((a.percentage ?? -1) - (b.percentage ?? -1)) * dir;
    });
    return list;
  }, [rows, typeFilter, unitFilter, sortKey, sortDir]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  };

  return (
    <section className="page">
      <header className="page-header">
        <h1>سجل التقييمات</h1>
        <p>كل درجات الكويزات والامتحان الشامل المسجّلة</p>
      </header>

      <div className="filters-bar">
        <label>
          النوع
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as 'all' | AssessmentType);
              setPage(1);
            }}
          >
            <option value="all">الكل</option>
            <option value="quiz">كويز</option>
            <option value="exam">امتحان شامل</option>
          </select>
        </label>
        <label>
          الوحدة
          <select
            value={unitFilter}
            onChange={(e) => {
              setUnitFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">الكل</option>
            {availableUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          ترتيب حسب
          <select
            value={sortKey}
            onChange={(e) => {
              setSortKey(e.target.value as SortKey);
              setPage(1);
            }}
          >
            <option value="percentage">النسبة</option>
            <option value="cumulative">التراكمي</option>
            <option value="student">اسم الطالب</option>
            <option value="assessment">التقييم</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="لا توجد نتائج مطابقة" />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="th-btn" onClick={() => toggleSort('student')}>
                      الطالب
                    </button>
                  </th>
                  <th>
                    <button type="button" className="th-btn" onClick={() => toggleSort('assessment')}>
                      التقييم
                    </button>
                  </th>
                  <th>النوع</th>
                  <th>الوحدة</th>
                  <th>الدرجة</th>
                  <th>
                    <button type="button" className="th-btn" onClick={() => toggleSort('percentage')}>
                      النسبة
                    </button>
                  </th>
                  <th>
                    <button type="button" className="th-btn" onClick={() => toggleSort('cumulative')}>
                      التراكمي بعدها
                    </button>
                  </th>
                  <th>الترتيب وقتها</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.key}>
                    <td>
                      <Link className="student-link" to={`/student/${r.studentId}`}>
                        {r.studentName}
                      </Link>
                    </td>
                    <td>{r.assessmentTitle}</td>
                    <td>{r.type === 'quiz' ? 'كويز' : 'شامل'}</td>
                    <td>{r.unitName}</td>
                    <td>{formatScore(r.score, r.maxScore, r.status)}</td>
                    <td>{formatPct(r.percentage)}</td>
                    <td>{formatPct(r.cumulative)}</td>
                    <td>{r.rankAtTime ? `#${r.rankAtTime}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}
