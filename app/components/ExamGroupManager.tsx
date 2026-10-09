"use client";

import { useState, useEffect } from "react";
import { api } from "@/libs/api";
import toast from "react-hot-toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { PlusCircle, Search, Filter, Loader2, BookOpen } from "lucide-react";
import { SelectDropdown } from "./SelectDropdown";
import { ExamGroup } from "@/hooks/useExamGroups";
import { ExamGroupCard } from "@/components/ExamGroupCard";

export function ExamGroupManager() {
  const [examGroups, setExamGroups] = useState<ExamGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<any>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ title: "", description: "", status: "draft", startTime: "", endTime: "", timePerQuestion: "", thumbnailUrl: "" });
  const [isCreating, setIsCreating] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [deleteExamId, setDeleteExamId] = useState<number | null>(null);

  const fetchExamGroups = async () => {
    setLoading(true);
    try {
      const res = await api.get("/exam-groups", { params: { page, limit: 10, q: search || undefined, status: statusFilter || undefined } });
      const data = res.data;
      if (Array.isArray(data)) {
        setExamGroups(data);
        setMeta({ totalItems: data.length, totalPages: 1, currentPage: 1 });
      } else {
        setExamGroups(data.data || []);
        setMeta(data.meta || {});
      }
    } catch {
      setExamGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchExamGroups(); }, [page, search, statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      let thumbnailUrl = createForm.thumbnailUrl;
      if (thumbnailFile) {
        const formData = new FormData();
        formData.append("file", thumbnailFile);
        const uploadRes = await api.post("/exam-groups/upload-thumbnail", formData, { headers: { "Content-Type": "multipart/form-data" } });
        thumbnailUrl = uploadRes.data.url;
      }

      const payload: any = { ...createForm, thumbnailUrl };
      if (payload.timePerQuestion === "") delete payload.timePerQuestion;
      else payload.timePerQuestion = Number(payload.timePerQuestion);

      if (payload.startTime) payload.startTime = new Date(payload.startTime).toISOString();
      if (payload.endTime) payload.endTime = new Date(payload.endTime).toISOString();

      await api.post("/exam-groups", payload);
      toast.success("Exam group created successfully!");
      setIsCreateModalOpen(false);
      setCreateForm({ title: "", description: "", status: "draft", startTime: "", endTime: "", timePerQuestion: "", thumbnailUrl: "" });
      setThumbnailFile(null);
      fetchExamGroups();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create exam group.");
    } finally {
      setIsCreating(false);
    }
  };

  const confirmDelete = async (id: number) => {
    try {
      await api.delete(`/exam-groups/${id}`);
      toast.success("Exam group deleted.");
      setDeleteExamId(null);
      fetchExamGroups();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete exam group.");
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-8 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">Exam Groups</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Create and manage timed MCQ exam groups.</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm shrink-0 self-start sm:self-center"
        >
          <PlusCircle size={15} /> Create Exam
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-1 flex-col sm:flex-row items-center gap-3 max-w-2xl">
          <div className="relative flex-1 w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search exam groups..."
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
            />
          </div>
          <div className="relative w-full sm:w-auto">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <SelectDropdown
              value={statusFilter}
              onChange={(v) => { setPage(1); setStatusFilter(v); }}
              options={[
                { value: "", label: "All statuses" },
                { value: "draft", label: "Draft" },
                { value: "active", label: "Active" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
              ]}
              className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
              ariaLabel="Filter exam groups by status"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Loading exam groups...</p>
        </div>
      ) : examGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
          <BookOpen size={40} className="text-slate-300 dark:text-zinc-700" />
          <p className="text-sm text-slate-500">No exam groups found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {examGroups.map((eg) => (
            <ExamGroupCard
              key={eg.id}
              examGroup={{ ...eg, totalQuestions: (eg as any).questions?.length ?? 0 }}
              onManage={() => { window.location.href = `/dashboard/exam-groups/${eg.id}/manage`; }}
              onDelete={() => setDeleteExamId(eg.id)}
              showActions
              userRole="admin"
            />
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <span className="text-xs text-slate-500">Page {meta.currentPage} of {meta.totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-zinc-800 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
            >
              Previous
            </button>
            <button
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-zinc-800 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-[#121212]">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-50 mb-4">Create Exam Group</h3>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Title *</label>
                <input type="text" required value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Description</label>
                <textarea value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900" rows={3} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Status</label>
                <SelectDropdown
                  value={createForm.status}
                  onChange={(v) => setCreateForm({ ...createForm, status: v })}
                  options={[
                    { value: "draft", label: "Draft" },
                    { value: "active", label: "Active" },
                    { value: "completed", label: "Completed" },
                    { value: "cancelled", label: "Cancelled" },
                  ]}
                  className="rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
                  ariaLabel="Exam group status"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Start Time</label>
                  <input type="datetime-local" value={createForm.startTime} onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">End Time</label>
                  <input type="datetime-local" value={createForm.endTime} onChange={(e) => setCreateForm({ ...createForm, endTime: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Total Time Limit (minutes, optional)</label>
                <input type="number" min="1" value={createForm.timePerQuestion} onChange={(e) => setCreateForm({ ...createForm, timePerQuestion: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Thumbnail</label>
                <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0] || null; setThumbnailFile(file); }} className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs dark:border-zinc-800 dark:bg-zinc-900" />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="rounded-xl border border-slate-200 dark:border-zinc-800 px-4 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 transition">Cancel</button>
                <button type="submit" disabled={isCreating} className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 text-xs font-bold transition">
                  {isCreating ? "Creating..." : "Create Exam"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteExamId !== null}
        onCancel={() => setDeleteExamId(null)}
        onConfirm={() => deleteExamId && confirmDelete(deleteExamId)}
        title="Delete Exam Group"
        message="Are you sure you want to delete this exam group? This action cannot be undone and will delete all associated questions, enrollments, and submissions."
        confirmText="Delete Exam Group"
      />
    </div>
  );
}
