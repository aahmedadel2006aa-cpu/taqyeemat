import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import {
  assessments as seedAssessments,
  defaultCalcSettings,
  initialGrades,
  initialStudents,
  units as seedUnits,
} from '../data/mockData';
import type {
  Assessment,
  CalcSettings,
  Grade,
  LeaderboardEntry,
  Student,
  StudentStats,
  Unit,
} from '../types';
import { buildLeaderboard, buildStudentStats } from '../utils/calculations';
import {
  generateGradesTemplateCsv,
  parseGradesCsv,
  findStudentMatch,
} from '../utils/csvHelper';

export interface ImportCsvReport {
  totalRows: number;
  updatedCount: number;
  newStudentsCount: number;
  zeroFilledCount: number;
  newStudentNames: string[];
  warnings: string[];
}

interface DataContextValue {
  students: Student[];
  assessments: Assessment[];
  grades: Grade[];
  units: Unit[];
  settings: CalcSettings;
  leaderboard: LeaderboardEntry[];
  getStudentStats: (studentId: string) => StudentStats | null;
  addStudent: (student: Omit<Student, 'id'>) => string;
  updateStudent: (id: string, patch: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  addAssessment: (a: Omit<Assessment, 'id'>) => string;
  updateAssessment: (id: string, patch: Partial<Assessment>) => void;
  deleteAssessment: (id: string) => void;
  upsertGrade: (grade: Omit<Grade, 'id'> & { id?: string }) => void;
  deleteGrade: (id: string) => void;
  updateSettings: (patch: Partial<CalcSettings>) => void;
  importGrades: (rows: Grade[]) => void;
  importCsvGrades: (
    csvText: string,
    targetAssessmentId: string,
    options?: { autoZeroMissing?: boolean },
  ) => ImportCsvReport;
  fillZeroForMissingGrades: (assessmentId: string) => number;
  exportGradesCsv: () => string;
  exportTemplateCsv: (assessmentId: string) => string;
}

const DataContext = createContext<DataContextValue | null>(null);

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Consolidates duplicate student records created by previous faulty imports,
 * remapping duplicate IDs and preserving their highest scored grades.
 */
function deduplicateAndHeal(
  rawStudents: Student[],
  rawGrades: Grade[],
): { students: Student[]; grades: Grade[] } {
  const canonicalStudents: Student[] = [];
  const idRemap = new Map<string, string>();

  // Prioritize primary IDs over auto-generated timestamp IDs, and longer official names
  const sorted = [...rawStudents].sort((a, b) => {
    const aIsAuto = /s-\d{10,}/.test(a.id);
    const bIsAuto = /s-\d{10,}/.test(b.id);
    if (!aIsAuto && bIsAuto) return -1;
    if (aIsAuto && !bIsAuto) return 1;
    return b.name.length - a.name.length;
  });

  for (const st of sorted) {
    const existing = canonicalStudents.find((c) => {
      if (c.id === st.id) return true;
      return findStudentMatch(st.name, [c]) !== null;
    });

    if (existing) {
      idRemap.set(st.id, existing.id);
      if (!existing.phone && st.phone) existing.phone = st.phone;
      if (!existing.parentPhone && st.parentPhone) existing.parentPhone = st.parentPhone;
      if (!existing.gradeLevel && st.gradeLevel) existing.gradeLevel = st.gradeLevel;
    } else {
      canonicalStudents.push({ ...st });
    }
  }

  const healedGrades: Grade[] = [];
  for (const g of rawGrades) {
    const targetStudentId = idRemap.get(g.studentId) || g.studentId;
    const existingIdx = healedGrades.findIndex(
      (hg) => hg.studentId === targetStudentId && hg.assessmentId === g.assessmentId,
    );

    if (existingIdx >= 0) {
      const existing = healedGrades[existingIdx];
      const gScore = g.score ?? 0;
      const exScore = existing.score ?? 0;
      if (
        gScore > exScore ||
        (existing.status === 'absent' && g.status === 'scored')
      ) {
        healedGrades[existingIdx] = { ...existing, score: g.score, status: g.status };
      }
    } else {
      healedGrades.push({ ...g, studentId: targetStudentId });
    }
  }

  return { students: canonicalStudents, grades: healedGrades };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [initialData] = useState(() => {
    try {
      const savedStudents = localStorage.getItem('nextdev_students');
      const savedGrades = localStorage.getItem('nextdev_grades');
      const rawS: Student[] = savedStudents ? JSON.parse(savedStudents) : initialStudents;
      const rawG: Grade[] = savedGrades ? JSON.parse(savedGrades) : initialGrades;
      return deduplicateAndHeal(rawS, rawG);
    } catch {
      return { students: initialStudents, grades: initialGrades };
    }
  });

  const [students, setStudents] = useState<Student[]>(initialData.students);

  const [assessments, setAssessments] = useState<Assessment[]>(() => {
    try {
      const saved = localStorage.getItem('nextdev_assessments');
      return saved ? JSON.parse(saved) : seedAssessments;
    } catch {
      return seedAssessments;
    }
  });

  const [grades, setGrades] = useState<Grade[]>(initialData.grades);

  const [units] = useState<Unit[]>(() => {
    return seedUnits && seedUnits.length >= 4
      ? seedUnits
      : [
          { id: 'unit-1', name: 'الوحدة الأولى', order: 1 },
          { id: 'unit-2', name: 'الوحدة الثانية', order: 2 },
          { id: 'unit-3', name: 'الوحدة الثالثة', order: 3 },
          { id: 'unit-4', name: 'الوحدة الرابعة', order: 4 },
        ];
  });

  const [settings, setSettings] = useState<CalcSettings>(() => {
    try {
      const saved = localStorage.getItem('nextdev_settings');
      return saved ? JSON.parse(saved) : defaultCalcSettings;
    } catch {
      return defaultCalcSettings;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('nextdev_students', JSON.stringify(students));
    } catch { /* empty */ }
  }, [students]);

  useEffect(() => {
    try {
      localStorage.setItem('nextdev_assessments', JSON.stringify(assessments));
    } catch { /* empty */ }
  }, [assessments]);

  useEffect(() => {
    try {
      localStorage.setItem('nextdev_grades', JSON.stringify(grades));
    } catch { /* empty */ }
  }, [grades]);

  useEffect(() => {
    try {
      localStorage.setItem('nextdev_settings', JSON.stringify(settings));
    } catch { /* empty */ }
  }, [settings]);

  const leaderboard = useMemo(
    () => buildLeaderboard(students, assessments, grades, settings),
    [students, assessments, grades, settings],
  );

  const getStudentStats = useCallback(
    (studentId: string): StudentStats | null => {
      const student = students.find((s) => s.id === studentId);
      if (!student) return null;
      return buildStudentStats(
        student,
        students,
        assessments,
        grades,
        units,
        settings,
        leaderboard,
      );
    },
    [students, assessments, grades, units, settings, leaderboard],
  );

  const addStudent = useCallback(
    (student: Omit<Student, 'id'>) => {
      const newId = uid('s');
      setStudents((prev) => [...prev, { ...student, id: newId }]);
      // إسناد 0 في كافة التقييمات القائمة للطالب الجديد حتى لا تُحسب درجته بمفردها
      setGrades((prev) => {
        const zeros: Grade[] = assessments.map((a) => ({
          id: uid('g'),
          studentId: newId,
          assessmentId: a.id,
          score: 0,
          status: 'absent',
        }));
        return [...prev, ...zeros];
      });
      return newId;
    },
    [assessments],
  );

  const updateStudent = useCallback((id: string, patch: Partial<Student>) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  }, []);

  const deleteStudent = useCallback((id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
    setGrades((prev) => prev.filter((g) => g.studentId !== id));
  }, []);

  const addAssessment = useCallback((a: Omit<Assessment, 'id'>) => {
    const id = uid(a.type === 'quiz' ? 'quiz' : 'exam');
    setAssessments((prev) => [...prev, { ...a, id }]);
    return id;
  }, []);

  const updateAssessment = useCallback(
    (id: string, patch: Partial<Assessment>) => {
      setAssessments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      );
    },
    [],
  );

  const deleteAssessment = useCallback((id: string) => {
    setAssessments((prev) => prev.filter((a) => a.id !== id));
    setGrades((prev) => prev.filter((g) => g.assessmentId !== id));
  }, []);

  const upsertGrade = useCallback(
    (grade: Omit<Grade, 'id'> & { id?: string }) => {
      setGrades((prev) => {
        const existing = prev.find(
          (g) =>
            g.studentId === grade.studentId &&
            g.assessmentId === grade.assessmentId,
        );
        if (existing) {
          return prev.map((g) =>
            g.id === existing.id
              ? {
                  ...g,
                  score: grade.score,
                  status: grade.status,
                }
              : g,
          );
        }
        return [
          ...prev,
          {
            id: grade.id ?? uid('g'),
            studentId: grade.studentId,
            assessmentId: grade.assessmentId,
            score: grade.score,
            status: grade.status,
          },
        ];
      });
    },
    [],
  );

  const deleteGrade = useCallback((id: string) => {
    setGrades((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const updateSettings = useCallback((patch: Partial<CalcSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const importGrades = useCallback((rows: Grade[]) => {
    setGrades((prev) => {
      const next = [...prev];
      for (const row of rows) {
        const idx = next.findIndex(
          (g) =>
            g.studentId === row.studentId &&
            g.assessmentId === row.assessmentId,
        );
        if (idx >= 0) next[idx] = { ...next[idx], ...row, id: next[idx].id };
        else next.push({ ...row, id: row.id || uid('g') });
      }
      return next;
    });
  }, []);

  const fillZeroForMissingGrades = useCallback(
    (assessmentId: string) => {
      let count = 0;
      setGrades((prev) => {
        const next = [...prev];
        for (const student of students) {
          if (!student.active) continue;
          const idx = next.findIndex(
            (g) => g.studentId === student.id && g.assessmentId === assessmentId,
          );
          if (idx === -1) {
            next.push({
              id: uid('g'),
              studentId: student.id,
              assessmentId,
              score: 0,
              status: 'absent',
            });
            count++;
          } else if (
            next[idx].score === null ||
            (next[idx].status === 'absent' && next[idx].score === null)
          ) {
            next[idx] = {
              ...next[idx],
              score: 0,
              status: 'absent',
            };
            count++;
          }
        }
        return next;
      });
      return count;
    },
    [students],
  );

  const importCsvGrades = useCallback(
    (
      csvText: string,
      targetAssessmentId: string,
      options: { autoZeroMissing?: boolean } = { autoZeroMissing: true },
    ): ImportCsvReport => {
      const targetAssessment = assessments.find((a) => a.id === targetAssessmentId);
      if (!targetAssessment) {
        return {
          totalRows: 0,
          updatedCount: 0,
          newStudentsCount: 0,
          zeroFilledCount: 0,
          newStudentNames: [],
          warnings: ['لم يتم العثور على التقييم المحدد.'],
        };
      }

      const parsed = parseGradesCsv(csvText, targetAssessment, students);
      const report: ImportCsvReport = {
        totalRows: parsed.records.length,
        updatedCount: 0,
        newStudentsCount: 0,
        zeroFilledCount: 0,
        newStudentNames: [],
        warnings: [...parsed.warnings],
      };

      if (parsed.records.length === 0) {
        return report;
      }

      const touchedStudentIds = new Set<string>();
      const nextStudents = [...students];
      const nextGrades = [...grades];

      for (const rec of parsed.records) {
        let student = rec.student;

        // إذا كان طالباً جديداً: إنشاؤه وإسناد 0 في كافة التقييمات الأخرى
        if (!student) {
          const newId = uid('s');
          student = {
            id: newId,
            name: rec.rawIdentifier,
            shortName: rec.rawIdentifier,
            gradeLevel: '',
            phone: '',
            parentPhone: '',
            active: true,
            notes: '',
          };
          nextStudents.push(student);
          report.newStudentsCount++;
          report.newStudentNames.push(student.name);

          // إسناد 0 في جميع التقييمات القائمة الأخرى للطالب الجديد
          for (const other of assessments) {
            if (other.id !== targetAssessment.id) {
              const existingOtherIdx = nextGrades.findIndex(
                (g) => g.studentId === newId && g.assessmentId === other.id,
              );
              if (existingOtherIdx >= 0) {
                nextGrades[existingOtherIdx] = {
                  ...nextGrades[existingOtherIdx],
                  score: 0,
                  status: 'absent',
                };
              } else {
                nextGrades.push({
                  id: uid('g'),
                  studentId: newId,
                  assessmentId: other.id,
                  score: 0,
                  status: 'absent',
                });
              }
            }
          }
        }

        touchedStudentIds.add(student.id);

        const aId = rec.assessmentId || targetAssessment.id;
        const gIdx = nextGrades.findIndex(
          (g) => g.studentId === student!.id && g.assessmentId === aId,
        );

        if (gIdx >= 0) {
          nextGrades[gIdx] = {
            ...nextGrades[gIdx],
            score: rec.score,
            status: rec.status,
          };
        } else {
          nextGrades.push({
            id: uid('g'),
            studentId: student.id,
            assessmentId: aId,
            score: rec.score,
            status: rec.status,
          });
        }
        report.updatedCount++;
      }

      // أي طالب مسجل لم ترد له درجة في الملف المرفوع: يُسند له 0
      if (options.autoZeroMissing !== false) {
        for (const st of nextStudents) {
          if (!st.active) continue;
          if (!touchedStudentIds.has(st.id)) {
            const gIdx = nextGrades.findIndex(
              (g) => g.studentId === st.id && g.assessmentId === targetAssessment.id,
            );
            if (gIdx >= 0) {
              nextGrades[gIdx] = {
                ...nextGrades[gIdx],
                score: 0,
                status: 'absent',
              };
            } else {
              nextGrades.push({
                id: uid('g'),
                studentId: st.id,
                assessmentId: targetAssessment.id,
                score: 0,
                status: 'absent',
              });
            }
            report.zeroFilledCount++;
          }
        }
      }

      const healed = deduplicateAndHeal(nextStudents, nextGrades);
      setStudents(healed.students);
      setGrades(healed.grades);

      return report;
    },
    [assessments, students, grades],
  );

  const exportGradesCsv = useCallback(() => {
    const header = 'studentId,studentName,assessmentId,score,status';
    const lines = grades.map((g) => {
      const name = students.find((s) => s.id === g.studentId)?.name ?? '';
      return `${g.studentId},"${name}",${g.assessmentId},${g.score ?? ''},${g.status}`;
    });
    return `\uFEFF${[header, ...lines].join('\n')}`;
  }, [grades, students]);

  const exportTemplateCsv = useCallback(
    (assessmentId: string) => {
      const assessment =
        assessments.find((a) => a.id === assessmentId) ?? assessments[0];
      if (!assessment) return '';
      return generateGradesTemplateCsv(students, assessment);
    },
    [assessments, students],
  );

  const value = useMemo(
    () => ({
      students,
      assessments,
      grades,
      units,
      settings,
      leaderboard,
      getStudentStats,
      addStudent,
      updateStudent,
      deleteStudent,
      addAssessment,
      updateAssessment,
      deleteAssessment,
      upsertGrade,
      deleteGrade,
      updateSettings,
      importGrades,
      importCsvGrades,
      fillZeroForMissingGrades,
      exportGradesCsv,
      exportTemplateCsv,
    }),
    [
      students,
      assessments,
      grades,
      units,
      settings,
      leaderboard,
      getStudentStats,
      addStudent,
      updateStudent,
      deleteStudent,
      addAssessment,
      updateAssessment,
      deleteAssessment,
      upsertGrade,
      deleteGrade,
      updateSettings,
      importGrades,
      importCsvGrades,
      fillZeroForMissingGrades,
      exportGradesCsv,
      exportTemplateCsv,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
