"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/libs/api";
import toast from "react-hot-toast";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";

export default function ExamResultsPage() {
  const params = useParams();
  const router = useRouter();
  const examGroupId = Number(params.id);

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!examGroupId) return;
    setLoading(true);
    api.get(`/exam-groups/${examGroupId}/my-submissions`)
      .then((res) => setSubmissions(res.data || []))
      .catch(() => toast.error("Failed to load results."))
      .finally(() => setLoading(false));
  }, [examGroupId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-sm text-slate-500">Loading results...</p>
      </div>
    );
  }

  const latest = submissions[0];

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <button
          onClick={() => router.push(`/exam-groups/${examGroupId}`)}
          className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 mb-4"
        >
          <ArrowLeft size={14} /> Back to Exam
        </button>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-8 shadow-sm flex flex-col items-center gap-4">
          <CheckCircle className="h-14 w-14 text-green-500" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">Exam Results</h1>

          {latest ? (
            <div className="flex flex-col items-center gap-2 mt-4">
              <span className="text-xs text-slate-400 uppercase tracking-wider">Marks Obtained</span>
              <span className="text-4xl font-bold text-blue-600 dark:text-blue-400">{latest.marksObtained ?? 0}</span>
              <span className="text-xs text-slate-400">Submitted on {new Date(latest.submittedAt).toLocaleString()}</span>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No submissions found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
