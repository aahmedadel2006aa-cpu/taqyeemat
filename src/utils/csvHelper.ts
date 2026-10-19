import type { Assessment, Grade, Student } from '../types';

/**
 * Normalizes Arabic text for flexible matching:
 * - Removes diacritics / tashkeel
 * - Removes tatweel (ـ)
 * - Normalizes alef forms (أ, إ, آ, ٱ -> ا)
 * - Normalizes taa marbouta (ة -> ه)
 * - Normalizes yaa (ى -> ي)
 * - Normalizes hamza on waw / yaa (ؤ -> و, ئ -> ي)
 * - Strips extra whitespace
 */
export function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    // Strip invisible characters, BOM, LTR/RTL marks, zero-width spaces, non-breaking spaces
    .replace(/[\u200B-\u200F\uFEFF\u00A0\u202A-\u202E\u2060-\u206F]/g, ' ')
    // Tashkeel / diacritics
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Tatweel
    .replace(/\u0640/g, '')
    // Alef forms (أ, إ, آ, ٱ -> ا)
    .replace(/[أإآٱ]/g, 'ا')
    // Taa marbouta (ة -> ه)
    .replace(/ة/g, 'ه')
    // Yaa / Alef maksura (ى -> ي)
    .replace(/ى/g, 'ي')
    // Hamza forms (ؤ -> و, ئ -> ي)
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    // Common spelling variants
    .replace(/عبد\s*الرحمان/g, 'عبدالرحمن')
    // Normalize compound prefixes: remove space after 'عبد', 'ابو', 'ابن'
    .replace(/عبد\s+/g, 'عبد')
    .replace(/ابو\s+/g, 'ابو')
    .replace(/ابن\s+/g, 'ابن')
    // Persian / Urdu variants
    .replace(/ڤ/g, 'ف')
    .replace(/گ/g, 'ك')
    .replace(/پ/g, 'ب')
    .replace(/چ/g, 'ج')
    // Replace punctuation with space
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
    // Collapse extra spaces
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Converts Arabic-Indic digits (٠-٩) and Persian digits (۰-۹) to standard Western digits (0-9).
 */
export function toWesternDigits(str: string): string {
  return str
    .replace(/[٠۰]/g, '0')
    .replace(/[١۱]/g, '1')
    .replace(/[٢۲]/g, '2')
    .replace(/[٣۳]/g, '3')
    .replace(/[٤۴]/g, '4')
    .replace(/[٥۵]/g, '5')
    .replace(/[٦۶]/g, '6')
    .replace(/[٧۷]/g, '7')
    .replace(/[٨۸]/g, '8')
    .replace(/[٩۹]/g, '9');
}

/**
 * Auto-detects the delimiter used in the CSV text:
 * Comma (,), Semicolon (; - common in Arabic/European Excel), or Tab (\t).
 */
export function detectDelimiter(csvText: string): string {
  const sampleLines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 5);

  if (sampleLines.length === 0) return ',';

  const candidates = [',', ';', '\t', '|'];
  let bestDelimiter = ',';
  let bestCount = -1;

  for (const delim of candidates) {
    let minInLines = Infinity;
    let total = 0;
    for (const line of sampleLines) {
      const count = line.split(delim).length - 1;
      total += count;
      if (count < minInLines) minInLines = count;
    }
    // Delimiter should appear at least once per line if consistent
    if (minInLines > 0 && total > bestCount) {
      bestCount = total;
      bestDelimiter = delim;
    }
  }

  return bestDelimiter;
}

/**
 * Parses raw CSV text into a 2D array of strings, respecting quotes and delimiters.
 */
export function parseCsvRows(csvText: string, delimiter?: string): string[][] {
  // Strip UTF-8 BOM if present
  let cleanText = csvText.replace(/^\uFEFF/, '').trim();
  if (!cleanText) return [];

  const delim = delimiter || detectDelimiter(cleanText);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delim && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n in CRLF
      }
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  // Push final field/row if any
  currentRow.push(currentField.trim());
  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Attempts to match a raw student string (name, phone, or id) against existing students.
 * Highly robust against compound Arabic names, spacing differences, invisible characters,
 * and multi-part patronymic name variations.
 */
export function findStudentMatch(
  rawIdentifier: string,
  students: Student[],
): Student | null {
  const trimmed = rawIdentifier.trim();
  if (!trimmed) return null;

  // 1. Direct ID match
  const byId = students.find(
    (s) => s.id.toLowerCase() === trimmed.toLowerCase(),
  );
  if (byId) return byId;

  // 2. Direct Phone match (last 8+ digits)
  const digitsOnly = toWesternDigits(trimmed).replace(/\D/g, '');
  if (digitsOnly.length >= 8) {
    const byPhone = students.find(
      (s) =>
        (s.phone && s.phone.replace(/\D/g, '').endsWith(digitsOnly)) ||
        (s.parentPhone && s.parentPhone.replace(/\D/g, '').endsWith(digitsOnly)),
    );
    if (byPhone) return byPhone;
  }

  // 3. Exact Normalized Name match
  const normRaw = normalizeArabic(trimmed);
  if (!normRaw) return null;

  const byExactName = students.find(
    (s) =>
      normalizeArabic(s.name) === normRaw ||
      (s.shortName && normalizeArabic(s.shortName) === normRaw),
  );
  if (byExactName) return byExactName;

  // 4. Prefix match (full name or shortName)
  const byPrefix = students.find((s) => {
    const sNorm = normalizeArabic(s.name);
    const snNorm = s.shortName ? normalizeArabic(s.shortName) : '';
    return (
      sNorm.startsWith(normRaw) ||
      normRaw.startsWith(sNorm) ||
      (snNorm && (snNorm.startsWith(normRaw) || normRaw.startsWith(snNorm)))
    );
  });
  if (byPrefix) return byPrefix;

  // 5. Token sequence match (e.g. "عبدالرحمن سعيد" matching "عبدالرحمن سعيد محمد عبدالكريم")
  const rawTokens = normRaw.split(' ').filter(Boolean);
  if (rawTokens.length >= 2) {
    const byTokens = students.find((s) => {
      const sTokens = normalizeArabic(s.name).split(' ').filter(Boolean);
      const snTokens = s.shortName
        ? normalizeArabic(s.shortName).split(' ').filter(Boolean)
        : [];

      // Test against full name tokens
      if (sTokens.length >= 2 && sTokens[0] === rawTokens[0]) {
        let lastIdx = 0;
        let allMatched = true;
        for (let i = 1; i < rawTokens.length; i++) {
          const foundIdx = sTokens.indexOf(rawTokens[i], lastIdx + 1);
          if (foundIdx === -1) {
            allMatched = false;
            break;
          }
          lastIdx = foundIdx;
        }
        if (allMatched) return true;
      }

      // Test against shortName tokens
      if (snTokens.length >= 2 && snTokens[0] === rawTokens[0]) {
        let lastIdx = 0;
        let allMatched = true;
        for (let i = 1; i < rawTokens.length; i++) {
          const foundIdx = snTokens.indexOf(rawTokens[i], lastIdx + 1);
          if (foundIdx === -1) {
            allMatched = false;
            break;
          }
          lastIdx = foundIdx;
        }
        if (allMatched) return true;
      }

      return false;
    });
    if (byTokens) return byTokens;
  }

  // 6. Substring / Contains match (if sufficiently specific: >= 4 characters)
  if (normRaw.length >= 4) {
    const byContains = students.find((s) => {
      const sNorm = normalizeArabic(s.name);
      const snNorm = s.shortName ? normalizeArabic(s.shortName) : '';
      return (
        sNorm.includes(normRaw) ||
        normRaw.includes(sNorm) ||
        (snNorm && (snNorm.includes(normRaw) || normRaw.includes(snNorm)))
      );
    });
    if (byContains) return byContains;
  }

  return null;
}

/**
 * Parses a score string, accepting Arabic numbers, decimals, fractions ("18/20"),
 * labels ("درجة 19", "18 من 20"), or absence markers.
 */
export function parseScoreValue(
  rawVal: string,
  maxScore: number,
): { score: number; status: Grade['status'] } {
  if (!rawVal) {
    return { score: 0, status: 'absent' };
  }

  const cleanVal = rawVal
    .replace(/[\u200B-\u200F\uFEFF\u00A0\u202A-\u202E]/g, ' ')
    .trim();

  if (!cleanVal) {
    return { score: 0, status: 'absent' };
  }

  const converted = toWesternDigits(cleanVal).replace(',', '.');
  const norm = normalizeArabic(converted);

  if (
    norm === 'غائب' ||
    norm === 'غياب' ||
    norm === 'غ' ||
    norm === 'absent' ||
    converted === '-' ||
    converted === '—'
  ) {
    return { score: 0, status: 'absent' };
  }

  if (
    norm === 'معذور' ||
    norm === 'عذر' ||
    norm === 'لن يحضر' ||
    norm === 'excused'
  ) {
    return { score: 0, status: 'excused' };
  }

  // Extract first numeric value (supports "18/20", "18.5", "درجة 19", "18 من 20", etc.)
  const numMatch = converted.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) {
    const num = parseFloat(numMatch[1]);
    if (!isNaN(num)) {
      const clamped = Math.max(0, Math.min(maxScore, num));
      return { score: clamped, status: 'scored' };
    }
  }

  return { score: 0, status: 'absent' };
}

export interface ParsedCsvResult {
  records: {
    rawIdentifier: string;
    student: Student | null; // null if brand new student
    score: number;
    status: Grade['status'];
    assessmentId?: string;
  }[];
  warnings: string[];
}

/**
 * Parses user-uploaded CSV into structured grade records.
 * Supports arbitrary column arrangements and auto-detects name and score columns.
 */
export function parseGradesCsv(
  csvText: string,
  targetAssessment: Assessment,
  students: Student[],
): ParsedCsvResult {
  const rows = parseCsvRows(csvText);
  const result: ParsedCsvResult = {
    records: [],
    warnings: [],
  };

  if (rows.length === 0) {
    result.warnings.push('الملف فارغ أو لا يحتوي على أسطر صالحة.');
    return result;
  }

  const normFirstRow = rows[0].map((c) => normalizeArabic(c));

  // Check if first row is a header row
  const hasNameHeader = normFirstRow.some(
    (c) =>
      c.includes('اسم') ||
      c.includes('طالب') ||
      c.includes('name') ||
      c.includes('student'),
  );
  const hasScoreHeader = normFirstRow.some(
    (c) =>
      c.includes('درج') ||
      c.includes('كويز') ||
      c.includes('امتحان') ||
      c.includes('اختبار') ||
      c.includes('تقييم') ||
      c.includes('شامل') ||
      c.includes('نتيج') ||
      c.includes('مجموع') ||
      c.includes('score') ||
      c.includes('grade') ||
      c.includes('mark') ||
      c.includes('result') ||
      c.includes('quiz') ||
      c.includes('exam') ||
      c.includes('test') ||
      (targetAssessment.title && c.includes(normalizeArabic(targetAssessment.title))),
  );

  const isHeaderRow = hasNameHeader || hasScoreHeader;
  const dataRows = isHeaderRow ? rows.slice(1) : rows;

  let nameColIdx = -1;
  let scoreColIdx = -1;
  let statusColIdx = -1;
  let assessColIdx = -1;

  if (isHeaderRow) {
    normFirstRow.forEach((h, idx) => {
      if (
        nameColIdx === -1 &&
        (h.includes('اسم') ||
          h.includes('طالب') ||
          h.includes('name') ||
          h.includes('student'))
      ) {
        nameColIdx = idx;
      } else if (
        scoreColIdx === -1 &&
        (h.includes('درج') ||
          h.includes('كويز') ||
          h.includes('امتحان') ||
          h.includes('اختبار') ||
          h.includes('تقييم') ||
          h.includes('شامل') ||
          h.includes('نتيج') ||
          h.includes('مجموع') ||
          h.includes('score') ||
          h.includes('grade') ||
          h.includes('mark') ||
          h.includes('result') ||
          h.includes('quiz') ||
          h.includes('exam') ||
          h.includes('test') ||
          (targetAssessment.title && h.includes(normalizeArabic(targetAssessment.title))))
      ) {
        scoreColIdx = idx;
      } else if (statusColIdx === -1 && (h.includes('حال') || h.includes('status'))) {
        statusColIdx = idx;
      } else if (
        assessColIdx === -1 &&
        (h.includes('تقييم') ||
          h.includes('كويز') ||
          h.includes('شامل') ||
          h.includes('assessment'))
      ) {
        assessColIdx = idx;
      }
    });
  }

  dataRows.forEach((row, rowIdx) => {
    if (row.length === 0 || row.every((c) => !c)) return;

    let studentStr = '';
    let scoreStr = '';
    let statusStr = '';
    let assessId = targetAssessment.id;

    if (nameColIdx !== -1 && scoreColIdx !== -1) {
      studentStr = row[nameColIdx] ?? '';
      scoreStr = row[scoreColIdx] ?? '';
      if (statusColIdx !== -1) statusStr = row[statusColIdx] ?? '';
      if (assessColIdx !== -1 && row[assessColIdx]) assessId = row[assessColIdx];
    } else if (row.length === 1) {
      result.warnings.push(`السطر ${rowIdx + 1}: عمود واحد فقط، تعذر قراءة الدرجة.`);
      return;
    } else {
      // Intelligent fallback for rows without clean headers
      // Find candidate name column (matches student or has Arabic letters)
      // and candidate score column (contains digits or absence keywords)
      let detectedNameIdx = -1;
      let detectedScoreIdx = -1;

      // Try finding direct student match in any column
      for (let i = 0; i < row.length; i++) {
        if (findStudentMatch(row[i], students)) {
          detectedNameIdx = i;
          break;
        }
      }

      // If not matched, pick first column with Arabic letters as name
      if (detectedNameIdx === -1) {
        for (let i = 0; i < row.length; i++) {
          if (/[\u0600-\u06FF]/.test(row[i])) {
            detectedNameIdx = i;
            break;
          }
        }
      }
      if (detectedNameIdx === -1) detectedNameIdx = 0;

      // Find score column among remaining columns
      for (let i = 0; i < row.length; i++) {
        if (i === detectedNameIdx) continue;
        const val = toWesternDigits(row[i].trim().replace(',', '.'));
        if (
          /\d/.test(val) ||
          normalizeArabic(val).includes('غائب') ||
          normalizeArabic(val).includes('غياب') ||
          normalizeArabic(val).includes('معذور')
        ) {
          detectedScoreIdx = i;
          break;
        }
      }
      if (detectedScoreIdx === -1) {
        detectedScoreIdx = detectedNameIdx === 0 ? 1 : 0;
      }

      studentStr = row[detectedNameIdx] ?? '';
      scoreStr = row[detectedScoreIdx] ?? '';
    }

    if (!studentStr.trim()) return;

    const matchedStudent = findStudentMatch(studentStr, students);
    const parsedScore = parseScoreValue(scoreStr, targetAssessment.maxScore);

    let status = parsedScore.status;
    if (statusStr) {
      const normStatus = normalizeArabic(statusStr);
      if (normStatus.includes('غائب') || normStatus.includes('غياب') || normStatus.includes('absent')) {
        status = 'absent';
      } else if (normStatus.includes('معذور') || normStatus.includes('عذر') || normStatus.includes('excused')) {
        status = 'excused';
      }
    }

    result.records.push({
      rawIdentifier: studentStr.trim(),
      student: matchedStudent,
      score: parsedScore.score,
      status,
      assessmentId: assessId,
    });
  });

  return result;
}

/**
 * Generates an Excel-friendly CSV template pre-populated with active students
 * and UTF-8 BOM so Arabic names display flawlessly in Excel on Windows.
 */
export function generateGradesTemplateCsv(
  students: Student[],
  assessment: Assessment,
): string {
  const header = `اسم الطالب,الدرجة (من ${assessment.maxScore}),الحالة (اختياري)`;
  const lines = students
    .filter((s) => s.active)
    .map((s) => `"${s.name.replace(/"/g, '""')}",,درجة`);

  // Prefix with \uFEFF for Excel UTF-8 recognition
  return `\uFEFF${[header, ...lines].join('\r\n')}`;
}
