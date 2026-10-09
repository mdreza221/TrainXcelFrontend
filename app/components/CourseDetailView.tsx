"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/libs/api";
import { getActionBadgeClasses, formatAction, getRoleBadgeClasses } from "@/libs/actionColors";
import { useCourses, Course, Lesson } from "@/hooks/useCourses";
import { useTheme } from "@/context/ThemeContext";
import { ConfirmModal } from "@/components/ConfirmModal";
import { SelectDropdown } from "@/components/SelectDropdown";
import { TestBuilder } from "@/components/TestBuilder";
import { TestPlayer } from "@/components/TestPlayer";
import { LessonEvaluationView } from "@/components/LessonEvaluationView";
import { AiTestBuilder } from "@/components/AiTestBuilder";
import { PracticeTestPanel } from "@/components/PracticeTestPanel";
import { toast } from "react-hot-toast";
import {
  ArrowLeft, Play, FileText, Check, CheckCircle, ExternalLink,
  Maximize2, MonitorPlay, Sparkles, Settings, Pencil, Trash2,
  Award, Trophy, Loader2, Clock, Eye, X, Lock, GraduationCap,
  ChevronLeft, ChevronRight,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectMaterialType(link: string): "Video" | "PDF" | "PPT" | "DOCX" {
  if (!link) return "Video";
  const n = link.toLowerCase().split("?")[0];
  if (n.includes("youtube.com") || n.includes("youtu.be") || [".mp4", ".mov", ".avi", ".webm", ".ogg"].some(e => n.endsWith(e))) return "Video";
  if (n.endsWith(".pdf")) return "PDF";
  if (n.endsWith(".ppt") || n.endsWith(".pptx")) return "PPT";
  if (n.endsWith(".doc") || n.endsWith(".docx")) return "DOCX";
  return "Video";
}

function getEmbedLink(url: string): string {
  if (!url) return "";
  try {
    if (url.includes("youtube.com/watch")) {
      const v = new URL(url).searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (url.includes("youtu.be/")) {
      const id = url.split("/").pop()?.split("?")[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch {}
  return url;
}

function formatChange(item: any) {
  if (item.from !== undefined && item.to !== undefined) {
    return `Mark changed from ${item.from} to ${item.to}`;
  }
  if (item.from !== undefined) return `from ${item.from}`;
  if (item.to !== undefined) return `to ${item.to}`;
  return JSON.stringify(item);
}

function LogDetailsCell({ details }: { details: any }) {
  if (!details || typeof details !== "object") {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const entries = Object.entries(details);
  if (entries.length === 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  return (
    <div className="flex flex-col gap-1 max-w-[320px]">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-start gap-1.5">
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap capitalize">
            {k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").toLowerCase()}:
          </span>
          <span className="text-xs font-mono text-slate-600 dark:text-zinc-300 break-words">
            {Array.isArray(v) ? (
              v.length === 0 ? "—" : (
                <span className="flex flex-col gap-0.5">
                  {v.map((item: any, i: number) => (
                    <span key={i} title={typeof item === "object" && item?.question ? String(item.question) : undefined}>
                      {typeof item === "object" && item !== null ? formatChange(item) : String(item)}
                    </span>
                  ))}
                </span>
              )
            ) : typeof v === "object" ? (
              JSON.stringify(v)
            ) : (
              String(v)
            )}
          </span>
        </div>
      ))}
    </div>
  );
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
            inWrapper: true, ignoreWidth: false, ignoreHeight: false,
            ignoreFonts: false, breakPages: true, experimental: true,
          });
        }
      } catch (err: any) {
        if (active) setError("Could not render document. It may be password protected or corrupted.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadDocx();
    return () => { active = false; };
  }, [url]);

  return (
    <div className="w-full h-full bg-white text-slate-800 overflow-y-auto flex flex-col p-4 relative select-text text-left">
      {loading && (
        <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500/20 border-t-blue-600" />
            <span className="text-xs text-slate-500 font-semibold">Rendering Word Document...</span>
          </div>
        </div>
      )}
      {error ? (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <p className="text-sm font-bold text-red-500">{error}</p>
          <a href={url} download className="mt-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2">
            Download Document instead
          </a>
        </div>
      ) : (
        <div ref={containerRef} className="w-full docx-render-container" />
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CourseDetailViewProps {
  courseId: string;
  backUrl: string;       // e.g. "/dashboard?tab=manage-courses" or "/dashboard?tab=my-learning"
  isAdminOrEmployee: boolean;
  isAdmin: boolean;
  userId: string;
  initialLessonId?: string | null;
  initialTab?: string | null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CourseDetailView({
  courseId,
  backUrl,
  isAdminOrEmployee,
  isAdmin,
  userId,
  initialLessonId,
  initialTab,
}: CourseDetailViewProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const {
    addLesson, updateLesson, softDeleteLesson, softDeleteCourse,
    completeLesson, enrollInCourse, updateCourse, fetchCourses,
    updateUserRole,
  } = useCourses();

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  const apiBase = api.defaults.baseURL?.replace("/api", "") || "http://localhost:3001";

  const playerRef = useRef<HTMLDivElement>(null);
  const standalonePlayerRef = useRef<HTMLDivElement>(null);
  const testSectionRef = useRef<HTMLDivElement>(null);
  const certRef = useRef<HTMLDivElement>(null);
  const adminTabRef = useRef<HTMLDivElement>(null);
  const deepLinkedTabRef = useRef<string | null>(null);
  const deepLinkedLessonScrolledRef = useRef<string | null>(null);

  // Robust scroll helper that survives Next.js's post-navigation scroll-to-top.
  // Applies scrollIntoView repeatedly over ~1s so a late scroll reset can't win.
  const scrollToSection = useCallback((el: HTMLElement | null | undefined) => {
    if (!el) return undefined;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const delay of [80, 250, 500, 800, 1200]) {
      timers.push(
        setTimeout(() => {
          try {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          } catch {}
        }, delay),
      );
    }
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  // ── Course State ──────────────────────────────────────────────────────────
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoadingCourse, setIsLoadingCourse] = useState(true);

  // ── Lessons State ─────────────────────────────────────────────────────────
  const [courseLessons, setCourseLessons] = useState<Lesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  // ── Learner Progress ──────────────────────────────────────────────────────
  const [learnerProgress, setLearnerProgress] = useState<number>(0);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);

  // ── Test State ────────────────────────────────────────────────────────────
  const [hasTests, setHasTests] = useState(false);
  const [showTestPlayer, setShowTestPlayer] = useState(false);
  const [standaloneExams, setStandaloneExams] = useState<any[]>([]);
  const [standaloneExamsLoading, setStandaloneExamsLoading] = useState(false);
  const [selectedStandaloneExam, setSelectedStandaloneExam] = useState<any | null>(null);
  const [evaluatingStandaloneExam, setEvaluatingStandaloneExam] = useState<any | null>(null);

  // Final Exam (testType=Course) state
  const [finalExams, setFinalExams] = useState<any[]>([]);
  const [finalExamsLoading, setFinalExamsLoading] = useState(false);
  const [selectedFinalExam, setSelectedFinalExam] = useState<any | null>(null);
  const [evaluatingFinalExam, setEvaluatingFinalExam] = useState<any | null>(null);
  const [deleteStandaloneExamId, setDeleteStandaloneExamId] = useState<number | null>(null);
  const [deleteFinalExamId, setDeleteFinalExamId] = useState<number | null>(null);
  const [allTestsLessonFilterId, setAllTestsLessonFilterId] = useState<number | null>(null);
  // Per-exam submission status for student (examId -> submission | null)
  const [finalExamSubmissions, setFinalExamSubmissions] = useState<Record<number, any>>({});
  const [finalExamSubmissionsLoaded, setFinalExamSubmissionsLoaded] = useState(false);

  const [isNextLessonTransition, setIsNextLessonTransition] = useState(false);

  // ── Admin Tabs ────────────────────────────────────────────────────────────
  const [courseDetailsTab, setCourseDetailsTab] = useState<
    "player" | "add-lesson" | "add-test" | "student-marks" | "settings" | "evaluation" | "all-tests" | "ai-test" | "leaderboard" | "activity-log" | "certifications"
  >("player");
  const [showCourseSettingsEdit, setShowCourseSettingsEdit] = useState(false);
  const [showAddTestForm, setShowAddTestForm] = useState(false);
  const [lockedFromNavigation, setLockedFromNavigation] = useState<Lesson | null>(null);

  // ── Learner Tabs ──────────────────────────────────────────────────────────
  const [studentViewTab, setStudentViewTab] = useState<"course" | "certifications">("course");

  // ── Edit Course ───────────────────────────────────────────────────────────
  const [editCourseName, setEditCourseName] = useState("");
  const [editCourseCategoryId, setEditCourseCategoryId] = useState<number | null>(null);
  const [editCourseDescription, setEditCourseDescription] = useState("");
  const [editCourseThumbnail, setEditCourseThumbnail] = useState<File | null>(null);
  const [isUpdatingCourse, setIsUpdatingCourse] = useState(false);
  const [editCourseFormError, setEditCourseFormError] = useState("");
  const [editCourseFormSuccess, setEditCourseFormSuccess] = useState("");
  const [categoriesList, setCategoriesList] = useState<{ categoryId: number; categoryName: string }[]>([]);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] = useState<number | null>(null);
  const [isDeletingCategoryId, setIsDeletingCategoryId] = useState<number | null>(null);

  // ── Edit Lesson ───────────────────────────────────────────────────────────
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editLessonTitle, setEditLessonTitle] = useState("");
  const [editLessonDescription, setEditLessonDescription] = useState("");
  const [editLessonLink, setEditLessonLink] = useState("");
  const [editLessonType, setEditLessonType] = useState<"Video" | "PDF" | "PPT" | "DOCX">("Video");
  const [editLessonInputMode, setEditLessonInputMode] = useState<"link" | "file">("link");
  const [editLessonPracticeEnabled, setEditLessonPracticeEnabled] = useState(false);
  const [isUpdatingLesson, setIsUpdatingLesson] = useState(false);  const [isUploadingEditFile, setIsUploadingEditFile] = useState(false);
  const [editLessonError, setEditLessonError] = useState("");

  // ── Add Lesson ────────────────────────────────────────────────────────────
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonDescription, setNewLessonDescription] = useState("");
  const [newLessonType, setNewLessonType] = useState("Video");
  const [newLessonLink, setNewLessonLink] = useState("");
  const [lessonInputMode, setLessonInputMode] = useState<"link" | "upload">("link");
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isDeployingLesson, setIsDeployingLesson] = useState(false);
  const [lessonFormError, setLessonFormError] = useState("");
  const [lessonFormSuccess, setLessonFormSuccess] = useState("");

  // ── Practice toggle (playlist) ───────────────────────────────────────────
  const [togglingPracticeLessonId, setTogglingPracticeLessonId] = useState<number | null>(null);

  // ── Student Marks ─────────────────────────────────────────────────────────
  const [studentMarks, setStudentMarks] = useState<any[]>([]);
  const [remainingSubmissions, setRemainingSubmissions] = useState(0);
  const [isMarksLoading, setIsMarksLoading] = useState(false);
  const [marksExamType, setMarksExamType] = useState<"lesson" | "standalone" | "final">("lesson");
  const [marksLesson, setMarksLesson] = useState<any | null>(null);
  const [marksStandaloneExam, setMarksStandaloneExam] = useState<any | null>(null);
  const [marksFinalExam, setMarksFinalExam] = useState<any | null>(null);
  const [reviewStudentSubmission, setReviewStudentSubmission] = useState<any | null>(null);
  const [isReviewLoading, setIsReviewLoading] = useState<number | null>(null);

  // ── Edit Marks (admin only) ───────────────────────────────────────────────
  const [isEditingMarks, setIsEditingMarks] = useState(false);
  const [editedMarks, setEditedMarks] = useState<Record<number, { marksAwarded: string; evaluatorComment: string }>>({});
  const [isSavingMarks, setIsSavingMarks] = useState(false);

  // ── Activity Log (admin) ──────────────────────────────────────────────────
  const [courseActivityLogs, setCourseActivityLogs] = useState<any[]>([]);
  const [isActivityLogsLoading, setIsActivityLogsLoading] = useState(false);
  const [activityLogsError, setActivityLogsError] = useState("");
  const [activityLogPage, setActivityLogPage] = useState(1);
  const [activityLogMeta, setActivityLogMeta] = useState<any>({ totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 10 });

  // ── Certificates (admin) ──────────────────────────────────────────────────
  const [courseCertificates, setCourseCertificates] = useState<any[]>([]);
  const [isCertificatesLoading, setIsCertificatesLoading] = useState(false);
  const [certificatesError, setCertificatesError] = useState("");
  const [verifyCertificate, setVerifyCertificate] = useState<any | null>(null);
  const [isVerifyLoading, setIsVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isGeneratingCert, setIsGeneratingCert] = useState(false);
  const [isRejectingCert, setIsRejectingCert] = useState(false);

  // ── Certificates (learner) ────────────────────────────────────────────────
  const [certEligibility, setCertEligibility] = useState<any | null>(null);
  const [isCertEligibilityLoading, setIsCertEligibilityLoading] = useState(false);
  const [isApplyingCert, setIsApplyingCert] = useState(false);

  // ── Admin Leaderboard ─────────────────────────────────────────────────────
  const [adminLeaderboardLessonId, setAdminLeaderboardLessonId] = useState<string>("");
  const [adminLeaderboardData, setAdminLeaderboardData] = useState<any[]>([]);
  const [isAdminLeaderboardLoading, setIsAdminLeaderboardLoading] = useState(false);

  // ── Course Info Modal (Learner) ────────────────────────────────────────────
  const [viewCourseModalOpen, setViewCourseModalOpen] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // ── Confirm Modal ─────────────────────────────────────────────────────────
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    confirmLabel: string;
  }>({ open: false, title: "", description: "", onConfirm: () => {}, confirmLabel: "Confirm" });
  const [isConfirming, setIsConfirming] = useState(false);

  const triggerConfirm = (title: string, description: string, onConfirm: () => void, confirmLabel = "Confirm") => {
    setConfirmState({ open: true, title, description, onConfirm, confirmLabel });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Fetch course on mount
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setIsLoadingCourse(true);
      try {
        const res = await api.get(`/courses/${courseId}`);
        setCourse(res.data);
        setEditCourseName(res.data.name || "");
        setEditCourseCategoryId(res.data.categoryId || null);
        setEditCourseDescription(res.data.description || "");
      } catch {
        toast.error("Failed to load course.");
      } finally {
        setIsLoadingCourse(false);
      }
    };
    load();
  }, [courseId]);

  // Fetch categories for admin edit form
  useEffect(() => {
    if (!isAdminOrEmployee) return;
    api.get("/courses/categories").then(res => {
      setCategoriesList((res.data || []).map((cat: any) => ({ categoryId: cat.id, categoryName: cat.name })));
    }).catch(() => {});
  }, [isAdminOrEmployee]);

  // ─────────────────────────────────────────────────────────────────────────
  // Load lessons
  // ─────────────────────────────────────────────────────────────────────────
  const loadCourseLessons = useCallback(async (cId: string, autoSelectFirst = false) => {
    setLessonsLoading(true);
    try {
      const res = await api.get(`/courses/${cId}/lessons`);
      const allLessons: Lesson[] = res.data || [];
      const activeLessons = allLessons.filter(l => !l.deletedAt);
      setCourseLessons(activeLessons);

      let freshCompleted: string[] = [];
      if (!isAdminOrEmployee && userId) {
        try {
          const progressRes = await api.get(`/courses/${cId}/progress/${userId}`);
          const data = progressRes.data;
          const progressValue = typeof data === "number" ? data : (data?.progress ?? 0);
          setLearnerProgress(progressValue);
          setCompletedLessons(data?.completedLessons || []);
          freshCompleted = data?.completedLessons || [];
        } catch {}
      }

      if (autoSelectFirst && activeLessons.length > 0) {
        const requested = initialLessonId
          ? activeLessons.find(l => String(l.id) === String(initialLessonId) || l.lessonId === initialLessonId)
          : undefined;
        if (requested) {
          setSelectedLesson(requested);
          if (!isAdminOrEmployee && requested && activeLessons.length > 1) {
            const idx = activeLessons.findIndex(l => String(l.id) === String(requested.id) || l.lessonId === requested.lessonId);
            const prevComp = idx > 0
              ? freshCompleted.includes(activeLessons[idx - 1].lessonId)
                || freshCompleted.includes(String(activeLessons[idx - 1].id))
                || freshCompleted.includes((activeLessons[idx - 1] as any).id)
              : true;
            if (idx > 0 && !prevComp) {
              setLockedFromNavigation(requested);
            }
          }
        } else {
          const saved = typeof window !== "undefined" && userId
            ? localStorage.getItem(`trainxcel:selected-lesson:${cId}:${userId}`)
            : null;
          const savedLesson = saved
            ? activeLessons.find(l => String(l.id) === saved || l.lessonId === saved)
            : undefined;
          setSelectedLesson(savedLesson || activeLessons[0]);
        }
      }
      return activeLessons;
    } catch {
      return [];
    } finally {
      setLessonsLoading(false);
    }
  }, [isAdminOrEmployee, userId, initialLessonId]);

  useEffect(() => {
    if (courseId) {
      loadCourseLessons(courseId, true);
    }
  }, [courseId, loadCourseLessons]);

  // Apply deep-linked tab (e.g. ?tab=evaluation, ?tab=certifications)
  useEffect(() => {
    if (!initialTab) return;
    if (isAdminOrEmployee) {
      const valid: string[] = ["player", "add-lesson", "student-marks", "evaluation", "all-tests", "leaderboard", "activity-log", "certifications"];
      if (valid.includes(initialTab)) {
        setCourseDetailsTab(initialTab as any);
        deepLinkedTabRef.current = initialTab;
      }
    } else if (initialTab === "certifications") {
      setStudentViewTab("certifications");
      deepLinkedTabRef.current = initialTab;
    } else if (initialTab === "course") {
      setStudentViewTab("course");
    }
  }, [initialTab, isAdminOrEmployee]);

  // ─────────────────────────────────────────────────────────────────────────
  // Persist selected lesson so refresh/back/relogin keeps you on the same lesson
  // (scoped per user, so a different account starts fresh)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedLesson && courseId && userId) {
      try {
        localStorage.setItem(`trainxcel:selected-lesson:${courseId}:${userId}`, String(selectedLesson.id));
      } catch {}
    }
  }, [selectedLesson, courseId, userId]);

  // ─────────────────────────────────────────────────────────────────────────
  // Standalone exams
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!courseId) return;
    setStandaloneExamsLoading(true);
    api.get(`/tests/standalone/${courseId}`)
      .then(res => setStandaloneExams(res.data || []))
      .catch(() => setStandaloneExams([]))
      .finally(() => setStandaloneExamsLoading(false));
    setSelectedStandaloneExam(null);
  }, [courseId]);

  // ─────────────────────────────────────────────────────────────────────────
  // Final Exams (testType=Course) - auto-refresh every 15s for admin/employee
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!courseId) return;
    const fetchFinalExams = () => {
      api.get(`/tests/course/${courseId}`)
        .then(res => setFinalExams(res.data || []))
        .catch(() => setFinalExams([]));
    };
    fetchFinalExams();
    
    // Poll every 15 seconds for admin/employee to show newly created exams
    if (isAdminOrEmployee) {
      const intervalId = setInterval(fetchFinalExams, 15000);
      return () => clearInterval(intervalId);
    }
  }, [courseId, isAdminOrEmployee]);

  // Fetch student submission status for each final exam (auto-refresh every 15s)
  useEffect(() => {
    if (isAdminOrEmployee || finalExams.length === 0) return;
    const fetchStatuses = async () => {
      const results: Record<number, any> = {};
      await Promise.all(finalExams.map(async (exam) => {
        try {
          const res = await api.get(`/tests/${exam.id}/my-submission`);
          results[exam.id] = res.data || null;
        } catch {
          results[exam.id] = null;
        }
      }));
      setFinalExamSubmissions(results);
      // Only set loaded to true after first successful fetch
      // On subsequent polls, keep it true to avoid UI blinking
    };
    
    // Initial fetch - set loaded only on first completion
    fetchStatuses().then(() => {
      setFinalExamSubmissionsLoaded(true);
    });
    
    // Auto-refresh every 15 seconds to detect evaluation changes
    const intervalId = setInterval(fetchStatuses, 15000);
    
    return () => clearInterval(intervalId);
  }, [finalExams, isAdminOrEmployee]);

  useEffect(() => {
    if (selectedStandaloneExam && standalonePlayerRef.current) {
      return scrollToSection(standalonePlayerRef.current);
    }
  }, [selectedStandaloneExam, scrollToSection]);

  // Auto-scroll to deep-linked admin tab section (e.g. ?tab=certifications)
  useEffect(() => {
    if (
      deepLinkedTabRef.current &&
      isAdminOrEmployee &&
      courseDetailsTab === deepLinkedTabRef.current &&
      adminTabRef.current
    ) {
      deepLinkedTabRef.current = null;
      return scrollToSection(adminTabRef.current);
    }
  }, [courseDetailsTab, isAdminOrEmployee, initialTab, scrollToSection]);

  // Auto-scroll to deep-linked learner certifications section
  useEffect(() => {
    if (
      deepLinkedTabRef.current === "certifications" &&
      !isAdminOrEmployee &&
      studentViewTab === "certifications" &&
      certRef.current
    ) {
      deepLinkedTabRef.current = null;
      return scrollToSection(certRef.current);
    }
  }, [studentViewTab, isAdminOrEmployee, initialTab, scrollToSection]);

  // Auto-scroll to deep-linked lesson's section (e.g. from a test notification).
  // Waits for the test panel (when the lesson has tests) before scrolling,
  // falling back to the video player otherwise.
  useEffect(() => {
    if (
      !initialLessonId ||
      !selectedLesson ||
      deepLinkedLessonScrolledRef.current === String(initialLessonId)
    ) {
      return;
    }
    const matches =
      String(selectedLesson.id) === String(initialLessonId) ||
      selectedLesson.lessonId === initialLessonId;
    if (!matches) return;

    deepLinkedLessonScrolledRef.current = String(initialLessonId);

    const isLearner = !isAdminOrEmployee;
    let cancelled = false;
    let attempts = 0;

    const attemptScroll = () => {
      if (cancelled) return;
      // Learner: the deep link may refer to a test. Prefer the test panel once
      // it mounts (after the async "has tests" check), otherwise scroll the video.
      if (isLearner && testSectionRef.current) {
        scrollToSection(testSectionRef.current);
        return;
      }
      const player = playerRef.current;
      if (!isLearner && player) {
        scrollToSection(player);
        return;
      }
      if (isLearner) {
        if (player) {
          // Test info still loading; wait a bit, then fall back to the player.
          if (attempts < 6) {
            attempts += 1;
            setTimeout(attemptScroll, 250);
            return;
          }
          scrollToSection(player);
          return;
        }
        if (attempts < 4) {
          attempts += 1;
          setTimeout(attemptScroll, 250);
        }
        return;
      }
      if (attempts < 4) {
        attempts += 1;
        setTimeout(attemptScroll, 250);
      }
    };
    const t = setTimeout(attemptScroll, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [selectedLesson, initialLessonId, isAdminOrEmployee, scrollToSection]);

  // ─────────────────────────────────────────────────────────────────────────
  // Has tests check
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedLesson) { setHasTests(false); return; }
    api.get(`/tests/lesson/${selectedLesson.id}`)
      .then(res => setHasTests(res.data && res.data.length > 0))
      .catch(() => setHasTests(false));
  }, [selectedLesson]);

  // ─────────────────────────────────────────────────────────────────────────
  // Reset tab toggles when tab changes
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => { setShowCourseSettingsEdit(false); }, [courseDetailsTab]);
  useEffect(() => { setShowAddTestForm(false); }, [courseDetailsTab]);

  // ─────────────────────────────────────────────────────────────────────────
  // Student marks
  // ─────────────────────────────────────────────────────────────────────────
  const loadStudentMarks = useCallback(async () => {
    setIsMarksLoading(true);
    try {
      let res;
      if (marksExamType === "lesson") {
        const lesson = marksLesson || selectedLesson;
        if (!lesson) { setStudentMarks([]); setRemainingSubmissions(0); return; }
        res = await api.get(`/tests/lesson/${lesson.id}/submissions`);
      } else if (marksExamType === "standalone") {
        const exam = marksStandaloneExam || (standaloneExams.length > 0 ? standaloneExams[0] : null);
        if (!exam) { setStudentMarks([]); setRemainingSubmissions(0); return; }
        res = await api.get(`/tests/test/${exam.id}/submissions`);
      } else {
        const exam = marksFinalExam || (finalExams.length > 0 ? finalExams[0] : null);
        if (!exam) { setStudentMarks([]); setRemainingSubmissions(0); return; }
        res = await api.get(`/tests/test/${exam.id}/submissions`);
      }
      const payload = res.data || {};
      const submissions = Array.isArray(payload.submissions) ? payload.submissions : [];
      const remaining = typeof payload.remaining === "number" ? payload.remaining : 0;
      setStudentMarks(submissions);
      setRemainingSubmissions(remaining);
    } catch {
      setStudentMarks([]);
    } finally {
      setIsMarksLoading(false);
    }
  }, [marksExamType, marksLesson, selectedLesson, marksStandaloneExam, marksFinalExam, standaloneExams, finalExams]);

  useEffect(() => {
    if (courseDetailsTab === "student-marks") {
      loadStudentMarks();
    }
  }, [courseDetailsTab, loadStudentMarks, marksLesson, marksStandaloneExam, marksFinalExam, marksExamType]);

  // ─────────────────────────────────────────────────────────────────────────
  // Admin leaderboard
  // ─────────────────────────────────────────────────────────────────────────
  const fetchAdminLeaderboard = useCallback(async (lessonId: string) => {
    if (!lessonId) return;
    setIsAdminLeaderboardLoading(true);
    try {
      const res = await api.get(`/tests/leaderboard/${lessonId}`);
      setAdminLeaderboardData(res.data || []);
    } catch {
      setAdminLeaderboardData([]);
    } finally {
      setIsAdminLeaderboardLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminLeaderboardLessonId) fetchAdminLeaderboard(adminLeaderboardLessonId);
  }, [adminLeaderboardLessonId, fetchAdminLeaderboard]);

  useEffect(() => {
    if (courseLessons.length > 0 && !adminLeaderboardLessonId) {
      setAdminLeaderboardLessonId(String(courseLessons[0].id));
    }
  }, [courseLessons, adminLeaderboardLessonId]);

  // ─────────────────────────────────────────────────────────────────────────
  // Edit lesson form sync
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (editingLesson) {
      setEditLessonTitle(editingLesson.title || "");
      setEditLessonDescription(editingLesson.description || "");
      setEditLessonLink(editingLesson.materialLink || "");
      setEditLessonType(editingLesson.materialType as any);
      setEditLessonInputMode("link");
      setEditLessonPracticeEnabled(!!editingLesson.practiceEnabled);
      setEditLessonError("");
    }
  }, [editingLesson]);

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────
  const toggleFullScreen = () => {
    if (playerRef.current) {
      if (document.fullscreenElement) document.exitFullscreen();
      else playerRef.current.requestFullscreen().catch(console.error);
    }
  };

  const triggerNextLesson = (next: Lesson) => {
    setIsNextLessonTransition(true);
    setShowTestPlayer(false);
    setLockedFromNavigation(null);
    setSelectedLesson(next);
    setTimeout(() => setIsNextLessonTransition(false), 600);
  };

  const goToFirstAvailableLesson = () => {
    if (courseLessons.length === 0) return;
    const firstUnlocked = courseLessons.find((l, index) => {
      if (index === 0) return true;
      return isCompleted(courseLessons[index - 1]);
    });
    setLockedFromNavigation(null);
    setSelectedLesson(firstUnlocked || courseLessons[0]);
  };

  const handleCompleteLesson = (cId: string, lessonId: string) => {
    triggerConfirm(
      "Mark Lesson Completed",
      "Confirm that you have reviewed the study slides and completed this lesson tutorial.",
      async () => {
        try {
          await completeLesson(cId, lessonId);
          toast.success("Lesson completed!");
          const freshLessons = await loadCourseLessons(cId);
          const freshLesson = freshLessons.find((l: Lesson) => l.lessonId === lessonId || String(l.id) === lessonId);
          if (freshLesson) setSelectedLesson(freshLesson);
        } catch (err: any) {
          toast.error(err.message || "Failed to complete lesson.");
        }
      },
      "Mark Complete"
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
    if (!newLessonTitle.trim()) setNewLessonTitle(fileNameWithoutExt);
    const ext = file.name.split(".").pop()?.toLowerCase();
    let type = "PDF";
    if (["mp4", "mov", "avi", "webm", "ogg"].includes(ext || "")) type = "Video";
    else if (["ppt", "pptx"].includes(ext || "")) type = "PPT";
    else if (["doc", "docx"].includes(ext || "")) type = "DOCX";
    else if (ext === "pdf") type = "PDF";
    setNewLessonType(type);
    setIsUploadingFile(true);
    setLessonFormError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await api.post("/courses/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      if (res.data?.url) {
        setNewLessonLink(res.data.url);
        setLessonFormSuccess("File uploaded and linked successfully!");
        setTimeout(() => setLessonFormSuccess(p => p === "File uploaded and linked successfully!" ? "" : p), 10000);
      }
    } catch (err: any) {
      setLessonFormError(err.response?.data?.message || "File upload failed.");
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleAddLesson = (e: React.FormEvent) => {
    e.preventDefault();
    setLessonFormError("");
    setLessonFormSuccess("");
    if (!course) { setLessonFormError("Course not loaded."); return; }
    if (!newLessonTitle.trim() || !newLessonLink.trim()) { setLessonFormError("Lesson title and material link are required."); return; }
    triggerConfirm(
      "Deploy New Lesson",
      `Are you sure you want to publish the lesson "${newLessonTitle}" under ${course.name}?`,
      async () => {
        setIsDeployingLesson(true);
        try {
          const typeToSubmit = lessonInputMode === "link" ? detectMaterialType(newLessonLink) : newLessonType as any;
          await addLesson(course.courseId, { title: newLessonTitle, description: newLessonDescription, materialType: typeToSubmit, materialLink: newLessonLink, status: "Active" });
          setLessonFormSuccess("Lesson added successfully!");
          setTimeout(() => setLessonFormSuccess(p => p === "Lesson added successfully!" ? "" : p), 10000);
          setNewLessonTitle(""); setNewLessonDescription(""); setNewLessonLink("");
          await loadCourseLessons(course.courseId);
          fetchCourses();
        } catch (err: any) {
          setLessonFormError(err.message);
        } finally {
          setIsDeployingLesson(false);
        }
      },
      "Deploy Lesson"
    );
  };

  const handleEditCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course) return;
    setEditCourseFormError(""); setEditCourseFormSuccess(""); setIsUpdatingCourse(true);
    try {
      let thumbnailUrl = undefined;
      if (editCourseThumbnail) {
        const formData = new FormData();
        formData.append("file", editCourseThumbnail);
        const uploadRes = await api.post("/courses/upload-thumbnail", formData, { headers: { "Content-Type": "multipart/form-data" } });
        thumbnailUrl = uploadRes.data.url;
      }
      const updated = await updateCourse(course.courseId, { name: editCourseName, categoryId: editCourseCategoryId || undefined, description: editCourseDescription, ...(thumbnailUrl && { thumbnailUrl }) });
      setCourse(updated);
      toast.success("Course updated successfully!");
      setEditCourseFormSuccess("Course updated successfully!");
      setEditCourseThumbnail(null);
      setTimeout(() => setEditCourseFormSuccess(""), 10000);
      fetchCourses();
    } catch (err: any) {
      setEditCourseFormError(err.message || "Failed to update course.");
    } finally {
      setIsUpdatingCourse(false);
    }
  };

  const handleEditLessonFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingEditFile(true); setEditLessonError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await api.post("/courses/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      if (res.data?.url) {
        setEditLessonLink(res.data.url);
        setEditLessonType(detectMaterialType(res.data.url) as any);
      }
    } catch (err: any) {
      setEditLessonError(err.response?.data?.message || "File upload failed.");
    } finally {
      setIsUploadingEditFile(false);
    }
  };

  const handleEditLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLesson || !course) return;
    setIsUpdatingLesson(true); setEditLessonError("");
    try {
      const typeToSubmit = editLessonInputMode === "link" ? detectMaterialType(editLessonLink) : editLessonType;
      await updateLesson(course.courseId, editingLesson.lessonId, { title: editLessonTitle, description: editLessonDescription, materialType: typeToSubmit, materialLink: editLessonLink, practiceEnabled: editLessonPracticeEnabled });
      await loadCourseLessons(course.courseId);
      if (selectedLesson?.lessonId === editingLesson.lessonId) {
        setSelectedLesson(prev => prev ? { ...prev, title: editLessonTitle, description: editLessonDescription, materialLink: editLessonLink, materialType: typeToSubmit, practiceEnabled: editLessonPracticeEnabled } : null);
      }
      setEditingLesson(null);
      toast.success("Lesson updated!");
    } catch (err: any) {
      setEditLessonError(err.message || "Failed to update lesson.");
    } finally {
      setIsUpdatingLesson(false);
    }
  };

  const handleUpdateCourseStatus = (cId: string, status: string) => {
    const title = status === "active" ? "Set Course to Active" : "Set Course to Inactive";
    const description = status === "active"
      ? "Confirming change to ACTIVE status. This course will become visible in the catalog."
      : "Warning: Setting to Inactive will hide this course from the catalog. Active enrollments will be locked.";
    triggerConfirm(title, description, async () => {
      try {
        await api.patch(`/courses/${cId}/status`, { status });
        toast.success(`Course status updated to ${status.toUpperCase()}.`);
        const res = await api.get(`/courses/${cId}`);
        setCourse(res.data);
        fetchCourses();
      } catch (err: any) {
        toast.error(err.message || "Failed to update course status.");
      }
    }, status === "active" ? "Set Active" : "Set Inactive");
  };

  const confirmSoftDeleteCourse = (cId: string) => {
    triggerConfirm("Move Course to Recycle Bin", "Are you sure you want to delete this course? It will be moved to the recycle bin.", async () => {
      try {
        await softDeleteCourse(cId);
        toast.success("Course moved to Recycle Bin.");
        fetchCourses();
        router.push(backUrl);
      } catch (err: any) {
        toast.error(err.message || "Failed to delete course.");
      }
    }, "Move to Trash");
  };

  const confirmSoftDeleteLesson = (cId: string, lessonId: string) => {
    triggerConfirm("Move Lesson to Recycle Bin", "Are you sure you want to delete this lesson?", async () => {
      try {
        await softDeleteLesson(cId, lessonId);
        toast.success("Lesson moved to Recycle Bin.");
        if (selectedLesson?.lessonId === lessonId || String(selectedLesson?.id) === String(lessonId)) {
          setSelectedLesson(null);
        }
        await loadCourseLessons(cId);
        fetchCourses();
      } catch (err: any) {
        toast.error(err.message || "Failed to delete lesson.");
      }
    }, "Move to Trash");
  };

  const handleViewSubmissionDetails = async (submissionId: number) => {
    setIsReviewLoading(submissionId);
    try {
      const res = await api.get(`/tests/submissions/${submissionId}`);
      setReviewStudentSubmission(res.data);
    } catch {
      toast.error("Failed to load submission details.");
    } finally {
      setIsReviewLoading(null);
    }
  };

  const startEditMarks = () => {
    if (!reviewStudentSubmission) return;
    const initial: Record<number, { marksAwarded: string; evaluatorComment: string }> = {};
    (reviewStudentSubmission.answers || []).forEach((a: any) => {
      if (!a?.id) return;
      initial[a.id] = {
        marksAwarded: String(a.marksAwarded ?? 0),
        evaluatorComment: typeof a.evaluatorComment === "string" ? a.evaluatorComment : "",
      };
    });
    setEditedMarks(initial);
    setIsEditingMarks(true);
  };

  const handleSaveMarks = async () => {
    if (!reviewStudentSubmission) return;
    setIsSavingMarks(true);
    try {
      const answers = Object.entries(editedMarks).map(([id, val]) => ({
        submissionAnswerId: Number(id),
        marksAwarded: Number(val.marksAwarded) || 0,
        evaluatorComment: val.evaluatorComment || "",
      }));
      await api.put(`/tests/submissions/${reviewStudentSubmission.id}/marks`, { answers });
      toast.success("Marks updated successfully.");
      setIsEditingMarks(false);
      const res = await api.get(`/tests/submissions/${reviewStudentSubmission.id}`);
      setReviewStudentSubmission(res.data);
      await loadStudentMarks();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update marks.");
    } finally {
      setIsSavingMarks(false);
    }
  };

  const loadCourseActivityLogs = useCallback(async () => {
    if (!isAdmin) return;
    setIsActivityLogsLoading(true);
    setActivityLogsError("");
    try {
      const res = await api.get(`/activity-logs/course/${courseId}`, {
        params: { page: activityLogPage, limit: 10 },
      });
      setCourseActivityLogs(res.data?.data || []);
      setActivityLogMeta(res.data?.meta || {});
    } catch {
      setActivityLogsError("Failed to load activity log.");
    } finally {
      setIsActivityLogsLoading(false);
    }
  }, [courseId, isAdmin, activityLogPage]);

  useEffect(() => {
    if (courseDetailsTab === "activity-log") {
      setActivityLogPage(1);
    }
  }, [courseDetailsTab]);

  useEffect(() => {
    if (courseDetailsTab === "activity-log") {
      loadCourseActivityLogs();
    }
  }, [courseDetailsTab, loadCourseActivityLogs]);

  // ─────────────────────────────────────────────────────────────────────────
  // Certificates (admin) — course applications
  // ─────────────────────────────────────────────────────────────────────────
  const loadCourseCertificates = useCallback(async () => {
    setIsCertificatesLoading(true);
    try {
      const res = await api.get(`/certificates/course/${courseId}`);
      setCourseCertificates(res.data || []);
      setCertificatesError("");
    } catch (err: any) {
      setCertificatesError(err.response?.data?.message || "Failed to load certificate applications.");
    } finally {
      setIsCertificatesLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (courseDetailsTab === "certifications") {
      loadCourseCertificates();
    }
  }, [courseDetailsTab, loadCourseCertificates]);

  const openVerifyCertificate = async (certId: number) => {
    setVerifyCertificate(null);
    setShowRejectInput(false);
    setRejectReason("");
    setVerifyError("");
    setIsVerifyLoading(true);
    try {
      const res = await api.get(`/certificates/${certId}`);
      setVerifyCertificate(res.data);
    } catch (err: any) {
      setVerifyError(err.response?.data?.message || "Failed to load application details.");
    } finally {
      setIsVerifyLoading(false);
    }
  };

  const handleGenerateCertificate = async () => {
    if (!verifyCertificate) return;
    setIsGeneratingCert(true);
    try {
      const res = await api.post(`/certificates/${verifyCertificate.certificate.id}/generate`);
      toast.success(`Certificate ${res.data.certificateId} generated successfully!`);
      setVerifyCertificate(null);
      await loadCourseCertificates();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to generate certificate.");
    } finally {
      setIsGeneratingCert(false);
    }
  };

  const handleRejectCertificate = async () => {
    if (!verifyCertificate) return;
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection.");
      return;
    }
    setIsRejectingCert(true);
    try {
      const res = await api.post(`/certificates/${verifyCertificate.certificate.id}/reject`, { reason: rejectReason.trim() });
      toast.success(`Application ${res.data.certificateId} rejected.`);
      setVerifyCertificate(null);
      await loadCourseCertificates();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to reject certificate.");
    } finally {
      setIsRejectingCert(false);
    }
  };

  const downloadCertificatePdf = async (certId: number) => {
    try {
      const res = await api.get(`/certificates/${certId}/pdf`, { responseType: "blob" });
      const disposition = res.headers["content-disposition"] || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `certificate-${certId}.pdf`;
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to download certificate.");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Certificates (learner) — eligibility + apply
  // ─────────────────────────────────────────────────────────────────────────
  const loadCertEligibility = useCallback(async () => {
    setIsCertEligibilityLoading(true);
    try {
      const res = await api.get(`/certificates/eligibility/${courseId}`);
      setCertEligibility(res.data);
    } catch {
      setCertEligibility(null);
    } finally {
      setIsCertEligibilityLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (!isAdminOrEmployee && studentViewTab === "certifications") {
      loadCertEligibility();
    }
  }, [studentViewTab, isAdminOrEmployee, loadCertEligibility]);

  const handleApplyCertificate = async () => {
    setIsApplyingCert(true);
    try {
      await api.post("/certificates/apply", { courseId });
      toast.success("Certificate application submitted! An admin will review it shortly.");
      await loadCertEligibility();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to submit certificate application.");
    } finally {
      setIsApplyingCert(false);
    }
  };

  const handleDeleteTest = async (testId: number, type: 'standalone' | 'final') => {
    try {
      await api.delete(`/tests/${testId}`);
      toast.success(`${type === 'standalone' ? 'Standalone exam' : 'Final exam'} deleted successfully.`);
      if (type === 'standalone') {
        const res = await api.get(`/tests/standalone/${courseId}`);
        setStandaloneExams(res.data || []);
      } else {
        const res = await api.get(`/tests/course/${courseId}`);
        setFinalExams(res.data || []);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Failed to delete ${type === 'standalone' ? 'standalone exam' : 'final exam'}.`);
    }
  };

  const handleAddCategory = () => {
    setNewCategoryName("");
    setShowAddCategoryModal(true);
  };

  const submitNewCategory = async () => {
    if (!newCategoryName.trim() || isAddingCategory) return;
    setIsAddingCategory(true);
    try {
      const res = await api.post("/courses/categories", { name: newCategoryName.trim() });
      const fresh = await api.get("/courses/categories");
      setCategoriesList((fresh.data || []).map((cat: any) => ({ categoryId: cat.id, categoryName: cat.name })));
      if (res.data && res.data.id) {
        setEditCourseCategoryId(res.data.id);
      }
      setNewCategoryName("");
      setShowAddCategoryModal(false);
      toast.success("Category saved!");
    } catch {
      toast.error("Failed to add category");
    } finally {
      setIsAddingCategory(false);
    }
  };

  const deleteCategory = async (id: number) => {
    setIsDeletingCategoryId(id);
    try {
      await api.delete(`/courses/categories/${id}`);
      const fresh = await api.get("/courses/categories");
      setCategoriesList((fresh.data || []).map((cat: any) => ({ categoryId: cat.id, categoryName: cat.name })));
      setConfirmDeleteCategoryId(null);
      toast.success("Category deleted!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete category");
      setConfirmDeleteCategoryId(null);
    } finally {
      setIsDeletingCategoryId(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Derived helpers
  // ─────────────────────────────────────────────────────────────────────────
  const isCompleted = (l: Lesson) => {
    if (!l) return false;
    return completedLessons.includes(l.lessonId) || completedLessons.includes(String(l.id)) || (completedLessons as any).includes(l.id);
  };

  const currentIdx = selectedLesson
    ? courseLessons.findIndex(l => l.lessonId === selectedLesson.lessonId || String(l.id) === String(selectedLesson.id))
    : -1;
  const nextLesson = currentIdx !== -1 && currentIdx < courseLessons.length - 1 ? courseLessons[currentIdx + 1] : null;

  // ─────────────────────────────────────────────────────────────────────────
  // Loading state
  // ─────────────────────────────────────────────────────────────────────────
  if (isLoadingCourse) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="relative flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500/20 border-t-blue-600" />
          <Sparkles className="absolute h-5 w-5 text-blue-500 animate-pulse" />
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-zinc-400 animate-pulse">Loading course...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-sm font-medium text-red-500">Course not found.</p>
        <button onClick={() => router.push(backUrl)} className="text-sm text-blue-600 underline">Go back</button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex flex-col gap-6 pb-8 animate-fadeIn">
        {/* Navigation & Title block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(backUrl)}
              className="flex items-center justify-center h-9 w-9 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider dark:text-blue-400">{course.courseId}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-zinc-700" />
                <span className="text-xs text-slate-400">{courseLessons.length} Lesson{courseLessons.length !== 1 ? "s" : ""}</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-50">{course.name}</h2>
            </div>
          </div>

          {!isAdminOrEmployee && (
            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
              <span className="text-xs text-slate-400 font-medium">Your Progress</span>
              <div className="w-24 h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 transition-all" style={{ width: `${learnerProgress}%` }} />
              </div>
              <span className="text-xs font-bold text-green-600 dark:text-green-400">{learnerProgress}%</span>
            </div>
          )}
        </div>

        {/* Learner Tabs */}
        {!isAdminOrEmployee && (
          <div className="flex border-b border-slate-200 dark:border-zinc-800 overflow-x-auto">
            {(["course", "certifications"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStudentViewTab(tab)}
                className={`pb-3 text-sm font-semibold px-4 whitespace-nowrap transition ${studentViewTab === tab ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400" : "text-slate-400 hover:text-slate-600"}`}
              >
                {tab === "course" ? "Course Content" : "Certifications"}
              </button>
            ))}
          </div>
        )}

        {/* Learner Certifications Panel */}
        {!isAdminOrEmployee && studentViewTab === "certifications" && (
          <div ref={certRef} className="flex flex-col gap-4 scroll-mt-24">
            {isCertEligibilityLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={28} className="text-blue-500 animate-spin" />
                <span className="text-xs text-slate-400 font-medium animate-pulse">Checking your certificate eligibility...</span>
              </div>
            ) : !certEligibility ? (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-8 text-center">
                <p className="text-xs text-red-500">Failed to load certificate information. Please try again.</p>
              </div>
            ) : (
              <>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 flex flex-col gap-4 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <Award size={18} className="text-amber-500" />
                    <h4 className="font-bold text-slate-900 dark:text-zinc-50">Certifications</h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Take every test and complete 100% of this course to unlock your certificate. Once submitted, an admin will review and generate it.</p>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">Tests Completed</span>
                      <span className="text-xs text-slate-500">{certEligibility.takenTests} of {certEligibility.totalTests}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 items-center">
                      <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">Course Completion</span>
                      {certEligibility.totalLessons > 0 ? (
                        <span className={`text-xs font-bold ${certEligibility.courseCompleted ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>{Math.round(certEligibility.courseProgress || 0)}%</span>
                      ) : (
                        <span className="text-xs font-bold text-green-600 dark:text-green-400">Complete</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 text-right">
                      <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">Eligibility</span>
                      {certEligibility.eligible ? (
                        <span className="text-xs font-bold text-green-600 dark:text-green-400">Eligible</span>
                      ) : (
                        <span className="text-xs font-bold text-rose-500">Not yet eligible</span>
                      )}
                    </div>
                  </div>

                  {!certEligibility.eligible && certEligibility.missingTests?.length > 0 && (
                    <div className="flex flex-col gap-1.5 p-4 rounded-xl border border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10">
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Tests still required</span>
                      {certEligibility.missingTests.map((t: any) => (
                        <span key={t.testId} className="text-xs text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
                          <X size={11} className="text-amber-500 shrink-0" /> {t.title} <span className="text-[10px] text-slate-400 font-mono">({t.testType})</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {!certEligibility.eligible && !certEligibility.courseCompleted && (
                    <div className="flex flex-col gap-1.5 p-4 rounded-xl border border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10">
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Course not completed</span>
                      <span className="text-xs text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
                        <X size={11} className="text-amber-500 shrink-0" /> Finish all lessons and reach 100% course completion to apply.
                      </span>
                    </div>
                  )}

                  {!certEligibility.myCertificate && (
                    <button
                      type="button"
                      onClick={handleApplyCertificate}
                      disabled={!certEligibility.eligible || isApplyingCert}
                      className="self-start flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition shadow-sm"
                    >
                      {isApplyingCert ? <><Loader2 size={14} className="animate-spin" /> Applying...</> : <><Award size={14} /> Apply for Certificate</>}
                    </button>
                  )}
                </div>

                {certEligibility.myCertificate && (
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 flex flex-col gap-4 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award size={18} className="text-amber-500" />
                        <h4 className="font-bold text-slate-900 dark:text-zinc-50">Your Application</h4>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border capitalize ${
                        certEligibility.myCertificate.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40"
                        : certEligibility.myCertificate.status === "issued" ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/40"
                        : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40"
                      }`}>{certEligibility.myCertificate.status}</span>
                    </div>

                    {certEligibility.myCertificate.status === "pending" && (
                      <p className="text-xs text-slate-500 dark:text-zinc-400">Your application is under review. You&apos;ll be notified once it&apos;s generated or rejected.</p>
                    )}

                    {certEligibility.myCertificate.status === "rejected" && (
                      <div className="flex flex-col gap-1.5 p-4 rounded-xl border border-rose-200 bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-950/10">
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Rejected</span>
                        <p className="text-xs text-slate-600 dark:text-zinc-300">Reason: {certEligibility.myCertificate.rejectionReason || "No reason provided"}</p>
                        <p className="text-[10px] text-slate-400 mt-1">You can re-apply for a certificate for this course.</p>
                      </div>
                    )}

                    {certEligibility.myCertificate.status === "rejected" && certEligibility.eligible && (
                      <button
                        type="button"
                        onClick={handleApplyCertificate}
                        disabled={isApplyingCert}
                        className="self-start flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition shadow-sm"
                      >
                        {isApplyingCert ? <><Loader2 size={14} className="animate-spin" /> Applying...</> : <><Award size={14} /> Re-apply</>}
                      </button>
                    )}

                    {certEligibility.myCertificate.status === "issued" && (
                      <div className="flex flex-col gap-3">
                        <p className="text-xs text-slate-500 dark:text-zinc-400">Congratulations! Your certificate is ready. View it online or download a PDF copy.</p>
                        <div className="flex items-center gap-2">
                          <a
                            href={`${apiBase}${certEligibility.myCertificate.certificateUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm"
                          >
                            <Eye size={13} /> View Certificate
                          </a>
                          <button
                            type="button"
                            onClick={() => downloadCertificatePdf(certEligibility.myCertificate.id)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            <FileText size={13} /> Download PDF
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Dynamic Split Layout */}
        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 items-start ${!isAdminOrEmployee && studentViewTab === "certifications" ? "hidden" : ""}`}>

          {/* MIDDLE COLUMN - Content Player & Sub-actions (70% width on Desktop) */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {isNextLessonTransition ? (
              <div className="flex flex-col items-center justify-center py-40 gap-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm animate-fadeIn">
                <div className="relative flex items-center justify-center">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500/20 border-t-blue-600" />
                  <Sparkles className="absolute h-5 w-5 text-blue-500 animate-pulse" />
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-zinc-400 animate-pulse">Loading next lesson...</p>
              </div>
            ) : (
              <>
                {/* Player Container */}
                <div ref={playerRef} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-md dark:border-zinc-800 aspect-video flex flex-col items-center justify-center text-center">
                  {selectedLesson ? (
                    <div className="w-full h-full relative">
                      {selectedLesson.materialType === "Video" ? (
                        selectedLesson.materialLink.includes("youtube.com") || selectedLesson.materialLink.includes("youtu.be") ? (
                          <iframe src={getEmbedLink(selectedLesson.materialLink)} className="w-full h-full border-0" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" title={selectedLesson.title} />
                        ) : (
                          <video src={selectedLesson.materialLink.startsWith("/") ? `${apiBase}${selectedLesson.materialLink}` : selectedLesson.materialLink} className="w-full h-full bg-black object-contain" controls />
                        )
                      ) : selectedLesson.materialType === "PPT" ? (() => {
                        const absoluteLink = selectedLesson.materialLink.startsWith("/") ? `${apiBase}${selectedLesson.materialLink}` : selectedLesson.materialLink;
                        return <iframe src={`https://docs.google.com/gview?url=${encodeURIComponent(absoluteLink)}&embedded=true`} className="w-full h-full border-0 bg-white" title={selectedLesson.title} />;
                      })() : selectedLesson.materialType === "DOCX" ? (
                        <DocxViewer url={selectedLesson.materialLink.startsWith("/") ? `${apiBase}${selectedLesson.materialLink}` : selectedLesson.materialLink} />
                      ) : (
                        <iframe src={selectedLesson.materialLink.startsWith("/") ? `${apiBase}${selectedLesson.materialLink}` : selectedLesson.materialLink} className="w-full h-full border-0 bg-white" title={selectedLesson.title} />
                      )}

                      {/* Absolute Player Controls Overlay */}
                      <div className="absolute top-4 right-4 z-10 flex gap-2">
                        <a href={selectedLesson.materialLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl bg-black/60 hover:bg-black/85 text-white backdrop-blur-sm px-3.5 py-2 text-xs font-semibold transition">
                          Open Link <ExternalLink size={12} />
                        </a>
                      </div>
                      <button onClick={toggleFullScreen} className="absolute bottom-4 right-4 z-20 flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 hover:bg-black/85 text-white backdrop-blur-sm transition" title="Toggle Fullscreen">
                        <Maximize2 size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 p-8">
                      <MonitorPlay size={54} className="text-zinc-700 animate-bounce" />
                      <h3 className="text-lg font-bold text-white">Select a Lesson to Start</h3>
                      <p className="text-xs text-zinc-500 max-w-sm">Choose from the course outline playlist in the sidebar to review teaching slides or start stream playback.</p>
                    </div>
                  )}
                </div>

                {/* Locked Lesson Banner (from notification deep-link) */}
                {!isAdminOrEmployee && lockedFromNavigation && selectedLesson && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-5 animate-fadeIn">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                        <Lock size={16} />
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">Lesson Locked</h4>
                        <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                          &ldquo;{selectedLesson.title}&rdquo; is locked. Complete the previous lesson to unlock it and take its test.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={goToFirstAvailableLesson}
                      className="shrink-0 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2 transition flex items-center gap-1.5"
                    >
                      <Play size={13} /> Go to first available lesson
                    </button>
                  </div>
                )}

                {/* Lesson Detail Bar & Action Panel */}
                {selectedLesson && (
                  <div className="flex flex-col gap-4 bg-white p-6 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 shadow-sm animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Lesson Info</span>
                      <div className="flex items-center gap-2">
                        {!isAdminOrEmployee && (
                          <button type="button" onClick={() => setViewCourseModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-900/40 dark:hover:bg-blue-900/40 text-xs font-semibold transition" title="View Course Info">
                            <Eye size={12} /> Course Info
                          </button>
                        )}
                        {isAdminOrEmployee && (
                          <button type="button" onClick={() => setEditingLesson(selectedLesson)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold transition dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800">
                            <Pencil size={12} /> Edit Lesson
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400 px-2.5 py-1 rounded-md">Playing: {selectedLesson.materialType}</span>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-50 mt-2">{selectedLesson.title}</h3>
                        {selectedLesson.description && <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400 leading-relaxed max-w-2xl">{selectedLesson.description}</p>}
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {isCompleted(selectedLesson) ? (
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-xl dark:bg-green-950/20 dark:text-green-400">
                              <CheckCircle size={14} /> Completed
                            </span>
                            {!isAdminOrEmployee && nextLesson && (
                              <button onClick={() => triggerNextLesson(nextLesson)} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 transition flex items-center gap-1 shadow-sm">
                                Next Lesson →
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-3">
                            {!isAdminOrEmployee && !hasTests && !lockedFromNavigation && (
                              <button onClick={() => handleCompleteLesson(course.courseId, selectedLesson.lessonId)} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 transition">
                                Mark Complete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Test Player for Learners */}
                {!isAdminOrEmployee && selectedLesson && hasTests && !lockedFromNavigation && (
                  <div ref={testSectionRef} className="mt-6 animate-fadeIn scroll-mt-24">
                    <TestPlayer
                      lessonId={selectedLesson.id}
                      isAdmin={false}
                      hasNextLesson={!!nextLesson}
                      onNextLesson={() => { if (nextLesson) triggerNextLesson(nextLesson); }}
                      onSuccess={async () => {
                        const freshLessons = await loadCourseLessons(course.courseId);
                        // reload progress
                        try {
                          const progressRes = await api.get(`/courses/${course.courseId}/progress/${userId}`);
                          const data = progressRes.data;
                          setLearnerProgress(typeof data === "number" ? data : (data?.progress ?? 0));
                          setCompletedLessons(data?.completedLessons || []);
                        } catch {}
                      }}
                      onCancel={() => setShowTestPlayer(false)}
                    />
                  </div>
                )}

                {/* AI Test Practice Panel for Learners */}
                {!isAdminOrEmployee && selectedLesson && selectedLesson.practiceEnabled && (
                  <PracticeTestPanel
                    lesson={selectedLesson}
                  />
                )}

                {/* Standalone Exam Player */}
                {selectedStandaloneExam && (
                  <div className="mt-6 animate-fadeIn" ref={standalonePlayerRef}>
                    <TestPlayer
                      externalTest={selectedStandaloneExam}
                      isAdmin={isAdminOrEmployee}
                      onSuccess={async () => {
                        await loadCourseLessons(course.courseId);
                        setSelectedStandaloneExam(null);
                      }}
                      onCancel={() => setSelectedStandaloneExam(null)}
                    />
                  </div>
                )}

                {/* Admin / Employee Management Area Tabs */}
                {isAdminOrEmployee && (
                  <div className="flex flex-col gap-4">
                    <div className="flex border-b border-slate-200 dark:border-zinc-800 overflow-x-auto">
                      {(["player", "add-lesson", "student-marks", "evaluation", "all-tests", "leaderboard", "activity-log", "certifications"] as const)
                        .filter(tab => tab !== "activity-log" || isAdmin)
                        .map(tab => (
                        <button
                          key={tab}
                          onClick={() => setCourseDetailsTab(tab)}
                          className={`pb-3 text-sm font-semibold px-4 whitespace-nowrap transition ${courseDetailsTab === tab ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400" : "text-slate-400 hover:text-slate-600"}`}
                        >
                          {tab === "player" ? "Course Info" : tab === "add-lesson" ? "Add Lesson" : tab === "student-marks" ? "Student Marks" : tab === "evaluation" ? "Evaluation" : tab === "all-tests" ? "All Tests" : tab === "activity-log" ? "Activity Log" : tab === "certifications" ? "Certifications" : "Leaderboard"}
                        </button>
                      ))}
                    </div>

                    <div ref={adminTabRef} className="p-1 scroll-mt-24">
                      {/* Course Info Tab */}
                      {courseDetailsTab === "player" && (
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col gap-6 animate-fadeIn">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-bold text-slate-900 dark:text-zinc-50">Course Info & Metrics</h4>
                              <p className="text-xs text-slate-500">Summary stats and general information for this course.</p>
                            </div>
                            <button type="button" onClick={() => setShowCourseSettingsEdit(!showCourseSettingsEdit)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold transition dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800">
                              <Settings size={14} /> {showCourseSettingsEdit ? "Close Settings" : "Edit Course Settings"}
                            </button>
                          </div>

                          {showCourseSettingsEdit ? (
                            <div className="flex flex-col gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50 dark:border-zinc-800 dark:bg-zinc-900/30 animate-fadeIn">
                              <h5 className="text-xs font-bold text-slate-900 dark:text-zinc-100">Edit Settings</h5>
                              {editCourseFormError && <div className="p-3 text-xs bg-red-50 text-red-605 text-red-600 rounded-xl border border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30">{editCourseFormError}</div>}
                              {editCourseFormSuccess && <div className="p-3 text-xs bg-green-50 text-green-600 rounded-xl border border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30">{editCourseFormSuccess}</div>}
                              <form onSubmit={handleEditCourse} className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1"><label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Course Name</label><input type="text" value={editCourseName} onChange={e => setEditCourseName(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900" required /></div>
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex items-center justify-between"><label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Category</label><button type="button" onClick={handleAddCategory} className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline">+ New Category</button></div>
                                  <SelectDropdown
                                    value={editCourseCategoryId === null ? "" : String(editCourseCategoryId)}
                                    onChange={v => setEditCourseCategoryId(v === "" ? null : Number(v))}
                                    options={[{ value: "", label: "Select Category" }, ...categoriesList.map(cat => ({ value: String(cat.categoryId), label: cat.categoryName }))]}
                                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                                    ariaLabel="Select category"
                                  />
                                </div>
                                <div className="flex flex-col gap-1"><label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Course Thumbnail</label><input type="file" accept="image/*" onChange={e => { if (e.target.files?.[0]) setEditCourseThumbnail(e.target.files[0]); }} className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900" /></div>
                                <div className="flex flex-col gap-1"><label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Course Description</label><textarea value={editCourseDescription} onChange={e => setEditCourseDescription(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 min-h-[80px]" placeholder="Enter course description here..." /></div>
                                <button type="submit" disabled={isUpdatingCourse} className="self-start rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 transition disabled:opacity-50">{isUpdatingCourse ? "Saving..." : "Save Changes"}</button>
                              </form>
                              <div className="h-px bg-slate-200 dark:bg-zinc-800 w-full my-2" />
                              <div className="flex flex-col gap-3">
                                <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Visibility & Status:</span>
                                <div className="flex flex-wrap items-center gap-2">
                                  {course.status === "active" ? (
                                    <button type="button" onClick={() => handleUpdateCourseStatus(course.courseId, "inactive")} className="rounded-xl px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition shadow-sm">Set Inactive</button>
                                  ) : (
                                    <button type="button" onClick={() => handleUpdateCourseStatus(course.courseId, "active")} className="rounded-xl px-4 py-2 text-xs font-bold bg-green-600 hover:bg-green-700 text-white transition shadow-sm">Set Active</button>
                                  )}
                                  <button type="button" onClick={() => confirmSoftDeleteCourse(course.courseId)} className="rounded-xl px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition shadow-sm ml-auto">Delete Course</button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-6">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-100 dark:border-zinc-800/60">
                                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Total Enrolled Learners</span>
                                  <span className="text-xl font-bold text-slate-900 dark:text-zinc-100">{course.enrolled}</span>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-100 dark:border-zinc-800/60">
                                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Lesson Chapters Count</span>
                                  <span className="text-xl font-bold text-slate-900 dark:text-zinc-100">{courseLessons.length}</span>
                                </div>
                              </div>
                              <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/20 dark:border-zinc-800 dark:bg-zinc-900/10">
                                <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Course Description</h5>
                                {course.description ? (
                                  <p className="text-xs text-slate-650 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{course.description}</p>
                                ) : (
                                  <p className="text-xs text-slate-400 italic">No description provided for this course yet.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* All Tests Tab */}
                      {courseDetailsTab === "all-tests" && (
                        <div className="flex flex-col gap-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                            <div className="flex flex-col gap-2 w-full sm:w-auto">
                              <div><h4 className="font-bold text-slate-900 dark:text-zinc-50 text-sm">All Tests</h4><p className="text-xs text-slate-500 dark:text-zinc-400">Manage lesson tests and standalone exams for this course.</p></div>
                              {courseLessons.length > 0 && (
                                <SelectDropdown
                                  value={allTestsLessonFilterId === null ? "" : String(allTestsLessonFilterId)}
                                  onChange={v => setAllTestsLessonFilterId(v === "" ? null : Number(v))}
                                  options={[{ value: "", label: "Select a lesson..." }, ...courseLessons.map(l => ({ value: String(l.id), label: `${l.lessonId} - ${l.title}` }))]}
                                  className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-full sm:w-auto max-w-full"
                                  ariaLabel="Filter tests by lesson"
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <button type="button" onClick={() => setCourseDetailsTab("ai-test")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm">
                                <Sparkles size={14} /> AI Test Builder
                              </button>
                              <button type="button" onClick={() => setShowAddTestForm(!showAddTestForm)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800">
                                <span>{showAddTestForm ? "✕ Cancel" : "+ Add Test"}</span>
                              </button>
                            </div>
                          </div>
                          {showAddTestForm && (
                            <div className="animate-fadeIn">
                              <TestBuilder
                                courseId={course.id}
                                lessons={courseLessons}
                                initialLessonId={allTestsLessonFilterId ?? selectedLesson?.id}
                                onSuccess={async (createdForLessonId?: number) => {
                                  setShowAddTestForm(false);
                                  const freshLessons = await loadCourseLessons(course.courseId);
                                  if (createdForLessonId && freshLessons?.length) {
                                    const targetLesson = freshLessons.find((l: any) => l.id === createdForLessonId);
                                    if (targetLesson) { setAllTestsLessonFilterId(targetLesson.id); }
                                  } else if (allTestsLessonFilterId) {
                                    try { const res = await api.get(`/tests/lesson/${allTestsLessonFilterId}`); setHasTests(res.data && res.data.length > 0); } catch {}
                                  }
                                  try { const res = await api.get(`/tests/standalone/${course.courseId}`); setStandaloneExams(res.data || []); } catch {}
                                  try { const res = await api.get(`/tests/course/${course.courseId}`); setFinalExams(res.data || []); } catch {}
                                }}
                              />
                            </div>
                          )}
                          {!showAddTestForm && allTestsLessonFilterId && (
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4">
                              <TestPlayer
                                lessonId={allTestsLessonFilterId}
                                isAdmin={true}
                                hasNextLesson={false}
                                onNextLesson={() => {}}
                                onSuccess={async () => { await loadCourseLessons(course.courseId); }}
                                onCancel={() => setAllTestsLessonFilterId(null)}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* AI Test Builder Tab */}
                      {courseDetailsTab === "ai-test" && (
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                          <AiTestBuilder
                            courseId={course.id}
                            lessons={courseLessons}
                            initialLessonId={selectedLesson?.id}
                            onBack={() => setCourseDetailsTab("all-tests")}
                            onSuccess={async () => {
                              await loadCourseLessons(course.courseId);
                              try { const res = await api.get(`/tests/lesson/${selectedLesson?.id}`); setHasTests(res.data && res.data.length > 0); } catch {}
                              try { const res = await api.get(`/tests/standalone/${course.courseId}`); setStandaloneExams(res.data || []); } catch {}
                              try { const res = await api.get(`/tests/course/${course.courseId}`); setFinalExams(res.data || []); } catch {}
                            }}
                          />
                        </div>
                      )}

                      {/* Add Lesson Tab */}
                      {courseDetailsTab === "add-lesson" && (
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                          <h4 className="font-bold text-slate-900 dark:text-zinc-50 mb-3">Add Lesson</h4>
                          {lessonFormError && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">{lessonFormError}</div>}
                          {lessonFormSuccess && <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-950/30 dark:text-green-400">{lessonFormSuccess}</div>}
                          <form onSubmit={handleAddLesson} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold text-slate-500">Lesson Title</label><input type="text" value={newLessonTitle || ""} onChange={e => setNewLessonTitle(e.target.value)} placeholder="e.g. Introduction to App Router" className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-800" /></div>
                            <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold text-slate-500">Lesson Description</label><textarea value={newLessonDescription || ""} onChange={e => setNewLessonDescription(e.target.value)} placeholder="Write a brief overview of this lesson chapter..." className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-800 w-full min-h-[70px]" /></div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-slate-500">Material Source</label>
                              <div className="flex bg-slate-105 p-1 rounded-xl w-fit border border-slate-200 dark:border-zinc-800">
                                <button type="button" onClick={() => setLessonInputMode("link")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${lessonInputMode === "link" ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100" : "text-slate-500 hover:text-slate-700 dark:text-zinc-400"}`}>Direct Link</button>
                                <button type="button" onClick={() => setLessonInputMode("upload")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${lessonInputMode === "upload" ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100" : "text-slate-500 hover:text-slate-700 dark:text-zinc-400"}`}>Documents</button>
                              </div>
                            </div>
                            <div className="flex flex-col gap-3">
                              {lessonInputMode === "link" ? (
                                <div className="flex flex-col gap-1.5 w-full"><label className="text-xs font-semibold text-slate-500">Material Link</label><input key="lesson-link-input" type="text" value={newLessonLink || ""} onChange={e => setNewLessonLink(e.target.value)} placeholder="https://example.com/materials/..." className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-800 w-full" /></div>
                              ) : (
                                <div className="flex flex-col gap-1.5 w-full">
                                  <label className="text-xs font-semibold text-slate-500">Upload File (VDO/PDF/PPT/DOCX)</label>
                                  <input key="lesson-file-input" type="file" accept="video/*,.pdf,.ppt,.pptx,.doc,.docx" onChange={handleFileUpload} className="text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-zinc-800 dark:file:text-zinc-200 cursor-pointer w-full" />
                                  {isUploadingFile && <span className="text-[10px] text-blue-500 animate-pulse mt-1">Uploading file to server...</span>}
                                  {newLessonLink && !isUploadingFile && <span className="text-[10px] text-green-600 truncate mt-1">Uploaded path: {newLessonLink}</span>}
                                </div>
                              )}
                            </div>
                            <button type="submit" disabled={isDeployingLesson} className="flex justify-center items-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 w-full">
                              {isDeployingLesson ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Deploying Lesson...</> : "Add Lesson"}
                            </button>
                          </form>
                          {isDeployingLesson && (
                            <div className="mt-4 p-4 rounded-xl border border-blue-100 bg-blue-50/20 dark:border-blue-900/20 dark:bg-blue-950/10 flex items-center gap-3 animate-pulse">
                              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent shrink-0" />
                              <div className="min-w-0"><p className="text-xs font-bold text-slate-900 dark:text-zinc-50">Syncing with databases...</p><p className="text-[10px] text-slate-400">Allocating assets and custom LES ID codes.</p></div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Leaderboard Tab */}
                      {courseDetailsTab === "leaderboard" && (
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col gap-6 animate-fadeIn">
                          <div><h4 className="font-bold text-slate-900 dark:text-zinc-50 mb-1 flex items-center gap-2"><Trophy size={18} className="text-amber-500" /> Lesson Leaderboard</h4><p className="text-xs text-slate-500 dark:text-zinc-400">View Top 5 student scores and completions for the selected lesson.</p></div>
                          <div className="flex flex-col gap-1.5 w-full max-w-xs">
                            <label className="text-xs font-semibold text-slate-500">Select Lesson</label>
                            <SelectDropdown
                              value={adminLeaderboardLessonId}
                              onChange={v => setAdminLeaderboardLessonId(v)}
                              options={[{ value: "", label: "Select a lesson..." }, ...courseLessons.map(l => ({ value: String(l.id), label: `${l.lessonId} - ${l.title}` }))]}
                              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 focus:outline-none"
                              ariaLabel="Select lesson for leaderboard"
                            />
                          </div>
                          {isAdminLeaderboardLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3"><Loader2 size={24} className="text-blue-500 animate-spin" /><span className="text-xs text-slate-455 font-medium">Fetching ranks...</span></div>
                          ) : adminLeaderboardData.length === 0 ? (
                            <p className="text-xs text-slate-500 py-4 bg-slate-50 dark:bg-zinc-800/40 rounded-xl px-4 text-center">No participants yet for this lesson&apos;s test.</p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {adminLeaderboardData.map((lb, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                                  <div className="flex items-center gap-3">
                                    <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? "bg-amber-100 text-amber-700 animate-pulse" : idx === 1 ? "bg-slate-200 text-slate-700" : idx === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"}`}>#{idx + 1}</span>
                                    <span className="font-semibold text-slate-800 dark:text-zinc-200 text-xs">{lb.name}</span>
                                  </div>
                                  <span className="font-bold text-slate-900 dark:text-zinc-100 text-xs">{lb.marksObtained} pts</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Student Marks Tab */}
                      {courseDetailsTab === "student-marks" && (
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-slate-900 dark:text-zinc-50">
                              Student Marks {marksExamType === "lesson" ? (marksLesson?.title || selectedLesson?.title ? `- ${marksLesson?.title || selectedLesson?.title}` : "") : (marksStandaloneExam?.title || (standaloneExams.length > 0 ? `- ${standaloneExams[0].title}` : ""))}
                            </h4>
                            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full">
                              {remainingSubmissions > 0 ? `${remainingSubmissions} submission${remainingSubmissions !== 1 ? "s" : ""} remaining` : "All submissions evaluated"}
                            </span>
                          </div>

                          {/* Toggle */}
                          <div className="flex gap-2 mb-4 bg-slate-100 dark:bg-zinc-800/50 p-1 rounded-xl w-fit">
                            <button onClick={() => setMarksExamType("lesson")} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${marksExamType === "lesson" ? "bg-white dark:bg-zinc-700 shadow-sm text-slate-800 dark:text-zinc-100" : "text-slate-500 hover:text-slate-700"}`}>Lesson Exams</button>
                            <button onClick={() => setMarksExamType("standalone")} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${marksExamType === "standalone" ? "bg-white dark:bg-zinc-700 shadow-sm text-slate-800 dark:text-zinc-100" : "text-slate-500 hover:text-slate-700"}`}>Standalone Exams</button>
                            <button onClick={() => setMarksExamType("final")} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${marksExamType === "final" ? "bg-white dark:bg-zinc-700 shadow-sm text-slate-800 dark:text-zinc-100" : "text-slate-500 hover:text-slate-700"}`}>Final Exam</button>
                          </div>

                          <div className="mb-4">
                            {marksExamType === "lesson" ? (
                              <>
                                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5 block">Select Lesson</label>
                                <SelectDropdown
                                  value={marksLesson?.lessonId || selectedLesson?.lessonId || ""}
                                  onChange={v => { const val = v; if (val === "") { setMarksLesson(null); } else { const found = courseLessons.find((l: any) => String(l.lessonId) === val); setMarksLesson(found || null); } }}
                                  options={[{ value: "", label: "Select a lesson..." }, ...courseLessons.map((l: any) => ({ value: String(l.lessonId), label: l.title }))]}
                                  className="w-full max-w-xs text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                  ariaLabel="Select lesson for marks"
                                />
                              </>
                            ) : marksExamType === "standalone" ? (
                              <>
                                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5 block">Select Standalone Exam</label>
                                <SelectDropdown
                                  value={marksStandaloneExam?.id || (standaloneExams.length > 0 ? standaloneExams[0].id : "")}
                                  onChange={v => { const val = v; if (val === "") { setMarksStandaloneExam(null); } else { const found = standaloneExams.find((l: any) => String(l.id) === val); setMarksStandaloneExam(found || null); } }}
                                  options={[{ value: "", label: "Select an exam..." }, ...standaloneExams.map((l: any) => ({ value: String(l.id), label: l.title }))]}
                                  className="w-full max-w-xs text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                  ariaLabel="Select standalone exam"
                                />
                              </>
                            ) : (
                              <>
                                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5 block">Select Final Exam</label>
                                <SelectDropdown
                                  value={marksFinalExam?.id || (finalExams.length > 0 ? finalExams[0].id : "")}
                                  onChange={v => { const val = v; if (val === "") { setMarksFinalExam(null); } else { const found = finalExams.find((l: any) => String(l.id) === val); setMarksFinalExam(found || null); } }}
                                  options={[{ value: "", label: "Select an exam..." }, ...finalExams.map((l: any) => ({ value: String(l.id), label: l.title }))]}
                                  className="w-full max-w-xs text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                  ariaLabel="Select final exam"
                                />
                              </>
                            )}
                          </div>
                          {marksExamType === "lesson" && !selectedLesson && !marksLesson ? (
                            <p className="text-xs text-slate-400">Please select a lesson from the playlist to view student marks.</p>
                          ) : marksExamType === "standalone" && standaloneExams.length === 0 ? (
                            <p className="text-xs text-slate-400">No standalone exams found.</p>
                          ) : marksExamType === "final" && finalExams.length === 0 ? (
                            <p className="text-xs text-slate-400">No final exams found.</p>
                          ) : isMarksLoading ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-3"><Loader2 size={24} className="text-blue-500 animate-spin" /><span className="text-xs text-slate-400 font-medium animate-pulse">Loading marks...</span></div>
                          ) : studentMarks.length === 0 ? (
                            <p className="text-xs text-slate-400 py-4 text-center">No student test submissions found for this test.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-zinc-800/50">
                                  <tr>
                                    {["Student Name", "Email", "User ID", "Test Name", "Marks", "Actions"].map(h => <th key={h} className="py-2.5 px-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">{h}</th>)}
                                  </tr>
                                </thead>
                                <tbody>
                                  {studentMarks.map((sub: any) => (
                                    <tr key={sub.id} className="border-b border-slate-100 dark:border-zinc-800">
                                      <td className="py-3 px-4"><div className="text-sm font-bold text-slate-800 dark:text-zinc-100">{sub.user?.name}</div></td>
                                      <td className="py-3 px-4 text-sm text-slate-500 dark:text-zinc-400">{sub.user?.email}</td>
                                      <td className="py-3 px-4"><span className="px-2 py-1 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 rounded border border-purple-100 dark:border-purple-900/30 font-mono text-xs font-semibold tracking-wide">{sub.user?.userId}</span></td>
                                      <td className="py-3 px-4"><span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-full text-xs font-bold border border-emerald-100 dark:border-emerald-900/30 whitespace-nowrap">{sub.test?.title || "Unknown"}</span></td>
                                      <td className="py-3 px-4 text-right"><span className="text-base font-black text-blue-600 dark:text-blue-400">{sub.marksObtained}</span></td>
                                      <td className="py-3 px-4 text-right">
                                        <button onClick={() => handleViewSubmissionDetails(sub.id)} disabled={isReviewLoading === sub.id} className="ml-auto flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-950/30 dark:hover:bg-blue-900/50 transition border border-blue-100 dark:border-blue-900/40 disabled:opacity-50">
                                          {isReviewLoading === sub.id ? <Loader2 size={12} className="animate-spin" /> : null} View Details
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Activity Log Tab */}
                      {courseDetailsTab === "activity-log" && (
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 animate-fadeIn">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h4 className="font-bold text-slate-900 dark:text-zinc-50">Activity Log</h4>
                              <p className="text-xs text-slate-500">Audit trail for actions performed on this course.</p>
                            </div>
                            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full">
                              {activityLogMeta.totalItems} record{activityLogMeta.totalItems !== 1 ? "s" : ""}
                            </span>
                          </div>
                          {isActivityLogsLoading ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-3"><Loader2 size={24} className="text-blue-500 animate-spin" /><span className="text-xs text-slate-400 font-medium animate-pulse">Loading activity...</span></div>
                          ) : activityLogsError ? (
                            <p className="text-xs text-red-500">{activityLogsError}</p>
                          ) : courseActivityLogs.length === 0 ? (
                            <p className="text-xs text-slate-400 py-4 text-center">No activity recorded for this course yet.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-zinc-800/50">
                                  <tr>
                                    {["Date", "Admin", "Role", "Action", "Target", "Details"].map(h => <th key={h} className="py-2.5 px-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">{h}</th>)}
                                  </tr>
                                </thead>
                                <tbody>
                                  {courseActivityLogs.map((log: any) => (
                                    <tr key={log.id} className="border-b border-slate-100 dark:border-zinc-800 align-top">
                                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                                      <td className="py-3 px-4">
                                        <div className="flex flex-col gap-0.5">
                                          <span className="text-sm font-bold text-slate-800 dark:text-zinc-100">{log.actorName}</span>
                                          <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 rounded border border-purple-100 dark:border-purple-900/30 font-mono text-[10px] font-semibold tracking-wide w-fit">{log.actorId}</span>
                                        </div>
                                      </td>
                                      <td className="py-3 px-4"><span className={`px-2 py-1 rounded border text-sm font-semibold ${getRoleBadgeClasses(log.actorRole)}`}>{log.actorRole}</span></td>
                                      <td className="py-3 px-4"><span className={`px-2.5 py-1 rounded-full text-sm font-bold border whitespace-nowrap ${getActionBadgeClasses(log.action)}`}>{formatAction(log.action)}</span></td>
                                      <td className="py-3 px-4">
                                        <div className="flex flex-col gap-0.5">
                                          <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">{log.targetName || "—"}</span>
                                          <span className="text-[10px] text-slate-400 font-mono">{log.targetType ? `${log.targetType}${log.targetId ? ` · ${log.targetId}` : ""}` : ""}</span>
                                        </div>
                                      </td>
                                      <td className="py-3 px-4">
                                        <LogDetailsCell details={log.details} />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {courseActivityLogs.length > 0 && (
                            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-zinc-800 mt-4">
                              <span className="text-xs text-slate-500">
                                Page {activityLogMeta.currentPage} of {activityLogMeta.totalPages}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setActivityLogPage(Math.max(1, activityLogPage - 1))}
                                  disabled={activityLogPage <= 1}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                >
                                  <ChevronLeft size={14} /> Prev
                                </button>
                                <button
                                  onClick={() => setActivityLogPage(Math.min(activityLogMeta.totalPages, activityLogPage + 1))}
                                  disabled={activityLogPage >= activityLogMeta.totalPages}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                >
                                  Next <ChevronRight size={14} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Evaluation Tab */}
                      {courseDetailsTab === "evaluation" && (
                        <div>
                          <LessonEvaluationView
                            selectedLesson={selectedLesson ?? (courseLessons.length > 0 ? courseLessons[0] : null)}
                            courseId={course.courseId}
                            courseLessons={courseLessons}
                            enrolledCount={course.enrolled}
                          />
                        </div>
                      )}

                      {/* Certifications Tab */}
                      {courseDetailsTab === "certifications" && (
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 animate-fadeIn">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h4 className="font-bold text-slate-900 dark:text-zinc-50">Certifications</h4>
                              <p className="text-xs text-slate-500">Review certificate applications submitted by learners for this course.</p>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{courseCertificates.length} Application{courseCertificates.length !== 1 ? "s" : ""}</span>
                          </div>
                          {isCertificatesLoading ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-3"><Loader2 size={24} className="text-blue-500 animate-spin" /><span className="text-xs text-slate-400 font-medium animate-pulse">Loading applications...</span></div>
                          ) : certificatesError ? (
                            <p className="text-xs text-red-500">{certificatesError}</p>
                          ) : courseCertificates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
                              <Award size={38} className="text-slate-300" />
                              <p className="text-xs text-slate-400">No certificate applications yet. When a learner takes all the tests in this course, they can apply here.</p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-zinc-800/50">
                                  <tr>
                                    {["Student", "Student ID", "Applied On", "Status", "Action"].map(h => <th key={h} className="py-2.5 px-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">{h}</th>)}
                                  </tr>
                                </thead>
                                <tbody>
                                  {courseCertificates.map((cert: any) => (
                                    <tr key={cert.id} className="border-b border-slate-100 dark:border-zinc-800">
                                      <td className="py-3 px-4">
                                        <div className="flex flex-col gap-0.5">
                                          <span className="text-sm font-bold text-slate-800 dark:text-zinc-100">{cert.userName}</span>
                                          <span className="text-xs text-slate-500">{cert.applicant?.email || "—"}</span>
                                        </div>
                                      </td>
                                      <td className="py-3 px-4"><span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 rounded border border-purple-100 dark:border-purple-900/30 font-mono text-[10px] font-semibold tracking-wide w-fit">{cert.userId}</span></td>
                                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap">{new Date(cert.appliedAt || cert.createdAt).toLocaleString()}</td>
                                      <td className="py-3 px-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border capitalize ${
                                          cert.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40"
                                          : cert.status === "issued" ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/40"
                                          : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40"
                                        }`}>{cert.status}</span>
                                        {cert.status === "rejected" && cert.rejectionReason && (
                                          <div className="mt-1 text-[10px] text-rose-500 line-clamp-2 max-w-[220px]">Reason: {cert.rejectionReason}</div>
                                        )}
                                      </td>
                                      <td className="py-3 px-4">
                                        {cert.status === "pending" ? (
                                          <button type="button" onClick={() => openVerifyCertificate(cert.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm">
                                            <Eye size={13} /> Verify
                                          </button>
                                        ) : cert.status === "issued" ? (
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-mono text-slate-400">{cert.certificateId}</span>
                                            <a href={`${apiBase}${cert.certificateUrl}`} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-[11px] font-bold transition dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800">View PDF</a>
                                          </div>
                                        ) : (
                                          <span className="text-[10px] text-slate-400">—</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* RIGHT COLUMN - Playlist (30% width) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#121212] shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-50">Course Playlist</h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{courseLessons.length} Items</span>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto pr-1 select-none" style={{ maxHeight: "500px", scrollbarWidth: "thin" }}>
              {lessonsLoading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3"><Loader2 size={24} className="text-blue-500 animate-spin" /><span className="text-xs text-slate-400 font-medium animate-pulse">Loading playlist...</span></div>
              ) : courseLessons.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">No lessons available in this course.</div>
              ) : (
                courseLessons.map((l, index) => {
                  const isCur = selectedLesson?.lessonId === l.lessonId;
                  const isComp = isCompleted(l);
                  const isLocked = !isAdminOrEmployee && index > 0 && !isCompleted(courseLessons[index - 1]);
                  return (
                    <div key={l.lessonId} onClick={() => { if (!isLocked) { setLockedFromNavigation(null); setSelectedLesson(l); } }} className={`group flex items-start gap-3 rounded-xl p-2.5 text-left transition border ${isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${isCur ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-400" : "hover:bg-slate-50 border-transparent dark:hover:bg-zinc-800/40"}`}>
                      <div className="relative h-14 w-20 shrink-0 bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center text-white border border-slate-800">
                        {l.materialType === "Video" ? <Play size={16} className="text-blue-500 fill-blue-500/20 group-hover:scale-110 transition" /> : <FileText size={16} className="text-emerald-500" />}
                        <span className="absolute bottom-1 right-1 bg-black/80 text-[8px] font-mono px-1 rounded text-slate-400">{l.materialType}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 line-clamp-2 dark:text-zinc-100" title={l.title}>{l.title}</p>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">{l.lessonId}</p>
                        <div className="flex items-center gap-1.5 mt-1.5 justify-between">
                          {isAdminOrEmployee ? (
                            l.tests && l.tests.length > 0 ? (
                              <span className="flex items-center gap-0.5 text-[9px] text-amber-600 font-bold dark:text-amber-500"><Award size={10} /> Test Added</span>
                            ) : (
                              <span className="text-[9px] text-slate-400">No Test</span>
                            )
                          ) : isComp ? (
                            <span className="flex items-center gap-0.5 text-[9px] text-green-600 font-bold dark:text-green-400"><Check size={10} /> Completed</span>
                          ) : (
                            <span className="text-[9px] text-slate-400">Not Completed</span>
                          )}
                          {isAdminOrEmployee && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={async e => {
                                  e.stopPropagation();
                                  setTogglingPracticeLessonId(l.id);
                                  try {
                                    await updateLesson(course.courseId, l.lessonId, { practiceEnabled: !l.practiceEnabled });
                                    await loadCourseLessons(course.courseId);
                                    if (selectedLesson?.lessonId === l.lessonId) {
                                      setSelectedLesson(prev => prev ? { ...prev, practiceEnabled: !l.practiceEnabled } : null);
                                    }
                                    toast.success(l.practiceEnabled ? "Practice disabled" : "Practice enabled");
                                  } catch (err: any) {
                                    toast.error(err.message || "Failed to toggle practice.");
                                  } finally {
                                    setTogglingPracticeLessonId(null);
                                  }
                                }}
                                disabled={togglingPracticeLessonId === l.id}
                                className={`p-1.5 rounded transition ${
                                  l.practiceEnabled
                                    ? "text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                                    : "text-slate-400 hover:text-amber-600 dark:hover:text-amber-400"
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                title={l.practiceEnabled ? "Disable AI Test Practice" : "Enable AI Test Practice"}
                              >
                                {togglingPracticeLessonId === l.id ? (
                                  <Loader2 size={15} className="animate-spin" />
                                ) : (
                                  <Sparkles size={15} />
                                )}
                              </button>
                              <button onClick={e => { e.stopPropagation(); setEditingLesson(l); }} className="p-1.5 text-slate-450 hover:text-blue-600 transition rounded hover:bg-blue-50 dark:hover:bg-blue-950/20" title="Edit lesson details"><Pencil size={14} /></button>
                              <button onClick={e => { e.stopPropagation(); confirmSoftDeleteLesson(course.courseId, l.lessonId); }} className="p-1.5 text-slate-400 hover:text-rose-600 transition rounded hover:bg-rose-50 dark:hover:bg-rose-950/20" title="Move lesson to Recycle Bin"><Trash2 size={14} /></button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Standalone Exams Section */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-zinc-50">Standalone Exams</h4>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{standaloneExams.length} Items</span>
              </div>
              {standaloneExamsLoading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3"><Loader2 size={24} className="text-blue-500 animate-spin" /><span className="text-xs text-slate-400 font-medium animate-pulse">Loading exams...</span></div>
              ) : standaloneExams.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">No standalone exams for this course.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {standaloneExams.map((exam: any) => {
                    const isSelected = selectedStandaloneExam?.id === exam.id;
                    return (
                      <div key={exam.id} onClick={() => setSelectedStandaloneExam(exam)} className={`group flex items-start gap-3 rounded-xl p-2.5 text-left transition border cursor-pointer ${isSelected ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-400" : "hover:bg-slate-50 border-transparent dark:hover:bg-zinc-800/40"}`}>
                        <div className="relative h-14 w-20 shrink-0 bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center text-white border border-slate-800">
                          <Clock size={16} className="text-blue-500 fill-blue-500/20 group-hover:scale-110 transition" />
                          <span className="absolute bottom-1 right-1 bg-black/80 text-[8px] font-mono px-1 rounded text-slate-400">Exam</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 line-clamp-2 dark:text-zinc-100" title={exam.title}>{exam.title}</p>
                          <p className="text-[9px] text-slate-400 font-mono mt-0.5">{exam.questions?.length || 0} questions</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="flex items-center gap-0.5 text-[9px] text-amber-600 font-bold dark:text-amber-500"><Award size={10} /> Timed Exam</span>
                            {isAdminOrEmployee && (
                              <div className="flex items-center gap-1">
                                <button onClick={(e) => { e.stopPropagation(); setEvaluatingStandaloneExam(exam); }} className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg border border-blue-100 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 transition">
                                  Evaluate
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setDeleteStandaloneExamId(exam.id); }} className="p-1.5 text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 rounded-lg border border-rose-100 dark:border-rose-900/40 transition" title="Delete standalone exam">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                          {(exam.startTime || exam.endTime) && (
                            <div className="flex flex-col gap-0.5 mt-1 text-[9px] text-slate-500 font-medium">
                              {exam.startTime && <span>Starts: {new Date(exam.startTime).toLocaleString()}</span>}
                              {exam.endTime && <span>Ends: {new Date(exam.endTime).toLocaleString()}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Final Exam Section */}
            {(isAdminOrEmployee || finalExams.length > 0) && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-zinc-50 flex items-center gap-1.5">
                    <GraduationCap size={15} className="text-indigo-500" /> Final Exam
                  </h4>
                  {isAdminOrEmployee && <span className="text-[10px] font-bold text-slate-400 uppercase">{finalExams.length} Exam{finalExams.length !== 1 ? "s" : ""}</span>}
                </div>

                {finalExamsLoading ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2"><Loader2 size={20} className="text-indigo-500 animate-spin" /><span className="text-xs text-slate-400 animate-pulse">Loading final exams...</span></div>
                ) : finalExams.length === 0 ? (
                  isAdminOrEmployee ? (
                    <div className="text-center py-6 text-xs text-slate-400">No final exam created yet. Use TestBuilder → "Final Course Exam".</div>
                  ) : null
                ) : (
                  <div className="flex flex-col gap-2">
                    {finalExams.map((exam: any) => {
                      const allLessonsComplete = learnerProgress >= 100;
                      const studentSubmission = finalExamSubmissions[exam.id];
                      const isUnlocked = isAdminOrEmployee || allLessonsComplete;
                      const qCount = exam.questions?.length || 0;
                      const mcqCount = exam.questions?.filter((q: any) => q.type === "MCQ").length || 0;
                      const cqCount = exam.questions?.filter((q: any) => q.type === "CQ").length || 0;
                      const vidCount = exam.questions?.filter((q: any) => q.type === "Video").length || 0;

                      return (
                        <div key={exam.id} className={`rounded-xl border p-3 transition ${
                          isUnlocked
                            ? "bg-gradient-to-br from-indigo-50/60 to-purple-50/40 border-indigo-200 dark:from-indigo-950/20 dark:to-purple-950/10 dark:border-indigo-900/40"
                            : "bg-slate-50 border-slate-200 dark:bg-zinc-800/30 dark:border-zinc-700/50 opacity-75"
                        }`}>
                          <div className="flex items-start gap-2.5">
                            <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center border ${
                              isUnlocked
                                ? "bg-indigo-600 border-indigo-700 text-white"
                                : "bg-slate-200 dark:bg-zinc-700 border-slate-300 dark:border-zinc-600 text-slate-400"
                            }`}>
                              {isUnlocked ? <GraduationCap size={18} /> : <Lock size={16} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 line-clamp-2">{exam.title}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{qCount} questions ({mcqCount} MCQ · {cqCount} CQ · {vidCount} Video)</p>

                              {/* Admin actions */}
                              {isAdminOrEmployee && (
                                <div className="flex items-center gap-2 mt-2">
                                  <button
                                    onClick={() => setEvaluatingFinalExam(exam)}
                                    className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-lg border border-indigo-100 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800 transition"
                                  >
                                    Evaluate
                                  </button>
                                  <button
                                    onClick={() => setDeleteFinalExamId(exam.id)}
                                    className="p-1.5 text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 rounded-lg border border-rose-100 dark:border-rose-900/40 transition"
                                    title="Delete final exam"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}

                              {/* Student: locked */}
                              {!isAdminOrEmployee && !isUnlocked && (
                                <div className="mt-2">
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-zinc-400">
                                    <Lock size={10} /> Complete all lessons to unlock ({Math.round(learnerProgress)}% done)
                                  </div>
                                  <div className="mt-1.5 w-full h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-400 transition-all rounded-full" style={{ width: `${learnerProgress}%` }} />
                                  </div>
                                </div>
                              )}

                              {/* Student: submitted */}
                              {!isAdminOrEmployee && isUnlocked && studentSubmission && (
                                <div className="mt-2 flex items-center gap-1.5">
                                  <CheckCircle size={12} className="text-green-500" />
                                  <span className="text-[10px] font-bold text-green-600 dark:text-green-400">Submitted ✓</span>
                                  {studentSubmission.marksObtained !== undefined && (
                                    <span className="ml-1 text-[10px] text-slate-500 dark:text-zinc-400">Score: <strong className="text-slate-800 dark:text-zinc-100">{studentSubmission.marksObtained}</strong></span>
                                  )}
                                  {studentSubmission.status === "Pending Evaluation" ? (
                                    <span className="ml-1 px-2 py-0.5 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 text-[9px] font-bold rounded-lg bg-amber-50 dark:bg-amber-950/20">
                                      Pending
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => setSelectedFinalExam(exam)}
                                      className="ml-1 px-2 py-0.5 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-[9px] font-bold rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition"
                                    >
                                      Review Answers
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Student: take exam - only show when submissions have been loaded */}
                              {!isAdminOrEmployee && isUnlocked && !studentSubmission && finalExamSubmissionsLoaded && (
                                <button
                                  onClick={() => setSelectedFinalExam(exam)}
                                  className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg transition shadow-sm"
                                >
                                  <Play size={10} /> Take Final Exam
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lessons Loading Overlay */}
      {lessonsLoading && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="flex flex-col items-center gap-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-8 rounded-3xl shadow-2xl animate-scaleIn">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-bold text-slate-800 dark:text-zinc-200">Loading course syllabus...</p>
            <p className="text-xs text-slate-400">Preparing lessons & materials</p>
          </div>
        </div>
      )}

      {/* Edit Lesson Modal */}
      {editingLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-[#121212] animate-scaleIn">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-50">Edit Lesson</h3>
              <button onClick={() => setEditingLesson(null)} className="rounded-lg p-1 text-slate-450 hover:bg-slate-50 dark:hover:bg-zinc-800"><X size={16} /></button>
            </div>
            {editLessonError && <div className="mb-3 p-3 text-xs bg-red-50 text-red-600 rounded-xl dark:bg-red-950/20 dark:text-red-400">{editLessonError}</div>}
            <form onSubmit={handleEditLessonSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold text-slate-500">Lesson Title</label><input type="text" value={editLessonTitle} onChange={e => setEditLessonTitle(e.target.value)} required className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-800" /></div>
              <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold text-slate-500">Description</label><textarea value={editLessonDescription} onChange={e => setEditLessonDescription(e.target.value)} className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-800 min-h-[60px]" /></div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Material Source</label>
                <div className="flex bg-slate-50 p-1 rounded-xl w-fit border border-slate-200 dark:border-zinc-800">
                  <button type="button" onClick={() => setEditLessonInputMode("link")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${editLessonInputMode === "link" ? "bg-white shadow-sm dark:bg-zinc-700" : "text-slate-500"}`}>Link</button>
                  <button type="button" onClick={() => setEditLessonInputMode("file")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${editLessonInputMode === "file" ? "bg-white shadow-sm dark:bg-zinc-700" : "text-slate-500"}`}>Upload</button>
                </div>
              </div>
              {editLessonInputMode === "link" ? (
                <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold text-slate-500">Material Link</label><input type="text" value={editLessonLink} onChange={e => setEditLessonLink(e.target.value)} className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-800" /></div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500">Upload File</label>
                  <input type="file" accept="video/*,.pdf,.ppt,.pptx,.doc,.docx" onChange={handleEditLessonFileUpload} className="text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
                  {isUploadingEditFile && <span className="text-[10px] text-blue-500 animate-pulse">Uploading...</span>}
                  {editLessonLink && !isUploadingEditFile && <span className="text-[10px] text-green-600 truncate">Linked: {editLessonLink}</span>}
                </div>
              )}
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">Enable AI Test Practice</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    {editLessonType === "Video"
                      ? "Not available for video lessons."
                      : "Let learners generate AI practice tests from this lesson's material."}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={editLessonPracticeEnabled}
                  aria-disabled={editLessonType === "Video"}
                  disabled={editLessonType === "Video"}
                  onClick={() => setEditLessonPracticeEnabled(v => !v)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 ${
                    editLessonPracticeEnabled ? "bg-blue-600" : "bg-slate-300 dark:bg-zinc-700"
                  } ${editLessonType === "Video" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${editLessonPracticeEnabled ? "translate-x-[22px]" : "translate-x-0"}`} />
                </button>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                <button type="button" onClick={() => setEditingLesson(null)} className="rounded-xl border border-slate-200 bg-transparent px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800">Cancel</button>
                <button type="submit" disabled={isUpdatingLesson} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{isUpdatingLesson ? "Saving..." : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Learner: Course Info Modal */}
      {viewCourseModalOpen && !isAdminOrEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn" onClick={() => setViewCourseModalOpen(false)}>
          <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-[#121212] animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-zinc-800/80 shrink-0">
              <h3 className="pl-4 text-base font-bold text-slate-900 dark:text-zinc-50">Course Info</h3>
              <button onClick={() => setViewCourseModalOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-850 transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4 overflow-y-auto">
              {course.thumbnailUrl && (
                <div className="w-full aspect-video max-h-44 bg-slate-100 dark:bg-zinc-800 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-800 relative">
                  <img src={course.thumbnailUrl.startsWith("/") ? `${apiBase}${course.thumbnailUrl}` : course.thumbnailUrl} alt={course.name} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setFullscreenImage(`${apiBase}${course.thumbnailUrl!.startsWith("/") ? course.thumbnailUrl : "/" + course.thumbnailUrl}`)}
                    className="absolute bottom-2 left-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition"
                    title="View Fullscreen"
                  >
                    <Maximize2 size={14} />
                  </button>
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-50">{course.name}</h2>
                <p className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono mt-0.5">{course.courseId}</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 bg-slate-50 dark:bg-zinc-800/40 rounded-xl border border-slate-100 dark:border-zinc-850">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Chapters</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">{courseLessons.length}</span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-zinc-800/40 rounded-xl border border-slate-100 dark:border-zinc-850">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Learners</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">{course.enrolled}</span>
                </div>
              </div>
              {course.description ? (
                <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/20 dark:border-zinc-850 dark:bg-zinc-900/10">
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Course Description</h5>
                  <div className="max-h-32 overflow-y-auto text-xs text-slate-650 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap pr-1">{course.description}</div>
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/20 dark:border-zinc-850 dark:bg-zinc-900/10">
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Course Description</h5>
                  <p className="text-xs text-slate-400 italic">No description provided for this course yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Student Submission Review Modal */}
      {reviewStudentSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-4xl bg-white p-6 rounded-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 animate-scaleIn my-auto">
            <button onClick={() => setReviewStudentSubmission(null)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 transition mb-6 w-fit border border-blue-100 dark:border-blue-900/30">
              <ArrowLeft size={14} className="stroke-[3px]" /> Back to Submissions
            </button>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50">Reviewing Answers: {reviewStudentSubmission.user?.name}</h3>
              <div className="flex items-center gap-2">
                {isAdmin && !isEditingMarks && (
                  <button onClick={startEditMarks} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition">
                    <Pencil size={13} /> Edit Marks
                  </button>
                )}
                {isAdmin && isEditingMarks && (
                  <>
                    <button onClick={() => setIsEditingMarks(false)} disabled={isSavingMarks} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition dark:text-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-50">Cancel</button>
                    <button onClick={handleSaveMarks} disabled={isSavingMarks} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-700 transition disabled:opacity-50">
                      {isSavingMarks ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save Marks
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-6">Score obtained: <span className="font-bold text-blue-600">{reviewStudentSubmission.marksObtained}</span> points</p>
            <div className="flex flex-col gap-6">
              {(reviewStudentSubmission.answers || []).map((ans: any, idx: number) => {
                let rawProvided = ans.providedAnswer;
                if (typeof rawProvided === 'string') {
                  try { rawProvided = JSON.parse(rawProvided); } catch (e) {}
                }
                let rawCorrect = ans.question?.correctAnswers;
                if (typeof rawCorrect === 'string') {
                  try { rawCorrect = JSON.parse(rawCorrect); } catch (e) {}
                }

                const isCQ = ans.question?.type === "CQ" || ans.question?.type === "Video";
                const provided = Array.isArray(rawProvided) ? rawProvided : [rawProvided];
                const correct = Array.isArray(rawCorrect) ? rawCorrect : [rawCorrect];
                const isCorrect = !isCQ && provided.length === correct.length && provided.every((v: string) => correct.includes(v));

                let parsedFeedback: any = null;
                try { parsedFeedback = JSON.parse(ans.evaluatorComment); } catch (e) {}
                const hasAiFeedback = parsedFeedback && typeof parsedFeedback === 'object' && ('postureScore' in parsedFeedback);

                return (
                  <div key={ans.id || idx} className="p-5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-zinc-800/40 dark:border-zinc-700">
                    <h5 className="font-semibold text-slate-800 dark:text-zinc-100 mb-1">{idx + 1}. {ans.question?.questionText}</h5>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                      <span>Total Marks: {ans.question?.marks}</span>
                      {isEditingMarks && isCQ ? (
                        <div className="flex flex-col gap-2 items-end">
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] font-bold text-slate-500">Marks:</label>
                            <input
                              type="number"
                              min={0}
                              max={ans.question?.marks}
                              value={editedMarks[ans.id]?.marksAwarded ?? ""}
                              onChange={e => setEditedMarks(prev => ({ ...prev, [ans.id]: { marksAwarded: e.target.value, evaluatorComment: prev[ans.id]?.evaluatorComment ?? "" } }))}
                              className="w-20 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs font-bold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                            />
                            <span className="text-[11px] text-slate-400">/ {ans.question?.marks}</span>
                          </div>
                          <input
                            type="text"
                            placeholder="Evaluator comment..."
                            value={editedMarks[ans.id]?.evaluatorComment ?? ""}
                            onChange={e => setEditedMarks(prev => ({ ...prev, [ans.id]: { marksAwarded: prev[ans.id]?.marksAwarded ?? "", evaluatorComment: e.target.value } }))}
                            className="w-56 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          />
                        </div>
                      ) : (
                        <span className={`font-bold ${isCorrect || (isCQ && ans.marksAwarded > 0) ? "text-green-600" : (isCQ && reviewStudentSubmission.status === "Pending Evaluation" ? "text-amber-500" : "text-rose-600")}`}>
                          Marks Awarded: {isCQ && reviewStudentSubmission.status === "Pending Evaluation" ? "Pending" : (ans.marksAwarded ?? 0)}
                        </span>
                      )}
                    </div>
                    {!isCQ && ans.question?.options ? (
                      <div className="flex flex-col gap-2">
                        {ans.question.options.map((opt: string, oIdx: number) => {
                          const optionKey = `option_${oIdx}`;
                          const wasSelected = provided.includes(opt) || provided.includes(optionKey);
                          const isOptCorrect = correct.includes(opt) || correct.includes(optionKey);
                          
                          let cls = "border-slate-200 bg-white dark:bg-zinc-900";
                          if (wasSelected && isOptCorrect) cls = "border-green-500 bg-green-50 dark:bg-green-950/20";
                          else if (wasSelected && !isOptCorrect) cls = "border-rose-500 bg-rose-50 dark:bg-rose-950/20";
                          else if (!wasSelected && isOptCorrect) cls = "border-green-500 border-dashed bg-green-50/50 dark:bg-green-950/10";
                          
                          return (
                            <div key={oIdx} className={`p-3 rounded-lg border ${cls} text-sm flex justify-between items-center transition-colors`}>
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
                        {ans.question?.type === "Video" || (provided.length > 0 && typeof provided[0] === 'string' && provided[0].startsWith('http') && (provided[0].includes('.mp4') || provided[0].includes('.webm') || provided[0].includes('cloudinary') || provided[0].includes('video'))) ? (
                          <div className="p-4 rounded-xl border border-slate-200 bg-white dark:bg-zinc-900 flex flex-col md:flex-row gap-6 items-stretch">
                            <div className="shrink-0 flex flex-col gap-1 w-full md:w-auto">
                              <span className="text-slate-500 text-xs font-bold">Student Video Answer:</span>
                              <video 
                                src={(() => {
                                  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
                                  const url = provided.length > 0 ? provided[0] : "";
                                  return url.startsWith("http") ? url : `${base}${url}`;
                                })()} 
                                controls 
                                className="w-full md:max-w-[320px] rounded-lg border border-slate-200 dark:border-zinc-700 bg-black" 
                              />
                            </div>
                            
                            <div className="flex-1 flex flex-col gap-2 justify-center min-w-0 w-full">
                              {hasAiFeedback ? (
                                <>
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                                      {ans.evaluatedBy === 'AI' ? 'AI Evaluation Details:' : 'Evaluation Details:'}
                                    </p>
                                    <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                                      {ans.evaluatedBy === 'AI' ? 'Reviewed by AI' : 'Reviewed by Invigilator'}
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-2 w-full">
                                    <div className="p-3 bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800 rounded-xl flex items-start gap-4">
                                      <div className="w-28 shrink-0">
                                        <span className="text-[11px] font-bold text-slate-800 dark:text-zinc-200">Posture & Dress</span>
                                        <span className="text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full block w-fit mt-1">Score: {parsedFeedback.postureScore}</span>
                                      </div>
                                      <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed flex-1 break-words">{parsedFeedback.postureFeedback}</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800 rounded-xl flex items-start gap-4">
                                      <div className="w-28 shrink-0">
                                        <span className="text-[11px] font-bold text-slate-800 dark:text-zinc-200">Voice & Clarity</span>
                                        <span className="text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full block w-fit mt-1">Score: {parsedFeedback.attitudeScore}</span>
                                      </div>
                                      <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed flex-1 break-words">{parsedFeedback.attitudeFeedback}</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800 rounded-xl flex items-start gap-4">
                                      <div className="w-28 shrink-0">
                                        <span className="text-[11px] font-bold text-slate-800 dark:text-zinc-200">Script Accuracy</span>
                                        <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full block w-fit mt-1">Score: {parsedFeedback.accuracyScore}</span>
                                      </div>
                                      <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed flex-1 break-words">{parsedFeedback.accuracyFeedback}</p>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 text-sm w-full">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-blue-600 text-xs font-bold">Evaluator Comment:</p>
                                    <span className="text-[10px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                                      Reviewed by Invigilator
                                    </span>
                                  </div>
                                  <p className="text-blue-800 dark:text-blue-300">{ans.evaluatorComment || "No feedback comments provided yet."}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="p-4 rounded-xl border border-slate-200 bg-white dark:bg-zinc-900 text-sm">
                              <p className="text-slate-500 text-xs font-bold mb-1">Student's Answer:</p>
                              {provided.length > 0 && typeof provided[0] === 'string' && provided[0].startsWith('http') ? (
                                provided[0].match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                                  <img src={provided[0]} alt="Student answer" className="max-w-full h-auto mt-1 rounded-xl border border-slate-200 dark:border-zinc-800" />
                                ) : (
                                  <a href={provided[0]} target="_blank" rel="noreferrer" className="text-blue-500 underline font-semibold break-all inline-block mt-1">View Attachment</a>
                                )
                              ) : (
                                <p className="text-slate-700 dark:text-zinc-300 whitespace-pre-wrap">{provided.join(", ") || "No answer provided."}</p>
                              )}
                            </div>
                            
                            {correct.length > 0 && correct[0] && (
                              <div className="p-4 rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/10 dark:border-green-900/30 text-sm">
                                <p className="text-green-700 dark:text-green-500 text-xs font-bold mb-1">Correct Answer:</p>
                                <p className="text-green-800 dark:text-green-300 whitespace-pre-wrap">{correct.join(", ")}</p>
                              </div>
                            )}

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
                                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 text-sm mt-2">
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
        </div>
      )}

      {fullscreenImage && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setFullscreenImage(null)}>
          <img src={fullscreenImage} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      <ConfirmModal
        isOpen={confirmState.open}
        title={confirmState.title}
        message={confirmState.description}
        confirmText={confirmState.confirmLabel}
        isLoading={isConfirming}
        onConfirm={async () => {
          setIsConfirming(true);
          try {
            await confirmState.onConfirm();
          } catch (err: any) {
            toast.error(err?.message || "Operation failed.");
          } finally {
            setIsConfirming(false);
            setConfirmState(s => ({ ...s, open: false }));
          }
        }}
        onCancel={() => setConfirmState(s => ({ ...s, open: false }))}
      />

      {/* Delete Standalone Exam Confirmation */}
      <ConfirmModal
        isOpen={deleteStandaloneExamId !== null}
        title="Delete Standalone Exam"
        message="Are you sure you want to delete this standalone exam? This action cannot be undone. All associated questions and student submissions will be permanently removed."
        confirmText="Delete Exam"
        onConfirm={async () => {
          if (deleteStandaloneExamId !== null) {
            await handleDeleteTest(deleteStandaloneExamId, 'standalone');
            setDeleteStandaloneExamId(null);
          }
        }}
        onCancel={() => setDeleteStandaloneExamId(null)}
      />

      {/* Delete Final Exam Confirmation */}
      <ConfirmModal
        isOpen={deleteFinalExamId !== null}
        title="Delete Final Exam"
        message="Are you sure you want to delete this final exam? This action cannot be undone. All associated questions and student submissions will be permanently removed."
        confirmText="Delete Exam"
        onConfirm={async () => {
          if (deleteFinalExamId !== null) {
            await handleDeleteTest(deleteFinalExamId, 'final');
            setDeleteFinalExamId(null);
          }
        }}
        onCancel={() => setDeleteFinalExamId(null)}
      />

      {/* Standalone Exam Evaluation Modal */}
      {evaluatingStandaloneExam && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-6xl flex flex-col h-[90vh] overflow-hidden">
             <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-900">
                <h2 className="font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                  <Award size={18} className="text-amber-500" /> Evaluate Standalone Exam
                </h2>
                <button onClick={() => setEvaluatingStandaloneExam(null)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-800 transition text-slate-500">
                  <X size={18} />
                </button>
             </div>
             <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30 dark:bg-[#121212]">
               <LessonEvaluationView 
                  courseId={course.courseId} 
                  standaloneExam={evaluatingStandaloneExam}
                  onClearStandalone={() => setEvaluatingStandaloneExam(null)}
               />
             </div>
          </div>
        </div>
      )}

      {/* Final Exam Player Modal (Student) */}
      {selectedFinalExam && !isAdminOrEmployee && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-5xl flex flex-col h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-indigo-50 dark:bg-zinc-900">
              <h2 className="font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                <GraduationCap size={18} className="text-indigo-600" /> Final Exam: {selectedFinalExam.title}
              </h2>
              <button onClick={() => setSelectedFinalExam(null)} className="p-2 rounded-full hover:bg-indigo-100 dark:hover:bg-zinc-800 transition text-slate-500">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 bg-slate-50/30 dark:bg-[#121212]">
              <TestPlayer
                externalTest={selectedFinalExam}
                isAdmin={false}
                onSuccess={async () => {
                  // Refresh submission status without closing the modal
                  try {
                    const res = await api.get(`/tests/${selectedFinalExam.id}/my-submission`);
                    setFinalExamSubmissions(prev => ({ ...prev, [selectedFinalExam.id]: res.data || null }));
                  } catch {}
                }}
                onCancel={() => setSelectedFinalExam(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Manage Categories Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn" onClick={() => !isAddingCategory && setShowAddCategoryModal(false)}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-zinc-800/80">
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-50">Manage Categories</h3>
              <button
                onClick={() => setShowAddCategoryModal(false)}
                disabled={isAddingCategory}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-850 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New Category Name..."
                  className="flex-1 rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-800"
                />
                <button
                  onClick={submitNewCategory}
                  disabled={!newCategoryName.trim() || isAddingCategory}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isAddingCategory ? <Loader2 size={16} className="animate-spin" /> : null}
                  Add
                </button>
              </div>

              <div className="max-h-[300px] overflow-y-auto pr-1 flex flex-col gap-2 mt-2">
                {categoriesList.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No categories found.</p>
                ) : (
                  categoriesList.map(cat => (
                    <div key={cat.categoryId} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-zinc-800/60 bg-slate-50 dark:bg-zinc-800/40">
                      <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">{cat.categoryName}</span>

                      {confirmDeleteCategoryId === cat.categoryId ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => deleteCategory(cat.categoryId)}
                            disabled={isDeletingCategoryId === cat.categoryId}
                            className="flex items-center gap-1 text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50 transition"
                          >
                            {isDeletingCategoryId === cat.categoryId ? <Loader2 size={12} className="animate-spin" /> : null}
                            Confirm Delete
                          </button>
                          <button
                            onClick={() => setConfirmDeleteCategoryId(null)}
                            className="text-xs bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 px-2 py-1 rounded hover:bg-slate-300 dark:hover:bg-zinc-600 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteCategoryId(cat.categoryId)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded-md transition-colors"
                          title="Delete Category"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Final Exam Evaluation Modal (Admin) */}
      {evaluatingFinalExam && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-6xl flex flex-col h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-indigo-50 dark:bg-zinc-900">
              <h2 className="font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                <GraduationCap size={18} className="text-indigo-500" /> Evaluate Final Exam
              </h2>
              <button onClick={() => setEvaluatingFinalExam(null)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-800 transition text-slate-500">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30 dark:bg-[#121212]">
              <LessonEvaluationView
                courseId={course.courseId}
                standaloneExam={evaluatingFinalExam}
                onClearStandalone={() => setEvaluatingFinalExam(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Certificate Verify Modal (Admin) */}
      {verifyCertificate && isAdminOrEmployee && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn" onClick={() => { if (!isGeneratingCert && !isRejectingCert) setVerifyCertificate(null); }}>
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-[#121212] animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-zinc-800/80 shrink-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2"><Award size={18} className="text-amber-500" /> Verify Certificate Application</h3>
              <button onClick={() => { if (!isGeneratingCert && !isRejectingCert) setVerifyCertificate(null); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"><X size={18} /></button>
            </div>
            <div className="p-5 flex flex-col gap-4 overflow-y-auto">
              {isVerifyLoading ? (
                <div className="flex flex-col items-center justify-center py-14 gap-3">
                  <Loader2 size={26} className="text-blue-500 animate-spin" />
                  <span className="text-xs text-slate-400 font-medium animate-pulse">Loading application details...</span>
                </div>
              ) : verifyError ? (
                <p className="text-xs text-red-500 text-center py-10">{verifyError}</p>
              ) : verifyCertificate ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 dark:border-zinc-800 dark:bg-zinc-900/30">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Student</h5>
                      <div className="flex items-center gap-3">
                        {verifyCertificate.applicant?.profilePictureUrl && (
                          <img src={verifyCertificate.applicant.profilePictureUrl.startsWith("/") ? `${apiBase}${verifyCertificate.applicant.profilePictureUrl}` : verifyCertificate.applicant.profilePictureUrl} alt="" className="h-10 w-10 rounded-full object-cover border border-slate-200 dark:border-zinc-700" />
                        )}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-slate-900 dark:text-zinc-100">{verifyCertificate.applicant?.name || verifyCertificate.certificate.userName}</span>
                          <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 rounded border border-purple-100 dark:border-purple-900/30 font-mono text-[10px] font-semibold tracking-wide w-fit">{verifyCertificate.certificate.userId}</span>
                          <span className="text-xs text-slate-500">{verifyCertificate.applicant?.email || ""}</span>
                        </div>
                      </div>
                      {verifyCertificate.applicant?.phoneNumber && <p className="text-xs text-slate-500 mt-2">📞 {verifyCertificate.applicant.phoneNumber}</p>}
                    </div>
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 dark:border-zinc-800 dark:bg-zinc-900/30">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Course</h5>
                      <span className="text-sm font-bold text-slate-900 dark:text-zinc-100">{verifyCertificate.certificate.courseName}</span>
                      <span className="block text-[11px] text-slate-500 font-mono mt-0.5">{verifyCertificate.certificate.courseId}</span>
                      {verifyCertificate.course?.category?.name && <span className="text-xs text-slate-500 mt-1 block">Category: {verifyCertificate.course.category.name}</span>}
                    </div>
                  </div>

                  <div>
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Test Performance</h5>
                    {verifyCertificate.tests.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 text-center">No tests found for this course.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 dark:bg-zinc-800/50">
                            <tr>
                              {["Test", "Type", "Marks", "Status", "Submitted"].map(h => <th key={h} className="py-2.5 px-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {verifyCertificate.tests.map((t: any) => (
                              <tr key={t.testId} className="border-b border-slate-100 dark:border-zinc-800">
                                <td className="py-3 px-4">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-100">{t.title}</span>
                                    {t.lessonTitle && <span className="text-[10px] text-slate-400">{t.lessonTitle}</span>}
                                  </div>
                                </td>
                                <td className="py-3 px-4"><span className="text-[11px] font-mono text-slate-500">{t.testType}</span></td>
                                <td className="py-3 px-4">
                                  {t.submission?.submitted ? (
                                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-100">{t.submission.marksObtained ?? 0}<span className="text-slate-400 font-normal"> / {t.totalMarks}</span></span>
                                  ) : (
                                    <span className="text-xs text-rose-500 font-bold">Not taken</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${
                                    t.submission?.submitted && t.submission.status === "Evaluated"
                                      ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/40"
                                      : t.submission?.submitted
                                      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40"
                                      : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                                  }`}>{t.submission?.submitted ? t.submission.status : "Not taken"}</span>
                                </td>
                                <td className="py-3 px-4 text-[11px] text-slate-500 dark:text-zinc-400 whitespace-nowrap">{t.submission?.submittedAt ? new Date(t.submission.submittedAt).toLocaleString() : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {showRejectInput && (
                    <div className="flex flex-col gap-2 p-4 rounded-xl border border-rose-200 bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-950/10 animate-fadeIn">
                      <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Rejection Reason (required)</span>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Explain why this application is not valid..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 min-h-[70px]"
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button type="button" onClick={() => { setShowRejectInput(false); setRejectReason(""); }} className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800">Cancel</button>
                        <button type="button" onClick={handleRejectCertificate} disabled={isRejectingCert} className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold">
                          {isRejectingCert ? "Rejecting..." : "Confirm Reject"}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 justify-end pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                    {!showRejectInput && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowRejectInput(true)}
                          disabled={isGeneratingCert || isRejectingCert}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/20 transition"
                        >
                          <X size={13} /> Reject
                        </button>
                        <button
                          type="button"
                          onClick={handleGenerateCertificate}
                          disabled={isGeneratingCert || isRejectingCert}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-sm"
                        >
                          {isGeneratingCert ? <><Loader2 size={13} className="animate-spin" /> Generating...</> : <><Award size={13} /> Generate Certificate</>}
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
