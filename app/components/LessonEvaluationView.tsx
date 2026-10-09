"use client";

import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, CheckCircle, FileText, Video as VideoIcon, 
  User, Save, ChevronRight, ChevronLeft, Award, Clock, Layers
} from "lucide-react";
import { api } from "@/libs/api";
import toast from "react-hot-toast";
import { SelectDropdown } from "./SelectDropdown";

interface LessonEvaluationViewProps {
  selectedLesson?: any;
  courseId: number | string;
  courseLessons?: any[];
  enrolledCount?: number;
  standaloneExam?: any;
  onClearStandalone?: () => void;
}

export function LessonEvaluationView({ selectedLesson, courseId, courseLessons = [], enrolledCount = 0, standaloneExam, onClearStandalone }: LessonEvaluationViewProps) {
  const [activeLesson, setActiveLesson] = useState<any>(selectedLesson);
  const [tests, setTests] = useState<any[]>([]);
  const [pendingCounts, setPendingCounts] = useState<Record<number, number>>({});
  const [loadingTests, setLoadingTests] = useState(true);

  const [selectedTest, setSelectedTest] = useState<any | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);

  // Pagination states
  const [testPage, setTestPage] = useState(1);
  const TESTS_PER_PAGE = 5;

  const [subPage, setSubPage] = useState(1);
  const SUBS_PER_PAGE = 5;

  // Form states for CQ evaluation
  const [cqMarks, setCqMarks] = useState<Record<number, number | string>>({});
  const [cqComments, setCqComments] = useState<Record<number, string>>({});

  // Form states for 3-category Video evaluation
  const [postureScores, setPostureScores] = useState<Record<number, number | string>>({});
  const [postureFeedbacks, setPostureFeedbacks] = useState<Record<number, string>>({});
  
  const [attitudeScores, setAttitudeScores] = useState<Record<number, number | string>>({});
  const [attitudeFeedbacks, setAttitudeFeedbacks] = useState<Record<number, string>>({});

  const [accuracyScores, setAccuracyScores] = useState<Record<number, number | string>>({});
  const [accuracyFeedbacks, setAccuracyFeedbacks] = useState<Record<number, string>>({});

  const [submittingEval, setSubmittingEval] = useState(false);

  useEffect(() => {
    if (standaloneExam?.id) {
      handleSelectTest(standaloneExam);
    } else if (selectedLesson?.id) {
      setActiveLesson(selectedLesson);
    }
  }, [selectedLesson?.id, standaloneExam?.id]);

  useEffect(() => {
    if (activeLesson?.id && !standaloneExam?.id) {
      setSelectedTest(null);
      setSelectedSubmission(null);
      fetchLessonTests();
    }
  }, [activeLesson?.id]);

  const fetchLessonTests = async () => {
    try {
      setLoadingTests(true);
      const [testsRes, pendingRes] = await Promise.all([
        api.get(`/tests/lesson/${activeLesson.id}`),
        api.get(`/tests/evaluations/pending?lessonId=${activeLesson.id}`),
      ]);

      const rawTests = testsRes.data || [];
      const pendingList = pendingRes.data || [];

      // Calculate pending evaluation counts per test
      const counts: Record<number, number> = {};
      pendingList.forEach((sub: any) => {
        if (sub.status === "Pending Evaluation" && sub.test?.id) {
          counts[sub.test.id] = (counts[sub.test.id] || 0) + 1;
        }
      });

      setTests(rawTests);
      setPendingCounts(counts);
      setTestPage(1);
    } catch (err) {
      toast.error("Failed to load lesson tests.");
    } finally {
      setLoadingTests(false);
    }
  };

  const handleSelectTest = async (test: any) => {
    setSelectedTest(test);
    setSelectedSubmission(null);
    setSubPage(1);
    try {
      setLoadingSubmissions(true);
      const res = await api.get(`/tests/evaluations/pending?testId=${test.id}`);
      setSubmissions(res.data || []);
    } catch (err) {
      toast.error("Failed to load test submissions.");
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleOpenSubmission = (sub: any) => {
    setSelectedSubmission(sub);
    const initialCqMarks: Record<number, number | string> = {};
    const initialCqComments: Record<number, string> = {};

    const initialPosScores: Record<number, number | string> = {};
    const initialPosFeedbacks: Record<number, string> = {};
    const initialAttScores: Record<number, number | string> = {};
    const initialAttFeedbacks: Record<number, string> = {};
    const initialAccScores: Record<number, number | string> = {};
    const initialAccFeedbacks: Record<number, string> = {};

    sub.answers.forEach((ans: any) => {
      if (ans.question.type === "CQ") {
        const isPending = ans.marksAwarded === 0 && (!ans.evaluatorComment || ans.evaluatorComment.trim() === "");
        initialCqMarks[ans.id] = isPending ? "" : (ans.marksAwarded ?? "");
        initialCqComments[ans.id] = ans.evaluatorComment || "";
      } else if (ans.question.type === "Video") {
        let parsed: any = null;
        try {
          if (ans.evaluatorComment && ans.evaluatorComment.startsWith("{")) {
            parsed = JSON.parse(ans.evaluatorComment);
          }
        } catch (e) {
          parsed = null;
        }

        const hasScores = parsed && parsed.postureScore !== undefined;

        initialPosScores[ans.id] = hasScores ? parsed.postureScore : "";
        initialPosFeedbacks[ans.id] = parsed?.postureFeedback ?? "";

        initialAttScores[ans.id] = hasScores ? parsed.attitudeScore : "";
        initialAttFeedbacks[ans.id] = parsed?.attitudeFeedback ?? "";

        initialAccScores[ans.id] = hasScores ? parsed.accuracyScore : "";
        initialAccFeedbacks[ans.id] = parsed?.accuracyFeedback ?? "";
      }
    });

    setCqMarks(initialCqMarks);
    setCqComments(initialCqComments);
    setPostureScores(initialPosScores);
    setPostureFeedbacks(initialPosFeedbacks);
    setAttitudeScores(initialAttScores);
    setAttitudeFeedbacks(initialAttFeedbacks);
    setAccuracyScores(initialAccScores);
    setAccuracyFeedbacks(initialAccFeedbacks);
  };

  const handleSubmitEvaluation = async () => {
    if (!selectedSubmission) return;

    const evaluations: any[] = [];

    // STRICT FIELD VALIDATION
    for (let i = 0; i < selectedSubmission.answers.length; i++) {
      const ans = selectedSubmission.answers[i];
      const qNum = i + 1;

      if (ans.question.type === "CQ") {
        const marksRaw = cqMarks[ans.id];
        const marks = marksRaw === "" || marksRaw === undefined || marksRaw === null ? NaN : Number(marksRaw);
        const comment = cqComments[ans.id];

        if (isNaN(marks)) {
          toast.error(`Please enter valid marks for Question ${qNum} (CQ).`);
          return;
        }
        if (marks < 0 || marks > ans.question.marks) {
          toast.error(`Marks for Question ${qNum} (CQ) must be between 0 and ${ans.question.marks}.`);
          return;
        }

        evaluations.push({
          submissionAnswerId: ans.id,
          marksAwarded: Number(marks),
          evaluatorComment: (comment && comment.trim()) ? comment.trim() : "No feedback",
        });
      } else if (ans.question.type === "Video") {
        const posRaw = postureScores[ans.id];
        const attRaw = attitudeScores[ans.id];
        const accRaw = accuracyScores[ans.id];

        const posScore = posRaw === "" || posRaw === undefined || posRaw === null ? NaN : Number(posRaw);
        const attScore = attRaw === "" || attRaw === undefined || attRaw === null ? NaN : Number(attRaw);
        const accScore = accRaw === "" || accRaw === undefined || accRaw === null ? NaN : Number(accRaw);

        const posFeed = postureFeedbacks[ans.id];
        const attFeed = attitudeFeedbacks[ans.id];
        const accFeed = accuracyFeedbacks[ans.id];

        const postureMax = ans.question.postureMarks ?? (ans.question.marks / 3);
        const voiceMax = ans.question.voiceMarks ?? (ans.question.marks / 3);
        const accuracyMax = ans.question.accuracyMarks ?? (ans.question.marks / 3);

        if (isNaN(posScore) || posScore < 0 || posScore > postureMax) {
          toast.error(`Posture score for Video Q${qNum} must be between 0 and ${postureMax}`);
          return;
        }

        if (isNaN(attScore) || attScore < 0 || attScore > voiceMax) {
          toast.error(`Voice/Attitude score for Video Q${qNum} must be between 0 and ${voiceMax}`);
          return;
        }

        if (isNaN(accScore) || accScore < 0 || accScore > accuracyMax) {
          toast.error(`Script Accuracy score for Video Q${qNum} must be between 0 and ${accuracyMax}`);
          return;
        }

        const totalVideoMarks = Math.round((Number(posScore) + Number(attScore) + Number(accScore)) * 100) / 100;

        const structuredComment = JSON.stringify({
          postureScore: Number(posScore),
          postureFeedback: (posFeed && posFeed.trim()) ? posFeed.trim() : "No feedback",
          attitudeScore: Number(attScore),
          attitudeFeedback: (attFeed && attFeed.trim()) ? attFeed.trim() : "No feedback",
          accuracyScore: Number(accScore),
          accuracyFeedback: (accFeed && accFeed.trim()) ? accFeed.trim() : "No feedback",
          overallScore: totalVideoMarks,
        });

        evaluations.push({
          submissionAnswerId: ans.id,
          marksAwarded: totalVideoMarks,
          evaluatorComment: structuredComment,
        });
      }
    }

    setSubmittingEval(true);
    try {
      await api.put("/tests/evaluations", {
        testSubmissionId: selectedSubmission.id,
        evaluations,
      });

      toast.success("Evaluation submitted successfully!");
      setSelectedSubmission(null);

      // Refresh tests and counts
      if (!standaloneExam) {
        await fetchLessonTests();
      }
      if (selectedTest) {
        const res = await api.get(`/tests/evaluations/pending?testId=${selectedTest.id}`);
        setSubmissions(res.data || []);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to submit evaluation.");
    } finally {
      setSubmittingEval(false);
    }
  };

  // Filter tests: pending tests only
  const pendingTests = tests.filter((t: any) => (pendingCounts[t.id] || 0) > 0);

  // Pagination for pending tests
  const totalTestPages = Math.max(1, Math.ceil(pendingTests.length / TESTS_PER_PAGE));
  const paginatedTests = pendingTests.slice((testPage - 1) * TESTS_PER_PAGE, testPage * TESTS_PER_PAGE);

  // Pagination for submissions
  const totalSubPages = Math.max(1, Math.ceil(submissions.length / SUBS_PER_PAGE));
  const paginatedSubmissions = submissions.slice((subPage - 1) * SUBS_PER_PAGE, subPage * SUBS_PER_PAGE);

  if (!activeLesson && !standaloneExam) {
    return (
      <div className="p-10 text-center text-slate-400 text-xs bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
        No lessons found for this course. Add lessons first to enable evaluation.
      </div>
    );
  }

  if (loadingTests && !standaloneExam) {
    return (
      <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <span className="text-xs font-semibold">Loading lesson evaluations...</span>
      </div>
    );
  }

  // 1. SUBMISSION EVALUATION WORKBENCH
  if (selectedSubmission) {
    const cqAnswers = selectedSubmission.answers.filter((a: any) => a.question.type === "CQ");
    const videoAnswers = selectedSubmission.answers.filter((a: any) => a.question.type === "Video");

    return (
      <div className="flex flex-col gap-6 animate-fadeIn">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedSubmission(null)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 transition border border-slate-200 dark:border-zinc-700"
          >
            <ArrowLeft size={15} /> Back to Submissions
          </button>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Learner:</span>
            <span className="text-slate-900 dark:text-zinc-100 font-bold bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700">
              {selectedSubmission.user?.name || "Student"} ({selectedSubmission.user?.email})
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-5 mb-6">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-zinc-50">
                Evaluating Submission: {selectedTest?.title}
              </h3>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                <Clock size={13} /> Submitted on {new Date(selectedSubmission.createdAt).toLocaleString()}
              </p>
            </div>
            <span
              className={`text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full border ${
                selectedSubmission.status === "Pending Evaluation"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              }`}
            >
              {selectedSubmission.status}
            </span>
          </div>

          {/* MCQ QUESTIONS - READ ONLY (Auto Evaluated) */}
          {(() => {
            const mcqAnswers = selectedSubmission.answers.filter((a: any) => a.question.type === "MCQ");
            if (mcqAnswers.length === 0) return null;
            return (
              <div className="flex flex-col gap-4 mb-8">
                <h4 className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2 border-b pb-2.5 border-emerald-100 dark:border-emerald-950">
                  <CheckCircle size={18} /> Multiple Choice Questions – Auto Evaluated ({mcqAnswers.length})
                </h4>
                {mcqAnswers.map((ans: any, idx: number) => {
                  const studentAnswers: string[] = (() => {
                    try {
                      const parsed = JSON.parse(ans.providedAnswer);
                      return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
                    } catch {
                      return ans.providedAnswer ? [String(ans.providedAnswer)] : [];
                    }
                  })();
                  const correctAnswers: string[] = (ans.question.correctAnswers || []).map(String);
                  
                  const isCorrect = correctAnswers.length > 0 &&
                    studentAnswers.length === correctAnswers.length &&
                    studentAnswers.every((a: string) => correctAnswers.includes(a));
                  const marksAwarded = ans.marksAwarded ?? (isCorrect ? ans.question.marks : 0);

                  const options: string[] = ans.question.options || [];

                  return (
                    <div key={ans.id} className={`p-5 rounded-2xl border flex flex-col gap-4 ${isCorrect ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/10" : "border-rose-200 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10"}`}>
                      <div className="flex justify-between items-start gap-3 border-b border-slate-200/50 dark:border-zinc-800/50 pb-3">
                        <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 flex-1">
                          Q{idx + 1}: {ans.question.questionText}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${isCorrect ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"}`}>
                            {isCorrect ? "✓ Correct" : "✗ Incorrect"}
                          </span>
                          <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full border border-slate-200 dark:border-zinc-700">
                            {marksAwarded} / {ans.question.marks} marks
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2.5 mt-1">
                        {options.length > 0 ? (
                          options.map((opt: string, oIdx: number) => {
                            const optStr = String(opt);
                            const isStudentChoice = studentAnswers.includes(optStr);
                            const isActualCorrect = correctAnswers.includes(optStr);

                            let borderClass = "border-slate-200 dark:border-zinc-700";
                            let bgClass = "bg-white dark:bg-zinc-900";
                            let textClass = "text-slate-700 dark:text-zinc-300";
                            let icon = null;

                            if (isActualCorrect && isStudentChoice) {
                              borderClass = "border-emerald-500 dark:border-emerald-600";
                              bgClass = "bg-emerald-50 dark:bg-emerald-900/20";
                              textClass = "text-emerald-800 dark:text-emerald-200 font-semibold";
                              icon = <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-auto text-xs">✓ Correct Choice</span>;
                            } else if (isActualCorrect && !isStudentChoice) {
                              borderClass = "border-emerald-300 border-dashed dark:border-emerald-800/60";
                              bgClass = "bg-emerald-50/50 dark:bg-emerald-900/10";
                              textClass = "text-emerald-700 dark:text-emerald-400";
                              icon = <span className="text-emerald-500 dark:text-emerald-500 italic ml-auto text-xs">Should have selected</span>;
                            } else if (!isActualCorrect && isStudentChoice) {
                              borderClass = "border-rose-500 dark:border-rose-600";
                              bgClass = "bg-rose-50 dark:bg-rose-900/20";
                              textClass = "text-rose-800 dark:text-rose-200 font-semibold";
                              icon = <span className="text-rose-600 dark:text-rose-400 font-bold ml-auto text-xs">✗ Wrong Choice</span>;
                            }

                            return (
                              <div key={oIdx} className={`flex items-center gap-3 p-3 rounded-xl border ${borderClass} ${bgClass} transition-colors`}>
                                <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${isStudentChoice ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-slate-300 dark:border-zinc-600'}`}>
                                  {isStudentChoice && <CheckCircle size={12} className="text-white" />}
                                </div>
                                <span className={`text-sm ${textClass}`}>{optStr}</span>
                                {icon}
                              </div>
                            );
                          })
                        ) : (
                          // Fallback if no options are available in the question data
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Student's Answer</p>
                              <div className="flex flex-wrap gap-1.5">
                                {studentAnswers.length > 0 ? studentAnswers.map((a: string, i: number) => (
                                  <span key={i} className={`px-2.5 py-1 rounded-lg border font-semibold ${correctAnswers.includes(a) ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800" : "bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800"}`}>
                                    {a}
                                  </span>
                                )) : (
                                  <span className="text-slate-400 italic">No answer provided</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Correct Answer(s)</p>
                              <div className="flex flex-wrap gap-1.5">
                                {correctAnswers.map((a: string, i: number) => (
                                  <span key={i} className="px-2.5 py-1 rounded-lg border font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800">
                                    {a}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* CQ QUESTIONS EVALUATION */}
          {cqAnswers.length > 0 && (
            <div className="flex flex-col gap-6 mb-8">
              <h4 className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400 flex items-center gap-2 border-b pb-2.5 border-indigo-100 dark:border-indigo-950">
                <FileText size={18} /> Constructive Questions (CQ) ({cqAnswers.length})
              </h4>
              {cqAnswers.map((ans: any, idx: number) => (
                <div key={ans.id} className="p-5 rounded-2xl border border-indigo-100 dark:border-indigo-950/60 bg-indigo-50/30 dark:bg-indigo-950/10 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-bold text-slate-800 dark:text-zinc-100">
                      Q{idx + 1}: {ans.question.questionText}
                    </p>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950/50 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-900">
                      Max Marks: {ans.question.marks}
                    </span>
                  </div>

                  <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 text-xs font-mono whitespace-pre-wrap text-slate-800 dark:text-zinc-200 shadow-inner">
                    {ans.providedAnswer || "No answer text provided."}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start mt-1 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-300">
                        Marks Awarded <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="0"
                        value={cqMarks[ans.id] ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || /^\d*\.?\d*$/.test(val)) {
                            setCqMarks({ ...cqMarks, [ans.id]: val });
                          }
                        }}
                        className="p-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl bg-slate-50 dark:bg-zinc-800 text-xs font-bold focus:border-indigo-600 focus:outline-none"
                      />
                    </div>
                    <div className="md:col-span-3 flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-300">
                        Evaluator Feedback Comment
                      </label>
                      <input
                        type="text"
                        value={cqComments[ans.id] || ""}
                        onChange={(e) => setCqComments({ ...cqComments, [ans.id]: e.target.value })}
                        placeholder="No feedback"
                        className="p-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl bg-slate-50 dark:bg-zinc-800 text-xs focus:border-indigo-600 focus:outline-none w-full"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* VIDEO QUESTIONS 3-CATEGORY EVALUATION */}
          {videoAnswers.length > 0 && (
            <div className="flex flex-col gap-6 mb-8">
              <h4 className="font-extrabold text-sm text-purple-600 dark:text-purple-400 flex items-center gap-2 border-b pb-2.5 border-purple-100 dark:border-purple-950">
                <VideoIcon size={18} /> Video Questions (3-Category Evaluation) ({videoAnswers.length})
              </h4>
              {videoAnswers.map((ans: any, idx: number) => {
                const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
                const videoUrl = ans.providedAnswer?.startsWith("http")
                  ? ans.providedAnswer
                  : `${base}${ans.providedAnswer}`;

                const postureMax = ans.question.postureMarks ?? (ans.question.marks / 3);
                const voiceMax = ans.question.voiceMarks ?? (ans.question.marks / 3);
                const accuracyMax = ans.question.accuracyMarks ?? (ans.question.marks / 3);
                const totalMax = postureMax + voiceMax + accuracyMax;
                const currentTotal = Math.round(((Number(postureScores[ans.id]) || 0) + (Number(attitudeScores[ans.id]) || 0) + (Number(accuracyScores[ans.id]) || 0)) * 100) / 100;
                
                const isAiEvaluated = ans.evaluatedBy && ans.evaluatedBy.toUpperCase() === 'AI';

                return (
                  <div key={ans.id} className="p-5 rounded-2xl border border-purple-100 dark:border-purple-950/60 bg-purple-50/20 dark:bg-purple-950/10 flex flex-col gap-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-zinc-100">
                          Q{idx + 1}: {ans.question.questionText}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Method: {ans.question.evaluationType || "AI"}</p>
                      </div>
                      <span className="text-xs font-bold text-purple-600 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 px-3 py-1.5 rounded-full border border-purple-200 dark:border-purple-800">
                        Total Video Score: {currentTotal} / {totalMax}
                      </span>
                    </div>

                    {/* Student Video Player */}
                    <div className="w-full max-w-lg mx-auto bg-black rounded-2xl overflow-hidden shadow-md border border-slate-800">
                      {ans.providedAnswer ? (
                        <video src={videoUrl} controls className="w-full h-64 object-contain" />
                      ) : (
                        <div className="p-8 text-center text-xs text-slate-400">No video response recorded.</div>
                      )}
                    </div>

                    {/* 3 CATEGORY INPUT FORM */}
                    <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-purple-100 dark:border-purple-900/40 flex flex-col gap-4">
                      <h5 className="text-xs font-extrabold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Award size={15} className="text-purple-600" /> {isAiEvaluated ? "AI Evaluator 3-Category Scoring (Read-Only)" : "Human Evaluator 3-Category Scoring"}
                      </h5>

                      {/* 1. Posture & Dress Code */}
                      <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl flex flex-col md:flex-row gap-3 items-start md:items-center">
                        <div className="w-48 shrink-0">
                          <label className="text-xs font-bold text-blue-900 dark:text-blue-300 block">1. Posture &amp; Dress Code</label>
                          <span className="text-[10px] text-blue-600 dark:text-blue-400">Score range: 0 - {postureMax}</span>
                        </div>
                        <input
                          type="text"
                          placeholder="0"
                          value={postureScores[ans.id] ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d*\.?\d*$/.test(val)) {
                              setPostureScores({ ...postureScores, [ans.id]: val });
                            }
                          }}
                          disabled={isAiEvaluated}
                          className={`w-20 p-2.5 border border-blue-200 dark:border-blue-800 rounded-xl bg-white dark:bg-zinc-900 text-xs font-bold focus:border-blue-600 focus:outline-none ${isAiEvaluated ? 'opacity-70 cursor-not-allowed bg-slate-50 dark:bg-zinc-800' : ''}`}
                        />
                        <input
                          type="text"
                          value={postureFeedbacks[ans.id] || ""}
                          onChange={(e) => setPostureFeedbacks({ ...postureFeedbacks, [ans.id]: e.target.value })}
                          placeholder="No feedback"
                          disabled={isAiEvaluated}
                          className={`flex-1 p-2.5 border border-blue-200 dark:border-blue-800 rounded-xl bg-white dark:bg-zinc-900 text-xs focus:border-blue-600 focus:outline-none w-full ${isAiEvaluated ? 'opacity-70 cursor-not-allowed bg-slate-50 dark:bg-zinc-800' : ''}`}
                        />
                      </div>

                      {/* 2. Voice Tone & Clarity */}
                      <div className="p-3.5 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-xl flex flex-col md:flex-row gap-3 items-start md:items-center">
                        <div className="w-48 shrink-0">
                          <label className="text-xs font-bold text-purple-900 dark:text-purple-300 block">2. Voice Tone &amp; Clarity</label>
                          <span className="text-[10px] text-purple-600 dark:text-purple-400">Score range: 0 - {voiceMax}</span>
                        </div>
                        <input
                          type="text"
                          placeholder="0"
                          value={attitudeScores[ans.id] ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d*\.?\d*$/.test(val)) {
                              setAttitudeScores({ ...attitudeScores, [ans.id]: val });
                            }
                          }}
                          disabled={isAiEvaluated}
                          className={`w-20 p-2.5 border border-purple-200 dark:border-purple-800 rounded-xl bg-white dark:bg-zinc-900 text-xs font-bold focus:border-purple-600 focus:outline-none ${isAiEvaluated ? 'opacity-70 cursor-not-allowed bg-slate-50 dark:bg-zinc-800' : ''}`}
                        />
                        <input
                          type="text"
                          value={attitudeFeedbacks[ans.id] || ""}
                          onChange={(e) => setAttitudeFeedbacks({ ...attitudeFeedbacks, [ans.id]: e.target.value })}
                          placeholder="No feedback"
                          disabled={isAiEvaluated}
                          className={`flex-1 p-2.5 border border-purple-200 dark:border-purple-800 rounded-xl bg-white dark:bg-zinc-900 text-xs focus:border-purple-600 focus:outline-none w-full ${isAiEvaluated ? 'opacity-70 cursor-not-allowed bg-slate-50 dark:bg-zinc-800' : ''}`}
                        />
                      </div>

                      {/* 3. Script Accuracy */}
                      <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl flex flex-col md:flex-row gap-3 items-start md:items-center">
                        <div className="w-48 shrink-0">
                          <label className="text-xs font-bold text-emerald-900 dark:text-emerald-300 block">3. Script Accuracy</label>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Score range: 0 - {accuracyMax}</span>
                        </div>
                        <input
                          type="text"
                          placeholder="0"
                          value={accuracyScores[ans.id] ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d*\.?\d*$/.test(val)) {
                              setAccuracyScores({ ...accuracyScores, [ans.id]: val });
                            }
                          }}
                          disabled={isAiEvaluated}
                          className={`w-20 p-2.5 border border-emerald-200 dark:border-emerald-800 rounded-xl bg-white dark:bg-zinc-900 text-xs font-bold focus:border-emerald-600 focus:outline-none ${isAiEvaluated ? 'opacity-70 cursor-not-allowed bg-slate-50 dark:bg-zinc-800' : ''}`}
                        />
                        <input
                          type="text"
                          value={accuracyFeedbacks[ans.id] || ""}
                          onChange={(e) => setAccuracyFeedbacks({ ...accuracyFeedbacks, [ans.id]: e.target.value })}
                          placeholder="No feedback"
                          disabled={isAiEvaluated}
                          className={`flex-1 p-2.5 border border-emerald-200 dark:border-emerald-800 rounded-xl bg-white dark:bg-zinc-900 text-xs focus:border-emerald-600 focus:outline-none w-full ${isAiEvaluated ? 'opacity-70 cursor-not-allowed bg-slate-50 dark:bg-zinc-800' : ''}`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* SAVE EVALUATION BUTTON */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 border-t border-slate-100 dark:border-zinc-800">
            <span className="text-[11px] text-slate-400 font-medium">All mark inputs are required. Feedback comments are optional (defaults to "No feedback" if left blank).</span>
            <div className="flex gap-3 w-full sm:w-auto">
              <button
                onClick={() => setSelectedSubmission(null)}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitEvaluation}
                disabled={submittingEval}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs transition shadow-md disabled:opacity-50"
              >
                <Save size={16} />
                {submittingEval ? "Saving Evaluation..." : "Save & Complete Evaluation"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. SUBMISSIONS LIST TABLE FOR SELECTED TEST
  if (selectedTest) {
    return (
      <div className="flex flex-col gap-6 animate-fadeIn">
        <div className="flex items-center justify-between">
          {!standaloneExam && (
            <button
              onClick={() => setSelectedTest(null)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 transition border border-slate-200 dark:border-zinc-700"
            >
              <ArrowLeft size={15} /> Back to Tests List
            </button>
          )}
          {standaloneExam && onClearStandalone && (
            <button
              onClick={() => { setSelectedTest(null); onClearStandalone(); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 transition border border-slate-200 dark:border-zinc-700"
            >
              <ArrowLeft size={15} /> Back to Course
            </button>
          )}
          <span className="text-xs text-slate-400 font-medium">
            Test: <strong className="text-slate-800 dark:text-zinc-100 font-bold">{selectedTest.title}</strong>
          </span>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-zinc-800/80">
            <div>
              <h4 className="font-extrabold text-slate-900 dark:text-zinc-100 text-lg">
                Learner Submissions: {selectedTest.title}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Table list of student submissions containing CQ and Video questions.
              </p>
            </div>
<span className="text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-full w-fit">
               Submissions: {submissions.length}
             </span>
<span className="text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-full w-fit">
                Remaining: {Math.max(0, enrolledCount - submissions.length)}
              </span>
          </div>

          {loadingSubmissions ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <span className="text-xs font-semibold">Loading test submissions...</span>
            </div>
          ) : submissions.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 text-slate-400 text-sm">
              No student submissions found for this test yet.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* SUBMISSIONS TABLE */}
              <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-zinc-800">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/80 dark:bg-zinc-800/60 text-slate-600 dark:text-zinc-300 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4 border-b border-slate-200/80 dark:border-zinc-800">Student Learner</th>
                      <th className="py-3.5 px-4 border-b border-slate-200/80 dark:border-zinc-800">Submitted Date</th>
                      <th className="py-3.5 px-4 border-b border-slate-200/80 dark:border-zinc-800">Status</th>
                      <th className="py-3.5 px-4 border-b border-slate-200/80 dark:border-zinc-800 text-center">Marks Obtained</th>
                      <th className="py-3.5 px-4 border-b border-slate-200/80 dark:border-zinc-800 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
                    {paginatedSubmissions.map((sub: any) => {
                      const isPending = sub.status === "Pending Evaluation";
                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center shrink-0 font-bold border border-blue-500/20">
                                <User size={15} />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 dark:text-zinc-100">{sub.user?.name || "Student"}</p>
                                <p className="text-[11px] text-slate-400">{sub.user?.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400">
                            {new Date(sub.createdAt).toLocaleDateString()} {new Date(sub.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                                isPending
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              }`}
                            >
                              {sub.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-zinc-200">
                            {sub.marksObtained} Marks
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {isPending ? (
                              <button
                                onClick={() => handleOpenSubmission(sub)}
                                className="px-3.5 py-1.5 rounded-xl font-bold text-xs transition inline-flex items-center gap-1 shadow-sm bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                Evaluate<ChevronRight size={14} />
                              </button>
                            ) : (
                              <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 italic px-3 py-1">
                                No Action Needed
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* SUBMISSIONS TABLE PAGINATION */}
              {totalSubPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800 text-xs">
                  <span className="text-slate-400 font-medium">
                    Showing page {subPage} of {totalSubPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSubPage((p) => Math.max(1, p - 1))}
                      disabled={subPage === 1}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition disabled:opacity-40 flex items-center gap-1"
                    >
                      <ChevronLeft size={14} /> Previous
                    </button>
                    <button
                      onClick={() => setSubPage((p) => Math.min(totalSubPages, p + 1))}
                      disabled={subPage === totalSubPages}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition disabled:opacity-40 flex items-center gap-1"
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. TESTS TABLE IN LESSON WORKSPACE (PENDING TESTS ONLY)
  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-zinc-800/80">
          <div>
            <h4 className="font-extrabold text-slate-900 dark:text-zinc-100 text-lg">
              Lesson Evaluation Workspace
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Review and grade pending student CQ &amp; Video submissions for the selected lesson.
            </p>
          </div>
          {/* LESSON SELECTOR DROPDOWN */}
          {courseLessons.length > 0 && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400 whitespace-nowrap">Lesson:</label>
              <SelectDropdown
                value={activeLesson?.id ? String(activeLesson.id) : ""}
                onChange={(v) => {
                  const lesson = courseLessons.find((l: any) => String(l.id) === v);
                  if (lesson) setActiveLesson(lesson);
                }}
                options={courseLessons.map((l: any) => ({ value: String(l.id), label: l.title }))}
                className="text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 px-3 py-2 focus:border-blue-500 focus:outline-none w-full sm:w-auto sm:min-w-[180px] max-w-full sm:max-w-[280px] font-semibold shadow-sm"
                ariaLabel="Select lesson"
              />
            </div>
          )}
        </div>

        {/* IF NO PENDING EVALUATIONS: SHOW CLEAN STATE */}
        {pendingTests.length === 0 ? (
          <div className="p-10 text-center rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/20 text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 mb-1">
              <CheckCircle size={24} />
            </div>
            <h5 className="font-extrabold text-slate-900 dark:text-zinc-100 text-sm">No Pending Evaluations</h5>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm leading-relaxed">
              All test submissions for this lesson have been evaluated. No action needed at this time.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* TESTS TABLE */}
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-zinc-800">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/80 dark:bg-zinc-800/60 text-slate-600 dark:text-zinc-300 text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 border-b border-slate-200/80 dark:border-zinc-800">Test Title</th>
                    <th className="py-3.5 px-4 border-b border-slate-200/80 dark:border-zinc-800">Questions Breakdown</th>
                    <th className="py-3.5 px-4 border-b border-slate-200/80 dark:border-zinc-800 text-center">Pending Answers</th>
                    <th className="py-3.5 px-4 border-b border-slate-200/80 dark:border-zinc-800 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
                  {paginatedTests.map((test: any) => {
                    const mcqCount = test.questions?.filter((q: any) => q.type === "MCQ").length || 0;
                    const cqCount = test.questions?.filter((q: any) => q.type === "CQ").length || 0;
                    const videoCount = test.questions?.filter((q: any) => q.type === "Video").length || 0;
                    const pCount = pendingCounts[test.id] || 0;

                    return (
                      <tr key={test.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-4 px-4 font-bold text-slate-900 dark:text-zinc-100">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center shrink-0 border border-blue-500/20">
                              <Layers size={16} />
                            </div>
                            <span>{test.title}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            {mcqCount > 0 && (
                              <span className="text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 px-2.5 py-0.5 rounded-full border border-sky-500/20">
                                {mcqCount} MCQ
                              </span>
                            )}
                            {cqCount > 0 && (
                              <span className="text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                                {cqCount} CQ
                              </span>
                            )}
                            {videoCount > 0 && (
                              <span className="text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                                {videoCount} Video
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          {pCount > 0 ? (
                            <span className="text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full border border-amber-500/20 animate-pulse">
                              {pCount} Pending
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                              0 Pending
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          {pCount > 0 ? (
                            <button
                              onClick={() => handleSelectTest(test)}
                              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl text-xs transition inline-flex items-center gap-1.5 shadow-md"
                            >
                              View Submissions ({pCount}) <ChevronRight size={14} />
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 italic px-3 py-1">
                              No Action Needed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* TESTS TABLE PAGINATION */}
            {totalTestPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800 text-xs">
                <span className="text-slate-400 font-medium">
                  Showing page {testPage} of {totalTestPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTestPage((p) => Math.max(1, p - 1))}
                    disabled={testPage === 1}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition disabled:opacity-40 flex items-center gap-1"
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <button
                    onClick={() => setTestPage((p) => Math.min(totalTestPages, p + 1))}
                    disabled={testPage === totalTestPages}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition disabled:opacity-40 flex items-center gap-1"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
