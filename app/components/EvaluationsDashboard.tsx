import React, { useState, useEffect } from "react";
import { CheckCircle, AlertTriangle, FileText, User, ChevronLeft, ChevronRight, Video } from "lucide-react";
import { api } from "@/libs/api";
import { toast } from "react-hot-toast";

export function EvaluationsDashboard() {
  const [pendingEvaluations, setPendingEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  
  // Pagination States
  const [cqPage, setCqPage] = useState(1);
  const [videoPage, setVideoPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // Marks state for the currently selected submission
  const [marks, setMarks] = useState<Record<string, number | string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const res = await api.get("/tests/evaluations/pending");
      setPendingEvaluations(res.data);
    } catch (err: any) {
      setError("Failed to load pending evaluations.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSubmission = (sub: any) => {
    setSelectedSubmission(sub);
    const initialMarks: Record<string, number> = {};
    const initialComments: Record<string, string> = {};
    
    sub.answers.forEach((ans: any) => {
      const isPending = sub.status === "Pending Evaluation";
      if (ans.question.type === "CQ" || ans.question.type === "Video") {
        initialMarks[ans.id] = isPending ? "" : (ans.marksAwarded ?? "");
        initialComments[ans.id] = ans.evaluatorComment || "";
      }
    });
    
    setMarks(initialMarks);
    setComments(initialComments);
  };

  const handleSubmitEvaluation = async () => {
    if (!selectedSubmission) return;
    
    // Validate marks vs max marks
    for (const ansId of Object.keys(marks)) {
      const answerIdNum = Number(ansId);
      const answerObj = selectedSubmission.answers.find((a: any) => a.id === answerIdNum);
      if (answerObj) {
        const rawMark = marks[ansId];
        const inputMark = rawMark === "" || rawMark === undefined || rawMark === null ? NaN : Number(rawMark);
        const maxMark = answerObj.question.marks;
        if (isNaN(inputMark) || inputMark < 0 || inputMark > maxMark) {
          toast.error(`Marks for "${answerObj.question.questionText}" must be between 0 and ${maxMark}.`);
          return;
        }
      }
    }

    setSubmitting(true);
    
    const evaluations = Object.keys(marks).map(answerId => ({
      submissionAnswerId: Number(answerId),
      marksAwarded: Number(marks[answerId]),
      evaluatorComment: (comments[answerId] && comments[answerId].trim()) ? comments[answerId].trim() : "No feedback",
    }));

    try {
      await api.put("/tests/evaluations", {
        testSubmissionId: selectedSubmission.id,
        evaluations,
      });
      toast.success("Evaluation submitted successfully!");
      setSelectedSubmission(null);
      await fetchPending();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to submit evaluation");
    } finally {
      setSubmitting(false);
    }
  };

  // Derived lists for CQ and Video
  const cqEvaluations = pendingEvaluations.filter(sub => sub.answers.some((a: any) => a.question.type === "CQ"));
  const videoEvaluations = pendingEvaluations.filter(sub => sub.answers.some((a: any) => a.question.type === "Video"));

  // Pagination logic for CQ
  const totalCqPages = Math.ceil(cqEvaluations.length / ITEMS_PER_PAGE);
  const paginatedCq = cqEvaluations.slice((cqPage - 1) * ITEMS_PER_PAGE, cqPage * ITEMS_PER_PAGE);

  // Pagination logic for Video
  const totalVideoPages = Math.ceil(videoEvaluations.length / ITEMS_PER_PAGE);
  const paginatedVideo = videoEvaluations.slice((videoPage - 1) * ITEMS_PER_PAGE, videoPage * ITEMS_PER_PAGE);

  const getMediaUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}${url}`;
  };

  const getSnapshotUrls = (sub: any): string[] => {
    const test = sub?.test;
    if (!test) return [];
    const folderId = test.lesson?.id ?? test.id;
    const base = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/uploads/VdoEva/${folderId}/snap/snapshot_`;
    const urls: string[] = [];
    for (let i = 1; i <= 20; i++) {
      urls.push(`${base}${String(i).padStart(3, "0")}.jpg`);
    }
    return urls;
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading evaluations...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">Pending Evaluations</h2>
          <p className="text-slate-500 dark:text-zinc-400 mt-1">Review and grade subjective and video questions submitted by learners.</p>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        
        {/* Lists Panel (2 Columns) */}
        <div className="w-full xl:w-1/2 flex flex-col md:flex-row gap-4">
          
          {/* CQ Column */}
          <div className="flex-1 flex flex-col gap-3">
            <h3 className="font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2 mb-2">
              <FileText size={18} className="text-blue-500" /> 
              CQ Submissions ({cqEvaluations.length})
            </h3>
            
            {cqEvaluations.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center">
                <CheckCircle className="mx-auto h-8 w-8 text-green-500 mb-2 opacity-50" />
                <p className="text-sm text-slate-500">No CQ evaluations pending!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {paginatedCq.map(sub => (
                  <div 
                    key={sub.id} 
                    onClick={() => handleSelectSubmission(sub)}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      selectedSubmission?.id === sub.id 
                        ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800" 
                        : "bg-white border-slate-200 hover:border-blue-300 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-600"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-slate-500">
                        <User size={14} />
                      </div>
                      <div>
                        <h5 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{sub.user.name}</h5>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-zinc-400 font-medium truncate max-w-[150px]">{sub.test.title}</span>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded text-[10px] font-bold">
                        Pending
                      </span>
                    </div>
                  </div>
                ))}
                
                {/* CQ Pagination */}
                {totalCqPages > 1 && (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
                    <button 
                      disabled={cqPage === 1} 
                      onClick={() => setCqPage(p => p - 1)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs text-slate-500">Page {cqPage} of {totalCqPages}</span>
                    <button 
                      disabled={cqPage === totalCqPages} 
                      onClick={() => setCqPage(p => p + 1)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Video Column */}
          <div className="flex-1 flex flex-col gap-3">
            <h3 className="font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2 mb-2">
              <Video size={18} className="text-purple-500" /> 
              Video Submissions ({videoEvaluations.length})
            </h3>
            
            {videoEvaluations.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center">
                <CheckCircle className="mx-auto h-8 w-8 text-green-500 mb-2 opacity-50" />
                <p className="text-sm text-slate-500">No Video evaluations pending!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {paginatedVideo.map(sub => (
                  <div 
                    key={sub.id} 
                    onClick={() => handleSelectSubmission(sub)}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      selectedSubmission?.id === sub.id 
                        ? "bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800" 
                        : "bg-white border-slate-200 hover:border-purple-300 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-600"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-slate-500">
                        <User size={14} />
                      </div>
                      <div>
                        <h5 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{sub.user.name}</h5>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-zinc-400 font-medium truncate max-w-[150px]">{sub.test.title}</span>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded text-[10px] font-bold">
                        Pending
                      </span>
                    </div>
                  </div>
                ))}
                
                {/* Video Pagination */}
                {totalVideoPages > 1 && (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
                    <button 
                      disabled={videoPage === 1} 
                      onClick={() => setVideoPage(p => p - 1)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs text-slate-500">Page {videoPage} of {totalVideoPages}</span>
                    <button 
                      disabled={videoPage === totalVideoPages} 
                      onClick={() => setVideoPage(p => p + 1)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Evaluation Panel */}
        <div className="w-full xl:w-1/2">
          {selectedSubmission ? (
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm sticky top-6">
              <div className="border-b border-slate-100 dark:border-zinc-800 pb-4 mb-5 flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-50">{selectedSubmission.test.title}</h3>
                  <p className="text-slate-500 mt-1 text-sm">Submitted by <span className="font-medium text-slate-700 dark:text-zinc-300">{selectedSubmission.user.name}</span> on {new Date(selectedSubmission.submittedAt).toLocaleString()}</p>
                  <div className="flex flex-wrap gap-2 mt-3 items-center text-xs">
                    {(selectedSubmission.test.lesson?.course || selectedSubmission.test.course) && (
                      <span className="font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
                        Course: {selectedSubmission.test.lesson?.course?.title || selectedSubmission.test.course?.title || 'Unknown'}
                      </span>
                    )}
                    {selectedSubmission.test.lesson && (
                      <span className="font-semibold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded">
                        Lesson: {selectedSubmission.test.lesson.title}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-6 max-h-[600px] overflow-y-auto pr-2">
                {selectedSubmission.answers.filter((a: any) => a.question.type === "CQ" || a.question.type === "Video").map((ans: any, idx: number) => (
                  <div key={ans.id} className="p-5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700">
                    <div className="flex gap-3 mb-4">
                      <span className={`shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        ans.question.type === "Video" 
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                      }`}>
                        Q{idx+1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300">
                            {ans.question.type}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100 mt-1">{ans.question.questionText}</p>
                        <p className="text-xs text-slate-500 mt-1">Max marks: <span className="font-bold text-slate-700 dark:text-zinc-300">{ans.question.marks}</span></p>
                      </div>
                    </div>
                    
                     <div className="mb-5 pl-10">
                       <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Student's Answer</label>
                       {ans.question.type === "Video" ? (
                         <div className="flex flex-col gap-4">
                           <div className="rounded-xl overflow-hidden bg-black flex justify-center border border-slate-200 dark:border-zinc-700 shadow-inner">
                             {ans.providedAnswer ? (
                               <video 
                                 controls 
                                 src={getMediaUrl(ans.providedAnswer)} 
                                 className="w-full max-h-[300px] object-contain"
                               />
                             ) : (
                               <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                                 <Video size={32} className="mb-2 opacity-50" />
                                 <span className="text-sm italic">No video provided.</span>
                               </div>
                             )}
                           </div>
                         </div>
                       ) : (
                        <div className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 text-sm whitespace-pre-wrap shadow-sm">
                          {ans.providedAnswer || <span className="text-slate-400 italic">No answer provided.</span>}
                        </div>
                      )}
                    </div>

                    <div className="pl-10 grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Award Marks</label>
                        <input 
                          type="text" placeholder="0"
                          value={marks[ans.id] ?? ""} 
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d*\.?\d*$/.test(val)) {
                              setMarks({...marks, [ans.id]: val});
                            }
                          }}
                          className="w-full rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Feedback Comment <span className="text-slate-400 font-normal">(Optional)</span></label>
                        <input 
                          type="text" placeholder="No feedback"
                          value={comments[ans.id] || ""} 
                          onChange={(e) => setComments({...comments, [ans.id]: e.target.value})}
                          className="w-full rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3">
                <button 
                  onClick={() => setSelectedSubmission(null)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSubmitEvaluation}
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition shadow-sm"
                >
                  {submitting ? "Saving..." : "Submit Grades"}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 text-slate-400">
              <FileText size={48} className="mb-4 text-slate-300 dark:text-zinc-600" />
              <p className="font-medium text-slate-500 dark:text-zinc-400">Select a submission from the list to grade.</p>
              <p className="text-sm mt-1 text-slate-400 dark:text-zinc-500">You can evaluate both CQ and Video answers.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
