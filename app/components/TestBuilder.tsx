import React, { useState, useEffect } from "react";
import { PlusCircle, Trash2, CheckCircle, Search } from "lucide-react";
import { api } from "@/libs/api";
import { toast } from "react-hot-toast";
import { SelectDropdown } from "./SelectDropdown";

interface Question {
  id: string; // temp id for UI
  type: "MCQ" | "CQ" | "Video";
  questionText: string;
  marks: number | string;
  postureMarks?: number | string;
  voiceMarks?: number | string;
  accuracyMarks?: number | string;
  options: string[]; // for MCQ
  correctAnswers: string[]; // for MCQ
  evaluationType?: "AI" | "Manual";
  referenceScript?: string;
  scriptMode?: "file" | "text";
}

interface TestBuilderProps {
  courseId: number;
  lessons: Array<{ id: number; title: string }>;
  initialLessonId?: number;
  onSuccess?: (lessonId?: number) => void;
}

export function TestBuilder({
  courseId,
  lessons,
  initialLessonId,
  onSuccess,
}: TestBuilderProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [testType, setTestType] = useState<"Lesson" | "Course" | "Standalone">(
    "Lesson",
  );
  const [lessonId, setLessonId] = useState<number | "">(initialLessonId || "");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  // Track files that need uploading per question at submit time
  const [pendingUploads, setPendingUploads] = useState<Record<string, File>>({});
  // Track temp file names for display per question
  const [tempFileNames, setTempFileNames] = useState<Record<string, string>>({});

  const handleQuestionScriptModeChange = (qId: string, mode: "file" | "text") => {
    updateQuestion(qId, "scriptMode", mode);
    updateQuestion(qId, "referenceScript", undefined);
    setPendingUploads((prev) => { const n = { ...prev }; delete n[qId]; return n; });
    setTempFileNames((prev) => { const n = { ...prev }; delete n[qId]; return n; });
  };

  const handleQuestionScriptUpload = (qId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setPendingUploads((prev) => ({ ...prev, [qId]: file }));
    setTempFileNames((prev) => ({ ...prev, [qId]: file.name }));
    updateQuestion(qId, "referenceScript", undefined);
  };

  const addQuestion = (type: "MCQ" | "CQ" | "Video") => {
    setQuestions([
      ...questions,
      {
        id: Math.random().toString(36).substring(7),
        type,
        questionText: "",
        marks: "",
        options: type === "MCQ" ? ["Option 1", "Option 2"] : [],
        correctAnswers: [],
        evaluationType: type === "Video" || type === "CQ" ? "AI" : undefined,
        scriptMode: "file",
      },
    ]);
  };

  const updateQuestion = (
    id: string,
    field: keyof Question,
    value: Question[keyof Question],
  ) => {
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, [field]: value } : q)),
    );
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const addOption = (questionId: string) => {
    setQuestions(
      questions.map((q) =>
        q.id === questionId
          ? { ...q, options: [...q.options, `Option ${q.options.length + 1}`] }
          : q,
      ),
    );
  };

  const updateOption = (questionId: string, index: number, value: string) => {
    setQuestions(
      questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.map((opt, i) => (i === index ? value : opt)),
            }
          : q,
      ),
    );
  };

  const toggleCorrectAnswer = (questionId: string, optionValue: string) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === questionId) {
          const isSelected = q.correctAnswers.includes(optionValue);
          const newCorrectAnswers = isSelected
            ? q.correctAnswers.filter((a) => a !== optionValue)
            : [...q.correctAnswers, optionValue];
          return { ...q, correctAnswers: newCorrectAnswers };
        }
        return q;
      }),
    );
  };

  const removeOption = (questionId: string, index: number) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === questionId) {
          const optionToRemove = q.options[index];
          return {
            ...q,
            options: q.options.filter((_, i) => i !== index),
            correctAnswers: q.correctAnswers.filter(
              (a) => a !== optionToRemove,
            ),
          };
        }
        return q;
      }),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const triggerError = (msg: string) => {
      setError(msg);
      toast.error(msg);
    };

    if (!title.trim()) return triggerError("Test title is required.");
    if (testType === "Lesson" && !lessonId)
      return triggerError("Please select a lesson.");
    if (questions.length === 0)
      return triggerError("Please add at least one question.");

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim())
        return triggerError(`Question ${i + 1} must have text.`);
      if (q.type === "Video") {
        const pm = q.postureMarks === "" || q.postureMarks === undefined ? NaN : Number(q.postureMarks);
        const vm = q.voiceMarks === "" || q.voiceMarks === undefined ? NaN : Number(q.voiceMarks);
        const am = q.accuracyMarks === "" || q.accuracyMarks === undefined ? NaN : Number(q.accuracyMarks);
        if (isNaN(pm) || pm <= 0)
          return triggerError(`Posture marks are required for Video Question ${i + 1}.`);
        if (isNaN(vm) || vm <= 0)
          return triggerError(`Voice marks are required for Video Question ${i + 1}.`);
        if (isNaN(am) || am <= 0)
          return triggerError(`Accuracy marks are required for Video Question ${i + 1}.`);
      } else {
        if (q.marks === 0 || !q.marks)
          return triggerError(`Marks are required for Question ${i + 1}.`);
      }
      if (q.type === "MCQ") {
        if (q.options.length < 2)
          return triggerError(`MCQ Question ${i + 1} must have at least 2 options.`);
        if (q.correctAnswers.length === 0)
          return triggerError(`Select at least one correct answer for MCQ Question ${i + 1}.`);
      }
    }

    // Validate per-question referenceScript for Video and AI-evaluated CQ
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.type === "Video" || (q.type === "CQ" && q.evaluationType === "AI")) {
        const hasScript = !!q.referenceScript || !!pendingUploads[q.id];
        if (!hasScript) {
          return triggerError(`Reference Script is mandatory for ${q.type} Question ${i + 1}.`);
        }
      }
    }

    setIsSubmitting(true);
    try {
      // Upload files per-question
      const uploadedScripts: Record<string, string> = {};
      for (const [qId, file] of Object.entries(pendingUploads)) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await api.post("/courses/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        uploadedScripts[qId] = uploadRes.data.url;
      }

      const payload = {
        title,
        description,
        testType,
        courseId,
        // Keep test-level referenceScript for existing Video-only tests (legacy)
        referenceScript: undefined,
        lessonId: testType === "Lesson" ? Number(lessonId) : undefined,
        startTime:
          testType === "Standalone" && startTime
            ? new Date(startTime).toISOString()
            : undefined,
        endTime:
          testType === "Standalone" && endTime
            ? new Date(endTime).toISOString()
            : undefined,
        questions: questions.map(({ id, scriptMode, ...rest }) => {
          // Resolve per-question referenceScript: uploaded file URL or inline text
          const refScript = uploadedScripts[id] || rest.referenceScript || undefined;
          if (rest.type === "Video") {
            const pm = Number(rest.postureMarks) || 0;
            const vm = Number(rest.voiceMarks) || 0;
            const am = Number(rest.accuracyMarks) || 0;
            return {
              ...rest,
              marks: pm + vm + am,
              postureMarks: pm,
              voiceMarks: vm,
              accuracyMarks: am,
              type: rest.type,
              referenceScript: refScript,
            };
          }
          return {
            ...rest,
            marks: rest.marks === "" ? 0 : Number(rest.marks),
            type: rest.type,
            referenceScript: refScript,
          };
        }),
      };

      await api.post("/tests", payload);
      toast.success("Test created successfully!");
      setSuccess("Test created successfully!");
      setTitle("");
      setDescription("");
      setPendingUploads({});
      setTempFileNames({});
      setQuestions([]);
      if (onSuccess)
        onSuccess(testType === "Lesson" ? Number(lessonId) : undefined);
    } catch (err: unknown) {
      const anyErr = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errorMsg = anyErr.response?.data?.message || anyErr.message || "Failed to create test";
      triggerError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
      <h4 className="font-bold text-slate-900 dark:text-zinc-50 mb-4">
        Create Test / Exam
      </h4>



      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">
              Test Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. End of Chapter Quiz"
              className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-800"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">
              Test Type
            </label>
            <SelectDropdown
              value={testType}
              onChange={(v) => setTestType(v as any)}
              options={[
                { value: "Lesson", label: "Lesson Quiz (Optional test for a specific lesson)" },
                { value: "Course", label: "Final Course Exam" },
                { value: "Standalone", label: "Standalone Timed Exam" },
              ]}
              className="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
              ariaLabel="Select test type"
            />
          </div>
        </div>

        {testType === "Lesson" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">
              Select Lesson *
            </label>
            <SelectDropdown
              value={lessonId === "" ? "" : String(lessonId)}
              onChange={(v) => setLessonId(v === "" ? "" : Number(v))}
              options={[{ value: "", label: "-- Choose Lesson --" }, ...lessons.map((l) => ({ value: String(l.id), label: l.title }))]}
              className="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
              ariaLabel="Select lesson"
            />
          </div>
        )}

        {testType === "Standalone" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500">
                Start Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-800"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500">
                End Time
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-800"
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Instructions for the learners..."
            className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-800 min-h-[80px]"
          />
        </div>

        {/* Questions Section */}
        <div className="mt-4 border-t border-slate-100 dark:border-zinc-800 pt-4">
          <div className="flex items-center justify-between mb-4">
            <h5 className="font-semibold text-slate-800 dark:text-zinc-100">
              Questions ({questions.length})
            </h5>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => addQuestion("MCQ")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
              >
                <PlusCircle size={14} /> Add MCQ
              </button>
              <button
                type="button"
                onClick={() => addQuestion("CQ")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400"
              >
                <PlusCircle size={14} /> Add CQ
              </button>
              {!questions.some(q => q.type === "Video") && (
                <button
                  type="button"
                  onClick={() => addQuestion("Video")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400"
                >
                  <PlusCircle size={14} /> Add Video
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {questions.map((q, qIndex) => (
              <div
                key={q.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50 dark:bg-zinc-800/50 dark:border-zinc-700 relative"
              >
                <button
                  type="button"
                  onClick={() => removeQuestion(q.id)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition"
                >
                  <Trash2 size={16} />
                </button>

                <div className="flex gap-2 items-center mb-3 flex-wrap">
                  <span className="px-2 py-1 bg-slate-200 dark:bg-zinc-700 text-xs font-bold rounded-md text-slate-700 dark:text-zinc-300">
                    Q{qIndex + 1} - {q.type}
                  </span>
                  {q.type === "Video" ? (
                    <div className="flex items-center gap-3 ml-auto mr-8 flex-wrap">
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] font-semibold text-purple-600 dark:text-purple-400">Posture:</label>
                        <input
                          type="text"
                          placeholder="e.g. 5"
                          value={q.postureMarks === 0 ? "" : (q.postureMarks ?? "")}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d*\.?\d*$/.test(val)) {
                              updateQuestion(q.id, "postureMarks", val);
                            }
                          }}
                          className="w-14 rounded-md border border-purple-200 dark:border-purple-800 px-2 py-1 text-sm text-center dark:bg-zinc-900"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">Voice:</label>
                        <input
                          type="text"
                          placeholder="e.g. 5"
                          value={q.voiceMarks === 0 ? "" : (q.voiceMarks ?? "")}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d*\.?\d*$/.test(val)) {
                              updateQuestion(q.id, "voiceMarks", val);
                            }
                          }}
                          className="w-14 rounded-md border border-blue-200 dark:border-blue-800 px-2 py-1 text-sm text-center dark:bg-zinc-900"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Script:</label>
                        <input
                          type="text"
                          placeholder="e.g. 5"
                          value={q.accuracyMarks === 0 ? "" : (q.accuracyMarks ?? "")}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d*\.?\d*$/.test(val)) {
                              updateQuestion(q.id, "accuracyMarks", val);
                            }
                          }}
                          className="w-14 rounded-md border border-emerald-200 dark:border-emerald-800 px-2 py-1 text-sm text-center dark:bg-zinc-900"
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500">
                        Total: {((Number(q.postureMarks) || 0) + (Number(q.voiceMarks) || 0) + (Number(q.accuracyMarks) || 0)) || "–"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 ml-auto mr-8">
                      <label className="text-xs font-semibold text-slate-500">
                        Marks:
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 5"
                        value={q.marks === 0 ? "" : q.marks}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || /^\d*\.?\d*$/.test(val)) {
                            updateQuestion(q.id, "marks", val);
                          }
                        }}
                        className="w-16 rounded-md border border-slate-200 px-2 py-1 text-sm text-center dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="Type your question here..."
                  value={q.questionText}
                  onChange={(e) =>
                    updateQuestion(q.id, "questionText", e.target.value)
                  }
                  className="w-full mb-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
                />

                {q.type === "MCQ" && (
                  <div className="pl-4 flex flex-col gap-2">
                    <p className="text-xs text-slate-500 mb-1">
                      Options (Check the box to mark as correct answer. Multiple
                      allowed.)
                    </p>
                    {q.options.map((opt, oIndex) => (
                      <div key={oIndex} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={q.correctAnswers.includes(opt)}
                          onChange={() => toggleCorrectAnswer(q.id, opt)}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) =>
                            updateOption(q.id, oIndex, e.target.value)
                          }
                          className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                        />
                        <button
                          type="button"
                          onClick={() => removeOption(q.id, oIndex)}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addOption(q.id)}
                      className="text-xs text-blue-600 font-medium self-start mt-1 hover:underline dark:text-blue-400"
                    >
                      + Add Option
                    </button>
                  </div>
                )}

                {q.type === "CQ" && (
                  <div className="pl-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-500">
                        Evaluation Method:
                      </label>
                      <SelectDropdown
                        value={q.evaluationType || "AI"}
                        onChange={(v) =>
                          updateQuestion(q.id, "evaluationType", v as any)
                        }
                        options={[
                          { value: "AI", label: "AI Review" },
                          { value: "Manual", label: "Manual Review" },
                        ]}
                        className="text-xs rounded-md border border-slate-200 bg-white dark:bg-zinc-900 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 px-2.5 py-1 focus:border-blue-500 outline-none"
                        ariaLabel="Evaluation method"
                      />
                    </div>
                    <p className="text-xs text-slate-500 italic">
                      {q.evaluationType === "Manual"
                        ? "Students will submit a CQ answer which requires manual grading by an admin."
                        : "Students will submit a CQ answer which is automatically graded by AI against the reference document."}
                    </p>

                    {q.evaluationType === "AI" && (
                      <div className="flex flex-col gap-2 border-t border-slate-100 dark:border-zinc-800 pt-3 mt-2 text-left">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                            Reference Script / Material *
                          </label>
                          <div className="flex bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg text-[10px] font-bold">
                            <button
                              type="button"
                              onClick={() => handleQuestionScriptModeChange(q.id, "file")}
                              className={`px-2.5 py-1 rounded-md transition ${(q.scriptMode || "file") === "file" ? "bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-500"}`}
                            >
                              Documents
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuestionScriptModeChange(q.id, "text")}
                              className={`px-2.5 py-1 rounded-md transition ${(q.scriptMode || "file") === "text" ? "bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-500"}`}
                            >
                              Write Plain Text
                            </button>
                          </div>
                        </div>

                        {(q.scriptMode || "file") === "file" ? (
                          <div className="flex flex-col gap-1 mt-1">
                            <input
                              type="file"
                              accept=".pdf,.docx,.ppt,.pptx"
                              onChange={(e) => handleQuestionScriptUpload(q.id, e)}
                              className="text-xs file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                            />
                            {tempFileNames[q.id] && (
                              <span className="text-[10px] text-green-600 font-medium block mt-1">
                                Selected: {tempFileNames[q.id]} (will upload on submit)
                              </span>
                            )}
                          </div>
                        ) : (
                          <textarea
                            placeholder="Paste or write the reference material for AI evaluation..."
                            value={q.referenceScript || ""}
                            onChange={(e) => updateQuestion(q.id, "referenceScript", e.target.value)}
                            className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-xs focus:border-blue-600 focus:outline-none dark:border-zinc-800 min-h-[90px]"
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}
                {q.type === "Video" && (
                  <div className="pl-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-500">
                        Evaluation Method:
                      </label>
                      <SelectDropdown
                        value={q.evaluationType || "AI"}
                        onChange={(v) =>
                          updateQuestion(q.id, "evaluationType", v as any)
                        }
                        options={[
                          { value: "AI", label: "AI Review" },
                          { value: "Manual", label: "Manual Review" },
                        ]}
                        className="text-xs rounded-md border border-slate-200 bg-white dark:bg-zinc-900 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 px-2.5 py-1 focus:border-blue-500 outline-none"
                        ariaLabel="Evaluation method"
                      />
                    </div>
                    <p className="text-xs text-slate-500 italic">
                      {q.evaluationType === "Manual"
                        ? "Students will submit a video which requires manual grading by an admin."
                        : "Students will submit a video which is automatically graded by AI first (with manual review backup)."}
                    </p>

                    {/* Reference Script / Material Upload inside same Video question card */}
                    <div className="flex flex-col gap-2 border-t border-slate-100 dark:border-zinc-800 pt-3 mt-2 text-left">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                          Reference Script / Material *
                        </label>
                        <div className="flex bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => handleQuestionScriptModeChange(q.id, "file")}
                            className={`px-2.5 py-1 rounded-md transition ${(q.scriptMode || "file") === "file" ? "bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-500"}`}
                          >
                            Documents
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuestionScriptModeChange(q.id, "text")}
                            className={`px-2.5 py-1 rounded-md transition ${(q.scriptMode || "file") === "text" ? "bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-500"}`}
                          >
                            Write Plain Text
                          </button>
                        </div>
                      </div>

                      {(q.scriptMode || "file") === "file" ? (
                        <div className="flex flex-col gap-1 mt-1">
                          <input
                            type="file"
                            accept=".pdf,.docx,.ppt,.pptx"
                            onChange={(e) => handleQuestionScriptUpload(q.id, e)}
                            className="text-xs file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                          />
                          {tempFileNames[q.id] && (
                            <span className="text-[10px] text-green-600 font-medium block mt-1">
                              Selected: {tempFileNames[q.id]} (will upload on submit)
                            </span>
                          )}
                        </div>
                      ) : (
                        <textarea
                          placeholder="Paste or write the literal reference script details here..."
                          value={q.referenceScript || ""}
                          onChange={(e) => updateQuestion(q.id, "referenceScript", e.target.value)}
                          className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-xs focus:border-blue-600 focus:outline-none dark:border-zinc-800 min-h-[90px]"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {questions.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl dark:border-zinc-700">
                No questions added yet. Click above to add MCQ or CQ questions.
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 flex justify-center items-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "Creating..." : "Create Test"}
        </button>

        {error && (
          <div className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-2 rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-950/30 dark:text-green-400">
            {success}
          </div>
        )}
      </form>
    </div>
  );
}
