// ================================
// روابط Google Sheets (CSV Published)
// ================================
export const SHEET_CSV_URLS = {
  "2025": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ6VzfDGFdbH04pR3UulzwqT4XrDqJku3UEBdfPAyMYuqbq8uP1kN1Mx2tm2uA5ug/pub?gid=1933262051&single=true&output=csv",
  "2026": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ6VzfDGFdbH04pR3UulzwqT4XrDqJku3UEBdfPAyMYuqbq8uP1kN1Mx2tm2uA5ug/pub?gid=504234142&single=true&output=csv",
};

// ================================
// تحويل نص الأسبوع إلى مفاتيح الداشبورد
// ================================
const WEEK_MAP = {
  "الأسبوع الأول": "week1",
  "الأسبوع الثاني": "w2",
  "الأسبوع الثالث": "w3",
  "الأسبوع الرابع": "w4",
};

// ================================
// تحويل أي قيمة إلى رقم آمن
// ================================
function toNumber(v) {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  const cleaned = s.replace(/,/g, "").replace(/،/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// ================================
// CSV parser بسيط (يدعم النصوص بين "")
// ================================
function parseCSVLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

// ================================
// تطبيع العناوين عشان ما يفرق مسافة/همزات/BOM
// ================================
function normalizeHeader(s) {
  return String(s ?? "")
    .replace(/^\uFEFF/, "")         // إزالة BOM لو موجود
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")            // إزالة المسافات
    .replace(/[^\w\u0600-\u06FF]/g, ""); // إزالة الرموز
}

// ================================
// إيجاد عمود بناءً على أسماء محتملة (عربي/إنجليزي/بدائل)
// ================================
function findHeaderIndex(headers, candidates) {
  const normHeaders = headers.map(normalizeHeader);
  for (const c of candidates) {
    const target = normalizeHeader(c);
    const idx = normHeaders.indexOf(target);
    if (idx !== -1) return idx;
  }
  return -1;
}

// ================================
// تحميل CSV وتحويله لشكل الداشبورد
// ================================
export async function loadRowsFromPublishedCSV(csvUrl) {
  const res = await fetch(csvUrl, { cache: "no-store" });
  if (!res.ok) throw new Error("فشل تحميل CSV من Google Sheets");

  const text = await res.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);

  // ✅ مرونة في أسماء الأعمدة
  const stageIdx = findHeaderIndex(headers, ["المراحل", "المرحلة", "مرحلة", "stage", "phase"]);
  const metricIdx = findHeaderIndex(headers, ["المؤشر", "مؤشر", "indicator", "metric"]);
  const weekIdx  = findHeaderIndex(headers, ["الأسبوع", "اسبوع", "week"]);
  const valueIdx = findHeaderIndex(headers, ["القيمة", "قيمه", "value"]);

  if (stageIdx === -1 || metricIdx === -1 || weekIdx === -1 || valueIdx === -1) {
    // لمساعدة التشخيص: نطلع العناوين اللي جتنا فعليًا
    throw new Error(
      "الأعمدة المطلوبة غير موجودة.\n" +
      "لازم يكون عندك أعمدة مثل: المراحل/المرحلة ، المؤشر ، الأسبوع ، القيمة.\n" +
      "العناوين الموجودة عندك الآن: " + headers.join(" | ")
    );
  }

  // Pivot البيانات
  const map = new Map();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);

    const stage = (cols[stageIdx] ?? "").trim();
    const metric = (cols[metricIdx] ?? "").trim();
    const weekLabel = (cols[weekIdx] ?? "").trim();
    const weekKey = WEEK_MAP[weekLabel];
    const value = toNumber(cols[valueIdx]);

    if (!stage || !metric) continue;
    if (!weekKey) continue; // يتجاهل أي أسبوع غير معروف

    const key = `${stage}||${metric}`;
    if (!map.has(key)) {
      map.set(key, { stage, metric, week1: 0, w2: 0, w3: 0, w4: 0 });
    }

    map.get(key)[weekKey] += value;
  }

  return Array.from(map.values());
}




// ================================
// روابط Google Sheets (CSV Published)
// ================================




// export const SHEET_CSV_URLS = {
//   "2025": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ6VzfDGFdbH04pR3UulzwqT4XrDqJku3UEBdfPAyMYuqbq8uP1kN1Mx2tm2uA5ug/pub?gid=1933262051&single=true&output=csv",
//   "2026": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ6VzfDGFdbH04pR3UulzwqT4XrDqJku3UEBdfPAyMYuqbq8uP1kN1Mx2tm2uA5ug/pub?gid=504234142&single=true&output=csv",
// };

// // ================================
// // تحويل نص الأسبوع إلى مفاتيح الداشبورد
// // ================================
// const WEEK_MAP = {
//   "الأسبوع الأول": "week1",
//   "الأسبوع الثاني": "w2",
//   "الأسبوع الثالث": "w3",
//   "الأسبوع الرابع": "w4",
// };

// function toNumber(v) {
//   if (v === null || v === undefined) return 0;
//   const s = String(v).trim();
//   if (!s) return 0;
//   const cleaned = s.replace(/,/g, "").replace(/،/g, "");
//   const n = Number(cleaned);
//   return Number.isFinite(n) ? n : 0;
// }

// // ================================
// // CSV parser بسيط (يدعم النصوص بين "")
// // ================================
// function parseCSVLine(line) {
//   const out = [];
//   let cur = "";
//   let inQuotes = false;

//   for (let i = 0; i < line.length; i++) {
//     const ch = line[i];
//     if (ch === '"') {
//       if (inQuotes && line[i + 1] === '"') {
//         cur += '"';
//         i++;
//       } else {
//         inQuotes = !inQuotes;
//       }
//     } else if (ch === "," && !inQuotes) {
//       out.push(cur);
//       cur = "";
//     } else {
//       cur += ch;
//     }
//   }
//   out.push(cur);
//   return out.map((s) => s.trim());
// }

// // ================================
// // تطبيع العناوين (BOM/مسافات/اختلاف بسيط)
// // ================================
// function normalizeHeader(s) {
//   return String(s ?? "")
//     .replace(/^\uFEFF/, "")
//     .trim()
//     .toLowerCase()
//     .replace(/\s+/g, "")
//     .replace(/[^\w\u0600-\u06FF]/g, "");
// }

// function findHeaderIndex(headers, candidates) {
//   const normHeaders = headers.map(normalizeHeader);
//   for (const c of candidates) {
//     const target = normalizeHeader(c);
//     const idx = normHeaders.indexOf(target);
//     if (idx !== -1) return idx;
//   }
//   return -1;
// }

// // ================================
// // تحميل CSV وتحويله لشكل الداشبورد
// // يرجع rows فيها: month/day/stage/metric + week1/w2/w3/w4
// // ================================
// export async function loadRowsFromPublishedCSV(csvUrl) {
//   const res = await fetch(csvUrl, { cache: "no-store" });
//   if (!res.ok) throw new Error("فشل تحميل CSV من Google Sheets");

//   const text = await res.text();
//   const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
//   if (lines.length < 2) return [];

//   const headers = parseCSVLine(lines[0]);

//   const stageIdx = findHeaderIndex(headers, ["المراحل", "المرحلة", "stage", "phase"]);
//   const metricIdx = findHeaderIndex(headers, ["المؤشر", "indicator", "metric"]);
//   const weekIdx = findHeaderIndex(headers, ["الأسبوع", "week"]);
//   const valueIdx = findHeaderIndex(headers, ["القيمة", "value"]);

//   // ✅ شهر/يوم (اختياريين بس نستخدمهم للفلاتر)
//   const monthIdx = findHeaderIndex(headers, ["الشهر", "month"]);
//   const dayIdx = findHeaderIndex(headers, ["اليوم", "day", "date", "التاريخ"]);

//   if (stageIdx === -1 || metricIdx === -1 || weekIdx === -1 || valueIdx === -1) {
//     throw new Error(
//       "الأعمدة المطلوبة غير موجودة.\n" +
//       "لازم يكون عندك: المراحل/المرحلة ، المؤشر ، الأسبوع ، القيمة.\n" +
//       "العناوين الموجودة: " + headers.join(" | ")
//     );
//   }

//   // Pivot البيانات
//   // نجمع حسب: month + day + stage + metric
//   const map = new Map();

//   for (let i = 1; i < lines.length; i++) {
//     const cols = parseCSVLine(lines[i]);

//     const stage = (cols[stageIdx] ?? "").trim();
//     const metric = (cols[metricIdx] ?? "").trim();

//     const weekLabel = (cols[weekIdx] ?? "").trim();
//     const weekKey = WEEK_MAP[weekLabel];

//     const value = toNumber(cols[valueIdx]);

//     const month = monthIdx !== -1 ? String(cols[monthIdx] ?? "").trim() : "";
//     const day = dayIdx !== -1 ? String(cols[dayIdx] ?? "").trim() : "";

//     if (!stage || !metric || !weekKey) continue;

//     const key = `${month}||${day}||${stage}||${metric}`;

//     if (!map.has(key)) {
//       map.set(key, { month, day, stage, metric, week1: 0, w2: 0, w3: 0, w4: 0 });
//     }

//     map.get(key)[weekKey] += value;
//   }

//   return Array.from(map.values());
// }
