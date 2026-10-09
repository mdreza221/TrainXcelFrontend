"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/libs/api";
import { toast } from "react-hot-toast";
import { Loader2, Upload, FileText, CheckCircle2, AlertCircle, ChevronRight, ArrowLeft } from "lucide-react";

type GenerationStatus = "idle" | "uploading" | "generating" | "completed" | "failed";

interface Lesson {
  id: number;
  lessonId: string;
  title: string;
}

interface AiTestBuilderProps {
  courseId: number;
  lessons: Lesson[];
  initialLessonId?: number;
  onSuccess?: () => void;
  onBack?: () => void;
}

export function AiTestBuilder({
  courseId,
  lessons,
  initialLessonId,
  onSuccess,
  onBack,
}: AiTestBuilderProps) {
  const searchParams = useSearchParams();
  const passedLessonId = searchParams.get("lessonId");

  const [selectedLessonId, setSelectedLessonId] = useState<string>(
    String(initialLessonId || passedLessonId || ""),
  );
  const [testTitle, setTestTitle] = useState<string>("");
  const [mcqCount, setMcqCount] = useState<string>("");
  const [cqCount, setCqCount] = useState<string>("");
  const [includeVideoTest, setIncludeVideoTest] = useState<boolean>(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string>("");

  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [requestId, setRequestId] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!selectedLessonId && lessons.length > 0) {
      const fallback = String(initialLessonId || passedLessonId || lessons[0].id);
      setSelectedLessonId(fallback);
    }
  }, [lessons, initialLessonId, passedLessonId, selectedLessonId]);

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
      console.log('[AiTestBuilder] polling requestId', requestId);
      let lastStatus = status;
      pollRef.current = setInterval(async () => {
        try {
          const res = await api.get(`/tests/ai/requests/${requestId}`);
          const data = res.data;
          console.log('[AiTestBuilder] poll response', data);
          if (data.status === "completed") {
            lastStatus = data.status;
            setStatus("completed");
            toast.success("Test generated successfully!");
            onSuccessRef.current?.();
            if (pollRef.current) clearInterval(pollRef.current);
          } else if (data.status === "failed") {
            lastStatus = data.status;
            setStatus("failed");
            const errMsg = data.errorMessage || "AI generation failed.";
            setError(errMsg);
            toast.error(errMsg);
            if (pollRef.current) clearInterval(pollRef.current);
          } else if (lastStatus !== data.status) {
            lastStatus = data.status;
            setStatus(data.status === "processing" ? "generating" : status);
          }
        } catch (err) {
          console.error("[AiTestBuilder] poll failed", err);
          const pollErr = "Failed to check generation status.";
          setError(pollErr);
          toast.error(pollErr);
          setStatus("failed");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 2000);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status, requestId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      setError("Only PDF and DOCX files are allowed.");
      setDocumentFile(null);
      return;
    }
    setDocumentFile(file);
    setDocumentUrl("");
    setError("");

    // Auto-upload immediately
    setStatus("uploading");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/tests/ai/upload-document", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDocumentUrl(res.data.url);
      setStatus("idle");
      toast.success("Document uploaded successfully.");
    } catch (err: any) {
      const uploadErr = err.response?.data?.message || "Document upload failed.";
      setError(uploadErr);
      toast.error(uploadErr);
      setStatus("idle");
    }
  };

  const doGenerate = async () => {
    const mcqNum = parseInt(mcqCount, 10);
    const cqNum = parseInt(cqCount, 10);

    setStatus("generating");
    setError("");

    try {
      const res = await api.post("/tests/ai/generate", {
        lessonId: Number(selectedLessonId),
        sourceDocumentUrl: documentUrl,
        sourceDocumentType: documentFile?.name.split(".").pop()?.toLowerCase() || "pdf",
        mcqCount: mcqNum,
        cqCount: cqNum,
        includeVideoTest,
        title: testTitle.trim() || undefined,
      });
      console.log('[AiTestBuilder] generate response', res.data);
      if (res.data.status === 'failed') {
        setStatus('failed');
        const failMsg = res.data.errorMessage || 'AI generation failed.';
        setError(failMsg);
        toast.error(failMsg);
        return;
      }
      setRequestId(res.data.id);
    } catch (err: any) {
      console.error('[AiTestBuilder] generate error', err);
      const genErr = err.response?.data?.message || "Failed to start AI generation.";
      setError(genErr);
      toast.error(genErr);
      setStatus("failed");
    }
  };

  const handleGenerate = () => {
    if (mcqCount.trim() === "") {
      setError("Enter MCQ count (0 if you don't want any).");
      return;
    }
    if (cqCount.trim() === "") {
      setError("Enter CQ count (0 if you don't want any).");
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

    if (!selectedLessonId || !documentUrl) {
      setError("Please select a lesson and upload a document.");
      return;
    }

    setShowConfirm(true);
  };

  const resetForm = () => {
    setSelectedLessonId(String(initialLessonId || passedLessonId || ""));
    setTestTitle("");
    setMcqCount("");
    setCqCount("");
    setIncludeVideoTest(false);
    setDocumentFile(null);
    setDocumentUrl("");
    setRequestId(null);
    setStatus("idle");
    setError("");
  };

  const isBusy = status === "uploading" || status === "generating";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-3 flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition"
          >
            <ArrowLeft size={14} />
            Back to All Tests
          </button>
        )}
        <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">AI Test Builder</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          Upload a PDF or DOCX to auto-generate MCQs, descriptive questions, and an optional video test for course <span className="font-mono text-xs">{courseId}</span>.
        </p>
      </div>

      {status === "completed" && requestId !== null && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400">
          <CheckCircle2 size={16} />
          Test generated successfully.
        </div>
      )}

      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#121212]">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">1. Test Title</h2>
          <p className="mt-1 text-xs text-slate-400">Give your test a custom name.</p>
          <div className="mt-4">
            <input
              type="text"
              value={testTitle}
              onChange={(e) => setTestTitle(e.target.value)}
              placeholder="e.g. JavaScript Fundamentals Quiz"
              disabled={isBusy}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#121212]">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">2. Select Lesson</h2>
          <p className="mt-1 text-xs text-slate-400">Choose which lesson this AI test belongs to.</p>

          <div className="mt-4">
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-300">Lesson</label>
            <select
              value={selectedLessonId}
              onChange={(e) => setSelectedLessonId(e.target.value)}
              disabled={isLoadingLessons || isBusy || !lessons.length}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="">{isLoadingLessons ? "Loading..." : "Select lesson"}</option>
              {lessons.map((l) => (
                <option key={l.id} value={String(l.id)}>{l.title}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#121212]">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">3. Upload Document</h2>
          <p className="mt-1 text-xs text-slate-400">Upload a PDF or DOCX source document. Max one file per generation.</p>

          <div className="mt-4">
            <input
              id="ai-document-upload"
              type="file"
              accept=".pdf,.docx"
              onChange={handleFileChange}
              disabled={isBusy}
              className="hidden"
            />
            <label
              htmlFor="ai-document-upload"
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 transition ${
                documentFile
                  ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                  : "border-slate-300 hover:border-blue-400 dark:border-zinc-700 dark:hover:border-blue-500"
              }`}
            >
              <Upload size={18} className={documentFile ? "text-emerald-600" : "text-slate-400"} />
              <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">
                {status === "uploading" ? "Uploading..." : documentFile ? documentFile.name : "Click to upload PDF or DOCX"}
              </span>
            </label>
            {status === "uploading" && (
              <div className="mt-2 flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                <Loader2 size={14} className="animate-spin" />
                Uploading document...
              </div>
            )}
          </div>

          {documentUrl && (
            <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={14} />
              Document uploaded successfully
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#121212]">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">4. Configure Generation</h2>
          <p className="mt-1 text-xs text-slate-400">Set how many questions to generate and whether to include a video test.</p>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-300">MCQ Count</label>
              <input
                type="text"
                value={mcqCount}
                onChange={(e) => setMcqCount(e.target.value)}
                disabled={isBusy}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-300">CQ Count</label>
              <input
                type="text"
                value={cqCount}
                onChange={(e) => setCqCount(e.target.value)}
                disabled={isBusy}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-zinc-800">
                <input
                  type="checkbox"
                  checked={includeVideoTest}
                  onChange={(e) => setIncludeVideoTest(e.target.checked)}
                  disabled={isBusy}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">Include video test</span>
              </label>
            </div>
          </div>
        </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#121212]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">5. Generate Test</h2>
              <p className="mt-1 text-xs text-slate-400">
                {status === "generating"
                  ? "AI is generating your test. This may take a minute..."
                  : status === "completed"
                    ? "Test has been generated successfully."
                    : !selectedLessonId
                      ? "Select a lesson above to enable generation."
                      : !documentUrl
                        ? "Upload a document above to enable generation."
                        : "Review your selections and start generation."}
              </p>
              {status === "generating" && (
                <div className="mt-3 flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                  <Loader2 size={14} className="animate-spin" />
                  Generating test, please do not close this page...
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(status === "uploading" || status === "generating") && (
                <Loader2 size={18} className="animate-spin text-blue-600" />
              )}
              {status !== "completed" && (
                <button
                  onClick={handleGenerate}
                  disabled={isBusy || !documentUrl || !selectedLessonId}
                  title={!selectedLessonId ? "Please select a lesson" : !documentUrl ? "Please upload a document first" : ""}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${
                    isBusy || !documentUrl || !selectedLessonId
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {status === "generating" ? "Generating..." : "Generate Test"}
                </button>
              )}
              {(status === "completed" || status === "failed") && (
                <button
                  onClick={resetForm}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {status === "completed" ? "Generate Another" : "Try Again"}
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn" onClick={() => setShowConfirm(false)}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-[#121212] animate-scaleIn" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-50">Confirm Generation</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Review the configuration before generating the test.</p>

            <div className="mt-5 flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-zinc-800/60">
                <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Lesson</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{lessons.find(l => String(l.id) === selectedLessonId)?.title || `Lesson #${selectedLessonId}`}</span>
              </div>
              {testTitle.trim() && (
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-zinc-800/60">
                  <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Title</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{testTitle.trim()}</span>
                </div>
              )}
              <div className="rounded-lg bg-blue-50 px-3 py-3 dark:bg-blue-950/20">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 text-center">
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{mcqCount || 0}</span>
                    <p className="text-[10px] font-semibold text-blue-500/70 dark:text-blue-400/70 uppercase tracking-wider mt-0.5">MCQ</p>
                  </div>
                  <div className="flex-1 text-center">
                    <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{cqCount || 0}</span>
                    <p className="text-[10px] font-semibold text-emerald-500/70 dark:text-emerald-400/70 uppercase tracking-wider mt-0.5">CQ</p>
                  </div>
                  <div className="flex-1 text-center">
                    <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{includeVideoTest ? 'Yes' : 'No'}</span>
                    <p className="text-[10px] font-semibold text-amber-500/70 dark:text-amber-400/70 uppercase tracking-wider mt-0.5">Video Test</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowConfirm(false)} className="rounded-xl border border-slate-200 bg-transparent px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800">
                Cancel
              </button>
              <button onClick={() => { setShowConfirm(false); doGenerate(); }} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                <CheckCircle2 size={16} /> Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
