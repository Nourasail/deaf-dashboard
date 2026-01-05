import * as XLSX from "xlsx";

// يحوّل النص لرأس موحّد (للمقارنة)
function normalizeHeader(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\w\u0600-\u06FF]/g, "");
}

// يلقط اسم العمود حتى لو اختلف قليلًا
function pickHeaderKey(headers, candidates) {
  const map = new Map(headers.map((h) => [normalizeHeader(h), h]));
  for (const c of candidates) {
    const key = normalizeHeader(c);
    if (map.has(key)) return map.get(key);
  }
  return null;
}

// تحويل قيمة (قد تكون نص أو فيها فواصل) إلى رقم
function toNumber(v) {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  // إزالة الفواصل العربية/الإنجليزية
  const cleaned = s.replace(/,/g, "").replace(/،/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// تحويل نص الأسبوع إلى مفاتيح الداشبورد
const WEEK_MAP = {
  "الأسبوع الأول": "week1",
  "الأسبوع الثاني": "w2",
  "الأسبوع الثالث": "w3",
  "الأسبوع الرابع": "w4",
};

export async function readExcelFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("لا يوجد Sheets داخل ملف Excel");

  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (!json.length) return [];

  const headers = Object.keys(json[0]);

  // ✅ محاولة قراءة Wide Format (لو الملف تغيّر مستقبلًا وصار week1/w2..)
  const stageWideKey = pickHeaderKey(headers, ["المرحلة", "مرحله", "stage", "phase", "المراحل"]);
  const metricWideKey = pickHeaderKey(headers, ["المؤشر", "مؤشر", "indicator", "metric"]);
  const w1Key = pickHeaderKey(headers, ["week1", "w1", "week01"]);
  const w2Key = pickHeaderKey(headers, ["w2", "week2", "week02"]);
  const w3Key = pickHeaderKey(headers, ["w3", "week3", "week03"]);
  const w4Key = pickHeaderKey(headers, ["w4", "week4", "week04"]);

  const isWide = stageWideKey && metricWideKey && (w1Key || w2Key || w3Key || w4Key);

  if (isWide) {
    return json
      .map((r) => ({
        stage: String(r[stageWideKey] ?? "").trim(),
        metric: String(r[metricWideKey] ?? "").trim(),
        week1: toNumber(r[w1Key] ?? 0),
        w2: toNumber(r[w2Key] ?? 0),
        w3: toNumber(r[w3Key] ?? 0),
        w4: toNumber(r[w4Key] ?? 0),
      }))
      .filter((r) => r.stage && r.metric);
  }

  // ✅ قراءة Long Format (ملفك الحالي)
  // الأعمدة عندك: السنه | الشهر | الأسبوع | اليوم | المراحل | المؤشر | القيمة | ملاحظات
  const stageKey = pickHeaderKey(headers, ["المراحل", "المرحلة", "stage", "phase"]);
  const metricKey = pickHeaderKey(headers, ["المؤشر", "indicator", "metric"]);
  const weekLabelKey = pickHeaderKey(headers, ["الأسبوع", "week"]);
  const valueKey = pickHeaderKey(headers, ["القيمة", "value"]);

  if (!stageKey || !metricKey || !weekLabelKey || !valueKey) {
    throw new Error(
      "ملف Excel غير مطابق. لازم يحتوي على الأعمدة: المراحل، المؤشر، الأسبوع، القيمة"
    );
  }

  // Pivot: (stage + metric) => {week1, w2, w3, w4}
  const map = new Map();

  for (const r of json) {
    const stage = String(r[stageKey] ?? "").trim();
    const metric = String(r[metricKey] ?? "").trim();
    const weekLabel = String(r[weekLabelKey] ?? "").trim();
    const weekKey = WEEK_MAP[weekLabel];
    const value = toNumber(r[valueKey]);

    if (!stage || !metric) continue;
    if (!weekKey) continue; // يتجاهل أي أسبوع غير معروف

    const k = `${stage}||${metric}`;
    if (!map.has(k)) {
      map.set(k, { stage, metric, week1: 0, w2: 0, w3: 0, w4: 0 });
    }

    // لو تكرر نفس الأسبوع، نجمعه
    map.get(k)[weekKey] += value;
  }

  return Array.from(map.values());
}
