"use client";

import React, { useState } from "react";
import { api } from "@/libs/api";
import { CheckCircle2, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

type Props = {
  submission: any;
  onClose: () => void;
  onEvaluated: () => void;
};

export default function ExamGroupEvaluationView({ submission, onClose, onEvaluated }: Props) {
  const [evaluations, setEvaluations] = useState<Record<number, { marksAwarded: number; evaluatorComment: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize evaluations state
  React.useEffect(() => {
    if (submission?.answers) {
      const initialEvals: any = {};
      submission.answers.forEach((ans: any) => {
        initialEvals[ans.id] = {
          marksAwarded: ans.marksAwarded || 0,
          evaluatorComment: ans.evaluatorComment || "",
        };
      });
      setEvaluations(initialEvals);
    }
  }, [submission]);

  const handleMarksChange = (answerId: number, marks: number, maxMarks: number) => {
    setEvaluations(prev => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        marksAwarded: Math.min(Math.max(0, marks), maxMarks)
      }
    }));
  };

  const handleCommentChange = (answerId: number, comment: string) => {
    setEvaluations(prev => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        evaluatorComment: comment
      }
    }));
  };

  const submitEvaluation = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        submissionId: submission.id,
        evaluations: Object.keys(evaluations).map(ansId => ({
          answerId: Number(ansId),
          marksAwarded: evaluations[Number(ansId)].marksAwarded,
          evaluatorComment: evaluations[Number(ansId)].evaluatorComment,
        }))
      };

      await api.put(`/exam-groups/${submission.examGroup.id}/evaluations`, payload);
      toast.success("Evaluation saved successfully!");
      onEvaluated();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to submit evaluation");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!submission) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-[#121212] flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 transition mb-2 w-fit border border-blue-100 dark:border-blue-900/30">
              <ArrowLeft size={14} className="stroke-[3px]" /> Back to Submissions
            </button>
            <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50">
              Evaluating: {submission.user?.name}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Score: <span className="font-bold text-blue-600">{submission.marksObtained}</span> points | Submitted: {new Date(submission.submittedAt).toLocaleString()}
            </p>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-6">
          {submission.answers && submission.answers.length > 0 ? (
            submission.answers.map((ans: any, idx: number) => {
              const q = ans.question;
              if (!q) return null;

              const isMCQ = q.type === 'MCQ';
              const isAIReviewed = q.evaluationType === 'AI' && ans.evaluatedBy === 'AI';

              // Try parsing AI comment if it exists
              let aiCommentParsed = null;
              if (isAIReviewed && ans.evaluatorComment) {
                try {
                  aiCommentParsed = JSON.parse(ans.evaluatorComment);
                } catch (e) {
                  // Ignore
                }
              }

              return (
                <div key={idx} className="bg-slate-50 dark:bg-zinc-900/50 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-bold text-slate-400 mt-0.5">{idx + 1}.</span>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{q.questionText}</p>
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 px-2 py-1 rounded-md ml-4 shrink-0">
                          {q.marks} Marks
                        </span>
                      </div>
                      
                      {/* Answer Display */}
                      <div className="mt-4">
                        {isMCQ ? (
                          <div className="flex flex-col gap-2">
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
                                <div key={optIdx} className={`text-left text-xs px-4 py-3 rounded-xl border flex items-center gap-2 ${btnClass}`}>
                                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? (isCorrect ? "border-green-500 bg-green-600" : "border-red-500 bg-red-600") : "border-slate-300 dark:border-zinc-700"}`}>
                                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                                  </span>
                                  {opt}
                                  {isSelected && isCorrect && <CheckCircle2 size={14} className="ml-auto text-green-600" />}
                                </div>
                              );
                            })}
                          </div>
                        ) : q.type === 'Video' ? (
                          <div className="bg-black/5 dark:bg-black/20 rounded-xl p-4">
                            {ans.providedAnswer && ans.providedAnswer[0] ? (
                              <video controls className="w-full max-h-[300px] rounded-lg">
                                <source src={ans.providedAnswer[0]} />
                                Your browser does not support the video tag.
                              </video>
                            ) : (
                              <p className="text-sm text-slate-500 italic">No video submitted.</p>
                            )}
                          </div>
                        ) : (
                          <div className="bg-white dark:bg-zinc-950 rounded-xl p-4 border border-slate-200 dark:border-zinc-800">
                            <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap">
                              {ans.providedAnswer && ans.providedAnswer[0] ? ans.providedAnswer[0] : <span className="italic text-slate-400">No answer provided.</span>}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Evaluation Controls */}
                      {!isMCQ && (
                        <div className="mt-6 border-t border-slate-200 dark:border-zinc-800 pt-4">
                          {isAIReviewed ? (
                            <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-100 dark:border-blue-900/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                  AI Reviewed
                                </span>
                                <span className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                                  Marks Awarded: {ans.marksAwarded} / {q.marks}
                                </span>
                              </div>
                              {aiCommentParsed ? (
                                <div className="mt-3 text-sm text-slate-700 dark:text-zinc-300">
                                  <p className="font-semibold mb-1">Feedback:</p>
                                  <p>{aiCommentParsed.feedback}</p>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2">{ans.evaluatorComment || 'No feedback provided.'}</p>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-4">
                              <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-slate-700 dark:text-zinc-300">Manual Evaluation</label>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500">Marks out of {q.marks}:</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max={q.marks}
                                    value={evaluations[ans.id]?.marksAwarded ?? 0}
                                    onChange={(e) => handleMarksChange(ans.id, Number(e.target.value), q.marks)}
                                    className="w-20 rounded-lg border border-slate-300 bg-white py-1.5 px-3 text-sm font-bold focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 text-center"
                                  />
                                </div>
                              </div>
                              <textarea
                                placeholder="Add constructive feedback..."
                                rows={3}
                                value={evaluations[ans.id]?.evaluatorComment || ''}
                                onChange={(e) => handleCommentChange(ans.id, e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 resize-none"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">No answers found for this submission.</p>
          )}
        </div>
        
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={submitEvaluation}
            disabled={isSubmitting}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 text-sm font-bold transition flex items-center gap-2 disabled:opacity-50 shadow-md shadow-blue-500/20"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Save Evaluation
          </button>
        </div>
      </div>
    </div>
  );
}
