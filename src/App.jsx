// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Building2,
  Filter,
  Hash,
  Clock3,
  Users,
  Video,
  FileSpreadsheet,
  RefreshCcw,
} from "lucide-react";

// ✅ لوقو ثابت
import logo from "./assets/Logotw.png";

import { readExcelFile } from "./excel"; // احتياطي
import { SHEET_CSV_URLS, loadRowsFromPublishedCSV } from "./sheets";

/* =========================================================
   1) ثوابت عامة
   ========================================================= */
const WEEKS = ["الكل", "week1", "w2", "w3", "w4"];

// ترتيب مفضل للمراحل (إذا موجودة في البيانات تظهر بهذا الترتيب)
const PREFERRED_STAGE_ORDER = [
  "مرحلة التصوير",
  "مرحلة التسمية",
  "مرحلة المراجعة والتدقيق",
];

// ألوان التدرج حسب القيمة: أدنى = أحمر .. أعلى = أخضر
const SCALE_COLORS = {
  low: "#ef4444", // أحمر
  mid1: "#f97316", // برتقالي
  mid2: "#3b82f6", // أزرق
  high: "#22c55e", // أخضر
};

/* =========================================================
   2) Helpers (جمع/تنسيق + تلوين حسب القيم)
   ========================================================= */
const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);
const formatNumber = (n) => (Number(n) || 0).toLocaleString("ar-SA");

// ✅ مرن: أي مؤشر يحتوي كلمة "فيديو" يعتبر فيديوهات (مع trim)
const isVideoMetric = (m = "") => String(m || "").trim().includes("فيديو");

/** حساب quantiles (25%/50%/75%) لتلوين تلقائي حسب توزيع البيانات */
function getQuantile(sorted, q) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

/** يرجع دالة لون: value -> color (أحمر/برتقالي/أزرق/أخضر) */
function makeColorByValue(values) {
  const nums = values
    .map((v) => Number(v) || 0)
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);

  if (!nums.length) return () => SCALE_COLORS.high;

  const q25 = getQuantile(nums, 0.25);
  const q50 = getQuantile(nums, 0.5);
  const q75 = getQuantile(nums, 0.75);

  return (v) => {
    const x = Number(v) || 0;
    if (x <= q25) return SCALE_COLORS.low;
    if (x <= q50) return SCALE_COLORS.mid1;
    if (x <= q75) return SCALE_COLORS.mid2;
    return SCALE_COLORS.high;
  };
}

/* =========================================================
   3) UI Components
   ========================================================= */
function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl bg-white shadow-sm border border-emerald-100 ${className}`}
    >
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-xl bg-emerald-50 border border-emerald-100 p-2">
        <Icon className="h-5 w-5 text-emerald-700" />
      </div>
      <div>
        <div className="text-base font-semibold text-slate-800">{title}</div>
        {subtitle ? (
          <div className="text-sm text-slate-500">{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, hint }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-2">
            <Icon className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <div className="text-sm text-slate-600">{label}</div>
            <div className="text-2xl font-bold text-slate-900">
              {formatNumber(value)}
            </div>
          </div>
        </div>
        {hint ? (
          <span className="text-xs rounded-full bg-emerald-50 border border-emerald-100 px-2 py-1 text-emerald-800">
            {hint}
          </span>
        ) : null}
      </div>
    </Card>
  );
}

function Select({ value, onChange, options, label }) {
  return (
    <label className="flex flex-col gap-1 min-w-[180px]">
      <span className="text-xs text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
      >
        {options.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>
    </label>
  );
}

/* =========================================================
   4) App
   ========================================================= */
export default function App() {
  const YEARS = Object.keys(SHEET_CSV_URLS);
  const [year, setYear] = useState(YEARS[0] || "2025");

  const [stage, setStage] = useState("الكل");
  const [week, setWeek] = useState("الكل");

  const [rows, setRows] = useState([]);
  const [excelName, setExcelName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const excelRef = useRef(null);

  /* -----------------------------
     (C) Load from Google Sheets
     ----------------------------- */
  async function loadFromSheet(selectedYear = year) {
    setErrorMsg("");
    try {
      const url = SHEET_CSV_URLS[selectedYear];
      if (!url || url.includes("PUT_")) {
        throw new Error(
          "حط روابط CSV للسنة داخل src/sheets.js (Publish to web → CSV)"
        );
      }

      const parsed = await loadRowsFromPublishedCSV(url);
      setRows(parsed);
      setExcelName(`Google Sheet ${selectedYear}`);

      const stagesInFile = new Set(parsed.map((r) => r.stage));
      if (stage !== "الكل" && !stagesInFile.has(stage)) setStage("الكل");
    } catch (e) {
      setRows([]);
      setErrorMsg(e?.message || "فشل تحميل البيانات من Google Sheets");
    }
  }

  useEffect(() => {
    loadFromSheet(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  /* -----------------------------
     (D) Excel Backup
     ----------------------------- */
  const onPickExcel = () => excelRef.current?.click();
  const onExcelChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg("");

    try {
      const parsed = await readExcelFile(file);
      setRows(parsed);
      setExcelName(file.name);

      const stagesInFile = new Set(parsed.map((r) => r.stage));
      if (stage !== "الكل" && !stagesInFile.has(stage)) setStage("الكل");
    } catch (err) {
      setRows([]);
      setExcelName(file.name);
      setErrorMsg(err?.message || "حدث خطأ أثناء قراءة ملف Excel");
    } finally {
      e.target.value = "";
    }
  };

  const hasData = rows.length > 0;

  /* =========================================================
     5) ديناميكية المراحل
     ========================================================= */
  const dynamicStages = useMemo(() => {
    const set = new Set(rows.map((r) => r.stage).filter(Boolean));
    const ordered = [
      ...PREFERRED_STAGE_ORDER.filter((s) => set.has(s)),
      ...Array.from(set).filter((s) => !PREFERRED_STAGE_ORDER.includes(s)),
    ];
    return ["الكل", ...ordered];
  }, [rows]);

  /* =========================================================
     6) فلترة حسب المرحلة
     ========================================================= */
  const filteredRows = useMemo(() => {
    if (stage === "الكل") return rows;
    return rows.filter((r) => r.stage === stage);
  }, [rows, stage]);

  /* =========================================================
     7) Helper: حسب الأسبوع
     ========================================================= */
  const pickByWeek = (row) => {
    if (!row) return 0;
    if (week === "الكل") return sum([row.week1, row.w2, row.w3, row.w4]);
    return Number(row[week]) || 0;
  };

  /* =========================================================
     8) KPIs
     ========================================================= */
  const totals = useMemo(() => {
    const words = sum(
      filteredRows.filter((r) => r.metric === "عدد الكلمات").map(pickByWeek)
    );
    const hours = sum(
      filteredRows.filter((r) => r.metric === "عدد الساعات").map(pickByWeek)
    );
    const people = sum(
      filteredRows.filter((r) => r.metric === "عدد الأشخاص").map(pickByWeek)
    );
    return { words, hours, people };
  }, [filteredRows, week]);

  /* =========================================================
     9) KPI: الفيديوهات (دائمًا من التصوير)
     ========================================================= */
  const totalVideos = useMemo(() => {
    const videoRows = rows.filter(
      (r) => r.stage === "مرحلة التصوير" && isVideoMetric(r.metric)
    );
    return sum(videoRows.map(pickByWeek));
  }, [rows, week]);

  /* =========================================================
     10) Line Chart
     ========================================================= */
  const lineWordsByWeek = useMemo(() => {
    const weeks = ["week1", "w2", "w3", "w4"];
    const wordRows = filteredRows.filter((r) => r.metric === "عدد الكلمات");
    return weeks.map((w) => ({
      week: w,
      value: sum(wordRows.map((r) => Number(r[w]) || 0)),
    }));
  }, [filteredRows]);

  const colorLine = useMemo(
    () => makeColorByValue(lineWordsByWeek.map((d) => d.value)),
    [lineWordsByWeek]
  );

  /* =========================================================
     11) Bar Chart people/hours
     ========================================================= */
  const barPeopleHoursByStage = useMemo(() => {
    const stagesOnly = dynamicStages.filter((s) => s !== "الكل");
    const findRow = (st, metric) =>
      rows.find((r) => r.stage === st && r.metric === metric);

    return stagesOnly.map((st) => ({
      stage: st.replace("مرحلة ", ""),
      people: pickByWeek(findRow(st, "عدد الأشخاص")),
      hours: pickByWeek(findRow(st, "عدد الساعات")),
    }));
  }, [rows, week, dynamicStages]);

  const colorPeople = useMemo(
    () => makeColorByValue(barPeopleHoursByStage.map((d) => d.people)),
    [barPeopleHoursByStage]
  );
  const colorHours = useMemo(
    () => makeColorByValue(barPeopleHoursByStage.map((d) => d.hours)),
    [barPeopleHoursByStage]
  );

  /* =========================================================
     12) Stacked Bar
     ========================================================= */
  const stackedStagesOnly = useMemo(
    () => dynamicStages.filter((s) => s !== "الكل"),
    [dynamicStages]
  );

  const stackedWordsStageByWeek = useMemo(() => {
    const weeks = ["week1", "w2", "w3", "w4"];
    const findWordRow = (st) =>
      rows.find((r) => r.stage === st && r.metric === "عدد الكلمات");

    return weeks.map((w) => {
      const obj = { week: w };
      stackedStagesOnly.forEach((st) => {
        obj[st] = Number(findWordRow(st)?.[w] || 0);
      });
      return obj;
    });
  }, [rows, stackedStagesOnly]);

  const stackedStageColors = useMemo(() => {
    const palette = [
      "#059669",
      "#10b981",
      "#34d399",
      "#06b6d4",
      "#3b82f6",
      "#a855f7",
    ];
    const map = new Map();
    stackedStagesOnly.forEach((st, idx) =>
      map.set(st, palette[idx % palette.length])
    );
    return map;
  }, [stackedStagesOnly]);

  /* =========================================================
     13) Donut
     ========================================================= */
  const donutWordsByStage = useMemo(() => {
    const findWordRow = (st) =>
      rows.find((r) => r.stage === st && r.metric === "عدد الكلمات");
    return stackedStagesOnly.map((st) => ({
      name: st.replace("مرحلة ", ""),
      value: pickByWeek(findWordRow(st)),
      _stageKey: st,
    }));
  }, [rows, week, stackedStagesOnly]);

  const colorDonut = useMemo(
    () => makeColorByValue(donutWordsByStage.map((d) => d.value)),
    [donutWordsByStage]
  );

  return (
    <div dir="rtl" className="min-h-screen bg-emerald-50/40">
      {/* ================= Header ================= */}
      <div className="sticky top-0 z-20 backdrop-blur bg-white/80 border-b border-emerald-100">
        <div className="mx-auto max-w-7xl px-4 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-100 grid place-items-center overflow-hidden">
                {/* ✅ لوقو ثابت */}
                <img
                  src={logo}
                  alt="logo"
                  className="h-full w-full object-contain p-1"
                />
              </div>

              <div>
                <div className="text-lg md:text-xl font-bold text-slate-900">
                  Dashboard – مؤشرات مشروع الصم
                </div>
                <div className="text-sm text-slate-600">
                  By Noura Saad - Proudct specialist
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Refresh from Sheets */}
              <button
                onClick={() => loadFromSheet(year)}
                className="h-10 rounded-xl bg-white px-3 text-sm font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition inline-flex items-center gap-2"
                title="تحديث من Google Sheets"
              >
                <RefreshCcw className="h-4 w-4" />
                تحديث
              </button>

              {/* Excel Backup */}
              <input
                ref={excelRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={onExcelChange}
              />
              <button
                onClick={onPickExcel}
                className="h-10 rounded-xl bg-white px-3 text-sm font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition inline-flex items-center gap-2"
                title="احتياطي: رفع Excel"
              >
                <FileSpreadsheet className="h-4 w-4" />
                رفع Excel
              </button>

              <div className="text-xs text-slate-600 flex items-center gap-2">
                <RefreshCcw className="h-4 w-4 text-emerald-700" />
                {excelName ? (
                  <span className="truncate max-w-[260px]">
                    المصدر الحالي:{" "}
                    <span className="font-semibold">{excelName}</span>
                  </span>
                ) : (
                  <span>لم يتم تحميل بيانات بعد</span>
                )}
              </div>
            </div>
          </div>

          {/* Error */}
          {errorMsg ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {errorMsg}
            </div>
          ) : null}

          {/* ================= Filters ================= */}
          <Card className="p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <SectionTitle
                icon={Filter}
                title="الفلاتر"
                subtitle="السنة/المرحلة/الأسبوع"
              />
              <div className="flex gap-3 flex-wrap items-end">
                <Select
                  label="السنة"
                  value={year}
                  onChange={setYear}
                  options={YEARS.length ? YEARS : ["2025"]}
                />
                <Select
                  label="المرحلة"
                  value={stage}
                  onChange={setStage}
                  options={dynamicStages}
                />
                <Select
                  label="الأسبوع"
                  value={week}
                  onChange={setWeek}
                  options={WEEKS}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ================= Body ================= */}
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {!hasData ? (
          <Card className="p-6">
            <div className="text-slate-700 font-semibold mb-2">
              لا توجد بيانات بعد
            </div>
            <div className="text-sm text-slate-600 leading-6">
              ✅ تأكد أنك فعلت{" "}
              <span className="font-semibold">Publish to web → CSV</span> لكل
              سنة، وحطيت الروابط داخل{" "}
              <span className="font-semibold">src/sheets.js</span>.
            </div>
          </Card>
        ) : null}

        {/* ================= KPIs ================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI
            icon={Hash}
            label="إجمالي الكلمات"
            value={totals.words}
            hint={`${year} • ${stage} • ${week}`}
          />
          <KPI
            icon={Clock3}
            label="إجمالي الساعات"
            value={totals.hours}
            hint={`${year} • ${stage} • ${week}`}
          />
          <KPI
            icon={Users}
            label="عدد الأشخاص"
            value={totals.people}
            hint={`${year} • ${stage} • ${week}`}
          />
          <KPI
            icon={Video}
            label="مجموع الفيديوهات المصورة"
            value={totalVideos}
            hint="مرحلة التصوير"
          />
        </div>

        {/* ================= Charts ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="mb-3">
              <div className="text-base font-semibold text-slate-800">
                الكلمات عبر الأسابيع
              </div>
              <div className="text-sm text-slate-500">Line Chart</div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineWordsByWeek}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#059669"
                    strokeWidth={3}
                    dot={({ cx, cy, payload }) => (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill={colorLine(payload.value)}
                      />
                    )}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3">
              <div className="text-base font-semibold text-slate-800">
                مقارنة الأشخاص والساعات بين المراحل
              </div>
              <div className="text-sm text-slate-500">Bar Chart</div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barPeopleHoursByStage}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stage" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="people" name="الأشخاص" radius={[8, 8, 0, 0]}>
                    {barPeopleHoursByStage.map((entry, idx) => (
                      <Cell key={`p-${idx}`} fill={colorPeople(entry.people)} />
                    ))}
                  </Bar>
                  <Bar dataKey="hours" name="الساعات" radius={[8, 8, 0, 0]}>
                    {barPeopleHoursByStage.map((entry, idx) => (
                      <Cell key={`h-${idx}`} fill={colorHours(entry.hours)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3">
              <div className="text-base font-semibold text-slate-800">
                الكلمات حسب المرحلة لكل أسبوع
              </div>
              <div className="text-sm text-slate-500">Stacked Bar</div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stackedWordsStageByWeek}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {stackedStagesOnly.map((st) => (
                    <Bar
                      key={st}
                      dataKey={st}
                      stackId="a"
                      fill={stackedStageColors.get(st)}
                      name={st.replace("مرحلة ", "")}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3">
              <div className="text-base font-semibold text-slate-800">
                توزيع الكلمات بين المراحل
              </div>
              <div className="text-sm text-slate-500">Donut Chart</div>
            </div>

            {stage !== "الكل" ? (
              <div className="h-72 grid place-items-center rounded-xl border border-emerald-100 bg-emerald-50/40 text-slate-600 text-sm">
                اختر <span className="font-semibold mx-1">المرحلة: الكل</span>{" "}
                لعرض التوزيع
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip />
                    <Legend />
                    <Pie
                      data={donutWordsByStage}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={2}
                    >
                      {donutWordsByStage.map((entry, idx) => (
                        <Cell key={idx} fill={colorDonut(entry.value)} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>

        {/* ================= Table ================= */}
        <Card className="p-4">
          <div className="mb-3">
            <div className="text-base font-semibold text-slate-800">
              الجدول التفصيلي
            </div>
            <div className="text-sm text-slate-500">
              المرحلة | المؤشر | week1 | w2 | w3 | w4 | الإجمالي
            </div>
          </div>

          <div className="overflow-auto rounded-xl border border-emerald-100">
            <table className="min-w-full text-sm">
              <thead className="bg-emerald-50">
                <tr className="text-slate-700">
                  <th className="text-right px-3 py-2 font-semibold">المرحلة</th>
                  <th className="text-right px-3 py-2 font-semibold">المؤشر</th>
                  <th className="text-right px-3 py-2 font-semibold">week1</th>
                  <th className="text-right px-3 py-2 font-semibold">w2</th>
                  <th className="text-right px-3 py-2 font-semibold">w3</th>
                  <th className="text-right px-3 py-2 font-semibold">w4</th>
                  <th className="text-right px-3 py-2 font-semibold">الإجمالي</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((r, idx) => {
                  const total = sum([r.week1, r.w2, r.w3, r.w4]);
                  return (
                    <tr
                      key={idx}
                      className="border-t border-emerald-100 hover:bg-emerald-50/40 transition"
                    >
                      <td className="px-3 py-2 text-slate-800 whitespace-nowrap">
                        {r.stage}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {r.metric}
                      </td>
                      <td className="px-3 py-2">{formatNumber(r.week1)}</td>
                      <td className="px-3 py-2">{formatNumber(r.w2)}</td>
                      <td className="px-3 py-2">{formatNumber(r.w3)}</td>
                      <td className="px-3 py-2">{formatNumber(r.w4)}</td>
                      <td className="px-3 py-2 font-semibold text-slate-900">
                        {formatNumber(total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
