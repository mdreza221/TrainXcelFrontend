"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/libs/api";
import toast from "react-hot-toast";
import { ArrowLeft, BookOpen, Users, Clock, Play, Loader2, CheckCircle } from "lucide-react";
import { CountdownTimer } from "@/components/CountdownTimer";

export default function ExamGroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const examGroupId = Number(params.id);

  const [examGroup, setExamGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [submission, setSubmission] = useState<any>(null);

  useEffect(() => {
    if (!examGroupId) return;
    setLoading(true);
    
    Promise.all([
      api.get(`/exam-groups/${examGroupId}`),
      api.get(`/exam-groups/${examGroupId}/my-submissions`).catch(() => ({ data: [] }))
    ])
      .then(([egRes, subRes]) => {
        setExamGroup(egRes.data);
        if (subRes.data && subRes.data.length > 0) {
          setSubmission(subRes.data[0]);
        }
      })
      .catch(() => {
        toast.error("Failed to load exam group.");
        router.push("/exam-groups");
      })
      .finally(() => setLoading(false));
  }, [examGroupId, router]);

  const handleJoin = async () => {
    setIsJoining(true);
    try {
      await api.post(`/exam-groups/${examGroupId}/join`);
      toast.success("Joined exam successfully!");
      const res = await api.get(`/exam-groups/${examGroupId}`);
      setExamGroup(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to join exam.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleTakeExam = () => {
    window.location.href = `/exam-groups/${examGroupId}/take`;
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-sm text-slate-500">Loading exam...</p>
      </div>
    );
  }

  if (!examGroup) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-500">Exam group not found.</p>
        <button onClick={() => router.push("/exam-groups")} className="text-sm text-blue-600 underline">Go back</button>
      </div>
    );
  }

  const isEnrolled = (examGroup.enrollments || []).length > 0 || !!submission;
  const isActive = examGroup.status === "active";
  const isBeforeStart = examGroup.startTime && new Date() < new Date(examGroup.startTime);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <button
          onClick={() => router.push("/exam-groups")}
          className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 mb-4"
        >
          <ArrowLeft size={14} /> Back to Exam Groups
        </button>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono">
                {examGroup.examGroupId}
              </span>
              <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-50 mt-1">{examGroup.title}</h1>
            </div>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${isActive ? "bg-green-50 text-green-600 border-green-100 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30" : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"}`}>
              {examGroup.status}
            </span>
          </div>

          <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
            {examGroup.description || "No description provided."}
          </p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
              <BookOpen size={14} className="text-blue-500" />
              <span>{examGroup.totalQuestions ?? examGroup.questions?.length ?? 0} questions</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
              <Users size={14} className="text-purple-500" />
              <span>{examGroup.totalStudents || 0} enrolled</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
              <Clock size={14} className="text-amber-500" />
              <span>{examGroup.timePerQuestion ? `${examGroup.timePerQuestion} total minutes` : "Untimed"}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
              <Clock size={14} className="text-emerald-500" />
              <span>Ends: {examGroup.endTime ? new Date(examGroup.endTime).toLocaleString() : "Not set"}</span>
            </div>
          </div>

          {isBeforeStart && !isEnrolled && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-800 text-sm flex items-center gap-2 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400">
              <Clock size={16} />
              <span>This exam starts on {new Date(examGroup.startTime).toLocaleString()}. You can join now, but cannot take it until it starts.</span>
            </div>
          )}

          {isBeforeStart && isEnrolled && (
            <div className="mb-6">
              <CountdownTimer targetDate={examGroup.startTime} />
              <p className="text-center text-xs text-slate-500 mt-3 dark:text-zinc-400">
                You are enrolled! Return to your dashboard or stay on this page. The exam will unlock automatically.
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            {submission ? (
              <div className="w-full flex flex-col gap-6 mt-2">
                <div className="w-full bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-900/30 rounded-2xl p-6 flex flex-col items-center justify-center gap-3">
                  <CheckCircle className="h-10 w-10 text-green-500" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-50">Exam Completed</h3>
                  <div className="bg-white dark:bg-zinc-900 px-6 py-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col items-center gap-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Marks Obtained</span>
                    <span className="text-3xl font-black text-blue-600 dark:text-blue-400">{submission.marksObtained ?? 0}</span>
                  </div>
                </div>

                {submission.answers && submission.answers.length > 0 && (
                  <div className="w-full flex flex-col gap-4">
                    <h4 className="font-bold text-slate-900 dark:text-zinc-50 mb-2">Review Your Answers</h4>
                    {submission.answers.map((ans: any, idx: number) => {
                      const q = ans.question;
                      if (!q) return null;
                      return (
                        <div key={idx} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
                          <div className="flex items-start gap-3">
                            <span className="text-xs font-bold text-slate-400 mt-0.5">{idx + 1}.</span>
                            <div className="flex-1">
                              <p className="text-base font-semibold text-slate-900 dark:text-zinc-100">{q.questionText}</p>
                              <span className="text-[10px] text-slate-400 mt-1 inline-block">{ans.marksAwarded} / {q.marks} marks</span>
                              <div className="mt-3 flex flex-col gap-2">
                                {(q.options || []).map((opt: string, optIdx: number) => {
                                  const optionKey = `option_${optIdx}`;
                                  const isSelected = (ans.providedAnswer || []).includes(optionKey);
                                  const isCorrect = (q.correctAnswers || []).includes(optionKey);
                                  
                                  let btnClass = "border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300";
                                  if (isSelected && isCorrect) {
                                    btnClass = "border-green-500 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400";
                                  } else if (isSelected && !isCorrect) {
                                    btnClass = "border-red-500 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400";
                                  } else if (!isSelected && isCorrect) {
                                    btnClass = "border-green-500 bg-green-50/50 dark:bg-green-950/10 text-green-700 dark:text-green-400 border-dashed";
                                  }

                                  return (
                                    <div
                                      key={optIdx}
                                      className={`text-left text-sm px-5 py-4 rounded-xl border flex items-center gap-2 ${btnClass}`}
                                    >
                                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? (isCorrect ? "border-green-500 bg-green-600" : "border-red-500 bg-red-600") : "border-slate-300 dark:border-zinc-700"}`}>
                                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                                      </span>
                                      {opt}
                                      {isSelected && isCorrect && <CheckCircle size={14} className="ml-auto text-green-600" />}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : isEnrolled ? (
              <button
                onClick={handleTakeExam}
                disabled={!isActive || isBeforeStart}
                className="flex items-center justify-center gap-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 text-xs font-bold transition"
              >
                <Play size={14} /> Take Exam
              </button>
            ) : (
              <button
                onClick={handleJoin}
                disabled={!isActive || isJoining}
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 text-xs font-bold transition"
              >
                {isJoining ? "Joining..." : "Join Exam"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
