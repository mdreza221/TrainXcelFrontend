"use client";
import React, { useState, useEffect, useRef } from "react";
import { CheckCircle, ArrowLeft, Edit2, Save, X, Plus, Trash2, Check, Video, UploadCloud, Camera, Clock, MonitorPlay, Loader2, Download, AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import { api } from "@/libs/api";
import { WebcamRecorder } from "./WebcamRecorder";
import toast from "react-hot-toast";
import { ConfirmModal } from "./ConfirmModal";

function getTestEvaluationMode(test: any): 'ai' | 'manual' | 'mcq' {
  const hasAi = test.questions.some(
    (q: any) => (q.type === 'CQ' || q.type === 'Video') && q.evaluationType === 'AI'
  );
  if (hasAi) return 'ai';
  const hasManual = test.questions.some(
    (q: any) => (q.type === 'CQ' || q.type === 'Video') && q.evaluationType === 'Manual'
  );
  if (hasManual) return 'manual';
  return 'mcq';
}

function DocxViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadDocx = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch document");
        const arrayBuffer = await response.arrayBuffer();
        const docx = await import("docx-preview");
        if (active && containerRef.current) {
          containerRef.current.innerHTML = "";
          await docx.renderAsync(arrayBuffer, containerRef.current, undefined, {
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            experimental: true
          });
        }
      } catch (err: any) {
        console.error(err);
        if (active) setError("Could not render document. It may be password protected or corrupted.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadDocx();
    return () => {
      active = false;
    };
  }, [url]);

  return (
    <div className="w-full bg-white text-slate-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-auto p-4 max-h-[500px] text-left">
      {loading && <p className="text-xs text-slate-500 animate-pulse">Rendering Word Document...</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div ref={containerRef} />
    </div>
  );
}

interface TestPlayerProps {
  lessonId?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
  isAdmin?: boolean;
  hasNextLesson?: boolean;
  onNextLesson?: () => void;
  externalTest?: any;
  hideLeaderboard?: boolean;
  autoStart?: boolean;
  isModalMode?: boolean;
}

export function TestPlayer({ 
  lessonId, 
  onSuccess, 
  onCancel, 
  isAdmin = false,
  hasNextLesson = false,
  onNextLesson,
  externalTest,
  hideLeaderboard = false,
  autoStart = false,
  isModalMode = false
}: TestPlayerProps) {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeTest, setActiveTest] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [deleteModalTestId, setDeleteModalTestId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submissions, setSubmissions] = useState<Record<number, any>>({});
  const [reviewSubmission, setReviewSubmission] = useState<any | null>(null);
  const [aiFeedbackData, setAiFeedbackData] = useState<any | null>(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [examStatus, setExamStatus] = useState<'scheduled' | 'active' | 'completed'>('completed');
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isTestsMinimized, setIsTestsMinimized] = useState(false);
  const answersRef = React.useRef(answers);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Admin edit state
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [expandedTestId, setExpandedTestId] = useState<number | null>(null);
  const [recordingQuestionId, setRecordingQuestionId] = useState<string | null>(null);

  // Admin Test editing state
  const [uploadingScript, setUploadingScript] = useState(false);
  const [scriptMode, setScriptMode] = useState<"file" | "text">("file");
  const [selectedScriptFile, setSelectedScriptFile] = useState<File | null>(null);
  const [tempScriptFileName, setTempScriptFileName] = useState("");
  const [selectedVideoFiles, setSelectedVideoFiles] = useState<Record<string, File>>({});
  const [submittingTestIds, setSubmittingTestIds] = useState<Record<number, boolean>>({});

  const formatTimeRemaining = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m remaining`;
    if (m > 0) return `${m}m ${s}s remaining`;
    return `${s}s remaining`;
  };

  useEffect(() => {
    if (externalTest) {
      setTests([externalTest]);
      setLoading(false);
      if (!isAdmin) {
        (async () => {
          try {
            const sRes = await api.get(`/tests/${externalTest.id}/my-submission`);
            setSubmissions(prev => ({ ...prev, [externalTest.id]: sRes.data || null }));
            if (autoStart && !sRes.data) {
              handleStartTest(externalTest);
            }
          } catch {
            setSubmissions(prev => ({ ...prev, [externalTest.id]: null }));
            if (autoStart) {
              handleStartTest(externalTest);
            }
          }
        })();
      } else if (autoStart) {
        handleStartTest(externalTest);
      }
    } else {
      fetchTests();
      if (!isAdmin) fetchLeaderboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, externalTest, autoStart, isAdmin]);

  // Countdown timer for standalone exams
  useEffect(() => {
    if (!externalTest || isAdmin) return;

    const computeStatus = () => {
      const now = new Date();
      const start = externalTest.startTime ? new Date(externalTest.startTime) : null;
      const end = externalTest.endTime ? new Date(externalTest.endTime) : null;

      // If no time constraints, mark as active (user can freely answer)
      if (!start && !end) {
        setExamStatus('active');
        setTimeRemaining(0);
        return;
      }

      if (start && now < start) {
        setExamStatus('scheduled');
        setTimeRemaining(Math.max(0, Math.floor((start.getTime() - now.getTime()) / 1000)));
        return;
      }
      if (end && now > end) {
        setExamStatus('completed');
        setTimeRemaining(0);
        return;
      }
      setExamStatus('active');
      if (end) {
        setTimeRemaining(Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000)));
      }
    };

    computeStatus();
    const interval = setInterval(computeStatus, 1000);
    return () => clearInterval(interval);
  }, [externalTest, isAdmin]);

  const hasAutoSubmitted = React.useRef(false);

  // Auto-submit when timer expires for standalone exams
  useEffect(() => {
    if (!externalTest || isAdmin || examStatus !== 'completed') return;
    if (!activeTest || activeTest.id !== externalTest.id) return;
    if (submissions[activeTest.id] || hasAutoSubmitted.current) return;

    hasAutoSubmitted.current = true;
    const timer = setTimeout(() => {
      handleSubmit(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [externalTest, isAdmin, examStatus, activeTest, submissions]);

  const fetchTests = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/tests/lesson/${lessonId}`);
      setTests(res.data);

    if (!isAdmin) {
      const subs: Record<number, any> = {};
      await Promise.all(res.data.map(async (t: any) => {
        try {
          const sRes = await api.get(`/tests/${t.id}/my-submission`);
          subs[t.id] = sRes.data || null;
        } catch { 
          subs[t.id] = null;
        }
      }));
      setSubmissions(subs);
    }
    } catch {
      setError("Failed to load tests.");
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await api.get(`/tests/leaderboard/${lessonId}`);
      setLeaderboard(res.data);
    } catch { /* ignore */ }
  };

  const handleScriptModeChange = (mode: "file" | "text") => {
    setScriptMode(mode);
    setSelectedScriptFile(null);
    setTempScriptFileName("");
    const currentScript = editDraft.referenceScript || "";
    const isFile = currentScript.startsWith("http") || 
                   currentScript.startsWith("/") ||
                   (currentScript.length < 200 && /\.(pdf|docx|doc|pptx|ppt)$/i.test(currentScript));
    
    if (mode === "file" && !isFile) {
      setEditDraft({ ...editDraft, referenceScript: "" });
    } else if (mode === "text" && isFile) {
      setEditDraft({ ...editDraft, referenceScript: "" });
    }
  };

  const handleScriptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setSelectedScriptFile(file);
    setTempScriptFileName(file.name);
  };

  const handleDownloadScript = async (url: string) => {
    const filename = url.split('/').pop() || 'script_document';
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch script");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success("Download started!");
    } catch (error) {
      window.open(url, '_blank');
    }
  };

  // ─── Admin: start editing a question ────────────────────────────────────────
  const startEdit = (q: any, parentTest: any) => {
    setEditingQuestionId(q.id);
    setSelectedScriptFile(null);
    setTempScriptFileName("");
    const refScript = q.type === "Video" || q.type === "CQ"
      ? (q.referenceScript || parentTest.referenceScript || "")
      : "";
    const isFile = refScript && (
      refScript.startsWith("http") ||
      refScript.startsWith("/") ||
      (refScript.length < 200 && /\.(pdf|docx|doc|pptx|ppt)$/i.test(refScript))
    );
    setScriptMode(isFile ? "file" : "text");
    setEditDraft({
      questionText: q.questionText,
      options: q.type === "MCQ" ? [...(q.options || [])] : undefined,
      correctAnswers: q.type === "MCQ" ? [...(q.correctAnswers || [])] : undefined,
      marks: q.marks,
      postureMarks: q.postureMarks,
      voiceMarks: q.voiceMarks,
      accuracyMarks: q.accuracyMarks,
      evaluationType: q.type === "Video" || q.type === "CQ" ? q.evaluationType || "AI" : undefined,
      referenceScript: refScript,
    });
  };

  const cancelEdit = () => {
    setEditingQuestionId(null);
    setEditDraft({});
    setSelectedScriptFile(null);
    setTempScriptFileName("");
  };

  const saveEdit = async (questionId: number) => {
    setSavingEdit(true);
    try {
      let finalScript = editDraft.referenceScript;
      if (selectedScriptFile) {
        setUploadingScript(true);
        const formData = new FormData();
        formData.append("file", selectedScriptFile);
        const uploadRes = await api.post("/courses/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        finalScript = uploadRes.data.url;
        setUploadingScript(false);
      }

      const updatedDraft = { 
        ...editDraft, 
        marks: (editDraft.postureMarks !== undefined && editDraft.voiceMarks !== undefined && editDraft.accuracyMarks !== undefined)
          ? (Number(editDraft.postureMarks) || 0) + (Number(editDraft.voiceMarks) || 0) + (Number(editDraft.accuracyMarks) || 0)
          : (editDraft.marks === "" ? 0 : (editDraft.marks !== undefined ? Number(editDraft.marks) : undefined)),
        postureMarks: editDraft.postureMarks !== undefined ? (editDraft.postureMarks === "" ? null : Number(editDraft.postureMarks)) : undefined,
        voiceMarks: editDraft.voiceMarks !== undefined ? (editDraft.voiceMarks === "" ? null : Number(editDraft.voiceMarks)) : undefined,
        accuracyMarks: editDraft.accuracyMarks !== undefined ? (editDraft.accuracyMarks === "" ? null : Number(editDraft.accuracyMarks)) : undefined,
        referenceScript: finalScript 
      };

      await api.put(`/tests/questions/${questionId}`, updatedDraft);
      // Refresh tests to show updated data
      await fetchTests();
      setEditingQuestionId(null);
      setEditDraft({});
      setSelectedScriptFile(null);
      setTempScriptFileName("");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save question.");
    } finally {
      setSavingEdit(false);
      setUploadingScript(false);
    }
  };

  const deleteTest = async (e: React.MouseEvent, testId: number) => {
    e.stopPropagation();
    setDeleteModalTestId(testId);
  };

  const confirmDeleteTest = async () => {
    if (deleteModalTestId === null) return;
    setIsDeleting(true);
    try {
      await api.delete(`/tests/${deleteModalTestId}`);
      toast.success("Test deleted successfully");
      await fetchTests();
      if (externalTest && externalTest.id === deleteModalTestId) {
        window.location.reload(); 
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete test.");
    } finally {
      setIsDeleting(false);
      setDeleteModalTestId(null);
    }
  };

  const toggleCorrectAnswer = (opt: string) => {
    const current: string[] = editDraft.correctAnswers || [];
    if (current.includes(opt)) {
      setEditDraft({ ...editDraft, correctAnswers: current.filter((c: string) => c !== opt) });
    } else {
      setEditDraft({ ...editDraft, correctAnswers: [...current, opt] });
    }
  };

  const updateOption = (idx: number, val: string) => {
    const opts = [...editDraft.options];
    const oldOpt = opts[idx];
    opts[idx] = val;
    // Also update correctAnswers if the old option was selected
    const corrects = (editDraft.correctAnswers || []).map((c: string) => c === oldOpt ? val : c);
    setEditDraft({ ...editDraft, options: opts, correctAnswers: corrects });
  };

  const addOption = () => {
    setEditDraft({ ...editDraft, options: [...(editDraft.options || []), ""] });
  };

  const removeOption = (idx: number) => {
    const opts = [...editDraft.options];
    const removed = opts[idx];
    opts.splice(idx, 1);
    const corrects = (editDraft.correctAnswers || []).filter((c: string) => c !== removed);
    setEditDraft({ ...editDraft, options: opts, correctAnswers: corrects });
  };

  // ─── Learner: test taking ────────────────────────────────────────────────────
  const handleStartTest = (test: any) => {
    setActiveTest(test);
    hasAutoSubmitted.current = false;
    const initialAnswers: Record<string, any> = {};
    test.questions.forEach((q: any) => {
      initialAnswers[q.id] = q.type === "MCQ" ? [] : "";
    });
    setAnswers(initialAnswers);
  };

  const handleToggleMcq = (questionId: string, option: string) => {
    setAnswers(prev => {
      const current = prev[questionId] as string[];
      return current.includes(option)
        ? { ...prev, [questionId]: current.filter(o => o !== option) }
        : { ...prev, [questionId]: [...current, option] };
    });
  };

  const handleSubmit = async (isDraft: boolean) => {
    const currentAnswers = answersRef.current;

    if (!isDraft && activeTest) {
      const missingAnswer = activeTest.questions.some((q: any) => {
        const ans = currentAnswers[q.id];
        if (q.type === "MCQ") {
          return !ans || !Array.isArray(ans) || ans.length === 0;
        }
        if (q.type === "CQ") {
          return !ans || String(ans).trim() === "";
        }
        if (q.type === "Video") {
          const hasSelectedLocal = selectedVideoFiles[q.id] !== undefined;
          return (!ans || String(ans).trim() === "" || ans === "Uploading...") && !hasSelectedLocal;
        }
        return false;
      });

      if (missingAnswer) {
        toast.error("Answering all questions (MCQ, CQ, and Video) is mandatory before submitting the test.");
        return;
      }
    }

    if (!activeTest) return;
    const currentTest = activeTest;
    const targetTestId = activeTest.id;

    setIsSubmitting(true);
    if (!isDraft) {
      setActiveTest(null);
      setSubmittingTestIds(prev => ({ ...prev, [targetTestId]: true }));
      toast.success("Submitting test in the background...");
    }

    try {
      const finalAnswers = { ...currentAnswers };

      const uploadKeys = Object.keys(selectedVideoFiles);
      for (const qId of uploadKeys) {
        const file = selectedVideoFiles[qId];
        if (file) {
          setAnswers(prev => ({ ...prev, [qId]: "Uploading..." }));
          const formData = new FormData();
          formData.append('file', file);
          const res = await api.post('/tests/upload-test-video', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          if (res.data?.url) {
            finalAnswers[qId] = res.data.url;
            setAnswers(prev => ({ ...prev, [qId]: res.data.url }));
          } else {
            throw new Error("Failed to upload video response.");
          }
        }
      }

      setSelectedVideoFiles({});

      const formattedAnswers = Object.keys(finalAnswers).map(qId => ({
        questionId: Number(qId),
        providedAnswer: finalAnswers[qId],
      }));
      await api.post("/tests/submit", {
        testId: targetTestId,
        isDraft,
        answers: formattedAnswers,
      });
      if (!isDraft) {
        const sRes = await api.get(`/tests/${targetTestId}/my-submission`);
        setSubmissions(prev => ({ ...prev, [targetTestId]: sRes.data }));
        toast.success("Test submitted successfully!");
        const submitMode = getTestEvaluationMode(currentTest);
        if (submitMode === 'ai') {
          toast("AI evaluation in progress — results in 2–3 minutes.", { icon: '⏳', duration: 5000 });
        } else if (submitMode === 'manual') {
          toast("Test submitted — awaiting manual evaluation.", { icon: '📝', duration: 5000 });
        }
        if (onSuccess) onSuccess();
      } else {
        toast.success("Draft saved!");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to submit test.");
    } finally {
      setIsSubmitting(false);
      if (!isDraft) {
        setSubmittingTestIds(prev => ({ ...prev, [targetTestId]: false }));
      }
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  if (showSuccessOverlay) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 text-center flex flex-col items-center justify-center gap-5 max-w-md mx-auto shadow-xl animate-fadeIn">
        <div className="h-16 w-16 bg-green-50 dark:bg-green-950/30 rounded-full flex items-center justify-center text-green-500 animate-bounce">
          <CheckCircle size={36} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50">Test Submitted Successfully!</h3>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2 leading-relaxed font-medium">
            Great job! Your answers have been recorded. Your progress has been updated in your profile dashboard.
          </p>
        </div>
        <div className="flex gap-3 w-full mt-2">
          <button
            onClick={() => {
              setShowSuccessOverlay(false);
              setActiveTest(null);
              if (onCancel) onCancel(); // Back to lesson
            }}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
          >
            Review Lesson
          </button>
          {hasNextLesson && onNextLesson && (
            <button
              onClick={() => {
                setShowSuccessOverlay(false);
                setActiveTest(null);
                onNextLesson();
              }}
              className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition"
            >
              Next Lesson →
            </button>
          )}
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="p-8 flex items-center gap-3 text-slate-500">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      Loading tests...
    </div>
  );
  if (error) return <div className="p-8 text-red-500">{error}</div>;

  // ─── ADMIN VIEW ──────────────────────────────────────────────────────────────
  if (isAdmin) {
    return (
      <div className="flex flex-col gap-4 animate-fadeIn">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-50">
            {externalTest ? "Standalone Exam" : "Tests for this Lesson"}
            <span className="ml-2 text-xs font-normal text-slate-400">({tests.length} test{tests.length !== 1 ? "s" : ""})</span>
          </h3>
        </div>

        {tests.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 text-slate-400 text-sm">
            No tests have been created for this lesson yet.
          </div>
        ) : (
          tests.map(test => (
            <div key={test.id} className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
              {/* Test header */}
              <div
                onClick={() => setExpandedTestId(expandedTestId === test.id ? null : test.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition cursor-pointer"
              >
                <div className="text-left">
                  <h4 className="font-bold text-slate-900 dark:text-zinc-100">{test.title}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{test.questions.length} question{test.questions.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full">
                    {test.questions.filter((q: any) => q.type === "MCQ").length} MCQ · {test.questions.filter((q: any) => q.type === "CQ").length} CQ · {test.questions.filter((q: any) => q.type === "Video").length} Video
                  </span>
                  {isAdmin && (
                    <button
                      onClick={(e) => deleteTest(e, test.id)}
                      className="p-1.5 rounded-full bg-red-50 dark:bg-red-950/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors ml-2"
                      title="Delete Test"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  {expandedTestId === test.id ? <Edit2 size={16} className="text-slate-400 ml-1" /> : <Edit2 size={16} className="text-slate-400 ml-1" />}
                </div>
              </div>

              {/* Expanded question editor */}
              {expandedTestId === test.id && (
                <div className="border-t border-slate-100 dark:border-zinc-800 px-5 py-4 flex flex-col gap-4">
                  {test.questions.map((q: any, idx: number) => {
                    const isEditing = editingQuestionId === q.id;
                    return (
                      <div key={q.id} className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/40 p-4">
                        {/* Question header row */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300">
                              {q.type}
                            </span>
                            <span className="text-xs text-slate-400">Q{idx + 1}</span>
                          </div>
                          {!isEditing ? (
                            <button
                              onClick={() => startEdit(q, test)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition"
                            >
                              <Edit2 size={11} /> Edit
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={cancelEdit}
                                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 px-2.5 py-1 rounded-lg transition"
                              >
                                <X size={11} /> Cancel
                              </button>
                              <button
                                onClick={() => saveEdit(q.id)}
                                disabled={savingEdit}
                                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded-lg transition disabled:opacity-50"
                              >
                                {savingEdit ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save size={11} />}
                                Save
                              </button>
                            </div>
                          )}
                        </div>

                        {/* View / Edit question text */}
                        {!isEditing ? (
                          <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100 mb-2">{q.questionText}</p>
                        ) : (
                          <textarea
                            value={editDraft.questionText || ""}
                            onChange={e => setEditDraft({ ...editDraft, questionText: e.target.value })}
                            rows={2}
                            className="w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 mb-3 focus:border-blue-500 outline-none resize-none"
                            placeholder="Question text..."
                          />
                        )}

                        {q.type === "Video" ? (
                          <div className="flex flex-col gap-1 mb-3">
                            <span className="text-[11px] text-slate-400 font-bold">Category Max Marks:</span>
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-1">
                                <label className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">Posture:</label>
                                {!isEditing ? (
                                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">{q.postureMarks ?? (q.marks / 3)}</span>
                                ) : (
                                  <input
                                    type="text"
                                    value={editDraft.postureMarks ?? (q.postureMarks ?? "")}
                                    onChange={e => {
                                      const val = e.target.value;
                                      if (val === "" || /^\d*\.?\d*$/.test(val)) setEditDraft({ ...editDraft, postureMarks: val });
                                    }}
                                    className="w-12 border border-purple-200 dark:border-purple-800 rounded px-1 text-xs bg-white dark:bg-zinc-900 text-center outline-none"
                                  />
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <label className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">Voice:</label>
                                {!isEditing ? (
                                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">{q.voiceMarks ?? (q.marks / 3)}</span>
                                ) : (
                                  <input
                                    type="text"
                                    value={editDraft.voiceMarks ?? (q.voiceMarks ?? "")}
                                    onChange={e => {
                                      const val = e.target.value;
                                      if (val === "" || /^\d*\.?\d*$/.test(val)) setEditDraft({ ...editDraft, voiceMarks: val });
                                    }}
                                    className="w-12 border border-blue-200 dark:border-blue-800 rounded px-1 text-xs bg-white dark:bg-zinc-900 text-center outline-none"
                                  />
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <label className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Script:</label>
                                {!isEditing ? (
                                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">{q.accuracyMarks ?? (q.marks / 3)}</span>
                                ) : (
                                  <input
                                    type="text"
                                    value={editDraft.accuracyMarks ?? (q.accuracyMarks ?? "")}
                                    onChange={e => {
                                      const val = e.target.value;
                                      if (val === "" || /^\d*\.?\d*$/.test(val)) setEditDraft({ ...editDraft, accuracyMarks: val });
                                    }}
                                    className="w-12 border border-emerald-200 dark:border-emerald-800 rounded px-1 text-xs bg-white dark:bg-zinc-900 text-center outline-none"
                                  />
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 font-bold ml-2 border-l border-slate-200 dark:border-zinc-700 pl-3">
                                Total: {!isEditing ? q.marks : ((Number(editDraft.postureMarks) || 0) + (Number(editDraft.voiceMarks) || 0) + (Number(editDraft.accuracyMarks) || 0))}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 mb-3">
                            Marks: {!isEditing ? q.marks : (
                              <input
                                type="text"
                                placeholder="e.g. 5"
                                value={editDraft.marks ?? (q.marks === 0 ? "" : q.marks)}
                                onChange={e => {
                                  const val = e.target.value;
                                  if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                    setEditDraft({ ...editDraft, marks: val });
                                  }
                                }}
                                className="inline-block w-14 ml-1 border border-slate-300 dark:border-zinc-600 rounded px-1 text-xs bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 outline-none"
                              />
                            )}
                          </p>
                        )}

                        {/* MCQ options */}
                        {q.type === "MCQ" && (
                          <div className="flex flex-col gap-2">
                            {(!isEditing ? q.options : editDraft.options || []).map((opt: string, oIdx: number) => {
                              const isCorrect = isEditing
                                ? (editDraft.correctAnswers || []).includes(opt)
                                : (q.correctAnswers || []).includes(opt);
                              return (
                                <div key={oIdx} className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm ${
                                  isCorrect
                                    ? "border-green-400 bg-green-50 dark:bg-green-950/20 dark:border-green-700"
                                    : "border-slate-200 bg-white dark:bg-zinc-900 dark:border-zinc-700"
                                }`}>
                                  {isEditing ? (
                                    <>
                                      <button
                                        onClick={() => toggleCorrectAnswer(opt)}
                                        title="Toggle as correct answer"
                                        className={`h-5 w-5 rounded flex items-center justify-center border shrink-0 transition ${
                                          isCorrect ? "bg-green-500 border-green-500 text-white" : "border-slate-300 dark:border-zinc-600 text-transparent"
                                        }`}
                                      >
                                        <Check size={12} />
                                      </button>
                                      <input
                                        value={opt}
                                        onChange={e => updateOption(oIdx, e.target.value)}
                                        className="flex-1 text-sm bg-transparent outline-none text-slate-800 dark:text-zinc-200"
                                        placeholder={`Option ${oIdx + 1}`}
                                      />
                                      <button
                                        onClick={() => removeOption(oIdx)}
                                        className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-600 transition shrink-0"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <div className={`h-5 w-5 rounded flex items-center justify-center border shrink-0 ${
                                        isCorrect ? "bg-green-500 border-green-500 text-white" : "border-slate-300 dark:border-zinc-600"
                                      }`}>
                                        {isCorrect && <Check size={12} />}
                                      </div>
                                      <span className="text-slate-700 dark:text-zinc-300">{opt}</span>
                                      {isCorrect && (
                                        <span className="ml-auto text-[10px] font-bold text-green-600 dark:text-green-400">Correct</span>
                                      )}
                                    </>
                                  )}
                                </div>
                              );
                            })}
                            {isEditing && (
                              <button
                                onClick={addOption}
                                className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline mt-1"
                              >
                                <Plus size={12} /> Add Option
                              </button>
                            )}
                          </div>
                        )}

                        {/* CQ question */}
                        {q.type === "CQ" && (
                          isEditing ? (
                            <div className="mt-2 pl-1 flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-slate-500">
                                Evaluation Method:
                              </label>
                              <select
                                value={editDraft.evaluationType || "AI"}
                                onChange={e => setEditDraft({ ...editDraft, evaluationType: e.target.value })}
                                className="text-xs rounded border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 px-2.5 py-1 focus:border-blue-500 outline-none w-fit"
                              >
                                <option value="AI">AI Review</option>
                                <option value="Manual">Manual Review</option>
                              </select>

                              {editDraft.evaluationType === "AI" && (
                                <div className="flex flex-col gap-2 border-t border-slate-200/60 dark:border-zinc-800 pt-3 mt-3">
                                  <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Reference Script / Material</label>
                                    <div className="flex bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg text-[10px] font-bold">
                                      <button
                                        type="button"
                                        onClick={() => handleScriptModeChange("file")}
                                        className={`px-2.5 py-1 rounded-md transition ${scriptMode === "file" ? "bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-500"}`}
                                      >
                                        Documents
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleScriptModeChange("text")}
                                        className={`px-2.5 py-1 rounded-md transition ${scriptMode === "text" ? "bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-500"}`}
                                      >
                                        Write Plain Text
                                      </button>
                                    </div>
                                  </div>

                                  {scriptMode === "file" ? (
                                    <div className="flex flex-col gap-1">
                                       <input
                                        type="file"
                                        accept=".pdf,.docx,.ppt,.pptx"
                                        onChange={handleScriptFileChange}
                                        className="text-xs file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                                      />
                                      {uploadingScript && <span className="text-xs text-blue-500 animate-pulse">Uploading script...</span>}
                                      {tempScriptFileName ? (
                                        <span className="text-xs text-green-600 font-medium truncate mt-1 block">
                                          Selected: {tempScriptFileName} (will upload on save)
                                        </span>
                                      ) : editDraft.referenceScript ? (
                                        <span className="text-xs text-slate-500 font-medium truncate mt-1 block">
                                          Current script: {editDraft.referenceScript.split('/').pop()}
                                        </span>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <textarea
                                      placeholder="Paste or write the reference material for AI evaluation..."
                                      value={editDraft.referenceScript || ""}
                                      onChange={e => setEditDraft({ ...editDraft, referenceScript: e.target.value })}
                                      className="w-full text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 outline-none focus:border-blue-500 min-h-[80px]"
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-400 italic flex flex-col gap-1.5">
                              <span className="text-slate-500">Open-ended response question — learners type their answer.</span>
                              <span className="text-[10px] text-slate-500 font-semibold block">
                                Evaluation Method: <span className="text-blue-600 dark:text-blue-400 font-bold uppercase">{q.evaluationType || "AI"}</span>
                              </span>
                              {q.referenceScript && (
                                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800/40 text-left">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                                    Reference Script / Material:
                                  </span>
                                  {(() => {
                                    const refScript = q.referenceScript;
                                    const isFile = refScript.startsWith("http") || 
                                                   refScript.startsWith("/") ||
                                                   (refScript.length < 200 && /\.(pdf|docx|doc|pptx|ppt)$/i.test(refScript));
                                    
                                    if (isFile) {
                                      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
                                      const scriptUrl = refScript.startsWith("http") 
                                        ? refScript 
                                        : `${base}${refScript}`;
                                      const isPdf = /\.(pdf)$/i.test(refScript);
                                      const isDoc = /\.(docx|doc|pptx|ppt)$/i.test(refScript);
                                      
                                      if (isPdf) {
                                        return (
                                          <div className="flex flex-col gap-2">
                                            <iframe src={scriptUrl} className="w-full h-80 border border-slate-200 dark:border-zinc-800 rounded-lg" />
                                            <button 
                                              type="button"
                                              onClick={() => handleDownloadScript(scriptUrl)}
                                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold rounded-lg text-[10px] transition uppercase tracking-wider self-end mt-1 border border-blue-100 dark:border-blue-900/30"
                                            >
                                              <Download size={12} />
                                              Download PDF ({refScript.split('/').pop()})
                                            </button>
                                          </div>
                                        );
                                      } else if (isDoc) {
                                        const embedUrl = `https://docs.google.com/gview?url=${encodeURIComponent(scriptUrl)}&embedded=true`;
                                        return (
                                          <div className="flex flex-col gap-2">
                                            <iframe src={embedUrl} className="w-full h-80 border border-slate-200 dark:border-zinc-800 rounded-lg bg-white" />
                                            <button 
                                              type="button"
                                              onClick={() => handleDownloadScript(scriptUrl)}
                                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold rounded-lg text-[10px] transition uppercase tracking-wider self-end mt-1 border border-blue-100 dark:border-blue-900/30"
                                            >
                                              <Download size={12} />
                                              Download Document ({refScript.split('/').pop()})
                                            </button>
                                          </div>
                                        );
                                      } else {
                                        return (
                                          <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-between text-xs">
                                            <span className="font-semibold text-slate-700 dark:text-zinc-300 truncate max-w-[60%]">File: {refScript.split('/').pop()}</span>
                                            <button 
                                              type="button"
                                              onClick={() => handleDownloadScript(scriptUrl)}
                                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-[10px] uppercase tracking-wider shrink-0"
                                            >
                                              Download
                                            </button>
                                          </div>
                                        );
                                      }
                                    } else {
                                      return (
                                        <div className="p-3 bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-lg max-h-40 overflow-y-auto text-xs font-mono whitespace-pre-wrap text-slate-700 dark:text-zinc-300">
                                          {refScript}
                                        </div>
                                      );
                                    }
                                  })()}
                                </div>
                              )}
                            </div>
                          )
                        )}

                        {/* Video question text only — no answer box for admin */}
                        {q.type === "Video" && (
                          isEditing ? (
                            <div className="mt-2 pl-1 flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-slate-500">
                                Evaluation Method:
                              </label>
                              <select
                                value={editDraft.evaluationType || "AI"}
                                onChange={e => setEditDraft({ ...editDraft, evaluationType: e.target.value })}
                                className="text-xs rounded border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 px-2.5 py-1 focus:border-blue-500 outline-none w-fit"
                              >
                                <option value="AI">AI Review</option>
                                <option value="Manual">Manual Review</option>
                              </select>

                              {/* Reference Script Edit inside the Video Question */}
                              <div className="flex flex-col gap-2 border-t border-slate-200/60 dark:border-zinc-800 pt-3 mt-3">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Reference Script / Material</label>
                                  <div className="flex bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg text-[10px] font-bold">
                                    <button
                                      type="button"
                                      onClick={() => handleScriptModeChange("file")}
                                      className={`px-2.5 py-1 rounded-md transition ${scriptMode === "file" ? "bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-500"}`}
                                    >
                                      Documents
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleScriptModeChange("text")}
                                      className={`px-2.5 py-1 rounded-md transition ${scriptMode === "text" ? "bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-500"}`}
                                    >
                                      Write Plain Text
                                    </button>
                                  </div>
                                </div>

                                {scriptMode === "file" ? (
                                  <div className="flex flex-col gap-1">
                                     <input
                                      type="file"
                                      accept=".pdf,.docx,.ppt,.pptx"
                                      onChange={handleScriptFileChange}
                                      className="text-xs file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    />
                                    {uploadingScript && <span className="text-xs text-blue-500 animate-pulse">Uploading script...</span>}
                                    {tempScriptFileName ? (
                                      <span className="text-xs text-green-600 font-medium truncate mt-1 block">
                                        Selected: {tempScriptFileName} (will upload on save)
                                      </span>
                                    ) : editDraft.referenceScript ? (
                                      <span className="text-xs text-slate-500 font-medium truncate mt-1 block">
                                        Current script: {editDraft.referenceScript.split('/').pop()}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : (
                                  <textarea
                                    placeholder="Type script text details..."
                                    value={editDraft.referenceScript || ""}
                                    onChange={e => setEditDraft({ ...editDraft, referenceScript: e.target.value })}
                                    className="w-full text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 outline-none focus:border-blue-500 min-h-[80px]"
                                  />
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-400 italic flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <Video size={14} className="text-red-500" />
                                Video response question — learners will upload a video.
                              </div>
                              <span className="text-[10px] text-slate-500 font-semibold block">
                                Evaluation Method: <span className="text-blue-600 dark:text-blue-400 font-bold uppercase">{q.evaluationType || "AI"}</span>
                              </span>

                              {(q.referenceScript || test.referenceScript) && (
                                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800/40 text-left">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                                    Reference Script / Material:
                                  </span>
                                  {(() => {
                                    const refScript = q.referenceScript || test.referenceScript;
                                    const isFile = refScript.startsWith("http") || 
                                                   refScript.startsWith("/") ||
                                                   (refScript.length < 200 && /\.(pdf|docx|doc|pptx|ppt)$/i.test(refScript));
                                    
                                    if (isFile) {
                                      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
                                      const scriptUrl = refScript.startsWith("http") 
                                        ? refScript 
                                        : `${base}${refScript}`;
                                      const isPdf = /\.(pdf)$/i.test(refScript);
                                      const isDoc = /\.(docx|doc|pptx|ppt)$/i.test(refScript);
                                      
                                      if (isPdf) {
                                        return (
                                          <div className="flex flex-col gap-2">
                                            <iframe src={scriptUrl} className="w-full h-80 border border-slate-200 dark:border-zinc-800 rounded-lg" />
                                            <button 
                                              type="button"
                                              onClick={() => handleDownloadScript(scriptUrl)}
                                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold rounded-lg text-[10px] transition uppercase tracking-wider self-end mt-1 border border-blue-100 dark:border-blue-900/30"
                                            >
                                              <Download size={12} />
                                              Download PDF ({refScript.split('/').pop()})
                                            </button>
                                          </div>
                                        );
                                      } else if (isDoc) {
                                        const embedUrl = `https://docs.google.com/gview?url=${encodeURIComponent(scriptUrl)}&embedded=true`;
                                        return (
                                          <div className="flex flex-col gap-2">
                                            <iframe src={embedUrl} className="w-full h-80 border border-slate-200 dark:border-zinc-800 rounded-lg bg-white" />
                                            <button 
                                              type="button"
                                              onClick={() => handleDownloadScript(scriptUrl)}
                                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold rounded-lg text-[10px] transition uppercase tracking-wider self-end mt-1 border border-blue-100 dark:border-blue-900/30"
                                            >
                                              <Download size={12} />
                                              Download Document ({test.referenceScript.split('/').pop()})
                                            </button>
                                          </div>
                                        );
                                      } else {
                                        return (
                                          <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-between text-xs">
                                            <span className="font-semibold text-slate-700 dark:text-zinc-300 truncate max-w-[60%]">File: {test.referenceScript.split('/').pop()}</span>
                                            <button 
                                              type="button"
                                              onClick={() => handleDownloadScript(scriptUrl)}
                                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-[10px] uppercase tracking-wider shrink-0"
                                            >
                                              <Download size={12} />
                                              Download
                                            </button>
                                          </div>
                                        );
                                      }
                                    } else {
                                      return (
                                        <div className="p-3 bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-lg max-h-40 overflow-y-auto text-xs font-mono whitespace-pre-wrap text-slate-700 dark:text-zinc-300">
                                          {test.referenceScript}
                                        </div>
                                      );
                                    }
                                  })()}
                                </div>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      <ConfirmModal
        isOpen={deleteModalTestId !== null}
        title="Delete Test?"
        message="Are you sure you want to delete this test? All questions and submissions will be permanently lost."
        onConfirm={confirmDeleteTest}
        onCancel={() => setDeleteModalTestId(null)}
        confirmText="Confirm Delete"
        isLoading={isDeleting}
      />
      </div>
    );
  }

  // ─── LEARNER: taking a test ──────────────────────────────────────────────────
  if (activeTest) {
    const hasTaken = !!submissions[activeTest.id];
    const hasTimeConstraint = externalTest && externalTest.id === activeTest.id && (externalTest.startTime || externalTest.endTime);
    const isStandaloneActive = hasTimeConstraint && examStatus === 'active';
    const isUploadingVideo = Object.values(answers).some((val) => val === "Uploading...");

    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 animate-fadeIn">
        {!isModalMode && (<button onClick={() => setActiveTest(null)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 transition mb-6 w-fit border border-blue-100 dark:border-blue-900/30">
          <ArrowLeft size={14} className="stroke-[3px]" /> Back to tests
        </button>)}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50">
              {activeTest.title}
            </h3>
            <span className="text-xs font-semibold text-slate-500 mt-1 block">
              Total Marks: {activeTest.questions.reduce((sum: number, q: any) => sum + q.marks, 0)} points
            </span>
          </div>
          {hasTimeConstraint && isStandaloneActive && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg dark:bg-red-950/20 dark:text-red-400 self-start sm:self-center">
              <Clock size={14} /> {formatTimeRemaining(timeRemaining)}
            </span>
          )}
        </div>
        {activeTest.description && <p className="text-slate-600 mb-4">{activeTest.description}</p>}
        
        

        {hasTaken && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-900 rounded-xl text-xs text-green-800 dark:text-green-300">
            <span className="font-bold block mb-1">Test Completed</span>
            You have already submitted this test. See your results and evaluations below.
          </div>
        )}
        
        {!hasTaken && (
          <>
            <div className="flex flex-col gap-6">
              {activeTest.questions.map((q: any, idx: number) => (
                <div key={q.id} className="p-5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-zinc-800/40 dark:border-zinc-700 relative">
              <div className="absolute top-4 right-4 bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-full text-xs shadow-sm dark:bg-blue-900/40 dark:text-blue-300">
                {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
              </div>
              <h5 className="font-semibold text-slate-800 dark:text-zinc-100 mb-6 pr-20">{idx + 1}. {q.questionText}</h5>
              {q.type === "MCQ" && (
                <div className="flex flex-col gap-2">
                  {q.options.map((opt: string, oIdx: number) => (
                    <label key={oIdx} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white dark:bg-zinc-900 dark:border-zinc-700 cursor-pointer hover:border-blue-400">
                      <input type="checkbox" checked={(answers[q.id] || []).includes(opt)} onChange={() => handleToggleMcq(q.id, opt)} className="w-4 h-4 text-blue-600 rounded" />
                      <span className="text-sm text-slate-700 dark:text-zinc-300">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.type === "CQ" && (
                <textarea
                  value={answers[q.id] || ""}
                  onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                  placeholder="Type your answer here..."
                  className="w-full min-h-[120px] p-4 rounded-xl border border-slate-200 bg-white text-sm focus:border-blue-500 outline-none dark:bg-zinc-900 dark:border-zinc-700"
                />
              )}
              {q.type === "Video" && (
                <div className="flex flex-col gap-4 mt-2">
                  {(q.referenceScript || activeTest.referenceScript) && (() => {
                    const refScript = q.referenceScript || activeTest.referenceScript;
                    const isFile = refScript.startsWith("http") || 
                                   refScript.startsWith("/") ||
                                   (refScript.length < 200 && /\.(pdf|docx|doc|pptx|ppt)$/i.test(refScript));
                    
                    if (!isFile) {
                      return (
                        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-zinc-800/40 dark:border-zinc-700 flex flex-col gap-4 text-left">
                          <div>
                            <span className="font-bold text-xs text-slate-800 dark:text-zinc-100 block">Reference Script Material</span>
                            <span className="text-[10px] text-slate-500">Please review the reference script detailing text below before preparing your video.</span>
                          </div>
                          <div className="w-full p-4 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 overflow-y-auto max-h-[160px] whitespace-pre-wrap text-xs text-slate-800 dark:text-zinc-200 font-mono leading-relaxed">
                            {refScript}
                          </div>
                        </div>
                      );
                    }

                    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
                    const scriptUrl = refScript.startsWith("http") 
                      ? refScript 
                      : `${base}${refScript}`;
                    const ext = refScript.split('.').pop()?.toLowerCase();
                    
                    return (
                      <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-zinc-800/40 dark:border-zinc-700 flex flex-col gap-3 text-left">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <span className="font-bold text-xs text-slate-800 dark:text-zinc-100 block">Reference Script Material</span>
                            <span className="text-[10px] text-slate-500">Please review the reference script document below before preparing your video.</span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => handleDownloadScript(scriptUrl)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold transition shadow-sm uppercase tracking-wider self-end sm:self-center"
                          >
                            <Download size={12} />
                            Download
                          </button>
                        </div>

                        <div className="w-full rounded-xl overflow-hidden mt-1">
                          {ext === 'pdf' ? (
                            <iframe 
                              src={scriptUrl} 
                              className="w-full h-80 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white" 
                              title="Reference Script Viewer"
                            />
                          ) : ext === 'docx' || ext === 'doc' ? (
                            <iframe 
                              src={`https://docs.google.com/gview?url=${encodeURIComponent(scriptUrl)}&embedded=true`} 
                              className="w-full h-80 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white" 
                              title="Reference Script Viewer"
                            />
                          ) : ext === 'ppt' || ext === 'pptx' ? (
                            <div className="flex flex-col items-center justify-center p-6 bg-zinc-900 border border-zinc-800 text-white w-full h-[180px] rounded-xl text-center">
                              <MonitorPlay size={36} className="text-blue-500 mb-2 animate-pulse" />
                              <h4 className="font-bold text-xs text-slate-100">PowerPoint Presentation Script</h4>
                              <p className="text-[10px] text-zinc-400 max-w-xs mt-1 mb-2">PowerPoint files cannot be viewed directly inline. Click the button above to download and view the presentation slides.</p>
                            </div>
                          ) : (
                            <iframe 
                              src={scriptUrl} 
                              className="w-full h-80 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white" 
                              title="Reference Script Viewer"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {answers[q.id] === "Uploading..." ? (
                    <div className="border-2 border-dashed border-blue-300 dark:border-zinc-700 rounded-xl p-6 flex flex-col items-center justify-center gap-3 bg-blue-50/20 dark:bg-zinc-800/30 w-full animate-pulse">
                      <Loader2 size={32} className="text-blue-500 animate-spin" />
                      <div className="text-center">
                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400">Uploading response video...</p>
                        <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">Please do not close this page or submit the test until the upload completes.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-center gap-4 hover:border-red-400 transition bg-slate-50 dark:bg-zinc-800/30">
                      <div className="flex-1 text-center sm:text-left">
                        <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">Provide Video Response</p>
                        <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">Record a new video or upload an existing file (MP4, WebM, MOV).</p>
                        {answers[q.id] && (
                          <span className="inline-flex mt-3 text-xs font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100 dark:bg-green-900/20 dark:border-green-900/30 items-center gap-1.5">
                            <Check size={12} /> {answers[q.id].split('/').pop()}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <button type="button" onClick={() => setRecordingQuestionId(q.id)} className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition shadow-sm">
                          <Camera size={16} /> Record Video
                        </button>
                        <div className="relative flex items-center justify-center">
                          <input 
                            type="file" 
                            accept="video/*" 
                            capture="environment"
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                const file = e.target.files[0];
                                setSelectedVideoFiles(prev => ({ ...prev, [q.id]: file }));
                                setAnswers(prev => ({ ...prev, [q.id]: file.name }));
                              }
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                            id={`video-upload-${q.id}`} 
                          />
                          <label htmlFor={`video-upload-${q.id}`} className="flex w-full items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700 rounded-lg text-sm font-semibold transition cursor-pointer">
                            <UploadCloud size={16} /> Upload File
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button 
                onClick={() => handleSubmit(true)} 
                disabled={isSubmitting || isUploadingVideo} 
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition disabled:opacity-50"
              >
                Save Draft
              </button>
              <button 
                onClick={() => handleSubmit(false)} 
                disabled={isSubmitting || isUploadingVideo} 
                className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? "Submitting..." : isUploadingVideo ? "Uploading..." : "Submit Test"}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (reviewSubmission) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 animate-fadeIn">
        {!isModalMode && (<button onClick={() => setReviewSubmission(null)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 transition mb-6 w-fit border border-blue-100 dark:border-blue-900/30">
          <ArrowLeft size={14} className="stroke-[3px]" /> Back to tests
        </button>)}
        <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50 mb-1">Reviewing Answers</h3>
        <p className="text-sm text-slate-500 mb-6">Score obtained: <span className="font-bold text-blue-600">{reviewSubmission.marksObtained}</span> points</p>
        <div className="flex flex-col gap-6">
          {(reviewSubmission.answers || []).map((ans: any, idx: number) => {
            const isCQ = ans.question.type === "CQ" || ans.question.type === "Video";
            const provided = Array.isArray(ans.providedAnswer) ? ans.providedAnswer : [ans.providedAnswer];
            const correct = ans.question.correctAnswers || [];
            const isCorrect = !isCQ && provided.length === correct.length && provided.every((v: string) => correct.includes(v));
            return (
              <div key={ans.id} className="p-5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-zinc-800/40 dark:border-zinc-700">
                <h5 className="font-semibold text-slate-800 dark:text-zinc-100 mb-1">{idx + 1}. {ans.question.questionText}</h5>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                  <span>Total Marks: {ans.question.marks}</span>
                  <span className={`font-bold ${isCorrect || (isCQ && ans.marksAwarded > 0) ? "text-green-600" : (isCQ && reviewSubmission.status === "Pending Evaluation" ? "text-amber-500" : "text-rose-600")}`}>
                    Marks Awarded: {isCQ && reviewSubmission.status === "Pending Evaluation" ? "Pending" : (ans.marksAwarded ?? 0)}
                  </span>
                </div>
                {!isCQ ? (
                  <div className="flex flex-col gap-2">
                    {ans.question.options.map((opt: string, oIdx: number) => {
                      const wasSelected = provided.includes(opt);
                      const isOptCorrect = correct.includes(opt);
                      let cls = "border-slate-200 bg-white dark:bg-zinc-900";
                      if (wasSelected && isOptCorrect) cls = "border-green-500 bg-green-50 dark:bg-green-950/20";
                      else if (wasSelected && !isOptCorrect) cls = "border-rose-500 bg-rose-50 dark:bg-rose-950/20";
                      else if (!wasSelected && isOptCorrect) cls = "border-green-500";
                      return (
                        <div key={oIdx} className={`p-3 rounded-lg border ${cls} text-sm flex justify-between items-center`}>
                          <span className="text-slate-700 dark:text-zinc-300">{opt}</span>
                          <div className="flex gap-1.5 text-[10px] font-bold">
                            {wasSelected && <span className="text-slate-400 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">Your Answer</span>}
                            {isOptCorrect && <span className="text-green-600 bg-green-100 dark:bg-green-950/40 px-1.5 py-0.5 rounded">Correct</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {ans.question.type === "Video" ? (() => {
                      let parsed: any = null;
                      try {
                        parsed = JSON.parse(ans.evaluatorComment);
                      } catch (e) {}
                      
                      const hasAiFeedback = parsed && typeof parsed === 'object' && ('postureScore' in parsed);
                      
                      return (
                        <div className="p-4 rounded-xl border border-slate-200 bg-white dark:bg-zinc-900 flex flex-col md:flex-row gap-6 items-stretch">
                              {/* Video Section */}
                              <div className="shrink-0 flex flex-col gap-1">
                                <span className="text-slate-500 text-xs font-bold">Your Video Answer:</span>
                                <video 
                                  src={(() => {
                                    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
                                    return ans.providedAnswer.startsWith("http") 
                                      ? ans.providedAnswer 
                                      : `${base}${ans.providedAnswer}`;
                                  })()} 
                                  controls 
                                  className="w-full max-w-[320px] rounded-lg border border-slate-200 dark:border-zinc-700 bg-black" 
                                />
                              </div>

                          {/* Evaluation Details Section */}
                          <div className="flex-1 flex flex-col gap-2 justify-center min-w-0">
                            {hasAiFeedback ? (
                              <>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                                    {ans.evaluatedBy === 'AI' ? 'AI Evaluation Details:' : 'Evaluator Evaluation Details:'}
                                  </p>
                                  <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                                    {ans.evaluatedBy === 'AI' ? 'Reviewed by AI' : 'Reviewed by Invigilator'}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-2 w-full">
                                  <div className="p-3 bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800 rounded-xl flex items-start gap-4">
                                    <div className="w-28 shrink-0">
                                      <span className="text-[11px] font-bold text-slate-800 dark:text-zinc-200">Posture & Dress</span>
                                      <span className="text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full block w-fit mt-1">Score: {parsed.postureScore}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed flex-1 break-words">{parsed.postureFeedback}</p>
                                  </div>
                                  <div className="p-3 bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800 rounded-xl flex items-start gap-4">
                                    <div className="w-28 shrink-0">
                                      <span className="text-[11px] font-bold text-slate-800 dark:text-zinc-200">Voice & Clarity</span>
                                      <span className="text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full block w-fit mt-1">Score: {parsed.attitudeScore}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed flex-1 break-words">{parsed.attitudeFeedback}</p>
                                  </div>
                                  <div className="p-3 bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800 rounded-xl flex items-start gap-4">
                                    <div className="w-28 shrink-0">
                                      <span className="text-[11px] font-bold text-slate-800 dark:text-zinc-200">Script Accuracy</span>
                                      <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full block w-fit mt-1">Score: {parsed.accuracyScore}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed flex-1 break-words">{parsed.accuracyFeedback}</p>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 text-sm w-full">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-blue-600 dark:text-blue-400 text-xs font-bold">
                                    {ans.evaluatedBy === 'AI' ? 'AI Evaluation Details:' : 'Evaluator Comment:'}
                                  </p>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ans.evaluatedBy === 'AI' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'}`}>
                                    {ans.evaluatedBy === 'AI' ? 'Reviewed by AI' : 'Reviewed by Invigilator'}
                                  </span>
                                </div>
                                <p className="text-blue-800 dark:text-blue-300">{ans.evaluatorComment || "No feedback comments provided yet."}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })() : (
                      <>
                        <div className="p-4 rounded-xl border border-slate-200 bg-white dark:bg-zinc-900 text-sm">
                          <p className="text-slate-500 text-xs font-bold mb-1">Your Answer:</p>
                          <p className="text-slate-700 dark:text-zinc-300 whitespace-pre-wrap">{ans.providedAnswer || "No answer provided."}</p>
                        </div>
                        {(() => {
                          const isAiCq = ans.evaluatedBy === 'AI';
                          let cqFeedback: { marksAwarded?: number; feedback?: string } | null = null;
                          if (ans.evaluatorComment) {
                            try { cqFeedback = JSON.parse(ans.evaluatorComment); } catch (e) {}
                          }
                          if (!cqFeedback || typeof cqFeedback !== 'object' || !cqFeedback.feedback) {
                            cqFeedback = { feedback: ans.evaluatorComment };
                          }
                          return (
                            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 text-sm">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-blue-600 dark:text-blue-400 text-xs font-bold">
                                  {isAiCq ? 'AI Feedback:' : 'Evaluator Comment:'}
                                </p>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isAiCq ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'}`}>
                                  {isAiCq ? 'Reviewed by AI' : 'Reviewed by Invigilator'}
                                </span>
                              </div>
                              <p className="text-blue-800 dark:text-blue-300 whitespace-pre-wrap">{cqFeedback.feedback || "No feedback comments provided yet."}</p>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (aiFeedbackData) {
    let parsedFeedback: any = null;
    try {
      parsedFeedback = JSON.parse(aiFeedbackData.evaluatorComment);
    } catch (e) {
      // Fallback handled below
    }

    // Check if the feedback is structured JSON (from AI) or plain text (from manual admin evaluation)
    let isStructuredFeedback = true;
    try {
      const parsed = JSON.parse(aiFeedbackData.evaluatorComment);
      if (!parsed || typeof parsed !== 'object' || !('postureScore' in parsed)) {
        isStructuredFeedback = false;
      }
    } catch (e) {
      isStructuredFeedback = false;
    }

    if (!isStructuredFeedback) {
      return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 animate-fadeIn max-w-2xl mx-auto shadow-xl">
          {!isModalMode && (<button onClick={() => setAiFeedbackData(null)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 transition mb-6 w-fit border border-blue-100 dark:border-blue-900/30">
            <ArrowLeft size={14} className="stroke-[3px]" /> Back to tests
          </button>)}
          <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-50 mb-2">Performance Evaluation</h3>
          <p className="text-sm text-slate-500 mb-6">Here is the grade and feedback details of your video test submission.</p>

          <div className="flex flex-col gap-6">
            {/* Overall Marks Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md">
              <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Overall Score Obtained</p>
              <p className="text-4xl font-extrabold mt-1">
                {aiFeedbackData.marksAwarded} <span className="text-lg font-medium opacity-85">/ {aiFeedbackData.question?.marks || 15} Marks</span>
              </p>
            </div>

            {/* Overall Feedback Comment */}
            <div className="p-5 rounded-xl border border-slate-100 bg-slate-50 dark:bg-zinc-800/40 dark:border-zinc-700/50">
              <h5 className="font-bold text-slate-800 dark:text-zinc-100 text-sm mb-3">Overall Evaluator Feedback</h5>
              <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {aiFeedbackData.evaluatorComment || "No feedback comments provided."}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (!parsedFeedback || typeof parsedFeedback !== 'object') {
      parsedFeedback = {
        postureScore: 0,
        postureFeedback: "Unavailable",
        attitudeScore: 0,
        attitudeFeedback: aiFeedbackData.evaluatorComment || "No audio/voice tone feedback provided.",
        accuracyScore: 0,
        accuracyFeedback: "Unavailable",
        overallScore: aiFeedbackData.marksAwarded || 0
      };
    }

    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 animate-fadeIn max-w-2xl mx-auto shadow-xl">
        {!isModalMode && (<button onClick={() => setAiFeedbackData(null)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 transition mb-6 w-fit border border-blue-100 dark:border-blue-900/30">
          <ArrowLeft size={14} className="stroke-[3px]" /> Back to tests
        </button>)}
        <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-50 mb-2">
          {aiFeedbackData.evaluatedBy === 'AI' ? 'AI Performance Evaluation' : 'Performance Evaluation Details'}
        </h3>
        <p className="text-sm text-slate-500 mb-6">
          Here is the detailed breakdown of your video test submission {aiFeedbackData.evaluatedBy === 'AI' ? 'assessed by AI' : 'assessed by your evaluator'}.
        </p>

        <div className="flex flex-col gap-6">
          {/* Overall Marks Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Overall Score Obtained</p>
            <p className="text-4xl font-extrabold mt-1">
              {parsedFeedback.overallScore ?? aiFeedbackData.marksAwarded} <span className="text-lg font-medium opacity-85">/ {aiFeedbackData.question?.marks || 15} Marks</span>
            </p>
          </div>

          {/* Posture & Dressup */}
          <div className="p-5 rounded-xl border border-slate-100 bg-slate-50 dark:bg-zinc-800/40 dark:border-zinc-700/50">
            <div className="flex justify-between items-center mb-3">
              <h5 className="font-bold text-slate-800 dark:text-zinc-100 text-sm">1. Posture & Dress Code</h5>
              <span className="text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-2.5 py-1 rounded-full">
                Score: {parsedFeedback.postureScore}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">{parsedFeedback.postureFeedback}</p>
          </div>

          {/* Voice Tone & Fillers */}
          <div className="p-5 rounded-xl border border-slate-100 bg-slate-50 dark:bg-zinc-800/40 dark:border-zinc-700/50">
            <div className="flex justify-between items-center mb-3">
              <h5 className="font-bold text-slate-800 dark:text-zinc-100 text-sm">2. Voice Tone & Clarity</h5>
              <span className="text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-2.5 py-1 rounded-full">
                Score: {parsedFeedback.attitudeScore}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">{parsedFeedback.attitudeFeedback}</p>
          </div>

          {/* Script Accuracy */}
          <div className="p-5 rounded-xl border border-slate-100 bg-slate-50 dark:bg-zinc-800/40 dark:border-zinc-700/50">
            <div className="flex justify-between items-center mb-3">
              <h5 className="font-bold text-slate-800 dark:text-zinc-100 text-sm">3. Script Accuracy</h5>
              <span className="text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2.5 py-1 rounded-full">
                Score: {parsedFeedback.accuracyScore}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">{parsedFeedback.accuracyFeedback}</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── LEARNER: test list ───────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 animate-fadeIn">
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50">Tests &amp; Exams</h3>
            <button
              onClick={() => setIsTestsMinimized(!isTestsMinimized)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              title={isTestsMinimized ? "Expand" : "Minimize"}
            >
              {isTestsMinimized ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
          </div>
          
          {!isTestsMinimized && (
          tests.length === 0 ? (
          <p className="text-slate-500">No tests available for this lesson.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {tests.map(test => {
              const hasTaken = !!submissions[test.id];
              const submissionLoaded = submissions[test.id] !== undefined;
              const isStandalone = !!externalTest && externalTest.id === test.id;
              const standaloneHasTimeConstraint = isStandalone && (externalTest.startTime || externalTest.endTime);
              const testMode = getTestEvaluationMode(test);
              return (
                <div key={test.id} className="p-4 rounded-xl border border-slate-200 flex flex-col gap-3 bg-slate-50 dark:bg-zinc-800/40 dark:border-zinc-700">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-slate-800 dark:text-zinc-100 break-words">{test.title}</h4>
                      <p className="text-xs text-slate-500">{test.questions.length} questions</p>
                    </div>
                    {submittingTestIds[test.id] ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shrink-0 text-blue-600 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-400 animate-pulse">
                        {testMode === 'ai' ? "AI Evaluating..." : testMode === 'manual' ? "Submitting..." : "Processing..."}
                      </span>
                    ) : hasTaken && (
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shrink-0 ${
                        submissions[test.id].status === "Pending Evaluation" 
                          ? "text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400"
                          : "text-green-600 bg-green-50 dark:bg-green-950/20 dark:text-green-400"
                      }`}>
                        {submissions[test.id].status === "Pending Evaluation" ? "Pending Evaluation" : "Submitted"}
                      </span>
                    )}
                    {standaloneHasTimeConstraint && !hasTaken && !submittingTestIds[test.id] && examStatus === 'scheduled' && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400">
                        Scheduled
                      </span>
                    )}
                    {standaloneHasTimeConstraint && !hasTaken && !submittingTestIds[test.id] && examStatus === 'completed' && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md text-rose-600 bg-rose-50 dark:bg-rose-950/20 dark:text-rose-400">
                        Ended
                      </span>
                    )}
                  </div>
                  {testMode !== 'mcq' && (submittingTestIds[test.id] || (hasTaken && submissions[test.id].status === "Pending Evaluation")) && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Clock size={12} />
                      {testMode === 'ai'
                        ? "AI evaluation in progress — results in 2–3 minutes"
                        : "Pending evaluation — awaiting manual review"}
                    </p>
                  )}
                  {standaloneHasTimeConstraint && !hasTaken && !submittingTestIds[test.id] && examStatus === 'scheduled' && (
                    <p className="text-xs text-slate-500">Starts in {formatTimeRemaining(timeRemaining)}</p>
                  )}
                  {standaloneHasTimeConstraint && !hasTaken && !submittingTestIds[test.id] && examStatus === 'active' && (
                    <p className="text-xs text-blue-600 font-semibold">Time remaining: {formatTimeRemaining(timeRemaining)}</p>
                  )}
                  {hasTaken && !submittingTestIds[test.id] && submissions[test.id].status === "Evaluated" && (() => {
                    const sub = submissions[test.id];
                    const totalMarks = test.questions.reduce((sum: number, q: any) => sum + q.marks, 0);
                    const feedback = sub.answers.filter((a: any) => (a.question.type === "CQ" || a.question.type === "Video") && a.evaluatorComment);
                    return (
                      <div className="text-xs text-slate-600 dark:text-zinc-400">
                        <span className="font-bold text-green-600 dark:text-green-400">
                          Score: {sub.marksObtained} / {totalMarks}
                        </span>
                      </div>
                    );
                  })()}
                  <div className="flex gap-2">
                    {submittingTestIds[test.id] ? (
                      <div className="flex-1 flex flex-col items-center justify-center gap-1 px-4 py-2 bg-blue-50/50 dark:bg-blue-950/10 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold transition animate-pulse border border-blue-100/40">
                        <Loader2 size={12} className="animate-spin" />
                        {testMode === 'ai' ? "AI Evaluation Running..." : testMode === 'manual' ? "Submitting..." : "Processing..."}
                      </div>
                    ) : (
                      !hasTaken && submissionLoaded && !(standaloneHasTimeConstraint && examStatus !== 'active') && (
                        <button 
                          onClick={() => handleStartTest(test)} 
                          disabled={isStandalone && examStatus === 'scheduled'}
                          className="flex-1 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Take Test
                        </button>
                      )
                    )}
                    {hasTaken && (() => {
                      const hasVideo = test.questions.some((q: any) => q.type === "Video");
                      const videoAns = submissions[test.id].answers?.find((a: any) => a.question.type === "Video");
                      return (
                        <div className="flex gap-2 w-full">
                          <button 
                            onClick={() => setReviewSubmission(submissions[test.id])} 
                            className="flex-1 px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 text-center"
                          >
                            Review Answers
                          </button>
                          
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
      </div>

      {!hideLeaderboard && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 animate-fadeIn">
          <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50 mb-6 flex items-center gap-2">
            <CheckCircle className="text-amber-500" size={18} /> Top 5 Leaderboard
          </h3>
          {leaderboard.length === 0 ? (
            <p className="text-slate-500">No participants yet. Submit your test to be the first!</p>
          ) : (
            <div className="flex flex-col gap-2">
              {leaderboard.map((lb, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700">
                  <div className="flex items-center gap-3">
                    <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? "bg-amber-100 text-amber-700 animate-pulse" :
                      idx === 1 ? "bg-slate-200 text-slate-700" :
                      idx === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"
                    }`}>#{idx + 1}</span>
                    <span className="font-medium text-slate-800 dark:text-zinc-200">{lb.name}</span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-zinc-100">{lb.marksObtained} pts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Webcam Recorder Modal */}
      {recordingQuestionId && (
        <WebcamRecorder 
          onCancel={() => setRecordingQuestionId(null)}
          onUpload={(file) => {
            if (recordingQuestionId) {
              setSelectedVideoFiles(prev => ({ ...prev, [recordingQuestionId]: file }));
              setAnswers(prev => ({ ...prev, [recordingQuestionId]: file.name }));
              setRecordingQuestionId(null);
            }
          }}
        />
      )}
    </div>
  );
}
