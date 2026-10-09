"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/libs/api";
import { toast } from "react-hot-toast";
import { Loader2, CheckCircle2, AlertCircle, X, Sparkles } from "lucide-react";

type GenerationStatus = "idle" | "generating" | "completed" | "failed";

interface PracticeTestBuilderModalProps {
  lesson: { id: number; title: string };
  onClose: () => void;
  onSuccess?: (testId?: number) => void;
  testIndex?: number;
}

export function PracticeTestBuilderModal({
  lesson,
  onClose,
  onSuccess,
  testIndex,
}: PracticeTestBuilderModalProps) {
  const [mcqCount, setMcqCount] = useState<string>("");
  const [cqCount, setCqCount] = useState<string>("");
  const [includeVideoTest, setIncludeVideoTest] = useState<boolean>(false);
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [requestId, setRequestId] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const [showConfirm, setShowConfirm] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (status === "generating" && requestId !== null) {
      let lastStatus = status;
      pollRef.current = setInterval(async () => {
        try {
          const res = await api.get(`/tests/ai/requests/${requestId}`);
          const data = res.data;
          if (data.status === "completed") {
            lastStatus = data.status;
            setStatus("completed");
            toast.success("Practice test generated successfully!");
            if (pollRef.current) clearInterval(pollRef.current);
            onSuccessRef.current?.(data.testId);
            onClose();
          } else if (data.status === "failed") {
            lastStatus = data.status;
            setStatus("failed");
            const errMsg = data.errorMessage || "AI generation failed.";
            setError(errMsg);
            toast.error(errMsg);
            if (pollRef.current) clearInterval(pollRef.current);
          } else if (lastStatus !== data.status) {
            lastStatus = data.status;
          }
        } catch {
          setError("Failed to check generation status.");
          setStatus("failed");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 2000);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status, requestId, onClose]);

  const doGenerate = async () => {
    const mcqNum = parseInt(mcqCount, 10);
    const cqNum = parseInt(cqCount, 10);

    setStatus("generating");
    setError("");

    try {
      const res = await api.post("/tests/ai/practice/generate", {
        lessonId: lesson.id,
        mcqCount: mcqNum,
        cqCount: cqNum,
        includeVideoTest,
        testIndex,
      });
      if (res.data.status === "failed") {
        setStatus("failed");
        const failMsg = res.data.errorMessage || "AI generation failed.";
        setError(failMsg);
        toast.error(failMsg);
        return;
      }
      setRequestId(res.data.id);
    } catch (err: any) {
      const genErr = err.response?.data?.message || "Failed to start AI generation.";
      setError(genErr);
      toast.error(genErr);
      setStatus("failed");
    }
  };

  const handleGenerate = () => {
    if (mcqCount.trim() === "" || cqCount.trim() === "") {
      setError("Enter MCQ and CQ counts.");
      return;
    }
    const mcqNum = parseInt(mcqCount, 10);
    const cqNum = parseInt(cqCount, 10);
    if (isNaN(mcqNum) || mcqNum < 0 || mcqNum > 20) {
      setError("MCQ Count must be a number between 0 and 20.");
      return;
    }
    if (isNaN(cqNum) || cqNum < 0 || cqNum > 10) {
      setError("CQ Count must be a number between 0 and 10.");
      return;
    }
    if (mcqNum === 0 && cqNum === 0 && !includeVideoTest) {
      setError("At least one of MCQ, CQ, or Video test must be selected.");
      return;
    }
    setShowConfirm(true);
  };

  const confirmGenerate = () => {
    setShowConfirm(false);
    doGenerate();
  };

  const isBusy = status === "generating";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-[#121212] animate-scaleIn">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
            <Sparkles size={16} className="text-amber-500" /> Generate Practice Test
          </h3>
          <button onClick={onClose} disabled={isBusy} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800"><X size={16} /></button>
        </div>

        <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
          AI will generate a practice test for <span className="font-semibold text-slate-700 dark:text-zinc-200">"{lesson.title}"</span> from the lesson material.
        </p>

        {error && (
          <div className="mb-3 flex items-center gap-2 p-3 text-xs bg-red-50 text-red-600 rounded-xl dark:bg-red-950/20 dark:text-red-400">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {status === "completed" && (
          <div className="mb-3 flex items-center gap-2 p-3 text-xs bg-emerald-50 text-emerald-600 rounded-xl dark:bg-emerald-950/20 dark:text-emerald-400">
            <CheckCircle2 size={14} /> Practice test generated successfully.
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">MCQ Count</label>
            <input
              type="number"
              min={0}
              max={20}
              value={mcqCount}
              onChange={e => setMcqCount(e.target.value)}
              disabled={isBusy}
              className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-800"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">Descriptive (CQ) Count</label>
            <input
              type="number"
              min={0}
              max={10}
              value={cqCount}
              onChange={e => setCqCount(e.target.value)}
              disabled={isBusy}
              className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-800"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-zinc-200">
            <input
              type="checkbox"
              checked={includeVideoTest}
              onChange={e => setIncludeVideoTest(e.target.checked)}
              disabled={isBusy}
              className="accent-blue-600 h-4 w-4"
            />
            Include video test (recorded answer)
          </label>
        </div>

        {isBusy && (
          <div className="mt-4 flex flex-col items-center justify-center gap-2 py-4">
            <Loader2 size={24} className="text-blue-500 animate-spin" />
            <p className="text-xs text-slate-400 animate-pulse">Generating practice test with AI...</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-100 dark:border-zinc-800/80">
          <button onClick={onClose} disabled={isBusy} className="rounded-xl border border-slate-200 bg-transparent px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800">Cancel</button>
          <button onClick={handleGenerate} disabled={isBusy} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {isBusy ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>

      {/* Confirmation Modal Overlay */}
      {showConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-[#121212] animate-scaleIn">
            <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-zinc-50">
              <AlertCircle size={20} className="text-amber-500" /> Confirm Generation
            </h3>
            <p className="mb-6 text-sm text-slate-600 dark:text-zinc-400">
              Are you sure you want to generate a practice test with <strong>{mcqCount} MCQs</strong> and <strong>{cqCount} CQs</strong>{includeVideoTest ? " and a Video test" : ""}?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowConfirm(false)} className="rounded-xl border border-slate-200 bg-transparent px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800">
                Cancel
              </button>
              <button onClick={confirmGenerate} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
