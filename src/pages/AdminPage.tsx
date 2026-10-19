import { useMemo, useState, useRef } from 'react';
import { useData, type ImportCsvReport } from '../context/DataContext';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Pagination } from '../components/ui/Pagination';
import { formatPct, formatScore, percentageOf } from '../utils/calculations';
import type { Assessment, AssessmentType, Student, Unit } from '../types';

type Tab = 'students' | 'assessments' | 'grades' | 'settings';

export const DEFAULT_UNITS: Unit[] = [
  { id: 'unit-1', name: 'الوحدة الأولى', order: 1 },
  { id: 'unit-2', name: 'الوحدة الثانية', order: 2 },
  { id: 'unit-3', name: 'الوحدة الثالثة', order: 3 },
  { id: 'unit-4', name: 'الوحدة الرابعة', order: 4 },
];

const emptyStudent: Omit<Student, 'id'> = {
  name: '',
  shortName: '',
  gradeLevel: '',
  phone: '',
  parentPhone: '',
  active: true,
  notes: '',
};

export function AdminPage() {
  const {
    students,
    assessments,
    grades,
    units,
    settings,
    addStudent,
    updateStudent,
    deleteStudent,
    addAssessment,
    updateAssessment,
    deleteAssessment,
    upsertGrade,
    updateSettings,
    importCsvGrades,
    fillZeroForMissingGrades,
    exportGradesCsv,
    exportTemplateCsv,
  } = useData();

  const availableUnits = units && units.length >= 4 ? units : DEFAULT_UNITS;

  const [tab, setTab] = useState<Tab>('students');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState(emptyStudent);
  const [assessmentForm, setAssessmentForm] = useState({
    title: '',
    type: 'quiz' as AssessmentType,
    unitId: units[0]?.id ?? 'unit-1',
    maxScore: 20,
    date: '',
  });
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(
    null,
  );
  const [selectedAssessment, setSelectedAssessment] = useState(
    assessments[0]?.id ?? '',
  );
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [importResult, setImportResult] = useState<ImportCsvReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pageSize = 10;

  const filteredStudents = useMemo(() => {
    const q = query.trim();
    if (!q) return students;
    return students.filter(
      (s) => s.name.includes(q) || s.shortName.includes(q) || s.phone.includes(q),
    );
  }, [students, query]);

  const studentPage = filteredStudents.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  const selected = assessments.find((a) => a.id === selectedAssessment) ?? assessments[0];

  const gradeRows = useMemo(() => {
    if (!selected) return [];
    return students.map((student) => {
      const grade = grades.find(
        (g) => g.studentId === student.id && g.assessmentId === selected.id,
      );
      return { student, grade };
    });
  }, [students, grades, selected]);

  const resetStudentForm = () => {
    setEditing(null);
    setForm(emptyStudent);
  };

  const submitStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (editing) {
      updateStudent(editing.id, form);
    } else {
      addStudent({
        ...form,
        shortName: form.shortName || form.name,
      });
    }
    resetStudentForm();
  };

  const submitAssessment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessmentForm.title.trim()) return;
    if (editingAssessment) {
      updateAssessment(editingAssessment.id, assessmentForm);
      setEditingAssessment(null);
    } else {
      const id = addAssessment(assessmentForm);
      setSelectedAssessment(id);
    }
    setAssessmentForm({
      title: '',
      type: 'quiz',
      unitId: units[0]?.id ?? 'unit-1',
      maxScore: 20,
      date: '',
    });
  };

  const downloadCsv = () => {
    const csv = exportGradesCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'grades.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => {
    if (!selected) return;
    const csv = exportTemplateCsv(selected.id);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `نموذج_درجات_${selected.title.replace(/[\s—-]+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const report = importCsvGrades(text, selected?.id ?? selectedAssessment, {
        autoZeroMissing: true,
      });
      setImportResult(report);
    } catch (err: unknown) {
      setImportResult({
        totalRows: 0,
        updatedCount: 0,
        newStudentsCount: 0,
        zeroFilledCount: 0,
        newStudentNames: [],
        warnings: [(err as Error).message || 'حدث خطأ أثناء معالجة ملف CSV.'],
      });
    } finally {
      // إعادة تعيين قيمة input حتى يمكن رفع نفس الملف مرة أخرى عند التعديل عليه
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      e.target.value = '';
    }
  };

  const handleZeroFillMissing = () => {
    if (!selected) return;
    setConfirm({
      title: 'إسناد صفر للطلاب غير المسجلين',
      message: `هل تريد إسناد درجة 0 لجميع الطلاب الذين لم تُسجل لهم درجة في تقييم "${selected.title}"؟`,
      onConfirm: () => {
        const count = fillZeroForMissingGrades(selected.id);
        setConfirm(null);
        setImportResult({
          totalRows: count,
          updatedCount: 0,
          newStudentsCount: 0,
          zeroFilledCount: count,
          newStudentNames: [],
          warnings: [`تم إسناد درجة 0 بنجاح لـ ${count} طالب لم تكن لهم درجة.`],
        });
      },
    });
  };

  return (
    <section className="page admin-page">
      <header className="page-header">
        <h1>لوحة الإدارة</h1>
        <p>إدارة الطلاب والتقييمات والدرجات (بيانات محلية في المتصفح فقط)</p>
      </header>

      <div className="tabs" role="tablist">
        {(
          [
            ['students', 'الطلاب'],
            ['assessments', 'التقييمات'],
            ['grades', 'الدرجات'],
            ['settings', 'إعدادات الحساب'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={`tab ${tab === id ? 'active' : ''}`}
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'students' ? (
        <div className="admin-section">
          <div className="toolbar">
            <input
              className="search-input"
              placeholder="بحث بالاسم أو الهاتف..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <form className="form-card" onSubmit={submitStudent}>
            <h2>{editing ? 'تعديل طالب' : 'إضافة طالب'}</h2>
            <div className="form-grid">
              <label>
                الاسم الكامل
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                الاسم المختصر
                <input
                  value={form.shortName}
                  onChange={(e) =>
                    setForm({ ...form, shortName: e.target.value })
                  }
                />
              </label>
              <label>
                المستوى / المجموعة
                <input
                  value={form.gradeLevel}
                  onChange={(e) =>
                    setForm({ ...form, gradeLevel: e.target.value })
                  }
                />
              </label>
              <label>
                هاتف الطالب
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label>
                هاتف ولي الأمر
                <input
                  value={form.parentPhone}
                  onChange={(e) =>
                    setForm({ ...form, parentPhone: e.target.value })
                  }
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm({ ...form, active: e.target.checked })
                  }
                />
                نشط في الترتيب
              </label>
            </div>
            <div className="form-actions">
              {editing ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={resetStudentForm}
                >
                  إلغاء
                </button>
              ) : null}
              <button type="submit" className="btn btn-primary">
                {editing ? 'حفظ التعديل' : 'إضافة'}
              </button>
            </div>
          </form>

          {studentPage.length === 0 ? (
            <EmptyState title="لا يوجد طلاب" />
          ) : (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>الاسم</th>
                      <th>المجموعة</th>
                      <th>الهاتف</th>
                      <th>الحالة</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentPage.map((s) => (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td>{s.gradeLevel || '—'}</td>
                        <td className="ltr">{s.phone || '—'}</td>
                        <td>{s.active ? 'نشط' : s.notes || 'غير نشط'}</td>
                        <td className="actions-cell">
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => {
                              setEditing(s);
                              setForm({
                                name: s.name,
                                shortName: s.shortName,
                                gradeLevel: s.gradeLevel,
                                phone: s.phone,
                                parentPhone: s.parentPhone,
                                active: s.active,
                                notes: s.notes ?? '',
                              });
                            }}
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() =>
                              setConfirm({
                                title: 'حذف الطالب',
                                message: `هل تريد حذف ${s.name} وجميع درجاته؟`,
                                onConfirm: () => {
                                  deleteStudent(s.id);
                                  setConfirm(null);
                                },
                              })
                            }
                          >
                            حذف
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                pageSize={pageSize}
                total={filteredStudents.length}
                onChange={setPage}
              />
            </>
          )}
        </div>
      ) : null}

      {tab === 'assessments' ? (
        <div className="admin-section">
          <form className="form-card" onSubmit={submitAssessment}>
            <h2>{editingAssessment ? 'تعديل تقييم' : 'إنشاء تقييم'}</h2>
            <div className="form-grid">
              <label>
                العنوان
                <input
                  required
                  value={assessmentForm.title}
                  onChange={(e) =>
                    setAssessmentForm({
                      ...assessmentForm,
                      title: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                النوع
                <select
                  value={assessmentForm.type}
                  onChange={(e) =>
                    setAssessmentForm({
                      ...assessmentForm,
                      type: e.target.value as AssessmentType,
                    })
                  }
                >
                  <option value="quiz">كويز</option>
                  <option value="exam">امتحان شامل</option>
                </select>
              </label>
              <label>
                الوحدة
                <select
                  value={assessmentForm.unitId}
                  onChange={(e) =>
                    setAssessmentForm({
                      ...assessmentForm,
                      unitId: e.target.value,
                    })
                  }
                >
                  {availableUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                الدرجة النهائية
                <input
                  type="number"
                  min={1}
                  step={0.5}
                  required
                  value={assessmentForm.maxScore}
                  onChange={(e) =>
                    setAssessmentForm({
                      ...assessmentForm,
                      maxScore: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <div className="form-actions">
              {editingAssessment ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setEditingAssessment(null);
                    setAssessmentForm({
                      title: '',
                      type: 'quiz',
                      unitId: units[0]?.id ?? 'unit-1',
                      maxScore: 20,
                      date: '',
                    });
                  }}
                >
                  إلغاء
                </button>
              ) : null}
              <button type="submit" className="btn btn-primary">
                {editingAssessment ? 'حفظ' : 'إنشاء'}
              </button>
            </div>
          </form>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>العنوان</th>
                  <th>النوع</th>
                  <th>الوحدة</th>
                  <th>النهاية</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.title}</td>
                    <td>{a.type === 'quiz' ? 'كويز' : 'شامل'}</td>
                    <td>
                      {availableUnits.find((u) => u.id === a.unitId)?.name ?? a.unitId}
                    </td>
                    <td>{a.maxScore}</td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          setEditingAssessment(a);
                          setAssessmentForm({
                            title: a.title,
                            type: a.type,
                            unitId: a.unitId,
                            maxScore: a.maxScore,
                            date: a.date,
                          });
                        }}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() =>
                          setConfirm({
                            title: 'حذف التقييم',
                            message: `حذف ${a.title} وكل درجاته؟`,
                            onConfirm: () => {
                              deleteAssessment(a.id);
                              if (selectedAssessment === a.id) {
                                const remaining = assessments.filter((x) => x.id !== a.id);
                                setSelectedAssessment(remaining[0]?.id ?? '');
                              }
                              setConfirm(null);
                            },
                          })
                        }
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'grades' ? (
        <div className="admin-section">
          <div className="toolbar wrap">
            <label>
              اختر التقييم
              <select
                value={selectedAssessment}
                onChange={(e) => setSelectedAssessment(e.target.value)}
              >
                {assessments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="toolbar-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={downloadTemplate}
                title="تحميل ملف CSV يحتوي على جميع أسماء الطلاب لتعبئة درجاتهم في Excel"
              >
                تحميل نموذج CSV
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleZeroFillMissing}
                title="إسناد درجة صفر لجميع الطلاب الذين لم تُسجل لهم درجات في هذا التقييم"
              >
                إسناد 0 للغائبين
              </button>
              <button type="button" className="btn btn-ghost" onClick={downloadCsv}>
                تصدير الكل CSV
              </button>
              <label
                className="btn btn-primary file-btn"
                title="رفع ملف CSV من اللاب لإضافة وتحديث درجات الطلاب فوراً"
              >
                رفع درجات من اللاب (CSV)
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  hidden
                  onChange={handleImport}
                />
              </label>
            </div>
          </div>

          {!selected ? (
            <EmptyState title="لا يوجد تقييم محدد" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>الطالب</th>
                    <th>الدرجة / {selected.maxScore}</th>
                    <th>الحالة</th>
                    <th>النسبة</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeRows.map(({ student, grade }) => {
                    const score = grade?.score ?? '';
                    const status = grade?.status ?? 'scored';
                    return (
                      <tr key={student.id}>
                        <td>{student.name}</td>
                        <td>
                          <input
                            className="grade-input"
                            type="number"
                            min={0}
                            max={selected.maxScore}
                            step={0.5}
                            value={score}
                            disabled={status !== 'scored'}
                            onChange={(e) => {
                              const val =
                                e.target.value === ''
                                  ? null
                                  : Number(e.target.value);
                              upsertGrade({
                                studentId: student.id,
                                assessmentId: selected.id,
                                score: val,
                                status: 'scored',
                              });
                            }}
                          />
                        </td>
                        <td>
                          <select
                            value={status}
                            onChange={(e) => {
                              const next = e.target.value as
                                | 'scored'
                                | 'absent'
                                | 'excused';
                              upsertGrade({
                                studentId: student.id,
                                assessmentId: selected.id,
                                score: next === 'scored' ? grade?.score ?? 0 : null,
                                status: next,
                              });
                            }}
                          >
                            <option value="scored">درجة</option>
                            <option value="absent">غائب</option>
                            <option value="excused">لن يحضر</option>
                          </select>
                        </td>
                        <td>
                          {grade?.status === 'scored' && grade.score !== null
                            ? formatPct(
                                percentageOf(grade.score, selected.maxScore),
                              )
                            : formatScore(
                                grade?.score ?? null,
                                selected.maxScore,
                                grade?.status ?? 'absent',
                              )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === 'settings' ? (
        <div className="admin-section">
          <form
            className="form-card"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <h2>طريقة حساب النسبة التراكمية</h2>
            <div className="form-grid">
              <label>
                الطريقة
                <select
                  value={settings.method}
                  onChange={(e) =>
                    updateSettings({
                      method: e.target.value as typeof settings.method,
                    })
                  }
                >
                  <option value="total_points">مجموع الدرجات / المجموع الكلي</option>
                  <option value="average_percentage">متوسط النسب</option>
                  <option value="weighted">موزون (كويز / شامل)</option>
                </select>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.includeQuizzes}
                  onChange={(e) =>
                    updateSettings({ includeQuizzes: e.target.checked })
                  }
                />
                تضمين الكويزات
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.includeExams}
                  onChange={(e) =>
                    updateSettings({ includeExams: e.target.checked })
                  }
                />
                تضمين الامتحان الشامل
              </label>
              <label>
                وزن الكويزات
                <input
                  type="number"
                  min={0}
                  value={settings.quizWeight}
                  disabled={settings.method !== 'weighted'}
                  onChange={(e) =>
                    updateSettings({ quizWeight: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                وزن الشامل
                <input
                  type="number"
                  min={0}
                  value={settings.examWeight}
                  disabled={settings.method !== 'weighted'}
                  onChange={(e) =>
                    updateSettings({ examWeight: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <p className="hint">
              أي تعديل هنا يحدّث الترتيب وتمييز المراكز الثلاثة الأولى فورًا.
            </p>
          </form>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.onConfirm()}
      />

      {importResult ? (
        <div className="modal-backdrop" onClick={() => setImportResult(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h2>نتيجة استيراد الدرجات من الملف</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', margin: '1rem 0' }}>
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  background: 'rgba(34, 197, 94, 0.15)',
                  color: '#4ade80',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                }}
              >
                ✓ تم تحديث درجات <strong>{importResult.updatedCount}</strong> طالب بنجاح
              </div>

              {importResult.newStudentsCount > 0 && (
                <div
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#60a5fa',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                  }}
                >
                  + تم إضافة <strong>{importResult.newStudentsCount}</strong> طالب جديد تلقائياً وإسناد 0 لهم في باقي التقييمات:
                  <div style={{ fontSize: '0.85rem', marginTop: '0.35rem', opacity: 0.9 }}>
                    ({importResult.newStudentNames.slice(0, 6).join('، ')}
                    {importResult.newStudentNames.length > 6 ? '...' : ''})
                  </div>
                </div>
              )}

              {importResult.zeroFilledCount > 0 && (
                <div
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    background: 'rgba(234, 179, 8, 0.15)',
                    color: '#facc15',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                  }}
                >
                  ⭕ تم إسناد درجة 0 تلقائياً لـ <strong>{importResult.zeroFilledCount}</strong> طالب لم تكن لهم درجة في هذا التقييم
                </div>
              )}

              {importResult.warnings.length > 0 && (
                <div
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>ملاحظات:</div>
                  <ul style={{ margin: 0, paddingRight: '1.2rem', fontSize: '0.85rem' }}>
                    {importResult.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setImportResult(null)}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
