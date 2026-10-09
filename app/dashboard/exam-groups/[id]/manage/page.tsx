"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/libs/api";
import toast from "react-hot-toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Users,
  BookOpen,
  Loader2,
  GripVertical,
  CheckCircle2,
  Circle,
  MoreVertical,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
  Pencil,
} from "lucide-react";
import ExamGroupEvaluationView from "./ExamGroupEvaluationView";

type QuestionFormState = {
  questionText: string;
  type: string;
  options: string[];
  correctAnswers: string[];
  marks: number;
  postureMarks: number;
  voiceMarks: number;
  accuracyMarks: number;
  evaluationType: string;
};

const emptyQuestion: QuestionFormState = {
  questionText: "",
  type: "MCQ",
  options: ["", "", "", ""],
  correctAnswers: [],
  marks: 1,
  postureMarks: 0,
  voiceMarks: 0,
  accuracyMarks: 0,
  evaluationType: "AI",
};

export default function ManageExamGroupPage() {
  const params = useParams();
  const router = useRouter();
  const examGroupId = Number(params.id);

  const [examGroup, setExamGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"questions" | "enrollments" | "submissions">("questions");

  const [questions, setQuestions] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [viewingSubmission, setViewingSubmission] = useState<any>(null);
  const [remaining, setRemaining] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [newQuestion, setNewQuestion] = useState<QuestionFormState>(emptyQuestion);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [expandedQuestionId, setExpandedQuestionId] = useState<number | null>(null);
  
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [editQuestion, setEditQuestion] = useState<QuestionFormState>(emptyQuestion);
  const [isSavingQuestionId, setIsSavingQuestionId] = useState<number | null>(null);
  const [isDeletingQuestionId, setIsDeletingQuestionId] = useState<number | null>(null);
  const [isRemovingEnrollmentId, setIsRemovingEnrollmentId] = useState<number | null>(null);

  const [enrollUserId, setEnrollUserId] = useState("");
  const [isEnrolling, setIsEnrolling] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    status: "",
    startTime: "",
    endTime: "",
    timePerQuestion: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    confirmLabel: string;
  }>({ open: false, title: "", description: "", onConfirm: () => {}, confirmLabel: "Confirm" });

  const triggerConfirm = (
    title: string,
    description: string,
    onConfirm: () => void,
    confirmLabel = "Confirm",
  ) =>
    setConfirmState({ open: true, title, description, onConfirm, confirmLabel });

  useEffect(() => {
    if (!examGroupId) return;
    setLoading(true);
    Promise.all([
      api.get(`/exam-groups/${examGroupId}`),
      api.get(`/exam-groups/${examGroupId}/submissions`),
      api.get(`/exam-groups/${examGroupId}/remaining`),
    ])
      .then(([egRes, subRes, remRes]) => {
        const eg = egRes.data;
        setExamGroup(eg);
        setQuestions(eg.questions || []);
        setEnrollments(eg.enrollments || []);
        setSubmissions(subRes.data || []);
        setRemaining(remRes.data || null);
      })
      .catch(() => {
        toast.error("Failed to load exam group.");
        router.push("/dashboard?tab=manage-exam-groups");
      })
      .finally(() => setLoading(false));
  }, [examGroupId, router]);

  const reload = async () => {
    const egRes = await api.get(`/exam-groups/${examGroupId}`);
    const eg = egRes.data;
    setExamGroup(eg);
    setQuestions(eg.questions || []);
    setEnrollments(eg.enrollments || []);
    const [subRes, remRes] = await Promise.all([
      api.get(`/exam-groups/${examGroupId}/submissions`),
      api.get(`/exam-groups/${examGroupId}/remaining`),
    ]);
    setSubmissions(subRes.data || []);
    setRemaining(remRes.data || null);
  };

  const handleAddOption = () => {
    setNewQuestion((prev) => ({
      ...prev,
      options: [...prev.options, ""],
    }));
  };

  const handleRemoveOption = (index: number) => {
    if (newQuestion.options.length <= 2) {
      toast.error("At least 2 options are required.");
      return;
    }
    setNewQuestion((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
      correctAnswers: prev.correctAnswers.filter(
        (ans) => ans !== `option_${index}`,
      ),
    }));
  };

  const toggleCorrectAnswer = (optionIndex: number) => {
    const key = `option_${optionIndex}`;
    setNewQuestion((prev) => ({
      ...prev,
      correctAnswers: prev.correctAnswers.includes(key)
        ? prev.correctAnswers.filter((a) => a !== key)
        : [...prev.correctAnswers, key],
    }));
  };

  const toggleEditCorrectAnswer = (optionIndex: number) => {
    const key = `option_${optionIndex}`;
    setEditQuestion((prev) => ({
      ...prev,
      correctAnswers: prev.correctAnswers.includes(key)
        ? prev.correctAnswers.filter((a) => a !== key)
        : [...prev.correctAnswers, key],
    }));
  };

  const startEditing = (q: any) => {
    setEditingQuestionId(q.id);
    setEditQuestion({
      questionText: q.questionText || "",
      options: q.options || ["", "", "", ""],
      correctAnswers: q.correctAnswers || [],
      marks: q.marks || 1,
      type: q.type || "MCQ",
      postureMarks: q.postureMarks || 0,
      voiceMarks: q.voiceMarks || 0,
      accuracyMarks: q.accuracyMarks || 0,
      evaluationType: q.evaluationType || "AI",
    });
  };

  const handleAddQuestion = async (keepOpen: boolean) => {
    if (!examGroupId) return;

    if (!newQuestion.questionText.trim()) {
      toast.error("Question text is required.");
      return;
    }

    let filledOptions: string[] = [];
    if (newQuestion.type === 'MCQ') {
      filledOptions = newQuestion.options.map((o, i) => o.trim() || `Option ${i + 1}`);
      if (filledOptions.filter(Boolean).length < 2) {
        toast.error("Please provide at least 2 options for MCQ.");
        return;
      }
      if (newQuestion.correctAnswers.length === 0) {
        toast.error("Please select at least one correct answer.");
        return;
      }
    }

    setIsAddingQuestion(true);
    try {
      await api.post(
        `/exam-groups/${examGroupId}/questions`,
        {
          questions: [
            {
              questionText: newQuestion.questionText.trim(),
              type: newQuestion.type,
              options: newQuestion.type === 'MCQ' ? filledOptions : [],
              correctAnswers: newQuestion.type === 'MCQ' ? newQuestion.correctAnswers : [],
              marks: newQuestion.marks,
              postureMarks: newQuestion.type === 'Video' ? newQuestion.postureMarks : 0,
              voiceMarks: newQuestion.type === 'Video' ? newQuestion.voiceMarks : 0,
              accuracyMarks: newQuestion.type === 'Video' ? newQuestion.accuracyMarks : 0,
              evaluationType: newQuestion.evaluationType,
            },
          ],
        },
      );
      toast.success("Question added!");
      setNewQuestion(emptyQuestion);
      if (!keepOpen) {
        setShowAddForm(false);
      }
      reload();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to add question.");
    } finally {
      setIsAddingQuestion(false);
    }
  };

  const handleEditQuestion = async () => {
    if (!examGroupId || !editingQuestionId) return;

    const filledOptions = editQuestion.options.map((o, i) =>
      o.trim() || `Option ${i + 1}`,
    );
    if (filledOptions.filter(Boolean).length < 2) {
      toast.error("Please provide at least 2 options.");
      return;
    }
    if (editQuestion.correctAnswers.length === 0) {
      toast.error("Please select at least one correct answer.");
      return;
    }
    if (!editQuestion.questionText.trim()) {
      toast.error("Question text is required.");
      return;
    }

    setIsSavingQuestionId(editingQuestionId);
    try {
      await api.patch(
        `/exam-groups/${examGroupId}/questions/${editingQuestionId}`,
        {
          questionText: editQuestion.questionText.trim(),
          options: filledOptions,
          correctAnswers: editQuestion.correctAnswers,
          marks: editQuestion.marks,
        }
      );
      toast.success("Question updated!");
      setEditingQuestionId(null);
      reload();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update question.");
    } finally {
      setIsSavingQuestionId(null);
    }
  };

  const confirmRemoveQuestion = (questionId: number) => {
    triggerConfirm(
      "Delete Question",
      "Are you sure you want to delete this question? This action cannot be undone.",
      async () => {
        setIsDeletingQuestionId(questionId);
        try {
          await api.delete(`/exam-groups/${examGroupId}/questions/${questionId}`);
          toast.success("Question removed.");
          reload();
        } catch (err: any) {
          toast.error(err.response?.data?.message || "Failed to remove question.");
        } finally {
          setIsDeletingQuestionId(null);
        }
      },
      "Delete",
    );
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollUserId.trim()) return;
    setIsEnrolling(true);
    try {
      await api.post(`/exam-groups/${examGroupId}/enroll`, {
        userId: enrollUserId.trim(),
      });
      toast.success("User enrolled!");
      setEnrollUserId("");
      reload();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to enroll user.");
    } finally {
      setIsEnrolling(false);
    }
  };

  const confirmRemoveEnrollment = (userId: string) => {
    triggerConfirm(
      "Remove Enrollment",
      "Are you sure you want to remove this user from the exam? They will no longer be able to take it.",
      async () => {
        setIsRemovingEnrollmentId(userId as any);
        try {
          await api.delete(`/exam-groups/${examGroupId}/enroll/${userId}`);
          toast.success("Enrollment removed.");
          reload();
        } catch (err: any) {
          toast.error(err.response?.data?.message || "Failed to remove enrollment.");
        } finally {
          setIsRemovingEnrollmentId(null);
        }
      },
      "Remove",
    );
  };

  const toLocalDatetime = (dateString: string) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openEditModal = () => {
    if (!examGroup) return;
    setEditForm({
      title: examGroup.title || "",
      description: examGroup.description || "",
      status: examGroup.status || "draft",
      startTime: examGroup.startTime ? toLocalDatetime(examGroup.startTime) : "",
      endTime: examGroup.endTime ? toLocalDatetime(examGroup.endTime) : "",
      timePerQuestion: examGroup.timePerQuestion || "",
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examGroupId) return;
    setIsSavingEdit(true);
    try {
      const payload: any = { ...editForm };
      if (payload.startTime) {
        payload.startTime = new Date(payload.startTime).toISOString();
      } else {
        payload.startTime = null;
      }
      if (payload.endTime) {
        payload.endTime = new Date(payload.endTime).toISOString();
      } else {
        payload.endTime = null;
      }
      payload.timePerQuestion = payload.timePerQuestion ? Number(payload.timePerQuestion) : null;
      
      await api.patch(`/exam-groups/${examGroupId}`, payload);
      toast.success("Exam group updated!");
      setIsEditModalOpen(false);
      reload();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update exam group.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-sm text-slate-500">Loading exam group...</p>
      </div>
    );
  }

  if (!examGroup) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-red-500">Exam group not found.</p>
        <button
          onClick={() => router.push("/dashboard?tab=manage-exam-groups")}
          className="text-sm text-blue-600 underline"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard?tab=manage-exam-groups")}
          className="flex items-center justify-center h-9 w-9 rounded-full bg-white border border-slate-200 hover:bg-slate-50 transition dark:bg-zinc-900 dark:border-zinc-800"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider dark:text-blue-400">
              {examGroup.examGroupId}
            </span>
            <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-zinc-700" />
            <span className="text-xs text-slate-400">
              {questions.length} questions
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-50">
              {examGroup.title}
            </h2>
            <button
              onClick={openEditModal}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40"
            >
              <Pencil size={12} /> Edit
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex border-b border-slate-200 dark:border-zinc-800 overflow-x-auto">
          {(
            ["questions", "enrollments", "submissions"] as const
          ).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-semibold px-4 whitespace-nowrap transition ${
                activeTab === tab
                  ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {tab === "questions"
                ? "Questions"
                : tab === "enrollments"
                  ? "Enrollments"
                  : "Submissions"}
            </button>
          ))}
        </div>

        <div className="p-1">
          {/* QUESTIONS TAB */}
          {activeTab === "questions" && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              {/* Add Question Card - Google Forms Style */}
              {!showAddForm ? (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-800 p-6 flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 hover:border-blue-400 hover:text-blue-600 transition dark:hover:border-blue-900 dark:hover:text-blue-400"
                >
                  <Plus size={18} />
                  Add Question
                </button>
              ) : (
                <form
                  onSubmit={(e) => { e.preventDefault(); handleAddQuestion(false); }}
                  className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden flex flex-col relative animate-fadeIn"
                >
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setNewQuestion(emptyQuestion);
                      }}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 p-1.5 rounded-full transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="p-6 pb-2 mt-4 flex flex-col gap-3">
                    <select
                      value={newQuestion.type}
                      onChange={(e) =>
                        setNewQuestion({ ...newQuestion, type: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-sm font-semibold focus:outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                    >
                      <option value="MCQ">Multiple Choice Question (MCQ)</option>
                      <option value="CQ">Creative Question (CQ)</option>
                      <option value="Video">Video Response</option>
                    </select>

                    <textarea
                      required
                      rows={2}
                      placeholder="Type your question here..."
                      value={newQuestion.questionText}
                      onChange={(e) =>
                        setNewQuestion({
                          ...newQuestion,
                          questionText: e.target.value,
                        })
                      }
                      className="w-full bg-transparent text-lg font-semibold text-slate-800 dark:text-zinc-50 placeholder:text-slate-300 dark:placeholder:text-zinc-600 focus:outline-none resize-none border-b border-transparent focus:border-slate-100 dark:focus:border-zinc-800 transition min-h-[60px]"
                    />
                  </div>

                  {newQuestion.type === 'MCQ' && (
                    <div className="px-6 py-4 flex flex-col gap-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Options (Check to mark correct)
                      </p>
                      {newQuestion.options.map((option, index) => (
                        <div key={index} className="flex items-center gap-3 group relative bg-slate-50 dark:bg-zinc-950 rounded-xl px-3 py-2 border border-slate-100 dark:border-zinc-800/50 hover:border-blue-200 dark:hover:border-blue-900/30 transition shadow-sm">
                          <label className="flex items-center justify-center cursor-pointer relative">
                            <input
                              type="checkbox"
                              checked={newQuestion.correctAnswers.includes(`option_${index}`)}
                              onChange={() => toggleCorrectAnswer(index)}
                              className="sr-only"
                            />
                            <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                              newQuestion.correctAnswers.includes(`option_${index}`) 
                              ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                              : 'bg-white border-slate-300 dark:bg-zinc-900 dark:border-zinc-700 hover:border-blue-400'
                            }`}>
                              {newQuestion.correctAnswers.includes(`option_${index}`) && <CheckCircle2 size={14} />}
                            </div>
                          </label>
                          
                          <input
                            type="text"
                            required={index < 2}
                            value={option}
                            onChange={(e) => {
                              const newOptions = [...newQuestion.options];
                              newOptions[index] = e.target.value;
                              setNewQuestion({ ...newQuestion, options: newOptions });
                            }}
                            placeholder={`Option ${index + 1}`}
                            className="flex-1 bg-transparent text-sm font-medium text-slate-700 dark:text-zinc-200 focus:outline-none placeholder:text-slate-300 dark:placeholder:text-zinc-700"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(index)}
                            className="text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={handleAddOption}
                        className="text-sm text-blue-600 font-bold self-start mt-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                      >
                        <Plus size={16} /> Add Option
                      </button>
                    </div>
                  )}

                  {newQuestion.type === 'Video' && (
                    <div className="px-6 py-4 flex flex-col gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Evaluation Mode</label>
                        <select
                          value={newQuestion.evaluationType}
                          onChange={(e) => setNewQuestion({ ...newQuestion, evaluationType: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-sm focus:outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                        >
                          <option value="AI">AI Evaluation</option>
                          <option value="Manual">Manual Evaluation</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Posture Marks</label>
                          <input
                            type="number"
                            min="0"
                            value={newQuestion.postureMarks}
                            onChange={(e) => setNewQuestion({ ...newQuestion, postureMarks: Number(e.target.value) })}
                            className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Voice Marks</label>
                          <input
                            type="number"
                            min="0"
                            value={newQuestion.voiceMarks}
                            onChange={(e) => setNewQuestion({ ...newQuestion, voiceMarks: Number(e.target.value) })}
                            className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Accuracy Marks</label>
                          <input
                            type="number"
                            min="0"
                            value={newQuestion.accuracyMarks}
                            onChange={(e) => setNewQuestion({ ...newQuestion, accuracyMarks: Number(e.target.value) })}
                            className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-50 dark:bg-zinc-950/50 border-t border-slate-100 dark:border-zinc-800 p-4 px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Total Marks</span>
                      <input
                        type="number"
                        min="1"
                        value={newQuestion.marks}
                        onChange={(e) =>
                          setNewQuestion({
                            ...newQuestion,
                            marks: Number(e.target.value) || 1,
                          })
                        }
                        className="w-16 rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 text-center font-bold shadow-sm"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end mt-4 sm:mt-0 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddForm(false);
                          setNewQuestion(emptyQuestion);
                        }}
                        className="rounded-xl px-5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200/50 dark:hover:bg-zinc-800 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddQuestion(true)}
                        disabled={isAddingQuestion}
                        className="rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-50 text-slate-700 dark:text-zinc-300 px-6 py-2 text-xs font-bold shadow-sm transition flex items-center gap-2"
                      >
                        {isAddingQuestion ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        Save & Add Another
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddQuestion(false)}
                        disabled={isAddingQuestion}
                        className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 text-xs font-bold shadow-sm transition flex items-center gap-2"
                      >
                        {isAddingQuestion ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        {isAddingQuestion ? "Saving..." : "Save Question"}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Questions List */}
              <div className="flex flex-col gap-4">
                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="rounded-2xl border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-[#18181b] shadow-sm overflow-hidden p-5 sm:p-6 transition-all duration-200 hover:border-slate-300 dark:hover:border-zinc-700"
                  >
                    {editingQuestionId === q.id ? (
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-zinc-800">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-zinc-50">Edit Question {idx + 1}</h4>
                          <button onClick={() => setEditingQuestionId(null)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Question Text</label>
                          <textarea
                            required
                            value={editQuestion.questionText}
                            onChange={(e) => setEditQuestion({ ...editQuestion, questionText: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
                            rows={3}
                            placeholder="E.g. What is the capital of France?"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Options & Correct Answers</label>
                          <p className="text-[10px] text-slate-500 mb-1">Click the circle to mark an option as correct.</p>
                          {editQuestion.options.map((opt, optIdx) => {
                            const isCorrect = editQuestion.correctAnswers.includes(`option_${optIdx}`);
                            return (
                              <div key={optIdx} className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleEditCorrectAnswer(optIdx)}
                                  className={`shrink-0 flex items-center justify-center w-5 h-5 rounded-full border transition ${
                                    isCorrect ? "bg-green-500 border-green-500 text-white" : "border-slate-300 dark:border-zinc-700 hover:border-blue-400"
                                  }`}
                                >
                                  {isCorrect && <CheckCircle2 size={12} />}
                                </button>
                                <input
                                  type="text"
                                  placeholder={`Option ${optIdx + 1}`}
                                  value={opt}
                                  onChange={(e) => {
                                    const newOpts = [...editQuestion.options];
                                    newOpts[optIdx] = e.target.value;
                                    setEditQuestion({ ...editQuestion, options: newOpts });
                                  }}
                                  className="flex-1 rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex flex-col gap-1 w-1/3">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Marks</label>
                          <input
                            type="number"
                            min="1"
                            value={editQuestion.marks}
                            onChange={(e) => setEditQuestion({ ...editQuestion, marks: Number(e.target.value) })}
                            className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
                          />
                        </div>
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={handleEditQuestion}
                            disabled={isSavingQuestionId === q.id}
                            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 text-xs font-bold transition"
                          >
                            {isSavingQuestionId === q.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className="bg-slate-100 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-300 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide">
                              MCQ
                            </span>
                            <span className="text-slate-500 dark:text-zinc-500 text-xs font-bold tracking-wider">
                              Q{idx + 1}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startEditing(q)}
                              disabled={isDeletingQuestionId === q.id || isSavingQuestionId === q.id}
                              className="flex items-center gap-1.5 bg-blue-50/50 hover:bg-blue-100 dark:bg-blue-900/10 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                            >
                              <Pencil size={12} /> Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmRemoveQuestion(q.id);
                              }}
                              disabled={isDeletingQuestionId === q.id || isSavingQuestionId === q.id}
                              className="flex items-center gap-1.5 bg-red-50/50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                            >
                              {isDeletingQuestionId === q.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            </button>
                          </div>
                        </div>

                        <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100 mb-2 leading-relaxed">
                          {q.questionText}
                        </p>
                        <p className="text-xs font-medium text-slate-500 dark:text-zinc-500 mb-5">
                          Marks: {q.marks}
                        </p>

                        <div className="flex flex-col gap-2.5">
                          {(q.options || []).map((opt: string, optIdx: number) => {
                            const isCorrect = (q.correctAnswers || []).includes(`option_${optIdx}`);
                            return (
                              <div
                                key={optIdx}
                                className={`flex items-center justify-between p-3.5 rounded-xl border transition-colors ${
                                  isCorrect
                                    ? "border-green-500/30 bg-green-50/50 dark:border-green-500/20 dark:bg-green-950/10"
                                    : "border-slate-200 dark:border-zinc-800/80 bg-transparent hover:border-slate-300 dark:hover:border-zinc-700"
                                }`}
                              >
                                <div className="flex items-center gap-3.5">
                                  <div className={`w-5 h-5 shrink-0 rounded flex items-center justify-center border transition-colors ${
                                    isCorrect
                                      ? "bg-green-500 border-green-500 text-white shadow-sm"
                                      : "border-slate-300 dark:border-zinc-700 bg-transparent"
                                  }`}>
                                    {isCorrect && <CheckCircle2 size={12} strokeWidth={3} />}
                                  </div>
                                  <span className={`text-base font-medium ${isCorrect ? "text-green-700 dark:text-green-400" : "text-slate-700 dark:text-zinc-300"}`}>
                                    {opt}
                                  </span>
                                </div>
                                {isCorrect && (
                                  <span className="text-[10px] uppercase tracking-wider font-bold text-green-600 dark:text-green-500 pl-3">
                                    Correct
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {questions.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800">
                    <BookOpen
                      size={32}
                      className="text-slate-300 dark:text-zinc-700"
                    />
                    <p className="text-sm text-slate-500">
                      No questions yet. Add one above.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ENROLLMENTS TAB */}
          {activeTab === "enrollments" && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col gap-6 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
                    <Users size={16} />
                    Enrollments
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {remaining
                      ? `${remaining.totalEnrolled} enrolled • ${remaining.remaining} remaining`
                      : "Loading..."}
                  </p>
                </div>
              </div>

              <form
                onSubmit={handleEnroll}
                className="flex flex-col sm:flex-row items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Enter user ID (TX-0001)"
                  value={enrollUserId}
                  onChange={(e) => setEnrollUserId(e.target.value)}
                  className="flex-1 w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
                />
                <button
                  type="submit"
                  disabled={isEnrolling}
                  className="w-full sm:w-auto flex items-center justify-center gap-1 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 text-xs font-bold transition"
                >
                  <Plus size={14} />{" "}
                  {isEnrolling ? "Enrolling..." : "Enroll"}
                </button>
              </form>

              <div className="flex flex-col gap-2">
                {enrollments.map((enr) => (
                  <div
                    key={enr.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-zinc-800"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                        {enr.user.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {enr.user.userId} • {enr.user.email}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        confirmRemoveEnrollment(enr.user.userId)
                      }
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {enrollments.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">
                    No enrollments yet.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* SUBMISSIONS TAB */}
          {activeTab === "submissions" && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col gap-6 animate-fadeIn">
              <h4 className="font-bold text-slate-900 dark:text-zinc-50 text-sm">
                Submissions
              </h4>
              {submissions.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  No submissions yet.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {submissions.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-zinc-800"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                          {sub.user.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {sub.user.userId}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
                            {sub.marksObtained} marks
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(sub.submittedAt).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => setViewingSubmission(sub)}
                          className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 rounded-lg transition"
                        >
                          View Answers
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmState.open}
        title={confirmState.title}
        message={confirmState.description}
        confirmText={confirmState.confirmLabel}
        onConfirm={() => {
          confirmState.onConfirm();
          setConfirmState({
            open: false,
            title: "",
            description: "",
            onConfirm: () => {},
            confirmLabel: "Confirm",
          });
        }}
        onCancel={() =>
          setConfirmState({
            open: false,
            title: "",
            description: "",
            onConfirm: () => {},
            confirmLabel: "Confirm",
          })
        }
      />

      {/* Edit Exam Group Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-[#121212] overflow-y-auto max-h-[90vh]">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-50 mb-4">Edit Exam Group</h3>
            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Title *</label>
                <input type="text" required value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Description</label>
                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900" rows={3} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Start Time</label>
                  <input type="datetime-local" value={editForm.startTime} onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">End Time</label>
                  <input type="datetime-local" value={editForm.endTime} onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Total Time Limit (minutes, optional)</label>
                <input type="number" min="1" value={editForm.timePerQuestion} onChange={(e) => setEditForm({ ...editForm, timePerQuestion: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900" />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="rounded-xl border border-slate-200 dark:border-zinc-800 px-4 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 transition">Cancel</button>
                <button type="submit" disabled={isSavingEdit} className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 text-xs font-bold transition">
                  {isSavingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Submission Modal */}
      {viewingSubmission && (
        <ExamGroupEvaluationView
          submission={viewingSubmission}
          onClose={() => setViewingSubmission(null)}
          onEvaluated={() => {
            // refresh submissions
            api.get(`/exam-groups/${examGroupId}/submissions`).then(subRes => {
              setSubmissions(subRes.data || []);
              // update the current viewing submission as well
              const updated = (subRes.data || []).find((s: any) => s.id === viewingSubmission.id);
              if (updated) setViewingSubmission(updated);
            });
          }}
        />
      )}
    </div>
  );
}
