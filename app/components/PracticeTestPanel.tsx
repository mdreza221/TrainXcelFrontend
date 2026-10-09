"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/libs/api";
import { toast } from "react-hot-toast";
import { TestPlayer } from "./TestPlayer";
import { PracticeTestBuilderModal } from "./PracticeTestBuilderModal";
import { ConfirmModal } from "./ConfirmModal";
import { Sparkles, Play, Eye, Trash2, Loader2, FileText, Clock, Brain, X } from "lucide-react";

interface PracticeTestPanelProps {
  lesson: { id: number; title: string; materialType: string; practiceEnabled?: boolean };
}

export function PracticeTestPanel({ lesson }: PracticeTestPanelProps) {
  const [tests, setTests] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [activeTest, setActiveTest] = useState<any | null>(null);
  const [deleteTestId, setDeleteTestId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchPracticeTests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tests/practice/${lesson.id}`);
      const data = res.data || [];
      setTests(data);

      const subs: Record<number, any> = {};
      await Promise.all(data.map(async (t: any) => {
        try {
          const sRes = await api.get(`/tests/${t.id}/my-submission`);
          subs[t.id] = sRes.data || null;
        } catch {
          subs[t.id] = null;
        }
      }));
      setSubmissions(subs);
      return data;
    } catch {
      setTests([]);
      setSubmissions({});
      return [];
    } finally {
      setLoading(false);
    }
  }, [lesson.id]);

  useEffect(() => {
    fetchPracticeTests();
  }, [fetchPracticeTests]);

  if (lesson.materialType === "Video") return null;

  const handleDelete = async () => {
    if (!deleteTestId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/tests/practice/${deleteTestId}`);
      toast.success("Practice test deleted.");
      setTests(prev => prev.filter(t => t.id !== deleteTestId));
      if (activeTest?.id === deleteTestId) setActiveTest(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete practice test.");
    } finally {
      setIsDeleting(false);
      setDeleteTestId(null);
    }
  };

  return (
    <div className="mt-6 animate-fadeIn">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="text-amber-500" size={18} />
            <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50">AI Test Practice</h3>
          </div>
          <button
            onClick={() => setShowBuilder(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition"
          >
            <Sparkles size={14} /> Generate Practice Test
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-zinc-400 mb-5">
          Generate AI-powered practice questions from this lesson&apos;s material. Practice tests are private to you and are not scored in the leaderboard.
        </p>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 size={24} className="text-blue-500 animate-spin" />
            <span className="text-xs text-slate-400 font-medium animate-pulse">Loading practice tests...</span>
          </div>
        ) : tests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
            <FileText className="text-slate-300 dark:text-zinc-600" size={28} />
            <p className="text-xs text-slate-400">No practice tests yet. Generate one to start practicing!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {tests.map(test => {
              const hasTaken = !!submissions[test.id];
              const submission = submissions[test.id];
              const pending = hasTaken && submission?.status === "Pending Evaluation";
              const evaluated = hasTaken && submission?.status === "Evaluated";
              const hasAiQuestions = test.questions?.some((q: any) => q.evaluationType === "AI");
              return (
                <div key={test.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="text-blue-500 shrink-0" size={16} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate">{test.title}</p>
                      <p className="text-[10px] text-slate-400">{test.questions?.length || 0} questions</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {pending && (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400">
                        <Clock size={11} /> Pending Evaluation
                      </span>
                    )}
                    {evaluated && submission && (() => {
                      const totalMarks = test.questions.reduce((sum: number, q: any) => sum + q.marks, 0);
                      return (
                        <span className="text-[10px] font-bold text-green-600 dark:text-green-400">
                          {submission.marksObtained} / {totalMarks}
                        </span>
                      );
                    })()}
                    {!hasTaken ? (
                      <button
                        onClick={() => setActiveTest(test)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-semibold transition"
                      >
                        <Play size={12} /> Take Test
                      </button>
                    ) : (
                      <button
                        onClick={() => setActiveTest(test)}
                        className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700 rounded-lg text-xs font-semibold transition"
                      >
                        <Eye size={12} /> Review Answers
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteTestId(test.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
                      title="Delete practice test"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeTest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-5xl flex flex-col h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-blue-50 dark:bg-zinc-900">
              <h2 className="font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                <Brain size={18} className="text-blue-600" /> Practice Test: {activeTest.title}
              </h2>
              <button onClick={() => setActiveTest(null)} className="p-2 rounded-full hover:bg-blue-100 dark:hover:bg-zinc-800 transition text-slate-500">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 bg-slate-50/30 dark:bg-[#121212]">
              <TestPlayer
                externalTest={activeTest}
                isAdmin={false}
                hideLeaderboard
                autoStart
                isModalMode
                onSuccess={async () => {
                  await fetchPracticeTests();
                }}
                onCancel={() => setActiveTest(null)}
              />
            </div>
          </div>
        </div>
      )}

      {showBuilder && (
        <PracticeTestBuilderModal
          lesson={lesson}
          testIndex={tests.length + 1}
          onClose={() => setShowBuilder(false)}
          onSuccess={async (testId) => {
            const data = await fetchPracticeTests();
            const generated = testId
              ? data.find((t: any) => t.id === testId)
              : data[data.length - 1];
            if (generated) setActiveTest(generated);
          }}
        />
      )}

      <ConfirmModal
        isOpen={deleteTestId !== null}
        title="Delete Practice Test"
        message="This will permanently delete this practice test and its attempts. You cannot undo this action."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTestId(null)}
        confirmText="Delete"
        isLoading={isDeleting}
      />
    </div>
  );
}
