"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/libs/api";
import toast from "react-hot-toast";
import { CheckCircle, Clock, Loader2, AlertTriangle, Video, UploadCloud, X } from "lucide-react";
import { WebcamRecorder } from "./WebcamRecorder";

interface ExamGroupPlayerProps {
  examGroupId: number;
  examGroup: any;
  userId: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

export function ExamGroupPlayer({
  examGroupId,
  examGroup,
  userId,
  onComplete,
  onCancel,
}: ExamGroupPlayerProps) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedVideoFiles, setSelectedVideoFiles] = useState<Record<number, File>>({});
  const [recordingQuestionId, setRecordingQuestionId] = useState<number | null>(null);
  const answersRef = React.useRef(answers);
  const videoFilesRef = React.useRef(selectedVideoFiles);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    videoFilesRef.current = selectedVideoFiles;
  }, [selectedVideoFiles]);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const totalQuestions = examGroup?.questions?.length || 0;
  const totalMins = examGroup?.timePerQuestion ?? null;

  useEffect(() => {
    if (!examGroup?.questions) return;
    setQuestions(examGroup.questions);
    const submission = examGroup.submissions?.[0];
    if (submission) {
      setSubmitted(true);
      setResult(submission);
    }
    setLoading(false);
  }, [examGroup]);

  useEffect(() => {
    if (totalMins === null || submitted) return;
    const secs = totalMins * 60;
    setTimeLeft(secs);
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 0) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [totalMins, submitted]);

  const submitLogic = async (auto = false) => {
    if (submitted) return;
    const currentAnswers = { ...answersRef.current };
    const currentVideos = { ...videoFilesRef.current };

    if (!auto && questions.length > 0) {
      const missingAnswer = questions.some((q: any) => {
        const ans = currentAnswers[q.id];
        if (q.type === "MCQ") {
          return !ans || !Array.isArray(ans) || ans.length === 0;
        }
        if (q.type === "CQ") {
          return !ans || String(ans).trim() === "";
        }
        if (q.type === "Video") {
          const hasSelectedLocal = currentVideos[q.id] !== undefined;
          return (!ans || String(ans).trim() === "" || ans === "Uploading...") && !hasSelectedLocal;
        }
        return false;
      });

      if (missingAnswer) {
        toast.error("Answering all questions (MCQ, CQ, and Video) is mandatory before submitting the exam.");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      if (!auto) toast.success("Submitting exam in the background...");

      const finalAnswers = { ...currentAnswers };
      const uploadKeys = Object.keys(currentVideos);
      for (const qId of uploadKeys) {
        const file = currentVideos[Number(qId)];
        if (file) {
          setAnswers(prev => ({ ...prev, [Number(qId)]: ["Uploading..."] }));
          const formData = new FormData();
          formData.append('file', file);
          const res = await api.post('/tests/upload-test-video', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          if (res.data?.url) {
            finalAnswers[Number(qId)] = [res.data.url];
            setAnswers(prev => ({ ...prev, [Number(qId)]: [res.data.url] }));
          } else {
            throw new Error("Failed to upload video response.");
          }
        }
      }

      setSelectedVideoFiles({});

      const answerArray = Object.entries(finalAnswers).map(([questionId, providedAnswer]) => ({
        questionId: Number(questionId),
        providedAnswer: Array.isArray(providedAnswer) ? providedAnswer : [String(providedAnswer)],
      }));

      if (auto && answerArray.length === 0) {
        toast.error("No answers selected. Submitting empty exam.");
      }

      const res = await api.post(`/exam-groups/${examGroupId}/submit`, { answers: answerArray });
      setResult(res.data);
      setSubmitted(true);
      toast.success(auto ? "Time is up! Exam auto-submitted." : "Exam submitted successfully!");
      onComplete?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Failed to ${auto ? "auto-submit" : "submit"} exam.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoSubmit = useCallback(() => submitLogic(true), [examGroupId, submitted, onComplete, questions]);
  const handleSubmit = () => submitLogic(false);

  const toggleAnswer = (questionId: number, optionKey: string) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[questionId]) ? prev[questionId] : [];
      if (current.includes(optionKey)) {
        const next = current.filter((a: string) => a !== optionKey);
        if (next.length === 0) {
          const { [questionId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [questionId]: next };
      }
      return { ...prev, [questionId]: [...current, optionKey] };
    });
  };

  const handleTextAnswer = (questionId: number, text: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: [text] }));
  };

  const handleFileChange = (questionId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedVideoFiles(prev => ({ ...prev, [questionId]: file }));
      setAnswers(prev => ({ ...prev, [questionId]: [file.name] }));
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-sm text-slate-500">Loading exam...</p>
      </div>
    );
  }

  if (submitted && result) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fadeIn">
        <CheckCircle className="h-14 w-14 text-green-500" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-50">Exam Submitted</h2>
        <p className="text-sm text-slate-500">Your answers have been auto-evaluated.</p>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 flex flex-col items-center gap-2 shadow-sm">
          <span className="text-xs text-slate-400 uppercase tracking-wider">Marks Obtained</span>
          <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{result.marksObtained ?? 0}</span>
          {totalQuestions > 0 && (
            <span className="text-xs text-slate-400">out of {questions.reduce((sum: number, q: any) => sum + (q.marks || 0), 0)} marks</span>
          )}
        </div>
        {onCancel && (
          <button onClick={onCancel} className="mt-2 rounded-xl border border-slate-200 dark:border-zinc-800 px-4 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 transition">
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-50">{examGroup.title}</h2>
          <p className="text-xs text-slate-400">{totalQuestions} questions {totalMins ? `• ${totalMins} minutes total` : "• Untimed"}</p>
        </div>
        {timeLeft !== null && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${timeLeft < 60 ? "bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 animate-pulse" : "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"}`}>
            <Clock size={14} /> {formatTime(timeLeft)}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {questions.map((q: any, idx: number) => (
          <div key={q.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-xs font-bold text-slate-400 mt-0.5">{idx + 1}.</span>
              <div className="flex-1">
                <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100 mb-2 leading-relaxed">{q.questionText}</p>
                <span className="text-[10px] text-slate-400 mt-1 inline-block">{q.marks} marks</span>
                <div className="mt-3 flex flex-col gap-2">
                  {q.type === 'MCQ' ? (
                    (q.options || []).map((opt: string, optIdx: number) => {
                      const optionKey = `option_${optIdx}`;
                      const currentAnswers = Array.isArray(answers[q.id]) ? answers[q.id] : [];
                      const selected = currentAnswers.includes(optionKey);
                      return (
                        <button
                          key={optIdx}
                          onClick={() => toggleAnswer(q.id, optionKey)}
                          className={`text-left text-base px-5 py-4 rounded-xl border transition flex items-center gap-3 ${
                            selected
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400"
                              : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-700 dark:text-zinc-300"
                          }`}
                        >
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${selected ? "border-blue-500 bg-blue-600" : "border-slate-300 dark:border-zinc-700"}`}>
                            {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                          {opt}
                        </button>
                      );
                    })
                  ) : q.type === 'CQ' ? (
                    <textarea
                      value={(answers[q.id]?.[0]) || ""}
                      onChange={(e) => handleTextAnswer(q.id, e.target.value)}
                      placeholder="Type your answer here..."
                      rows={4}
                      className="w-full bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition p-4 resize-none outline-none"
                    />
                  ) : q.type === 'Video' ? (
                    <div className="bg-slate-50 dark:bg-zinc-950/50 p-4 sm:p-6 rounded-xl border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row gap-4 items-center">
                      <div className="flex-1 flex flex-col sm:flex-row gap-3 w-full">
                        <button
                          onClick={() => setRecordingQuestionId(q.id)}
                          className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl transition shadow-md w-full sm:w-auto"
                        >
                          <Video size={18} /> Record Video
                        </button>
                        <div className="relative w-full sm:w-auto flex-1 sm:flex-none flex">
                          <input
                            type="file"
                            accept="video/*"
                            id={`file-upload-${q.id}`}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => handleFileChange(q.id, e)}
                          />
                          <label
                            htmlFor={`file-upload-${q.id}`}
                            className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 font-bold py-3 px-6 rounded-xl transition cursor-pointer w-full text-center"
                          >
                            <UploadCloud size={18} /> Upload Video
                          </label>
                        </div>
                      </div>
                      <div className="w-full sm:w-auto text-center sm:text-right text-xs font-bold text-slate-500 dark:text-zinc-400">
                        {answers[q.id]?.[0] ? (
                          <div className="flex items-center justify-center sm:justify-end gap-1.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-900/30">
                            <CheckCircle size={14} /> 
                            <span className="truncate max-w-[150px] sm:max-w-[200px]" title={answers[q.id]?.[0]}>
                              {answers[q.id]?.[0]}
                            </span>
                          </div>
                        ) : (
                          "No video selected"
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3 sticky bottom-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-3 rounded-2xl border border-slate-200 dark:border-zinc-800">
        {onCancel && (
          <button onClick={onCancel} className="rounded-xl border border-slate-200 dark:border-zinc-800 px-4 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 transition">
            Cancel
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 text-xs font-bold transition shadow-sm"
        >
          {isSubmitting && <Loader2 size={14} className="animate-spin" />}
          {isSubmitting ? "Submitting..." : "Submit Exam"}
        </button>
      </div>

      {recordingQuestionId && (
        <WebcamRecorder 
          onCancel={() => setRecordingQuestionId(null)}
          onUpload={(file) => {
            if (recordingQuestionId) {
              setSelectedVideoFiles(prev => ({ ...prev, [recordingQuestionId]: file }));
              setAnswers(prev => ({ ...prev, [recordingQuestionId]: [file.name] }));
              setRecordingQuestionId(null);
            }
          }}
        />
      )}
    </div>
  );
}
