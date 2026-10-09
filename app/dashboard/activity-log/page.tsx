"use client";

import React, { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { SelectDropdown } from "@/components/SelectDropdown";
import { useUser } from "@/hooks/useUser";
import { api } from "@/libs/api";
import { getActionBadgeClasses, formatAction, getRoleBadgeClasses } from "@/libs/actionColors";
import {
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  ScrollText,
  X,
  RefreshCw,
} from "lucide-react";
import { toast } from "react-hot-toast";

const TARGET_TYPES = [
  "Course",
  "Lesson",
  "Test",
  "Submission",
  "Category",
  "User",
  "RecycleBin",
];

function formatKey(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").toLowerCase();
}

function formatChange(item: any) {
  if (item.from !== undefined && item.to !== undefined) {
    return `Mark changed from ${item.from} to ${item.to}`;
  }
  if (item.from !== undefined) return `from ${item.from}`;
  if (item.to !== undefined) return `to ${item.to}`;
  return JSON.stringify(item);
}

function formatValue(v: any) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function DetailsView({ details }: { details: any }) {
  if (details === null || details === undefined) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  if (typeof details !== "object") {
    return <span className="text-xs text-slate-500 dark:text-zinc-400 break-words">{String(details)}</span>;
  }
  const entries = Object.entries(details);
  if (entries.length === 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  return (
    <div className="flex flex-col gap-1">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-start gap-1.5">
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">{formatKey(k)}:</span>
          <span className="text-xs font-mono text-slate-600 dark:text-zinc-300 break-words">
            {Array.isArray(v) ? (
              v.length === 0 ? "—" : (
                <span className="flex flex-col gap-0.5">
                  {v.map((item: any, i: number) => (
                    <span key={i} title={typeof item === "object" && item?.question ? String(item.question) : undefined}>
                      {typeof item === "object" && item !== null ? formatChange(item) : String(item)}
                    </span>
                  ))}
                </span>
              )
            ) : (
              formatValue(v)
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ActivityLogPage() {
  const { role } = useUser();
  const isAdmin = role === "admin";

  const [logs, setLogs] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 10 });
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [actorId, setActorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const [actionsList, setActionsList] = useState<string[]>([]);

  const loadActions = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get("/activity-logs/actions");
      setActionsList(Array.isArray(res.data) ? res.data : []);
    } catch {
      // ignore — the filter dropdown will simply be empty
    }
  }, [isAdmin]);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  const fetchLogs = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const params: any = { page, limit: meta.itemsPerPage || 10 };
      if (q.trim()) params.q = q.trim();
      if (action) params.action = action;
      if (targetType) params.targetType = targetType;
      if (actorId.trim()) params.actorId = actorId.trim();
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await api.get("/activity-logs", { params });
      setLogs(res.data?.data || []);
      setMeta(res.data?.meta || {});
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load activity logs.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, page, meta.itemsPerPage, q, action, targetType, actorId, from, to]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const resetFilters = () => {
    setQ("");
    setAction("");
    setTargetType("");
    setActorId("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  if (!isAdmin) {
    return (
      <ProtectedRoute>
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <ScrollText size={40} className="text-slate-300 dark:text-zinc-700" />
          <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
            Only admin users can view the Activity Log.
          </p>
        </div>
      </ProtectedRoute>
    );
  }

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
  const labelCls =
    "text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400";

  return (
    <ProtectedRoute>
      <div className="flex flex-col gap-5 animate-fadeIn">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-50">Activity Log</h1>
            <p className="text-xs text-slate-500 mt-0.5">Audit trail of all important admin actions across the platform.</p>
          </div>
          <button
            onClick={() => { setPage(1); fetchLogs(); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Search</label>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Action, admin, target..." className={`${inputCls} pl-8`} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Action</label>
              <SelectDropdown
                value={action}
                onChange={(v) => { setAction(v); setPage(1); }}
                options={[{ value: "", label: "All actions" }, ...actionsList.map(a => ({ value: a, label: formatAction(a) }))]}
                className={inputCls}
                ariaLabel="Filter by action"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Target Type</label>
              <SelectDropdown
                value={targetType}
                onChange={(v) => { setTargetType(v); setPage(1); }}
                options={[{ value: "", label: "All types" }, ...TARGET_TYPES.map(t => ({ value: t, label: t }))]}
                className={inputCls}
                ariaLabel="Filter by target type"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Admin ID</label>
              <input value={actorId} onChange={e => { setActorId(e.target.value); setPage(1); }} placeholder="e.g. TX-0001" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>From Date</label>
              <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>To Date</label>
              <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} className={inputCls} />
            </div>
            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <X size={13} /> Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-slate-900 dark:text-zinc-50">Log Entries</h4>
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full">
              {meta.totalItems} record{meta.totalItems !== 1 ? "s" : ""}
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={24} className="text-blue-500 animate-spin" />
              <span className="text-xs text-slate-400 font-medium animate-pulse">Loading activity...</span>
            </div>
          ) : logs.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No activity log entries match your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-zinc-800/50">
                  <tr>
                    {["Date", "Admin", "Role", "Action", "Target", "Details"].map(h => (
                      <th key={h} className="py-2.5 px-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: any) => (
                    <tr key={log.id} className="border-b border-slate-100 dark:border-zinc-800 align-top">
                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-slate-800 dark:text-zinc-100">{log.actorName}</span>
                          <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 rounded border border-purple-100 dark:border-purple-900/30 font-mono text-[10px] font-semibold tracking-wide w-fit">{log.actorId}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded border text-sm font-semibold ${getRoleBadgeClasses(log.actorRole)}`}>{log.actorRole}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-sm font-bold border whitespace-nowrap ${getActionBadgeClasses(log.action)}`}>{formatAction(log.action)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">{log.targetName || "—"}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{log.targetType ? `${log.targetType}${log.targetId ? ` · ${log.targetId}` : ""}` : ""}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {log.details ? (
                          <div className="max-w-[280px]">
                            <DetailsView details={log.details} />
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {logs.length > 0 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-zinc-800 mt-4">
              <span className="text-xs text-slate-500">
                Page {meta.currentPage} of {meta.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <button
                  onClick={() => setPage(Math.min(meta.totalPages, page + 1))}
                  disabled={page >= meta.totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
