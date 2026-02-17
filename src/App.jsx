// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
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
  Legend,
} from "recharts";
import { Hash, Users, Video, Eye, EyeOff, Info } from "lucide-react";
import logo from "./assets/Logotw.png";
import { SHEET_CSV_URLS, loadRowsFromPublishedCSV } from "./sheets";

/* ========================= Helpers ========================= */

const formatNumber = (n) => (Number(n) || 0).toLocaleString("ar-SA");

const WEEK_LABELS = {
  week1: "الأسبوع الأول",
  w2: "الأسبوع الثاني",
  w3: "الأسبوع الثالث",
  w4: "الأسبوع الرابع",
};

const MONTH_ORDER = {
  يناير: 1,
  فبراير: 2,
  مارس: 3,
  أبريل: 4,
  مايو: 5,
  يونيو: 6,
  يوليو: 7,
  أغسطس: 8,
  سبتمبر: 9,
  أكتوبر: 10,
  نوفمبر: 11,
  ديسمبر: 12,
};

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl bg-white shadow-sm border border-emerald-100 ${className}`}>
      {children}
    </div>
  );
}

function KPI({ icon: Icon, label, value, tone = "emerald" }) {
  const toneMap = {
    emerald: {
      box: "bg-emerald-50 border-emerald-100",
      icon: "text-emerald-700",
    },
    blue: {
      box: "bg-blue-50 border-blue-100",
      icon: "text-blue-700",
    },
    violet: {
      box: "bg-violet-50 border-violet-100",
      icon: "text-violet-700",
    },
  };

  const t = toneMap[tone] || toneMap.emerald;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`rounded-xl border p-2 ${t.box}`}>
          <Icon className={`h-5 w-5 ${t.icon}`} />
        </div>
        <div>
          <div className="text-sm text-slate-600">{label}</div>
          <div className="text-2xl font-bold text-slate-900">{formatNumber(value)}</div>
        </div>
      </div>
    </Card>
  );
}

function Select({ value, onChange, options, label, type = "default" }) {
  return (
    <label className="flex flex-col gap-1 min-w-[160px]">
      <span className="text-xs text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-xl border border-emerald-100 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
      >
        {options.map((op) => {
          let labelText = op;

          if (type === "week") labelText = op === "الكل" ? "الكل" : WEEK_LABELS[op] || op;

          return (
            <option key={op} value={op}>
              {labelText}
            </option>
          );
        })}
      </select>
    </label>
  );
}

/* ========================= App ========================= */

export default function App() {
  // ✅ نخلي السنوات مرتبة (الأحدث أول)
  const YEARS = useMemo(() => {
    const ys = Object.keys(SHEET_CSV_URLS || {});
    return ys.sort((a, b) => Number(b) - Number(a));
  }, []);

  // ✅ افتراضيًا: أحدث سنة
  const [year, setYear] = useState(YEARS[0] || "2026");
  const [month, setMonth] = useState("الكل");
  const [week, setWeek] = useState("الكل");
  const [metric, setMetric] = useState("مجموع الفيديوهات المصورة");

  const [rows, setRows] = useState([]);

  /* ========================= Progress (Auto Target) ========================= */

  // 🔒 خليها false قبل عرض المدير (تخفي حقول الإعدادات وأزرار التحكم)
  const [adminMode] = useState(false);

  const [remainingWords, setRemainingWords] = useState(
    Number(localStorage.getItem("remainingWords")) || 1159
  );
  const [repeatPerWord, setRepeatPerWord] = useState(
    Number(localStorage.getItem("repeatPerWord")) || 15
  );
  const [showProgress, setShowProgress] = useState(
    localStorage.getItem("showProgress") !== "false"
  );

  useEffect(() => {
    localStorage.setItem("remainingWords", String(remainingWords || 0));
  }, [remainingWords]);

  useEffect(() => {
    localStorage.setItem("repeatPerWord", String(repeatPerWord || 0));
  }, [repeatPerWord]);

  useEffect(() => {
    localStorage.setItem("showProgress", String(showProgress));
  }, [showProgress]);

  /* ========================= Load Data ========================= */

  useEffect(() => {
    async function load() {
      const parsed = await loadRowsFromPublishedCSV(SHEET_CSV_URLS[year]);
      setRows(parsed);
    }
    load();
  }, [year]);

  /* ========================= Dynamic Months + Weeks ========================= */

  const dynamicMonths = useMemo(() => {
    const set = new Set(rows.map((r) => r.month).filter(Boolean));
    const ordered = Array.from(set).sort((a, b) => {
      const aa = MONTH_ORDER[a] || 99;
      const bb = MONTH_ORDER[b] || 99;
      return aa - bb;
    });
    return ["الكل", ...ordered];
  }, [rows]);

  const dynamicWeeks = useMemo(() => {
    const set = new Set(rows.map((r) => r.weekKey).filter(Boolean));
    const order = ["week1", "w2", "w3", "w4"];
    const ordered = order.filter((w) => set.has(w));
    return ["الكل", ...ordered];
  }, [rows]);

  // ✅ Auto-select أحدث شهر/أسبوع عند فتح الداشبورد (بدون ما تضغطين)
  useEffect(() => {
    if (!rows.length) return;

    // إذا المستخدم ما اختار شيء (لسه "الكل") نخليه يروح للأحدث تلقائيًا
    if (month === "الكل") {
      const months = rows
        .map((r) => r.month)
        .filter(Boolean)
        .sort((a, b) => (MONTH_ORDER[b] || 0) - (MONTH_ORDER[a] || 0));
      if (months[0]) setMonth(months[0]);
    }

    // بعد اختيار الشهر تلقائيًا، لو الأسبوع "الكل" نخليه على أحدث أسبوع موجود داخل الشهر
    // (مرّة وحدة) عشان يطلع لك بيانات قريبة من "اليوم"
    // ملاحظة: إذا تبين يبقى "الكل" دائمًا احذفي هذا الجزء.
    if (week === "الكل") {
      const inMonth = rows.filter((r) => (month === "الكل" ? true : r.month === month));
      const order = ["week1", "w2", "w3", "w4"];
      const weeks = inMonth
        .map((r) => r.weekKey)
        .filter(Boolean);
      const latest = [...new Set(weeks)].sort(
        (a, b) => order.indexOf(b) - order.indexOf(a)
      )[0];
      if (latest) setWeek(latest);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  /* ========================= Filtering ========================= */

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (r.year !== year) return false;
      if (month !== "الكل" && r.month !== month) return false;
      if (week !== "الكل" && r.weekKey !== week) return false;
      return true;
    });
  }, [rows, year, month, week]);

  /* ========================= KPI ========================= */

  const totals = useMemo(() => {
    const people = filteredRows
      .filter((r) => r.metric === "عدد الأشخاص")
      .reduce((s, r) => s + r.value, 0);

    const words = filteredRows
      .filter((r) => r.metric === "عدد الكلمات")
      .reduce((s, r) => s + r.value, 0);

    const videos = filteredRows
      .filter((r) => r.metric === "مجموع الفيديوهات المصورة")
      .reduce((s, r) => s + r.value, 0);

    return { people, words, videos };
  }, [filteredRows]);

  /* ========================= Progress ========================= */

  const targetVideos = useMemo(() => {
    const w = Number(remainingWords) || 0;
    const r = Number(repeatPerWord) || 0;
    return w * r;
  }, [remainingWords, repeatPerWord]);

  // ✅ المنجز: سنة كاملة (عشان يكون “تقدم مشروع”)
  const totalVideosYear = useMemo(() => {
    return rows
      .filter((r) => r.metric === "مجموع الفيديوهات المصورة")
      .reduce((s, r) => s + r.value, 0);
  }, [rows]);

  const progressPercent =
    targetVideos > 0 ? Math.min((totalVideosYear / targetVideos) * 100, 100) : 0;

  const remainingVideos = Math.max(targetVideos - totalVideosYear, 0);

  /* ========================= Chart #1 (selected metric) ========================= */

  const metricOverTime = useMemo(() => {
    const map = {};
    filteredRows
      .filter((r) => r.metric === metric)
      .forEach((r) => {
        const key = week !== "الكل" ? r.day : r.weekLabel;
        if (!map[key]) map[key] = 0;
        map[key] += r.value;
      });

    return Object.keys(map).map((k) => ({
      label: k,
      value: map[k],
    }));
  }, [filteredRows, week, metric]);

  /* ========================= Chart #2 (3 metrics grouped) ========================= */

  const threeMetricsOverTime = useMemo(() => {
    const keyFn = (r) => (week !== "الكل" ? r.day : r.weekLabel);

    const map = new Map(); // key -> {label, people, words, videos}
    for (const r of filteredRows) {
      const label = keyFn(r);
      if (!label) continue;

      if (!map.has(label)) {
        map.set(label, { label, people: 0, words: 0, videos: 0 });
      }
      const obj = map.get(label);

      if (r.metric === "عدد الأشخاص") obj.people += r.value;
      if (r.metric === "عدد الكلمات") obj.words += r.value;
      if (r.metric === "مجموع الفيديوهات المصورة") obj.videos += r.value;
    }

    return Array.from(map.values());
  }, [filteredRows, week]);

  /* ========================= UI ========================= */

  return (
    <div dir="rtl" className="min-h-screen bg-emerald-50/40">
      {/* Header */}
      <div className="bg-white border-b border-emerald-100">
        <div className="mx-auto max-w-7xl px-4 py-4 flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="logo" className="h-10" />
            <div>
              <div className="text-lg font-bold text-slate-900">مؤشرات مشروع الصم</div>
              <div className="text-sm text-slate-600">Noura Saad – Product Specialist</div>
              <div className="mt-1 inline-flex items-center gap-1 text-xs rounded-full bg-emerald-50 border border-emerald-100 px-2 py-1 text-emerald-800">
                <Info className="h-3.5 w-3.5" />
                ملاحظة: بداية احتساب الداشبورد من ديسمبر 2025 إلى الآن
              </div>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Select label="السنة" value={year} onChange={setYear} options={YEARS} />
            <Select label="الشهر" value={month} onChange={setMonth} options={dynamicMonths} />
            <Select
              label="الأسبوع"
              value={week}
              onChange={setWeek}
              options={dynamicWeeks}
              type="week"
            />
            <Select
              label="المؤشر"
              value={metric}
              onChange={setMetric}
              options={["عدد الأشخاص", "عدد الكلمات", "مجموع الفيديوهات المصورة"]}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* ===== Progress Section ===== */}
        {showProgress && targetVideos > 0 && (
          <Card className="p-4">
            <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
              <div className="font-semibold text-slate-800">تقدم المشروع الكلي</div>

              {adminMode && (
                <button
                  onClick={() => setShowProgress(false)}
                  className="text-emerald-700 flex items-center gap-1 text-sm"
                  title="إخفاء هذا القسم"
                >
                  <EyeOff size={16} /> إخفاء
                </button>
              )}
            </div>

            {/* ✅ هنا تكبير/تلوين الكلمات المتبقية */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm text-slate-700 mb-3">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                <div className="text-xs text-slate-600 mb-1">الهدف (فيديو)</div>
                <div className="font-bold">{formatNumber(targetVideos)}</div>
                <div className="text-xs text-slate-500 mt-1">
                  = {formatNumber(remainingWords)} كلمة × {formatNumber(repeatPerWord)} تكرار
                </div>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                <div className="text-xs text-slate-600 mb-1">المنجز حتى الآن</div>
                <div className="font-bold">{formatNumber(totalVideosYear)}</div>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                <div className="text-xs text-slate-600 mb-1">المتبقي (فيديو)</div>
                <div className="font-bold">{formatNumber(remainingVideos)}</div>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <div className="text-xs text-red-700 mb-1">الكلمات المتبقية</div>
                <div className="text-2xl font-extrabold text-red-700">
                  {formatNumber(remainingWords)}
                </div>
              </div>
            </div>

            <div className="w-full h-4 bg-emerald-50 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="text-xs mt-2 text-slate-600">
              نسبة الإنجاز: {progressPercent.toFixed(1)}%
            </div>
          </Card>
        )}

        {adminMode && !showProgress && (
          <button
            onClick={() => setShowProgress(true)}
            className="text-emerald-700 flex items-center gap-1 text-sm"
            title="إظهار قسم التقدم"
          >
            <Eye size={16} /> إظهار قسم التقدم
          </button>
        )}

        {adminMode && (
          <Card className="p-4">
            <div className="font-semibold text-slate-800 mb-3">إعدادات الهدف (لك فقط)</div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-600">الكلمات المتبقية</span>
                <input
                  type="number"
                  value={remainingWords}
                  onChange={(e) => setRemainingWords(Number(e.target.value))}
                  className="h-10 rounded-xl border border-emerald-100 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-600">عدد التكرار لكل كلمة</span>
                <input
                  type="number"
                  value={repeatPerWord}
                  onChange={(e) => setRepeatPerWord(Number(e.target.value))}
                  className="h-10 rounded-xl border border-emerald-100 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </label>

              <div className="text-sm text-slate-700">
                <div className="text-xs text-slate-600 mb-1">الهدف الناتج</div>
                <div className="font-bold text-slate-900">{formatNumber(targetVideos)} فيديو</div>
              </div>
            </div>

            <div className="text-xs text-slate-500 mt-3 leading-6">
              💡 لإخفاء قسم التقدم قبل عرض الداشبورد للمدير: فعّلي adminMode مؤقتًا ثم اضغطي “إخفاء”.
            </div>
          </Card>
        )}

        {/* KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPI icon={Users} label="عدد الأشخاص" value={totals.people} tone="emerald" />
          <KPI icon={Hash} label="عدد الكلمات" value={totals.words} tone="violet" />
          <KPI icon={Video} label="مجموع الفيديوهات المصورة" value={totals.videos} tone="blue" />
        </div>

        {/* Chart #1 */}
        <Card className="p-4">
          <div className="mb-3 font-semibold text-slate-800">{metric} عبر الزمن</div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metricOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#059669" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart #2 */}
        <Card className="p-4">
          <div className="mb-3 font-semibold text-slate-800">
            مقارنة المؤشرات الثلاثة عبر {week !== "الكل" ? "الأيام" : "الأسابيع"}
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={threeMetricsOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="people" name="عدد الأشخاص" fill="#059669" radius={[8, 8, 0, 0]} />
                <Bar dataKey="words" name="عدد الكلمات" fill="#7c3aed" radius={[8, 8, 0, 0]} />
                <Bar dataKey="videos" name="مجموع الفيديوهات" fill="#2563eb" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Table */}
        <Card className="p-4">
          <div className="mb-3 font-semibold text-slate-800">جدول تفصيلي</div>

          <div className="overflow-auto rounded-xl border border-emerald-100">
            <table className="min-w-full text-sm">
              <thead className="bg-emerald-50">
                <tr>
                  <th className="px-3 py-2 text-right">الشهر</th>
                  <th className="px-3 py-2 text-right">الأسبوع</th>
                  <th className="px-3 py-2 text-right">اليوم</th>
                  <th className="px-3 py-2 text-right">المؤشر</th>
                  <th className="px-3 py-2 text-right">القيمة</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r, i) => (
                  <tr key={i} className="border-t border-emerald-100 hover:bg-emerald-50/40">
                    <td className="px-3 py-2">{r.month}</td>
                    <td className="px-3 py-2">{r.weekLabel}</td>
                    <td className="px-3 py-2">{r.day}</td>
                    <td className="px-3 py-2">{r.metric}</td>
                    <td className="px-3 py-2 font-semibold">{formatNumber(r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
