import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getDashboardRevenue } from "../api/dashboard";
import { Skeleton } from "../components/Skeleton";

const BRAND = "#61B0BC";

const RANGE_OPTIONS = [
  "Today",
  "Last 7 days",
  "Last 30 days",
  "This month",
  "Last month",
  "This year",
  "Custom",
];

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rangeFor(key) {
  const now = new Date();
  const today = isoDate(now);
  switch (key) {
    case "Today":
      return [today, today];
    case "Last 7 days": {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      return [isoDate(s), today];
    }
    case "Last 30 days": {
      const s = new Date(now);
      s.setDate(s.getDate() - 29);
      return [isoDate(s), today];
    }
    case "This month":
      return [isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), today];
    case "Last month":
      return [
        isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        isoDate(new Date(now.getFullYear(), now.getMonth(), 0)),
      ];
    case "This year":
      return [`${now.getFullYear()}-01-01`, today];
    default:
      return ["", ""];
  }
}

function formatMoney(value) {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return value ?? "—";
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatShortDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatPeriodLabel(period) {
  // "2026-09-24" → "Sep 24"; "2026-09" → "Sep 2026"
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    const d = new Date(`${period}T00:00:00`);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  return period;
}

function pctChange(current, previous) {
  const cur = parseFloat(current) || 0;
  const prev = parseFloat(previous) || 0;
  if (prev === 0) return cur === 0 ? null : "new";
  return ((cur - prev) / prev) * 100;
}

function ChangeArrow({ change }) {
  if (change === null) {
    return <span className="text-xs font-sans text-gray-400">no change vs previous</span>;
  }
  if (change === "new") {
    return (
      <span className="text-xs font-sans text-emerald-600 font-medium">
        ↑ new vs previous
      </span>
    );
  }
  const up = change >= 0;
  const abs = Math.abs(change);
  const rounded = abs >= 10 ? Math.round(abs) : Math.round(abs * 10) / 10;
  return (
    <span
      className={`text-xs font-sans font-medium ${up ? "text-emerald-600" : "text-red-500"}`}
    >
      {up ? "↑" : "↓"} {rounded}% vs previous
    </span>
  );
}

function SummaryCard({ label, value, change }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 min-h-[92px]">
      <p className="text-xs font-sans text-gray-500">{label}</p>
      <p className="text-xl font-display font-bold text-gray-900 mt-1 break-words">
        {value}
      </p>
      <div className="mt-1">
        <ChangeArrow change={change} />
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label, money = true }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-md px-3 py-2 shadow-sm">
      <p className="text-xs font-sans font-semibold text-gray-900">
        {formatPeriodLabel(label)}
      </p>
      <p className="text-xs font-sans text-gray-600">
        {money ? formatMoney(payload[0].value) : payload[0].value}
      </p>
    </div>
  );
}

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportOrdersCsv(orders, start, end) {
  const header = ["Order number", "Date", "Customer", "Total"];
  const lines = [header.join(",")];
  for (const o of orders) {
    const name =
      [o.first_name, o.last_name].filter(Boolean).join(" ").trim() || o.email || "Guest";
    lines.push(
      [
        `#${o.id}`,
        formatShortDate(o.created_at),
        csvEscape(name),
        parseFloat(o.total_amount).toFixed(2),
      ].join(",")
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `revenue-orders-${start}-to-${end}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function RevenuePanel() {
  const [rangeKey, setRangeKey] = useState("This month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [start, end] = useMemo(() => {
    if (rangeKey === "Custom") return [customStart, customEnd];
    return rangeFor(rangeKey);
  }, [rangeKey, customStart, customEnd]);

  const dateError =
    rangeKey === "Custom" && (!customStart || !customEnd)
      ? "Pick a start and end date."
      : "";
  const error = dateError || fetchError;
  const ready = !dateError;

  useEffect(() => {
    if (!start || !end) return undefined;
    let cancelled = false;
    getDashboardRevenue(start, end)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setFetchError("");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const detail = err?.response?.data?.detail;
          setFetchError(
            detail ||
              `Failed to load revenue${err?.response?.status ? ` (${err.response.status})` : ""}.`
          );
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [start, end]);

  const cur = data?.current;
  const prev = data?.previous;
  const ordersTotal = useMemo(() => {
    if (!data?.orders) return 0;
    return data.orders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
  }, [data]);

  const chartData = useMemo(
    () => (data?.series || []).map((p) => ({ ...p, value: parseFloat(p.revenue) })),
    [data]
  );
  const categoryData = useMemo(
    () =>
      (data?.by_category || []).map((c) => ({
        ...c,
        value: parseFloat(c.revenue),
      })),
    [data]
  );
  const hasAnyOrder = (cur?.orders || 0) > 0;

  const tableCls =
    "w-full text-left text-sm font-sans border-collapse hidden sm:table";

  return (
    <section aria-label="Revenue" className="space-y-6">
      {/* Range selector */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="revenue-range" className="sr-only">
            Time period
          </label>
          <select
            id="revenue-range"
            value={rangeKey}
            onChange={(e) => setRangeKey(e.target.value)}
            className="min-h-[44px] px-3 text-sm font-sans text-gray-900 border border-gray-200 rounded-md outline-none focus:border-primary bg-white"
          >
            {RANGE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        {rangeKey === "Custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-sans text-gray-500" htmlFor="rev-start">
              From
            </label>
            <input
              id="rev-start"
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="min-h-[44px] px-3 text-sm font-sans border border-gray-200 rounded-md outline-none focus:border-primary"
            />
            <label className="text-xs font-sans text-gray-500" htmlFor="rev-end">
              To
            </label>
            <input
              id="rev-end"
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="min-h-[44px] px-3 text-sm font-sans border border-gray-200 rounded-md outline-none focus:border-primary"
            />
          </div>
        )}
        {ready && data && data.orders?.length > 0 && (
          <button
            type="button"
            onClick={() => exportOrdersCsv(data.orders, data.start, data.end)}
            className="min-h-[44px] px-4 text-sm font-sans rounded-md border border-primary text-primary hover:bg-primary/5 transition-colors cursor-pointer"
          >
            Export CSV
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-accent text-sm font-sans">
          {error}
        </p>
      )}

      {ready && loading && (
        <div className="space-y-3" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" rounded="rounded-lg" />
          ))}
        </div>
      )}

      {ready && !loading && !error && data && (
        <>
          <p className="text-xs font-sans text-gray-500">
            {formatShortDate(data.start)} – {formatShortDate(data.end)} ·
            {data.days === 1 ? " 1 day" : ` ${data.days} days`}
          </p>

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard
              label="Total revenue"
              value={formatMoney(cur.revenue)}
              change={pctChange(cur.revenue, prev.revenue)}
            />
            <SummaryCard
              label="Orders"
              value={String(cur.orders)}
              change={pctChange(cur.orders, prev.orders)}
            />
            <SummaryCard
              label="Average order"
              value={formatMoney(cur.average)}
              change={pctChange(cur.average, prev.average)}
            />
            <SummaryCard
              label="Items sold"
              value={String(cur.items_sold)}
              change={pctChange(cur.items_sold, prev.items_sold)}
            />
          </div>

          {/* Main chart */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-sans font-semibold text-gray-900 mb-3">
              Revenue over time
            </h3>
            {!hasAnyOrder ? (
              <div className="py-10 text-center">
                <p className="text-sm font-sans text-gray-500">
                  No orders in this period.
                </p>
                <p className="text-xs font-sans text-gray-400 mt-1">
                  Try a different time range above.
                </p>
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis
                      dataKey="period"
                      tickFormatter={formatPeriodLabel}
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      interval="preserveStartEnd"
                      minTickGap={24}
                    />
                    <YAxis
                      tickFormatter={(v) => `$${v}`}
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      width={56}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={BRAND}
                      strokeWidth={2}
                      dot={chartData.length <= 31}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Revenue by category */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-sans font-semibold text-gray-900 mb-3">
              Revenue by category
            </h3>
            {categoryData.length === 0 ? (
              <p className="text-sm font-sans text-gray-500 py-4">
                No category revenue in this period.
              </p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryData}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => `$${v}`}
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      width={92}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {categoryData.map((c) => (
                        <Cell key={c.category} fill={BRAND} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <ul className="mt-3 space-y-1 sm:hidden">
              {categoryData.map((c) => (
                <li
                  key={c.category}
                  className="flex justify-between text-sm font-sans text-gray-700"
                >
                  <span>{c.category}</span>
                  <span className="font-medium">{formatMoney(c.revenue)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Top products */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-sans font-semibold text-gray-900 mb-3">
              Top products
            </h3>
            {(data.top_products || []).length === 0 ? (
              <p className="text-sm font-sans text-gray-500 py-4">
                Nothing sold in this period.
              </p>
            ) : (
              <>
                <table className={tableCls}>
                  <thead>
                    <tr className="border-b border-gray-200 text-xs font-sans text-gray-500 uppercase tracking-wide">
                      <th className="py-2 pr-3 font-semibold">Product</th>
                      <th className="py-2 pr-3 font-semibold text-right">Quantity sold</th>
                      <th className="py-2 font-semibold text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_products.map((p) => (
                      <tr key={p.product_id} className="border-b border-gray-100">
                        <td className="py-2 pr-3 text-gray-900 break-words">{p.name}</td>
                        <td className="py-2 pr-3 text-right text-gray-700">{p.quantity}</td>
                        <td className="py-2 text-right text-gray-900 font-medium">
                          {formatMoney(p.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul className="sm:hidden space-y-2">
                  {data.top_products.map((p) => (
                    <li
                      key={p.product_id}
                      className="border border-gray-100 rounded-md p-3 text-sm font-sans"
                    >
                      <p className="text-gray-900 font-medium break-words">{p.name}</p>
                      <p className="text-gray-500 mt-1">
                        {p.quantity} sold · <span className="text-gray-900">{formatMoney(p.revenue)}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Orders in this period */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-sans font-semibold text-gray-900 mb-3">
              Orders in this period
            </h3>
            {data.orders.length === 0 ? (
              <p className="text-sm font-sans text-gray-500 py-4">No orders in this period.</p>
            ) : (
              <>
                <table className={tableCls}>
                  <thead>
                    <tr className="border-b border-gray-200 text-xs font-sans text-gray-500 uppercase tracking-wide">
                      <th className="py-2 pr-3 font-semibold">Order</th>
                      <th className="py-2 pr-3 font-semibold">Date</th>
                      <th className="py-2 pr-3 font-semibold">Customer</th>
                      <th className="py-2 font-semibold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.map((o) => {
                      const name =
                        [o.first_name, o.last_name].filter(Boolean).join(" ").trim() ||
                        o.email ||
                        "Guest";
                      return (
                        <tr key={o.id} className="border-b border-gray-100">
                          <td className="py-2 pr-3 text-gray-900">#{o.id}</td>
                          <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">
                            {formatShortDate(o.created_at)}
                          </td>
                          <td className="py-2 pr-3 text-gray-900 break-words">{name}</td>
                          <td className="py-2 text-right text-gray-900 whitespace-nowrap">
                            {formatMoney(o.total_amount)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-gray-300">
                      <td
                        colSpan={3}
                        className="py-2 pr-3 text-sm font-sans font-semibold text-gray-900"
                      >
                        Total
                      </td>
                      <td className="py-2 text-right text-sm font-sans font-bold text-gray-900 whitespace-nowrap">
                        {formatMoney(ordersTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <ul className="sm:hidden space-y-2">
                  {data.orders.map((o) => {
                    const name =
                      [o.first_name, o.last_name].filter(Boolean).join(" ").trim() ||
                      o.email ||
                      "Guest";
                    return (
                      <li
                        key={o.id}
                        className="border border-gray-100 rounded-md p-3 text-sm font-sans"
                      >
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-900 font-medium">#{o.id}</span>
                          <span className="text-gray-900 font-medium">
                            {formatMoney(o.total_amount)}
                          </span>
                        </div>
                        <p className="text-gray-500 mt-1 break-words">{name}</p>
                        <p className="text-gray-500">{formatShortDate(o.created_at)}</p>
                      </li>
                    );
                  })}
                  <li className="flex justify-between border-t-2 border-gray-300 pt-2 text-sm font-sans font-bold text-gray-900">
                    <span>Total</span>
                    <span>{formatMoney(ordersTotal)}</span>
                  </li>
                </ul>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
