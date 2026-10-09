"use client";

import { useState, useEffect, Suspense, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useUser } from "@/hooks/useUser";
import { useTheme } from "@/context/ThemeContext";
import { ConfirmModal } from "@/components/ConfirmModal";
import { SelectDropdown } from "@/components/SelectDropdown";
import { useCourses, Course, Lesson, UserProfile } from "@/hooks/useCourses";
import { api } from "@/libs/api";
import {
  Users as UsersIcon, BookOpen, Briefcase, TrendingUp,
  AlertTriangle, Activity, Trophy, PlusCircle, CheckCircle,
  Play, FileText, ExternalLink, ShieldAlert, Award, Search,
  Check, BookOpenCheck, Settings, ArrowLeft, MonitorPlay, Sparkles, Filter,
  Maximize2, LayoutGrid, List, Trash2, Eye, EyeOff, RotateCcw, Loader2, ChevronLeft, ChevronRight, Clock,
  Pencil, X
} from "lucide-react";
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { TestBuilder } from "@/components/TestBuilder";
import { EvaluationsDashboard } from "@/components/EvaluationsDashboard";
import { TestPlayer } from "@/components/TestPlayer";
import { LessonEvaluationView } from "@/components/LessonEvaluationView";
import { ExamGroupManager } from "@/components/ExamGroupManager";
import { ExamGroupCard } from "@/components/ExamGroupCard";
import { toast } from "react-hot-toast";

// Generates a unique color for any index using HSL
function getColor(i: number): string {
  const colors = [
    "#3b82f6", // Blue
    "#8b5cf6", // Purple
    "#10b981", // Emerald
    "#f59e0b", // Amber
    "#f43f5e", // Rose
    "#06b6d4", // Cyan
    "#d946ef", // Magenta
    "#84cc16", // Lime
    "#ec4899", // Pink
    "#14b8a6"  // Teal
  ];
  return colors[i % colors.length];
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="relative flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500/20 border-t-blue-600" />
        <Sparkles className="absolute h-5 w-5 text-blue-500 animate-pulse" />
      </div>
      <p className="text-sm font-medium text-slate-500 dark:text-zinc-400 animate-pulse">Loading training ecosystem...</p>
    </div>
  );
}

function getEmbedLink(url: string): string {
  if (!url) return "";
  try {
    // Check YouTube watch link
    if (url.includes("youtube.com/watch")) {
      const urlObj = new URL(url);
      const v = urlObj.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    // Check YouTube short link
    if (url.includes("youtu.be/")) {
      const parts = url.split("/");
      const id = parts[parts.length - 1]?.split("?")[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch (e) {
    console.error("Invalid URL in getEmbedLink", e);
  }
  return url;
}

function detectMaterialType(link: string): "Video" | "PDF" | "PPT" | "DOCX" {
  if (!link) return "Video";
  const normalized = link.toLowerCase().split('?')[0];
  if (
    normalized.includes("youtube.com") ||
    normalized.includes("youtu.be") ||
    normalized.endsWith(".mp4") ||
    normalized.endsWith(".mov") ||
    normalized.endsWith(".avi") ||
    normalized.endsWith(".webm") ||
    normalized.endsWith(".ogg")
  ) {
    return "Video";
  }
  if (normalized.endsWith(".pdf")) {
    return "PDF";
  }
  if (normalized.endsWith(".ppt") || normalized.endsWith(".pptx")) {
    return "PPT";
  }
  if (normalized.endsWith(".doc") || normalized.endsWith(".docx")) {
    return "DOCX";
  }
  return "Video";
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
          <a
            href={url}
            download
            className="mt-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2"
          >
            Download Document instead
          </a>
        </div>
      ) : (
        <div ref={containerRef} className="w-full docx-render-container" />
      )}
    </div>
  );
}

function TrashCountdown({ deletedAt }: { deletedAt: string }) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    const calculateSeconds = () => {
      if (!deletedAt) return 0;
      const deletedTime = new Date(deletedAt).getTime();
      const purgeTime = deletedTime + 60 * 1000; // 1 minute (60 seconds)
      const diff = Math.floor((purgeTime - Date.now()) / 1000);
      return Math.max(0, diff);
    };

    setSecondsLeft(calculateSeconds());

    const timer = setInterval(() => {
      const remaining = calculateSeconds();
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [deletedAt]);

  if (!deletedAt) return <span className="text-[11px] text-slate-400 font-mono">—</span>;

  const dateObj = new Date(deletedAt);
  const formattedDate = dateObj.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex flex-col gap-0.5 text-left">
      <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
        {formattedDate}
      </span>
      {secondsLeft > 0 ? (
        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 animate-pulse">
          <Clock size={10} /> Purges in {secondsLeft}s
        </span>
      ) : (
        <span className="text-[10px] text-rose-500 font-bold">
          Purging now...
        </span>
      )}
    </div>
  );
}

function DashboardPageContent() {
  const { name, role, email, userId } = useUser();
  const playerRef = useRef<HTMLDivElement>(null);
  const standalonePlayerRef = useRef<HTMLDivElement>(null);

  const toggleFullScreen = () => {
    if (playerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        playerRef.current.requestFullscreen().catch((err) => {
          console.error("Error entering fullscreen mode:", err);
        });
      }
    }
  };
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const router = useRouter();
  const defaultTab = role === "admin" || role === "employee" ? "overview" : "progress";
  const currentTab = searchParams.get("tab") || defaultTab;
  const resetTrigger = searchParams.get("_r");
  const dark = theme === "dark";

  const isAdminOrEmployee = role === "admin" || role === "employee";
  const isAdmin = role === "admin";

  // Dashboard Stats Hook (Admin/Employee Stats)
  const {
    stats, monthly, courseComparison, categories,
    materials, atRisk, recentActivity, userPerformance,
    isLoading: isStatsLoading, error: statsError, fetchUserPerformance, fetchCategories, fetchAtRisk,
    isFetchingLeaderboard, isFetchingCategories, isFetchingAtRisk
  } = useDashboardStats();

  // Course hook (Used by both admin & learners)
  const {
    courses: allCourses,
    isLoading: isCoursesLoading,
    fetchCourses,
    fetchMyLearning,
    enrollInCourse,
    completeLesson,
    createCourse,
    addLesson,
    searchUsers,
    updateUserRole,
    fetchCoursesPaginated,
    fetchUsersPaginated,
    softDeleteCourse,
    softDeleteLesson,
    fetchTrash,
    restoreCourse,
    restoreLesson,
    hardDeleteCourse,
    hardDeleteLesson,
    emptyTrash,
    createEmployee,
    updateCourse,
    updateLesson,
  } = useCourses();

  // Learner/User State
  const [learnerProgress, setLearnerProgress] = useState<Record<string, number>>({});
  const [completedLessonsMap, setCompletedLessonsMap] = useState<Record<string, string[]>>({}); // courseId -> lessonIds[]
  
  // Certificates (learner)
  const [myCertificates, setMyCertificates] = useState<any[]>([]);
  const [isCertificatesLoading, setIsCertificatesLoading] = useState(false);

  // Selected course management page simulation
  // NOTE: We intentionally do NOT rehydrate from sessionStorage on hard refresh.
  // sessionStorage is only written to persist state across same-session soft navigations,
  // but a Ctrl+R should always start at the course list, never deep inside a course.
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const prevUserIdRef = useRef<string | undefined>(userId);

  useEffect(() => {
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
      setSelectedCourse(null);
      setSelectedLesson(null);
      setCourseDetailsTab("player");
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("trainxcel_selected_course");
        sessionStorage.removeItem("trainxcel_selected_lesson");
        sessionStorage.removeItem("trainxcel_course_details_tab");
      }
    }
    prevUserIdRef.current = userId;
  }, [userId]);
  useEffect(() => {
    if (selectedCourse) {
      sessionStorage.setItem("trainxcel_selected_course", JSON.stringify(selectedCourse));
    } else {
      sessionStorage.removeItem("trainxcel_selected_course");
    }
  }, [selectedCourse]);

  useEffect(() => {
    if (selectedLesson) {
      sessionStorage.setItem("trainxcel_selected_lesson", JSON.stringify(selectedLesson));
    } else {
      sessionStorage.removeItem("trainxcel_selected_lesson");
    }
  }, [selectedLesson]);

  const [courseLessons, setCourseLessons] = useState<Lesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [showTestPlayer, setShowTestPlayer] = useState(false);
  const [hasTests, setHasTests] = useState(false);
  const [standaloneExams, setStandaloneExams] = useState<any[]>([]);
  const [standaloneExamsLoading, setStandaloneExamsLoading] = useState(false);
  const [selectedStandaloneExam, setSelectedStandaloneExam] = useState<any | null>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<Course[]>([]);
  const [isNextLessonTransition, setIsNextLessonTransition] = useState(false);

  // Fetch whether a lesson has tests
  useEffect(() => {
    const checkTests = async () => {
      if (selectedLesson) {
        try {
          const res = await api.get(`/tests/lesson/${selectedLesson.id}`);
          setHasTests(res.data && res.data.length > 0);
        } catch (err) {
          console.error("Failed to check tests for lesson:", err);
          setHasTests(false);
        }
      } else {
        setHasTests(false);
      }
    };
    checkTests();
  }, [selectedLesson]);

  // Fetch standalone exams for selected course
  useEffect(() => {
    const fetchStandaloneExams = async () => {
      if (!selectedCourse?.courseId) {
        setStandaloneExams([]);
        return;
      }
      setStandaloneExamsLoading(true);
      try {
        const res = await api.get(`/tests/standalone/${selectedCourse.courseId}`);
        setStandaloneExams(res.data || []);
      } catch (err) {
        console.error("Failed to fetch standalone exams:", err);
        setStandaloneExams([]);
      } finally {
        setStandaloneExamsLoading(false);
      }
    };
    fetchStandaloneExams();
    setSelectedStandaloneExam(null);
  }, [selectedCourse?.courseId]);

  useEffect(() => {
    if (selectedStandaloneExam && standalonePlayerRef.current) {
      standalonePlayerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedStandaloneExam]);

  
  // Tab within the simulated Course Details page

  const [courseDetailsTab, setCourseDetailsTab] = useState<"player" | "add-lesson" | "add-test" | "student-marks" | "settings" | "evaluation" | "all-tests" | "leaderboard">("player");
  const [courseSourceTab, setCourseSourceTab] = useState<string | null>(null);

  const [catalogSearch, setCatalogSearch] = useState("");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<number | null>(null);
  
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userList, setUserList] = useState<UserProfile[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);

  // Paginated user and course list states
  const [courseViewMode, setCourseViewMode] = useState<"card" | "list">("card");
  const [isCreateCourseModalOpen, setIsCreateCourseModalOpen] = useState(false);
  const [isManageCategoriesModalOpen, setIsManageCategoriesModalOpen] = useState(false);
  const [viewCourseModalCourse, setViewCourseModalCourse] = useState<any | null>(null);
  const [modalCourseDetails, setModalCourseDetails] = useState<any | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [viewUserModalUser, setViewUserModalUser] = useState<any | null>(null);
  const [newCategoryNameInput, setNewCategoryNameInput] = useState("");
  const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] = useState<number | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isDeletingCategoryId, setIsDeletingCategoryId] = useState<number | null>(null);
  const [reviewStudentSubmission, setReviewStudentSubmission] = useState<any | null>(null);
  const [isReviewLoading, setIsReviewLoading] = useState<number | null>(null);
  const [deletedLessonDetails, setDeletedLessonDetails] = useState<any | null>(null);
  const [showEmployeePassword, setShowEmployeePassword] = useState(false);

  // Edit course state
  const [editCourseName, setEditCourseName] = useState("");
  const [editCourseCategoryId, setEditCourseCategoryId] = useState<number | null>(null);
  const [editCourseDescription, setEditCourseDescription] = useState("");
  const [editCourseThumbnail, setEditCourseThumbnail] = useState<File | null>(null);
  const [isUpdatingCourse, setIsUpdatingCourse] = useState(false);
  const [editCourseFormError, setEditCourseFormError] = useState("");
  const [editCourseFormSuccess, setEditCourseFormSuccess] = useState("");
  const [showCourseSettingsEdit, setShowCourseSettingsEdit] = useState(false);

  useEffect(() => {
    setShowCourseSettingsEdit(false);
  }, [courseDetailsTab]);

  useEffect(() => {
    if (selectedCourse) {
      setEditCourseName(selectedCourse.name);
      setEditCourseCategoryId(selectedCourse.categoryId || null);
      setEditCourseDescription(selectedCourse.description || "");
      setEditCourseFormError("");
      setEditCourseFormSuccess("");
    }
  }, [selectedCourse]);

  const [adminLeaderboardLessonId, setAdminLeaderboardLessonId] = useState<string>("");
  const [adminLeaderboardData, setAdminLeaderboardData] = useState<any[]>([]);
  const [isAdminLeaderboardLoading, setIsAdminLeaderboardLoading] = useState(false);
  const [showAddTestForm, setShowAddTestForm] = useState(false);

  useEffect(() => {
    setShowAddTestForm(false);
  }, [courseDetailsTab]);

  const fetchAdminLeaderboard = useCallback(async (lessonId: string) => {
    if (!lessonId) return;
    setIsAdminLeaderboardLoading(true);
    try {
      const res = await api.get(`/tests/leaderboard/${lessonId}`);
      setAdminLeaderboardData(res.data || []);
    } catch (err) {
      console.error("Failed to fetch admin leaderboard", err);
      setAdminLeaderboardData([]);
    } finally {
      setIsAdminLeaderboardLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminLeaderboardLessonId) {
      fetchAdminLeaderboard(adminLeaderboardLessonId);
    }
  }, [adminLeaderboardLessonId, fetchAdminLeaderboard]);

  useEffect(() => {
    if (courseLessons.length > 0 && !adminLeaderboardLessonId) {
      setAdminLeaderboardLessonId(String(courseLessons[0].id));
    }
  }, [courseLessons, adminLeaderboardLessonId]);

  // Edit lesson state
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editLessonTitle, setEditLessonTitle] = useState("");
  const [editLessonDescription, setEditLessonDescription] = useState("");
  const [editLessonLink, setEditLessonLink] = useState("");
  const [editLessonType, setEditLessonType] = useState<"Video" | "PDF" | "PPT" | "DOCX">("Video");
  const [editLessonInputMode, setEditLessonInputMode] = useState<"link" | "file">("link");
  const [isUpdatingLesson, setIsUpdatingLesson] = useState(false);
  const [isUploadingEditFile, setIsUploadingEditFile] = useState(false);
  const [editLessonError, setEditLessonError] = useState("");

  useEffect(() => {
    if (editingLesson) {
      setEditLessonTitle(editingLesson.title);
      setEditLessonDescription(editingLesson.description || "");
      setEditLessonLink(editingLesson.materialLink);
      setEditLessonType(editingLesson.materialType as any);
      setEditLessonInputMode("link");
      setEditLessonError("");
    }
  }, [editingLesson]);

  // Course catalog pagination state
  const [catalogIsLoading, setCatalogIsLoading] = useState(false);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogTotalPages, setCatalogTotalPages] = useState(1);
  const [catalogTotalItems, setCatalogTotalItems] = useState(0);
  const [catalogCourses, setCatalogCourses] = useState<Course[]>([]);

  const [courseFilterCategoryId, setCourseFilterCategoryId] = useState<number | null>(null);
  const [courseFilterStatus, setCourseFilterStatus] = useState<string>("all");

  const [isCoursesPaginatedLoading, setIsCoursesPaginatedLoading] = useState(false);
  const [managedCourses, setManagedCourses] = useState<Course[]>([]);
  const [coursesPage, setCoursesPage] = useState(1);
  const [coursesTotalPages, setCoursesTotalPages] = useState(1);
  const [coursesTotalItems, setCoursesTotalItems] = useState(0);

  const [paginatedUserList, setPaginatedUserList] = useState<UserProfile[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersTotalItems, setUsersTotalItems] = useState(0);

  // Course Management Search
  const [courseSearchQuery, setCourseSearchQuery] = useState("");

  // Recycle Bin / Trash State
  const [isLoadingTrash, setIsLoadingTrash] = useState(false);
  const [trashItems, setTrashItems] = useState<any[]>([]);
  const [trashQuery, setTrashQuery] = useState<string>("");
  const [trashType, setTrashType] = useState<"all" | "course" | "lesson">("all");
  const [trashSortOrder, setTrashSortOrder] = useState<"ASC" | "DESC">("DESC");

  // Categories list loaded via API
  const [categoriesList, setCategoriesList] = useState<{ categoryId: number; categoryName: string }[]>([]);

  // Forms states
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseCategory, setNewCourseCategory] = useState(1);
  const [newCourseStatus, setNewCourseStatus] = useState("draft");
  const [newCourseDescription, setNewCourseDescription] = useState("");
  const [newCourseThumbnail, setNewCourseThumbnail] = useState<File | null>(null);
  const [courseFormError, setCourseFormError] = useState("");
  const [courseFormSuccess, setCourseFormSuccess] = useState("");

  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonDescription, setNewLessonDescription] = useState("");
  const [newLessonType, setNewLessonType] = useState("Video");
  const [newLessonLink, setNewLessonLink] = useState("");
  const [lessonInputMode, setLessonInputMode] = useState<"link" | "upload">("link");
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [lessonFormError, setLessonFormError] = useState("");
  const [lessonFormSuccess, setLessonFormSuccess] = useState("");

  // Create Employee Form states
  const [isCreateEmployeeModalOpen, setIsCreateEmployeeModalOpen] = useState(false);
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");
  const [employeePhone, setEmployeePhone] = useState("");
  const [employeeAddress, setEmployeeAddress] = useState("");
  const [employeeRole, setEmployeeRole] = useState("employee");
  const [employeeFormError, setEmployeeFormError] = useState("");
  const [employeeFormSuccess, setEmployeeFormSuccess] = useState("");
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);

  // Student Marks view tab states
  const [studentMarks, setStudentMarks] = useState<any[]>([]);
  const [remainingSubmissions, setRemainingSubmissions] = useState(0);
  const [isMarksLoading, setIsMarksLoading] = useState(false);
  const [marksLesson, setMarksLesson] = useState<any | null>(null);

  const lastResetRef = useRef<string | null>(resetTrigger);

  // Reset deep layout/navigation states whenever the sidebar reset trigger changes (sidebar clicked)
  useEffect(() => {
    if (resetTrigger && resetTrigger !== lastResetRef.current) {
      lastResetRef.current = resetTrigger;
      setSelectedCourse(null);
      setSelectedLesson(null);
      setShowTestPlayer(false);
      setSelectedStandaloneExam(null);
      setCourseLessons([]);
      setEditingLesson(null);
      setCourseDetailsTab("player");
    }
  }, [resetTrigger]);

  const loadStudentMarks = useCallback(async () => {
    const lesson = marksLesson || selectedLesson;
    if (!lesson) return;
    setIsMarksLoading(true);
    try {
      const res = await api.get(`/tests/lesson/${lesson.id}/submissions`);
      const payload = res.data || {};
      const submissions = Array.isArray(payload.submissions) ? payload.submissions : [];
      const remaining = typeof payload.remaining === 'number' ? payload.remaining : 0;
      setStudentMarks(submissions);
      setRemainingSubmissions(remaining);
    } catch (e) {
      console.error("Failed to load student marks", e);
      setStudentMarks([]);
      setRemainingSubmissions(0);
    } finally {
      setIsMarksLoading(false);
    }
  }, [marksLesson, selectedLesson]);

  const handleViewSubmissionDetails = async (submissionId: number) => {
    setIsReviewLoading(submissionId);
    try {
      const res = await api.get(`/tests/submissions/${submissionId}`);
      setReviewStudentSubmission(res.data);
    } catch (err) {
      toast.error("Failed to load submission details");
    } finally {
      setIsReviewLoading(null);
    }
  };

  useEffect(() => {
    if (courseDetailsTab === "student-marks" && (marksLesson || selectedLesson)) {
      loadStudentMarks();
    }
  }, [courseDetailsTab, marksLesson, selectedLesson, loadStudentMarks]);

  useEffect(() => {
    if (viewCourseModalCourse?.courseId) {
      api.get(`/courses/${viewCourseModalCourse.courseId}`).then((res) => {
        setModalCourseDetails(res.data);
      }).catch(() => {
        setModalCourseDetails(viewCourseModalCourse);
      });
    } else {
      setModalCourseDetails(null);
    }
  }, [viewCourseModalCourse?.courseId]);

  // Loading indicators for actions
  const [actionLoading, setActionLoading] = useState(false);
  const [isDeployingLesson, setIsDeployingLesson] = useState(false);

  // Confirm Modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const triggerConfirm = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    confirmText?: string
  ) => {
    setModalState({
      isOpen: true,
      title,
      message,
      confirmText,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await onConfirm();
        } finally {
          setActionLoading(false);
          setModalState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Fetch initial course catalog data
  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const fetchCategoriesList = useCallback(async () => {
    try {
      const res = await api.get("/courses/categories");
      const list = (res.data || []).map((cat: any) => ({
        categoryId: cat.id,
        categoryName: cat.name,
      }));
      setCategoriesList(list);
      if (list.length > 0 && newCourseCategory === 1) {
        setNewCourseCategory(list[0].categoryId);
      }
    } catch (err) {
      console.error("Failed to load categories dynamically:", err);
    }
  }, [newCourseCategory]);

  // Fetch categories list via API on mount
  useEffect(() => {
    fetchCategoriesList();
  }, [fetchCategoriesList]);

  // Handle recently viewed courses synchronization with localStorage
  const addToRecentlyViewed = useCallback((course: Course) => {
    if (!course || !course.courseId) return;
    const key = `recently_viewed_${userId || 'global'}`;
    try {
      const stored = localStorage.getItem(key);
      let list: Course[] = stored ? JSON.parse(stored) : [];
      list = list.filter(item => item.courseId !== course.courseId);
      list.unshift(course);
      if (list.length > 5) {
        list = list.slice(0, 5);
      }
      localStorage.setItem(key, JSON.stringify(list));
      setRecentlyViewed(list);
    } catch (e) {
      console.error("Failed to update recently viewed courses", e);
    }
  }, [userId]);

  const removeFromRecentlyViewed = useCallback((courseId: string) => {
    if (!courseId) return;
    const key = `recently_viewed_${userId || 'global'}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        let list: Course[] = JSON.parse(stored);
        list = list.filter(item => item.courseId !== courseId);
        localStorage.setItem(key, JSON.stringify(list));
        setRecentlyViewed(list);
      }
    } catch (e) {
      console.error("Failed to remove recently viewed course", e);
    }
  }, [userId]);

  useEffect(() => {
    const key = `recently_viewed_${userId || 'global'}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        setRecentlyViewed(JSON.parse(stored));
      } else {
        setRecentlyViewed([]);
      }
    } catch (e) {
      console.error("Failed to load recently viewed courses", e);
      setRecentlyViewed([]);
    }
  }, [userId]);

  useEffect(() => {
    if (selectedCourse && selectedCourse.courseId) {
      addToRecentlyViewed(selectedCourse);
    }
  }, [selectedCourse, addToRecentlyViewed]);

  // Live Search with Debounce for Course Catalog
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCourses(catalogSearch);
    }, 350);
    return () => clearTimeout(timer);
  }, [catalogSearch, fetchCourses]);

  const [myLearningFilter, setMyLearningFilter] = useState<"all" | "in-progress" | "completed">("all");
  const [myLearningViewMode, setMyLearningViewMode] = useState<"card" | "list">("card");
  const [myLearningPage, setMyLearningPage] = useState(1);
  const [myLearningTotalPages, setMyLearningTotalPages] = useState(1);
  const [myLearningCourses, setMyLearningCourses] = useState<Course[]>([]);
  const [isMyLearningLoading, setIsMyLearningLoading] = useState(false);

  const loadMyLearning = useCallback(async () => {
    setIsMyLearningLoading(true);
    try {
      const res = await fetchMyLearning(myLearningPage, 6, myLearningFilter);
      setMyLearningCourses(res.data);
      setMyLearningTotalPages(res.meta.totalPages);
      
      const progressMap: Record<string, number> = { ...learnerProgress };
      res.data.forEach((c: any) => {
        progressMap[c.courseId] = c.progress;
      });
      setLearnerProgress(progressMap);
    } catch (e) {
      console.error("Failed to load my learning", e);
    } finally {
      setIsMyLearningLoading(false);
    }
  }, [myLearningPage, myLearningFilter, fetchMyLearning]);

  useEffect(() => {
    setMyLearningPage(1);
  }, [myLearningFilter]);

  useEffect(() => {
    if (!isAdminOrEmployee && currentTab === "my-learning") {
      loadMyLearning();
    }
  }, [myLearningPage, myLearningFilter, isAdminOrEmployee, currentTab, loadMyLearning]);

  const [isProgressLoading, setIsProgressLoading] = useState(true);

  // Note: Only fetch learner progress for non-paginated legacy catalog usages if needed.
  // With paginated My Learning, this is much less needed globally.
  const loadLearnerProgress = useCallback(async () => {
    setIsProgressLoading(true);
    try {
      const res = await fetchMyLearning(1, 100, "all");
      const progressMap: Record<string, number> = {};
      res.data.forEach((c: any) => {
        progressMap[c.courseId] = c.progress;
      });
      setLearnerProgress(progressMap);
    } catch (e) {
      console.error("Failed to load learner progress details", e);
    } finally {
      setIsProgressLoading(false);
    }
  }, [fetchMyLearning]);

  useEffect(() => {
    if (!isAdminOrEmployee && (currentTab === "catalog" || currentTab === "progress" || currentTab === "my-learning")) {
      loadLearnerProgress();
    }
  }, [isAdminOrEmployee, currentTab, loadLearnerProgress]);

  // Load learner certificates when the Certificates tab is active
  const loadMyCertificates = useCallback(async () => {
    setIsCertificatesLoading(true);
    try {
      const res = await api.get("/certificates/mine");
      setMyCertificates(res.data || []);
    } catch {
      setMyCertificates([]);
    } finally {
      setIsCertificatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdminOrEmployee && currentTab === "certificates") {
      loadMyCertificates();
    }
  }, [isAdminOrEmployee, currentTab, loadMyCertificates]);

  // Fetch user list for admin User Management
  const loadUsers = useCallback(async (q: string = "") => {
    setIsUsersLoading(true);
    try {
      const users = await searchUsers(q);
      setUserList(users);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUsersLoading(false);
    }
  }, [searchUsers]);

  // Fetch paginated user list
  const loadPaginatedUsers = useCallback(async (page: number = 1) => {
    setIsUsersLoading(true);
    try {
      const res = await fetchUsersPaginated(page, 10);
      setPaginatedUserList(res.data || []);
      setUsersPage(res.meta?.currentPage || page);
      setUsersTotalPages(res.meta?.totalPages || 1);
      setUsersTotalItems(res.meta?.totalItems || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUsersLoading(false);
    }
  }, [fetchUsersPaginated]);

  // Fetch paginated course list (Admin/Employee manage-courses uses client-side pagination)
  const loadPaginatedCourses = useCallback(async (
    searchQuery: string = "",
    catOverride?: number | null,
    statusOverride?: string
  ) => {
    setIsCoursesPaginatedLoading(true);
    try {
      const cat = catOverride !== undefined ? catOverride : courseFilterCategoryId;
      const stat = statusOverride !== undefined ? statusOverride : courseFilterStatus;

      // Query database with high limit to handle client-side pagination / toggle view mode instantly
      const res = await fetchCoursesPaginated(1, 1000, searchQuery, cat, stat);
      setManagedCourses(res.data || []);
      setCoursesPage(1);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCoursesPaginatedLoading(false);
    }
  }, [fetchCoursesPaginated, courseFilterCategoryId, courseFilterStatus]);

  // Fetch paginated course catalog (User/Learner uses server-side pagination)
  const loadCatalogPage = useCallback(
    async (page: number) => {
      const pageSize = courseViewMode === "card" ? 6 : 10;
      setCatalogIsLoading(true);
      try {
        const res = await fetchCoursesPaginated(
          page,
          pageSize,
          catalogSearch,
          activeCategoryFilter,
          "active"
        );

        setCatalogCourses(res.data || []);

        const meta = res.meta || res.metadata || {};
        const totalItems = meta.totalItems ?? meta.total_count ?? res.data?.length ?? 0;
        const totalPages = meta.totalPages ?? meta.total_pages ?? Math.max(1, Math.ceil(totalItems / pageSize));

        setCatalogTotalItems(totalItems);
        setCatalogTotalPages(totalPages);
        setCatalogPage(page);
      } catch (err) {
        console.error(err);
        setCatalogCourses([]);
        setCatalogTotalItems(0);
        setCatalogTotalPages(1);
      } finally {
        setCatalogIsLoading(false);
      }
    },
    [
      fetchCoursesPaginated,
      courseViewMode,
      catalogSearch,
      activeCategoryFilter,
    ]
  );


  // Load paginated courses when category/status filters change, or tab is opened
  useEffect(() => {
    if (currentTab === "manage-courses" && isAdminOrEmployee) {
      // On category/status change, initial search value is the current input query, but we don't trigger this effect on every key press because courseSearchQuery is not in dependencies
      loadPaginatedCourses(courseSearchQuery, courseFilterCategoryId, courseFilterStatus);
    }
  }, [courseFilterCategoryId, courseFilterStatus, currentTab, isAdminOrEmployee, loadPaginatedCourses]);

  // Live search: debounce the course search query so we only fire after the user stops typing (400ms)
  useEffect(() => {
    if (currentTab !== "manage-courses" || !isAdminOrEmployee) return;
    const timer = setTimeout(() => {
      setCoursesPage(1);
      loadPaginatedCourses(courseSearchQuery, courseFilterCategoryId, courseFilterStatus);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseSearchQuery]);

  // Load catalog page when catalog tab/search/filter/view changes
  useEffect(() => {
    if (currentTab === "catalog" && !isAdminOrEmployee) {
      loadCatalogPage(1);
    }
  }, [currentTab, isAdminOrEmployee, catalogSearch, activeCategoryFilter, courseViewMode, loadCatalogPage]);

  // Live Search with Debounce for User Management (only runs search if query is not empty)
  useEffect(() => {
    if (currentTab === "users" && isAdmin) {
      if (!userSearchQuery) {
        loadPaginatedUsers(usersPage);
        return;
      }
      const timer = setTimeout(() => {
        loadUsers(userSearchQuery);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [userSearchQuery, usersPage, currentTab, isAdmin, loadUsers, loadPaginatedUsers]);

  const loadTrash = useCallback(async () => {
    setIsLoadingTrash(true);
    try {
      const res = await fetchTrash({ q: trashQuery, type: trashType, sortOrder: trashSortOrder });
      const list = res?.data ?? res?.items ?? res ?? [];
      setTrashItems(Array.isArray(list) ? list : []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load recycle bin.");
      setTrashItems([]);
    } finally {
      setIsLoadingTrash(false);
    }
  }, [fetchTrash, trashQuery, trashType, trashSortOrder]);

  useEffect(() => {
    if (currentTab === "trash" && isAdminOrEmployee) {
      loadTrash();
    }
  }, [currentTab, loadTrash, isAdminOrEmployee]);

  // Recharts styling configs
  const grid = dark ? "#27272a" : "#f1f5f9";
  const tickColor = dark ? "#71717a" : "#94a3b8";
  const tooltipStyle = {
    backgroundColor: dark ? "#1c1c1c" : "#ffffff",
    border: `1px solid ${dark ? "#2d2d2d" : "#e2e8f0"}`,
    borderRadius: 10,
    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
    fontSize: 12,
    color: dark ? "#fafafa" : "#0f172a",
    padding: "8px 12px",
  };

  // Course forms action
  const handleAddCategory = () => {
    setNewCategoryNameInput("");
    setIsManageCategoriesModalOpen(true);
  };

  const submitNewCategory = async () => {
    if (newCategoryNameInput.trim()) {
      setIsAddingCategory(true);
      try {
        const res = await api.post("/courses/categories", { name: newCategoryNameInput.trim() });
        await fetchCategoriesList();
        if (res.data && res.data.id) {
          setNewCourseCategory(res.data.id);
          if (editCourseCategoryId) setEditCourseCategoryId(res.data.id);
        }
        setNewCategoryNameInput("");
        toast.success("Category saved!");
      } catch (err: any) {
        toast.error("Failed to add category");
      } finally {
        setIsAddingCategory(false);
      }
    }
  };

  const deleteCategory = async (id: number) => {
    setIsDeletingCategoryId(id);
    try {
      await api.delete(`/courses/categories/${id}`);
      await fetchCategoriesList();
      setConfirmDeleteCategoryId(null);
      toast.success("Category deleted!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete category");
      setConfirmDeleteCategoryId(null);
    } finally {
      setIsDeletingCategoryId(null);
    }
  };

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    setCourseFormError("");
    setCourseFormSuccess("");
    if (!newCourseName.trim()) {
      setCourseFormError("Course name is required.");
      return;
    }
    // Close the form modal first so the confirmation modal is the only interactive overlay
    setIsCreateCourseModalOpen(false);

    triggerConfirm(
      "Create New Course",
      `Are you sure you want to create the course "${newCourseName}"? It will initially be saved as a draft.`,
      async () => {
        try {
          let thumbnailUrl = undefined;
          if (newCourseThumbnail) {
            const formData = new FormData();
            formData.append("file", newCourseThumbnail);
            const uploadRes = await api.post("/courses/upload-thumbnail", formData, {
              headers: { "Content-Type": "multipart/form-data" },
            });
            thumbnailUrl = uploadRes.data.url;
          }

          await createCourse({
            name: newCourseName,
            categoryId: Number(newCourseCategory),
            status: newCourseStatus,
            description: newCourseDescription,
            ...(thumbnailUrl && { thumbnailUrl }),
          });
          toast.success("Course created successfully!");
          setCourseFormSuccess("Course created successfully!");
          setNewCourseName("");
          setNewCourseDescription("");
          setNewCourseThumbnail(null);
          fetchCourses();
          loadPaginatedCourses();
          setIsCreateCourseModalOpen(false);
        } catch (err: any) {
          setCourseFormError(err.message);
        }
      },
      "Create Course"
    );
  };

  const handleUpdateCourseStatus = (courseId: string, status: string) => {
    const isInactive = status === "inactive" || status === "draft"; // setting to inactive/draft has similar visibility rules
    const title = status === "active" ? "Set Course to Active" : "Set Course to Inactive";
    const description = status === "active"
      ? "Confirming change to ACTIVE status. This course will become visible in the catalog, enabling learners to view, register, and enroll in it."
      : "Warning: Setting this course to Inactive/Draft will hide it from the learner course catalog. Active enrollments will be locked, meaning current learners will no longer see this course in their dashboard or be able to resume its lessons. You can set it to active again at any time to restore access.";

    triggerConfirm(
      title,
      description,
      async () => {
        try {
          await api.patch(`/courses/${courseId}/status`, { status });
          toast.success(`Course status updated to ${status.toUpperCase()} successfully!`);
          const updatedCourses = await api.get(`/courses/search?q=`);
          const freshCourse = updatedCourses.data?.find((c: Course) => c.courseId === courseId);
          if (freshCourse) {
            setSelectedCourse(freshCourse);
          }
          fetchCourses();
          loadPaginatedCourses();
        } catch (err: any) {
          toast.error(err.message || "Failed to update course status.");
        }
      },
      status === "active" ? "Set Active" : "Set Inactive"
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    if (!newLessonTitle.trim()) {
      setNewLessonTitle(fileNameWithoutExt);
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    let type = "PDF";
    if (["mp4", "mov", "avi", "webm", "ogg"].includes(ext || "")) {
      type = "Video";
    } else if (["ppt", "pptx"].includes(ext || "")) {
      type = "PPT";
    } else if (["doc", "docx"].includes(ext || "")) {
      type = "DOCX";
    } else if (ext === "pdf") {
      type = "PDF";
    }
    setNewLessonType(type);

    setIsUploadingFile(true);
    setLessonFormError("");
    setLessonFormSuccess("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/courses/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.url) {
        setNewLessonLink(res.data.url);
        setLessonFormSuccess("File uploaded and linked successfully!");
        setTimeout(() => {
          setLessonFormSuccess(prev => prev === "File uploaded and linked successfully!" ? "" : prev);
        }, 10000);
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
    if (!selectedCourse) {
      setLessonFormError("Select a course first.");
      return;
    }
    if (!newLessonTitle.trim() || !newLessonLink.trim()) {
      setLessonFormError("Lesson title and material link are required.");
      return;
    }
    triggerConfirm(
      "Deploy New Lesson",
      `Are you sure you want to publish the lesson "${newLessonTitle}" under ${selectedCourse.name}?`,
      async () => {
        setIsDeployingLesson(true);
        try {
          const typeToSubmit = lessonInputMode === "link" ? detectMaterialType(newLessonLink) : newLessonType;
          await addLesson(selectedCourse.courseId, {
            title: newLessonTitle,
            description: newLessonDescription,
            materialType: typeToSubmit as "Video" | "PDF" | "PPT" | "DOCX",
            materialLink: newLessonLink,
            status: "Active",
          });
          setLessonFormSuccess("Lesson added successfully!");
          setTimeout(() => {
            setLessonFormSuccess(prev => prev === "Lesson added successfully!" ? "" : prev);
          }, 10000);
          setNewLessonTitle("");
          setNewLessonDescription("");
          setNewLessonLink("");
          await loadCourseLessons(selectedCourse.courseId);
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
    if (!selectedCourse) return;
    setEditCourseFormError("");
    setEditCourseFormSuccess("");
    setIsUpdatingCourse(true);
    try {
      let thumbnailUrl = undefined;
      
      if (editCourseThumbnail) {
        const formData = new FormData();
        formData.append("file", editCourseThumbnail);
        const uploadRes = await api.post("/courses/upload-thumbnail", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        thumbnailUrl = uploadRes.data.url;
      }

      const updated = await updateCourse(selectedCourse.courseId, {
        name: editCourseName,
        categoryId: editCourseCategoryId || undefined,
        description: editCourseDescription,
        ...(thumbnailUrl && { thumbnailUrl }),
      });
      setSelectedCourse(updated);
      toast.success("Course updated successfully!");
      if (thumbnailUrl) toast.success("Thumbnail updated!");
      setEditCourseFormSuccess("Course updated successfully!");
      setEditCourseThumbnail(null);
      setTimeout(() => setEditCourseFormSuccess(""), 10000);
      fetchCourses();
      loadPaginatedCourses(courseSearchQuery, courseFilterCategoryId, courseFilterStatus);
    } catch (err: any) {
      setEditCourseFormError(err.message || "Failed to update course.");
    } finally {
      setIsUpdatingCourse(false);
    }
  };

  const handleEditLessonFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingEditFile(true);
    setEditLessonError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/courses/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.url) {
        setEditLessonLink(res.data.url);
        const detected = detectMaterialType(res.data.url);
        setEditLessonType(detected as any);
      }
    } catch (err: any) {
      setEditLessonError(err.response?.data?.message || "File upload failed.");
    } finally {
      setIsUploadingEditFile(false);
    }
  };

  const handleEditLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLesson || !selectedCourse) return;
    setIsUpdatingLesson(true);
    setEditLessonError("");
    try {
      const typeToSubmit = editLessonInputMode === "link" ? detectMaterialType(editLessonLink) : editLessonType;
      await updateLesson(selectedCourse.courseId, editingLesson.lessonId, {
        title: editLessonTitle,
        description: editLessonDescription,
        materialType: typeToSubmit,
        materialLink: editLessonLink,
      });
      await loadCourseLessons(selectedCourse.courseId);
      if (selectedLesson && selectedLesson.lessonId === editingLesson.lessonId) {
        setSelectedLesson(prev => prev ? { ...prev, title: editLessonTitle, description: editLessonDescription, materialLink: editLessonLink, materialType: typeToSubmit } : null);
      }
      setEditingLesson(null);
    } catch (err: any) {
      setEditLessonError(err.message || "Failed to update lesson.");
    } finally {
      setIsUpdatingLesson(false);
    }
  };

  // Learner Actions
  const handleEnroll = (course: Course) => {
    triggerConfirm(
      "Confirm Enrollment",
      "Would you like to enroll in this course? You will gain access to its learning playlist and slides.",
      async () => {
        try {
          await enrollInCourse(course.courseId);
          toast.success("Enrolled in course successfully!");
          await fetchCourses();
          loadLearnerProgress();
          
          router.push(`/dashboard/learn/${course.courseId}?from=catalog`);
        } catch (err: any) {
          toast.error(err.message || "Failed to enroll in course.");
        }
      },
      "Enroll Now"
    );
  };

  const handleCompleteLesson = (courseId: string, lessonId: string) => {
    triggerConfirm(
      "Mark Lesson Completed",
      "Confirm that you have reviewed the study slides and completed this lesson tutorial.",
      async () => {
        try {
          await completeLesson(courseId, lessonId);
          toast.success("Lesson completed!");
          const freshLessons = await loadCourseLessons(courseId);
          const freshLesson = freshLessons.find((l: Lesson) => l.lessonId === lessonId || String(l.id) === lessonId);
          if (freshLesson) setSelectedLesson(freshLesson);
        } catch (err: any) {
          toast.error(err.message || "Failed to complete lesson.");
        }
      },
      "Mark Complete"
    );
  };

  const triggerNextLesson = (next: Lesson) => {
    setIsNextLessonTransition(true);
    setShowTestPlayer(false);
    setSelectedLesson(next);
    setTimeout(() => {
      setIsNextLessonTransition(false);
    }, 600);
  };

  const confirmSoftDeleteCourse = (courseId: string) => {
    triggerConfirm(
      "Move Course to Recycle Bin",
      "Are you sure you want to delete this course? It will be moved to the recycle bin (soft delete).",
      async () => {
        try {
          await softDeleteCourse(courseId);
          toast.success("Course moved to Recycle Bin.");
          if (selectedCourse?.courseId === courseId) {
            setSelectedCourse(null);
            setSelectedLesson(null);
            setCourseLessons([]);
            if (courseSourceTab) {
              router.push(`/dashboard?tab=${courseSourceTab}`);
              setCourseSourceTab(null);
            } else {
              router.push(`/dashboard?tab=manage-courses`);
            }
          }
          removeFromRecentlyViewed(courseId);
          await fetchCourses();
          await loadPaginatedCourses(courseSearchQuery, courseFilterCategoryId, courseFilterStatus);
        } catch (err: any) {
          toast.error(err.message || "Failed to delete course.");
        }
      },
      "Move to Trash"
    );
  };

  const confirmSoftDeleteLesson = (courseId: string, lessonId: string) => {
    triggerConfirm(
      "Move Lesson to Recycle Bin",
      "Are you sure you want to delete this lesson? It will be moved to the recycle bin (soft delete).",
      async () => {
        try {
          await softDeleteLesson(courseId, lessonId);
          toast.success("Lesson moved to Recycle Bin.");
          if (selectedLesson && (selectedLesson.lessonId === lessonId || String(selectedLesson.id) === String(lessonId))) {
            setSelectedLesson(null);
          }
          await loadCourseLessons(courseId);
          await fetchCourses();
        } catch (err: any) {
          toast.error(err.message || "Failed to delete lesson.");
        }
      },
      "Move to Trash"
    );
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    triggerConfirm(
      "Change User Clearance",
      `Are you sure you want to change this user's authorization role to ${newRole.toUpperCase()}? This modifies their dashboard panels.`,
      async () => {
        try {
          await updateUserRole(userId, newRole);
          toast.success(`Clearance role changed to ${newRole.toUpperCase()} successfully!`);
          if (userSearchQuery) {
            loadUsers(userSearchQuery);
          } else {
            loadPaginatedUsers(usersPage);
          }
        } catch (err: any) {
          toast.error(err.message || "Failed to update clearance role.");
        }
      },
      "Change Clearance"
    );
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmployeeFormError("");
    setEmployeeFormSuccess("");

    if (!employeeEmail.trim() || !employeeName.trim() || !employeePassword.trim()) {
      setEmployeeFormError("Name, email, and password are required.");
      return;
    }

    setIsCreatingEmployee(true);
    try {
      await createEmployee({
        email: employeeEmail,
        name: employeeName,
        password: employeePassword,
        phoneNumber: employeePhone || undefined,
        address: employeeAddress || undefined,
        role: employeeRole,
      });

      toast.success("Employee registered successfully!");
      setEmployeeFormSuccess("Employee registered successfully!");
      setEmployeeEmail("");
      setEmployeeName("");
      setEmployeePassword("");
      setEmployeePhone("");
      setEmployeeAddress("");
      setEmployeeRole("employee");
      setShowEmployeePassword(false);

      // Refresh users list
      if (userSearchQuery) {
        loadUsers(userSearchQuery);
      } else {
        loadPaginatedUsers(usersPage);
      }


      // Close modal after brief timeout to show success state
      setTimeout(() => {
        setIsCreateEmployeeModalOpen(false);
        setEmployeeFormSuccess("");
      }, 1500);

    } catch (err: any) {
      setEmployeeFormError(err.message || "Failed to register employee.");
    } finally {
      setIsCreatingEmployee(false);
    }
  };

  // =========================================================================
  // VIEW RENDERERS
  // =========================================================================

  // Helper: load lessons from dedicated endpoint and set first lesson as selected
  const loadCourseLessons = async (courseId: string, autoSelectFirst = false) => {
    setLessonsLoading(true);
    try {
      const res = await api.get(`/courses/${courseId}/lessons`);
      const allLessons: Lesson[] = res.data || [];
      const activeLessons = allLessons.filter((l) => !l.deletedAt);
      setCourseLessons(activeLessons);

      if (!isAdminOrEmployee && userId) {
        try {
          const progressRes = await api.get(`/courses/${courseId}/progress/${userId}`);
          const data = progressRes.data;
          const progressValue = typeof data === "number" ? data : (data?.progress ?? 0);
          setLearnerProgress((prev) => ({ ...prev, [courseId]: progressValue }));
          const completed = data?.completedLessons || [];
          setCompletedLessonsMap((prev) => ({ ...prev, [courseId]: completed }));
        } catch (e) {
          console.error("Failed to fetch course progress", e);
        }
      }

      if (autoSelectFirst && activeLessons.length > 0) {
        setSelectedLesson(activeLessons[0]);
      }
      return activeLessons;
    } catch (err) {
      console.error(err);
      return [];
    } finally {
      setLessonsLoading(false);
    }
  };

  // Mount effect: lessons are loaded by loadCourseLessons when a course is selected interactively.
  // No sessionStorage rehydration or API fetch-on-mount needed here.

  // =========================================================================

  // RENDER ADMIN / EMPLOYEE OVERVIEW
  const renderAdminOverview = () => {
    if (isStatsLoading || isCoursesLoading) return <LoadingSpinner />;
    if (statsError) {
      return (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {statsError}
        </div>
      );
    }

    const courseChartWidth = Math.max(500, courseComparison.length * 80);
    const comparisonData = courseComparison.map((c) => ({
      ...c,
      displayRate: c.completionRate === 0 ? 0.8 : c.completionRate,
      shortName: c.name.length > 12 ? c.name.slice(0, 12) + "…" : c.name,
    }));

    const materialData = materials.map((m) => ({
      ...m,
      completionRate: m.availableLessonsCount > 0
        ? Math.round((m.totalCompletedLessonsCount / m.availableLessonsCount) * 100)
        : 0,
    }));

    return (
      <div className="flex flex-col gap-6 pb-8 animate-fadeIn">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
              Welcome back, {name} <Sparkles className="text-yellow-500 h-5 w-5 animate-pulse" />
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Here&apos;s what&apos;s happening across your organization.
            </p>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={<UsersIcon size={18} />} label="Total Users" value={stats?.totalUsers ?? 0} accent="#3b82f6" />
          <StatCard icon={<BookOpen size={18} />} label="Total Courses" value={stats?.totalCourses ?? 0} accent="#8b5cf6" />
          <StatCard icon={<Briefcase size={18} />} label="Employees" value={stats?.totalEmployees ?? 0} accent="#10b981" />
          <StatCard icon={<TrendingUp size={18} />} label="Completion Rate" value={`${stats?.overallCompletionRate?.toFixed(1) ?? 0}%`} accent="#f59e0b" />
        </div>

        {/* Row 1: Area + Materials */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" title="Monthly Progress Trend" subtitle="Average learner progress over time">
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={monthly} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={dark ? 0.6 : 0.4} />
                    <stop offset="60%" stopColor="#8b5cf6" stopOpacity={dark ? 0.25 : 0.15} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={grid} strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: tickColor, fontWeight: 500 }}
                  axisLine={false} tickLine={false}
                  height={40}
                />
                <YAxis tick={{ fontSize: 10, fill: tickColor, fontWeight: 500 }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" width={36} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}%`, "Progress"]} />
                <Area type="monotone" dataKey="progress" stroke="url(#lineGrad)" strokeWidth={3.5} fill="url(#grad1)" activeDot={{ r: 6, strokeWidth: 0, fill: "#ec4899" }} isAnimationActive={true} animationDuration={1200} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Material Breakdown" subtitle="Completion rate by type">
            <div className="flex flex-col gap-4.5 pt-2">
              {materialData.map((m, i) => {
                const color = getColor(i);
                return (
                  <div key={m.materialType}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">{m.materialType}</span>
                      <span className="text-sm font-extrabold text-slate-900 dark:text-zinc-50">{m.completionRate}%</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800/80">
                      <div 
                        className="h-full rounded-full transition-all duration-1000 ease-out" 
                        style={{ 
                          width: `${m.completionRate}%`, 
                          background: `linear-gradient(90deg, ${color}cc 0%, ${color} 100%)`,
                          boxShadow: `0 2px 8px ${color}33`
                        }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Row 2: Course Completion Rates + Category Performance */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" title="Course Completion Rates" subtitle={`${courseComparison.length} courses · scroll to see all`}>
            <div className="overflow-x-auto pb-1">
              <div style={{ width: courseChartWidth, minWidth: "100%" }}>
                <BarChart width={courseChartWidth} height={230} data={comparisonData} margin={{ top: 10, right: 10, left: -8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="barBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#1d4ed8" /></linearGradient>
                    <linearGradient id="barPurple" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#6d28d9" /></linearGradient>
                    <linearGradient id="barGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#047857" /></linearGradient>
                    <linearGradient id="barAmber" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#b45309" /></linearGradient>
                    <linearGradient id="barIndigo" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#4338ca" /></linearGradient>
                    <linearGradient id="barRose" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f43f5e" /><stop offset="100%" stopColor="#be123c" /></linearGradient>
                  </defs>
                  <CartesianGrid stroke={grid} strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fontSize: 10, fill: tickColor, fontWeight: 500 }}
                    axisLine={false} tickLine={false}
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 10, fill: tickColor, fontWeight: 500 }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" width={38} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: any, name: any, props: any) => {
                      const real = props.payload.completionRate;
                      return [`${real}%`, "Completion"];
                    }}
                    labelFormatter={(_, p) => p?.[0]?.payload?.name ?? ""}
                    cursor={{ fill: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", radius: 6 }}
                  />
                  <Bar dataKey="displayRate" radius={[6, 6, 0, 0]} maxBarSize={46} isAnimationActive={true} animationDuration={1000}>
                    {comparisonData.map((entry, i) => {
                      const gradNames = ["barBlue", "barPurple", "barGreen", "barAmber", "barIndigo", "barRose"];
                      return (
                        <Cell
                          key={i}
                          fill={`url(#${gradNames[i % gradNames.length]})`}
                          fillOpacity={entry.completionRate === 0 ? 0.35 : 1}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </div>
            </div>
          </Card>

          <Card title="Category Performance" subtitle="Avg progress per category">
            <div className="flex flex-col gap-4.5 pt-2 relative h-full min-h-[250px]">
              {isFetchingCategories && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-[1px] dark:bg-zinc-950/50 rounded-lg">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              )}
              {categories?.data?.map((cat, i) => {
                const color = getColor(i);
                return (
                  <div key={cat.categoryId}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">{cat.categoryName}</span>
                      <span className="text-sm font-extrabold text-slate-900 dark:text-zinc-50">{cat.averageProgress.toFixed(0)}%</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800/80">
                      <div
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{ 
                          width: `${cat.averageProgress}%`, 
                          background: `linear-gradient(90deg, ${color}cc 0%, ${color} 100%)`,
                          boxShadow: `0 2px 8px ${color}33`
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {categories && categories.totalPages > 1 && (
                <div className="mt-auto pt-2 flex items-center justify-between text-xs font-semibold">
                  <button 
                    disabled={categories.page === 1}
                    onClick={() => fetchCategories(categories.page - 1)}
                    className="disabled:opacity-50 text-slate-500 hover:text-slate-900 dark:hover:text-zinc-50"
                  >Prev</button>
                  <span className="text-slate-400">Page {categories.page} of {categories.totalPages}</span>
                  <button 
                    disabled={categories.page === categories.totalPages}
                    onClick={() => fetchCategories(categories.page + 1)}
                    className="disabled:opacity-50 text-slate-500 hover:text-slate-900 dark:hover:text-zinc-50"
                  >Next</button>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Row 3: Leaderboard + At-Risk + Activity */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card title="Leaderboard" subtitle="Ranked by average progress" icon={<Trophy size={14} className="text-amber-500" />}>
            <div className="mt-3 flex flex-col gap-1 relative h-full min-h-[250px]">
              {isFetchingLeaderboard && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-[1px] dark:bg-zinc-950/50 rounded-lg">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                </div>
              )}
              {userPerformance?.data?.map((u, i) => (
                <div key={u.userId} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50/50 dark:hover:bg-zinc-800/20">
                  <span className="w-5 shrink-0 text-center text-sm flex justify-center">
                    {i === 0 && userPerformance.page === 1 ? (
                      <Trophy size={14} className="text-amber-500" />
                    ) : i === 1 && userPerformance.page === 1 ? (
                      <Trophy size={14} className="text-slate-400" />
                    ) : i === 2 && userPerformance.page === 1 ? (
                      <Trophy size={14} className="text-amber-700" />
                    ) : (
                      <span className="text-xs font-bold text-slate-400">{(userPerformance.page - 1) * 6 + i + 1}</span>
                    )}
                  </span>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: getColor(i) }}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-zinc-50">{u.name}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-semibold" style={{ color: getColor(i) }}>{u.userId}</span>
                      <span className="text-[10px] text-slate-300 dark:text-zinc-600">·</span>
                      <span className="text-[10px] capitalize text-slate-450">{u.role}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold" style={{ color: getColor(i) }}>{u.averageProgress.toFixed(0)}%</p>
                  </div>
                </div>
              ))}
              {userPerformance && userPerformance.totalPages > 1 && (
                <div className="mt-auto pt-2 flex items-center justify-between px-2 text-xs font-semibold">
                  <button 
                    disabled={userPerformance.page === 1}
                    onClick={() => fetchUserPerformance(userPerformance.page - 1)}
                    className="disabled:opacity-50 text-slate-500 hover:text-slate-900 dark:hover:text-zinc-50"
                  >Prev</button>
                  <span className="text-slate-400">Page {userPerformance.page} of {userPerformance.totalPages}</span>
                  <button 
                    disabled={userPerformance.page === userPerformance.totalPages}
                    onClick={() => fetchUserPerformance(userPerformance.page + 1)}
                    className="disabled:opacity-50 text-slate-500 hover:text-slate-900 dark:hover:text-zinc-50"
                  >Next</button>
                </div>
              )}
            </div>
          </Card>

          <Card title="At-Risk Learners" subtitle="Enrolled with 0% progress" icon={<AlertTriangle size={14} className="text-amber-500" />}>
            <div className="mt-3 relative h-full flex flex-col min-h-[250px]">
              {isFetchingAtRisk && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-[1px] dark:bg-zinc-950/50 rounded-lg">
                  <Loader2 className="h-6 w-6 animate-spin text-red-500" />
                </div>
              )}
              {!atRisk?.data || atRisk.data.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10">
                  <CheckCircle className="h-10 w-10 text-green-500" />
                  <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">No at-risk learners!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {atRisk.data.map((u) => (
                    <div key={`${u.userId}-${u.courseId}`} className="rounded-xl border border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 p-4 dark:border-amber-900/20 dark:from-amber-900/10 dark:to-orange-900/10">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-50">{u.name}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-zinc-400">{u.courseName}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-amber-200 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-400">
                          {u.progress}%
                        </span>
                      </div>
                    </div>
                  ))}
                  {atRisk && atRisk.totalPages > 1 && (
                    <div className="mt-auto pt-2 flex items-center justify-between px-2 text-xs font-semibold">
                      <button 
                        disabled={atRisk.page === 1}
                        onClick={() => fetchAtRisk(atRisk.page - 1)}
                        className="disabled:opacity-50 text-slate-500 hover:text-slate-900 dark:hover:text-zinc-50"
                      >Prev</button>
                      <span className="text-slate-400">Page {atRisk.page} of {atRisk.totalPages}</span>
                      <button 
                        disabled={atRisk.page === atRisk.totalPages}
                        onClick={() => fetchAtRisk(atRisk.page + 1)}
                        className="disabled:opacity-50 text-slate-500 hover:text-slate-900 dark:hover:text-zinc-50"
                      >Next</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          <Card title="Recent Activity" subtitle="Latest platform actions" icon={<Activity size={14} className="text-blue-500" />}>
            <div className="mt-3 flex flex-col relative h-full min-h-[250px]">
              {recentActivity.slice(0, 5).map((a, i) => (
                <div key={a.activityId} className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-0 dark:border-zinc-800">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white bg-blue-600" style={{ backgroundColor: getColor(i) }}>
                    {a.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-xs font-semibold text-slate-800 dark:text-zinc-300 leading-relaxed">{a.message}</p>
                      {a.timestamp && (
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0 whitespace-nowrap mt-0.5">
                          {new Date(a.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-slate-450 dark:text-zinc-500 font-mono">
                      <span className="bg-slate-50 dark:bg-zinc-800/65 px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-500 dark:text-zinc-450 border border-slate-100 dark:border-zinc-800/40">UID: {a.userId}</span>
                      <span className="text-slate-300 dark:text-zinc-650">|</span>
                      <span className="bg-slate-50 dark:bg-zinc-800/65 px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-500 dark:text-zinc-450 border border-slate-100 dark:border-zinc-800/40">CID: {a.courseId}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  };

  // Helper to dynamically color category tags consistently using hashing
  const getCategoryStyle = (categoryName: string) => {
    let hash = 0;
    for (let i = 0; i < categoryName.length; i++) {
      hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      { bg: "bg-blue-50 dark:bg-blue-950/20", text: "text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30" },
      { bg: "bg-purple-50 dark:bg-purple-950/20", text: "text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900/30" },
      { bg: "bg-emerald-50 dark:bg-emerald-950/20", text: "text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30" },
      { bg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30" },
      { bg: "bg-rose-50 dark:bg-rose-950/20", text: "text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30" },
      { bg: "bg-cyan-50 dark:bg-cyan-950/20", text: "text-cyan-600 dark:text-cyan-400 border-cyan-100 dark:border-cyan-900/30" },
      { bg: "bg-indigo-50 dark:bg-indigo-950/20", text: "text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30" },
      { bg: "bg-orange-50 dark:bg-orange-950/20", text: "text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-900/30" }
    ];
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // RENDER BEAUTIFIED COURSE MANAGEMENT PANEL (Admin/Employee Only)
  const renderManageCourses = () => {

    if (isCoursesLoading) return <LoadingSpinner />;

    const pageSize = courseViewMode === "card" ? 6 : 10;
    const coursesTotalItems = managedCourses.length;
    const coursesTotalPages = Math.max(1, Math.ceil(coursesTotalItems / pageSize));
    const coursesToRender = managedCourses.slice((coursesPage - 1) * pageSize, coursesPage * pageSize);

    return (
      <div className="flex flex-col gap-5 pb-6 animate-fadeIn">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">Course Management Dashboard</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Deploy training courses, structure curriculum playlists, and review enrollment telemetry.</p>
          </div>
          <button
            onClick={() => {
              setCourseFormError("");
              setCourseFormSuccess("");
              setIsCreateCourseModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm shrink-0 self-start sm:self-center"
          >
            <PlusCircle size={15} /> Create Course
          </button>
        </div>

        {recentlyViewed.length > 0 && (
          <div className="animate-fadeIn">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-3 flex items-center gap-1.5">
              <Activity size={12} className="text-blue-500" /> Recently Viewed
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-3 pt-0.5 scrollbar-thin select-none">
              {recentlyViewed.map((c) => (
                <div
                  key={c.courseId}
                  onClick={async () => {
                    router.push(`/dashboard/courses/${c.courseId}`);
                  }}
                  className="w-64 shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 hover:shadow-md transition cursor-pointer dark:border-zinc-800 dark:bg-[#121212] flex flex-col justify-between"
                >
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 line-clamp-1">{c.name}</h4>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{c.courseId}</p>
                  </div>
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold mt-4 block">Manage Course →</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter / View switcher bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-1 flex-col sm:flex-row items-center gap-3 max-w-2xl">
            {/* Search Input and Button Group */}
            <div className="flex flex-1 w-full gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={courseSearchQuery}
                  onChange={(e) => setCourseSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setCoursesPage(1);
                      loadPaginatedCourses(courseSearchQuery, courseFilterCategoryId, courseFilterStatus);
                    }
                  }}
                  placeholder="Search managed courses by name or ID..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-8 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 transition-shadow focus:ring-1 focus:ring-blue-500/30"
                />
                {/* Live search indicator: spinner when loading, clear button when there's text */}
                <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                  {isCoursesPaginatedLoading && courseSearchQuery ? (
                    <span className="h-3 w-3 rounded-full border border-blue-500 border-t-transparent animate-spin" />
                  ) : courseSearchQuery ? (
                    <button
                      type="button"
                      onClick={() => { setCourseSearchQuery(""); }}
                      className="text-slate-350 hover:text-slate-600 dark:hover:text-zinc-300 transition text-sm leading-none"
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              </div>
              <button
                onClick={() => {
                  setCoursesPage(1);
                  loadPaginatedCourses(courseSearchQuery, courseFilterCategoryId, courseFilterStatus);
                }}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shrink-0"
              >
                Search
              </button>
            </div>

            {/* Category Select Dropdown */}
            <div className="w-full sm:w-48">
              <SelectDropdown
                value={courseFilterCategoryId != null ? String(courseFilterCategoryId) : ""}
                onChange={(val) => {
                  const catId = val === "" ? null : Number(val);
                  setCourseFilterCategoryId(catId);
                  setCoursesPage(1);
                  loadPaginatedCourses(courseSearchQuery, catId, courseFilterStatus);
                }}
                options={[
                  { value: "", label: "All Categories" },
                  ...categoriesList.map((cat) => ({ value: String(cat.categoryId), label: cat.categoryName })),
                ]}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                ariaLabel="Filter courses by category"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Status Toggle Tab Selector */}
            <div className="flex rounded-xl bg-slate-50 p-1 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 overflow-x-auto scrollbar-none max-w-full">
              {["all", "active", "draft", "inactive"].map((statusOption) => {
                const isActive = courseFilterStatus === statusOption;
                let activeStyle = "";
                if (isActive) {
                  if (statusOption === "all") activeStyle = "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 shadow-sm";
                  else if (statusOption === "active") activeStyle = "bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400 shadow-sm";
                  else if (statusOption === "draft") activeStyle = "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 shadow-sm";
                  else if (statusOption === "inactive") activeStyle = "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 shadow-sm";
                } else {
                  activeStyle = "text-slate-450 hover:text-slate-650 dark:text-zinc-500 dark:hover:text-zinc-350";
                }
                return (
                  <button
                    key={statusOption}
                    onClick={() => {
                      setCourseFilterStatus(statusOption);
                      setCoursesPage(1);
                      loadPaginatedCourses(courseSearchQuery, courseFilterCategoryId, statusOption);
                    }}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition shrink-0 ${activeStyle}`}
                  >
                    {statusOption}
                  </button>
                );
              })}
            </div>

            {/* Grid/List View switcher */}
            <div className="flex items-center gap-1.5 border-l pl-4 border-slate-100 dark:border-zinc-800/80">
              <button
                onClick={() => {
                  setCourseViewMode("card");
                }}
                className={`rounded-lg p-1.5 text-xs font-bold transition flex items-center gap-1 ${courseViewMode === "card" ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400" : "text-slate-655 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-850"}`}
                title="Card View"
              >
                <LayoutGrid size={15} />
                <span className="hidden lg:inline">Grid</span>
              </button>
              <button
                onClick={() => {
                  setCourseViewMode("list");
                }}
                className={`rounded-lg p-1.5 text-xs font-bold transition flex items-center gap-1 ${courseViewMode === "list" ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400" : "text-slate-655 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-850"}`}
                title="List View"
              >
                <List size={15} />
                <span className="hidden lg:inline">List</span>
              </button>
            </div>
          </div>
        </div>

        {/* Courses list/grid content — wrapped with inline loading overlay */}
        <div className="relative">
          {/* Subtle inline overlay during search/filter refresh — does NOT hide the layout */}
          {isCoursesPaginatedLoading && (
            <div className="absolute inset-0 z-10 flex items-start justify-center pt-10 rounded-2xl bg-white/60 dark:bg-zinc-950/60 backdrop-blur-[2px] pointer-events-none">
              <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-sm px-4 py-2">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Searching...</span>
              </div>
            </div>
          )}
          {coursesToRender.length === 0 && !isCoursesPaginatedLoading ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 dark:bg-[#121212] dark:border-zinc-800">
            <p className="text-sm text-slate-400">No managed courses found.</p>
          </div>
        ) : courseViewMode === "card" ? (
          /* CARD/GRID VIEW (6 per page, tight dimensions, readable fonts) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coursesToRender.map((c) => (
              <div
                key={c.courseId}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-slate-300 dark:border-zinc-800 dark:bg-[#121212] dark:hover:border-zinc-700 transition flex flex-col justify-between min-w-0 sm:min-w-[260px]"
              >
                <div className="w-full aspect-video bg-slate-100 dark:bg-zinc-800 relative overflow-hidden border-b border-slate-100 dark:border-zinc-800">
                  {c.thumbnailUrl ? (
                    <img src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}${c.thumbnailUrl}`} alt={c.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 dark:text-zinc-600 bg-slate-50 dark:bg-zinc-800/50">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1 opacity-50"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                      <span className="text-[10px] font-semibold tracking-wider uppercase opacity-75">No Image</span>
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <select
                      value={c.status}
                      onChange={(e) => handleUpdateCourseStatus(c.courseId, e.target.value)}
                      className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider cursor-pointer focus:outline-none transition shadow-sm backdrop-blur-md ${c.status === "active" ? "bg-green-500/90 text-white border-green-500/20" : c.status === "draft" ? "bg-amber-500/90 text-white border-amber-500/20" : "bg-rose-500/90 text-white border-rose-500/20"}`}
                    >
                      <option value="draft" className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">Draft</option>
                      <option value="active" className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">Active</option>
                      <option value="inactive" className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">Inactive</option>
                    </select>
                  </div>
                  <div className="absolute top-3 left-3">
                    {(() => {
                      const catName = (c as any).category?.name || (c.categoryId === 1 ? "Software" : c.categoryId === 2 ? "Business" : "Compliance");
                      const catStyle = getCategoryStyle(catName);
                      return (
                        <span className={`inline-block rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${catStyle.bg} ${catStyle.text} bg-white/95 dark:bg-black/95 backdrop-blur-md shadow-sm border-white/20 dark:border-black/20`}>
                          {catName}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <div className="p-4 flex flex-col flex-1">
                  <div>
                    <h4 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition dark:text-zinc-50 dark:group-hover:text-blue-400 line-clamp-2 leading-tight">{c.name}</h4>
                    <p className="text-[11px] text-slate-450 dark:text-zinc-500 font-mono mt-1.5">ID: {c.courseId}</p>
                    {c.description ? (
                      <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mt-2 line-clamp-3">{c.description}</p>
                    ) : (
                      <p className="text-xs text-slate-400 italic mt-2">No description provided for this course yet.</p>
                    )}
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                    <div className="flex gap-4">
                      <div className="text-left">
                        <span className="text-[10px] text-slate-400 block font-medium">Chapters</span>
                        <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">{(c as any).totalLessons ?? c.lessons?.length ?? 0}</span>
                      </div>
                      <div className="text-left">
                        <span className="text-[10px] text-slate-400 block font-medium">Learners</span>
                        <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">{c.enrolled}</span>
                      </div>
                    </div>

                  <div className="flex gap-2 items-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); setViewCourseModalCourse(c); }}
                      className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30 rounded-lg transition"
                      title="View Details"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      onClick={() => confirmSoftDeleteCourse(c.courseId)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20"
                      title="Move to Recycle Bin"
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      onClick={async () => {
                        router.push(`/dashboard/courses/${c.courseId}`);
                      }}
                      className="flex items-center gap-0.5 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      Manage Details →
                    </button>
                  </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* LIST VIEW (10 per page, tight dimensions, readable fonts) */
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-[#121212] shadow-sm animate-fadeIn">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 font-bold text-xs uppercase">
                    <th className="py-2.5 px-4">Course ID</th>
                    <th className="py-2.5 px-4">Course Name</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4">Chapters</th>
                    <th className="py-2.5 px-4">Learners</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coursesToRender.map((c) => (
                    <tr key={c.courseId} className="border-b border-slate-100 hover:bg-slate-50/50 dark:border-zinc-800 dark:hover:bg-zinc-800/10 transition">
                      <td className="py-2.5 px-4 font-mono text-sm font-bold text-slate-550 dark:text-zinc-400">{c.courseId}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-zinc-100 text-sm truncate max-w-xs">{c.name}</td>
                      <td className="py-2.5 px-4 text-xs font-semibold">
                        {(() => {
                          const catName = (c as any).category?.name || (c.categoryId === 1 ? "Software" : c.categoryId === 2 ? "Business" : "Compliance");
                          const catStyle = getCategoryStyle(catName);
                          return (
                            <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${catStyle.bg} ${catStyle.text}`}>
                              {catName}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-2.5 px-4 text-sm font-semibold text-slate-650 dark:text-zinc-350">{(c as any).totalLessons ?? c.lessons?.length ?? 0}</td>
                      <td className="py-2.5 px-4 text-sm font-semibold text-slate-650 dark:text-zinc-350">{c.enrolled}</td>
                      <td className="py-2.5 px-4">
                        <select
                          value={c.status}
                          onChange={(e) => handleUpdateCourseStatus(c.courseId, e.target.value)}
                          className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase cursor-pointer focus:outline-none transition ${c.status === "active" ? "bg-green-50 text-green-600 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30" : c.status === "draft" ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30" : "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30"}`}
                        >
                          <option value="draft">Draft</option>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => confirmSoftDeleteCourse(c.courseId)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20"
                            title="Move to Recycle Bin"
                          >
                            <Trash2 size={15} />
                          </button>
                          <button
                            onClick={async () => {
                              router.push(`/dashboard/courses/${c.courseId}`);
                            }}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                          >
                            Manage Details →
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>{/* end relative wrapper */}

        {/* Course Pagination Controls */}
        {coursesTotalPages > 1 && (
          <div className="flex items-center justify-between bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-2xl p-3 shadow-sm animate-fadeIn">
            <span className="text-xs font-semibold text-slate-500">
              Page {coursesPage} of {coursesTotalPages} ({coursesTotalItems} total courses)
            </span>
            <div className="flex gap-2">
              <button
                disabled={coursesPage <= 1}
                onClick={() => setCoursesPage(p => Math.max(1, p - 1))}
                className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
              >
                Previous
              </button>
              <button
                disabled={coursesPage >= coursesTotalPages}
                onClick={() => setCoursesPage(p => Math.min(coursesTotalPages, p + 1))}
                className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}


      </div>
    );
  };

  // RENDER USER MANAGEMENT (Admin Only)
  const renderUserManagement = () => {
    const listToRender = userSearchQuery ? userList : paginatedUserList;

    return (
      <div className="flex flex-col gap-6 pb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">User Access Management</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Modify credentials, change clearance roles and overview workspace permissions.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#121212]">
          <div className="mb-5 flex gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text" value={userSearchQuery} onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search by name, email, or role..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
              />
            </div>
            <button
              onClick={() => loadUsers(userSearchQuery)}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Search
            </button>
            <button
              onClick={() => {
                setEmployeeFormError("");
                setEmployeeFormSuccess("");
                setIsCreateEmployeeModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition shrink-0"
            >
              <PlusCircle size={16} /> Add Employee
            </button>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 dark:border-zinc-800">
                  <th className="py-3 px-4 font-semibold text-xs uppercase">User ID</th>
                  <th className="py-3 px-4 font-semibold text-xs uppercase">Name</th>
                  <th className="py-3 px-4 font-semibold text-xs uppercase">Email</th>
                  <th className="py-3 px-4 font-semibold text-xs uppercase">Role</th>
                  <th className="py-3 px-4 font-semibold text-xs uppercase">Phone Number</th>
                  <th className="py-3 px-4 font-semibold text-xs uppercase">Address</th>
                  <th className="py-3 px-4 font-semibold text-xs uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isUsersLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      <div className="flex justify-center items-center gap-2">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                        <span>Querying user records...</span>
                      </div>
                    </td>
                  </tr>
                ) : listToRender.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No matching user accounts found.
                    </td>
                  </tr>
                ) : (
                  listToRender.map((u) => (
                    <tr key={u.userId} className="border-b border-slate-100 hover:bg-slate-50/50 dark:border-zinc-800 dark:hover:bg-zinc-800/10">
                      <td className="py-4 px-4 font-mono text-slate-650 dark:text-zinc-400 font-bold">{u.userId}</td>
                      <td className="py-4 px-4 font-medium text-slate-900 dark:text-zinc-50 flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        {u.name}
                      </td>
                      <td className="py-4 px-4 text-slate-500 dark:text-zinc-400">{u.email}</td>
                      <td className="py-4 px-4">
                        <select
                           value={u.role} onChange={(e) => handleRoleChange(u.userId, e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white p-1 text-xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                        >
                          <option value="user">User (Learner)</option>
                          <option value="employee">Employee</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </td>
                      <td className="py-4 px-4 text-slate-500 dark:text-zinc-400">{u.phoneNumber || "N/A"}</td>
                      <td className="py-4 px-4 text-slate-500 dark:text-zinc-400 max-w-xs truncate">{u.address || "N/A"}</td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => setViewUserModalUser(u)}
                          className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-900/40"
                        >
                          <Eye size={12} />
                          <span>See Details</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden flex flex-col gap-3">
            {isUsersLoading ? (
              <div className="flex justify-center items-center gap-2 py-8 text-slate-400 text-sm">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                <span>Querying user records...</span>
              </div>
            ) : listToRender.length === 0 ? (
              <p className="py-8 text-center text-slate-400 text-sm">No matching user accounts found.</p>
            ) : (
              listToRender.map((u) => (
                <div key={u.userId} className="rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-zinc-50 truncate">{u.name}</p>
                      <p className="font-mono text-xs text-slate-500 dark:text-zinc-400 font-bold">{u.userId}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 break-words">{u.email}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Phone</p>
                      <p className="text-slate-600 dark:text-zinc-300 truncate">{u.phoneNumber || "N/A"}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Address</p>
                      <p className="text-slate-600 dark:text-zinc-300 truncate">{u.address || "N/A"}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <select
                      value={u.role} onChange={(e) => handleRoleChange(u.userId, e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                    >
                      <option value="user">User (Learner)</option>
                      <option value="employee">Employee</option>
                      <option value="admin">Administrator</option>
                    </select>
                    <button
                      onClick={() => setViewUserModalUser(u)}
                      className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-900/40"
                    >
                      <Eye size={12} />
                      <span>See Details</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* User Pagination Controls */}
          {!userSearchQuery && usersTotalPages > 1 && (
            <div className="flex items-center justify-between mt-4 bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm animate-fadeIn">
              <span className="text-xs font-semibold text-slate-500">
                Page {usersPage} of {usersTotalPages} ({usersTotalItems} total users)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={usersPage <= 1}
                  onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
                >
                  Previous
                  </button>
                <button
                  disabled={usersPage >= usersTotalPages}
                  onClick={() => setUsersPage(p => Math.min(usersTotalPages, p + 1))}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // =========================================================================
  // LEARNER / USER VIEWS
  // =========================================================================

  // RENDER LEARNER PORTAL - MY LEARNING & LESSON VIEWER
  const renderMyLearning = () => {

    // We now use myLearningCourses from backend pagination

    return (
      <div className="flex flex-col gap-6 pb-8 animate-fadeIn">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">My Courses</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Track progress and resume your active training modules.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex bg-slate-100 p-1 rounded-xl dark:bg-zinc-800/50">
              {(["all", "in-progress", "completed"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setMyLearningFilter(filter)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg capitalize transition ${
                    myLearningFilter === filter
                      ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                      : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                  }`}
                >
                  {filter.replace("-", " ")}
                </button>
              ))}
            </div>
            
            <div className="flex bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 p-1 rounded-xl">
              <button
                onClick={() => setMyLearningViewMode("card")}
                className={`rounded-lg p-1.5 text-xs font-bold transition flex items-center gap-1 ${myLearningViewMode === "card" ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400" : "text-slate-655 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-850"}`}
                title="Grid View"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setMyLearningViewMode("list")}
                className={`rounded-lg p-1.5 text-xs font-bold transition flex items-center gap-1 ${myLearningViewMode === "list" ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400" : "text-slate-655 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-850"}`}
                title="List View"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {isMyLearningLoading ? (
          <div className="py-12">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {recentlyViewed.length > 0 && (
          <div className="animate-fadeIn">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-3 flex items-center gap-1.5">
              <Activity size={12} className="text-blue-500" /> Recently Viewed
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-3 pt-0.5 scrollbar-thin select-none">
              {recentlyViewed.map((c) => (
                <div
                  key={c.courseId}
                  onClick={async () => {
                    router.push(`/dashboard/learn/${c.courseId}`);
                  }}
                  className="w-64 shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 hover:shadow-md transition cursor-pointer dark:border-zinc-800 dark:bg-[#121212] flex flex-col justify-between"
                >
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 line-clamp-1">{c.name}</h4>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{c.courseId}</p>
                  </div>
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold mt-4 block">Resume Course →</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {myLearningCourses.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#121212]">
            <BookOpenCheck size={42} className="text-slate-400 animate-pulse" />
            <h4 className="font-bold text-slate-800 dark:text-zinc-200">No Enrolled Courses Found</h4>
            <p className="text-xs text-slate-400 max-w-xs">Search our catalog to enroll in training tracks matching your skills requirements.</p>
            <button
              onClick={() => router.push("/dashboard?tab=catalog")}
              className="mt-3 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              Go to Course Catalog
            </button>
          </div>
        ) : myLearningViewMode === "card" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myLearningCourses.map((c, idx) => {
              const progress = c.progress ?? learnerProgress[c.courseId] ?? 0;
              return (
                <div
                  key={`${c.courseId}-${idx}`}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212] flex flex-col justify-between hover:border-slate-300 hover:shadow-md transition cursor-pointer"
                  onClick={async () => {
                    router.push(`/dashboard/learn/${c.courseId}`);
                  }}
                >
                  <div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                      Active Enrollment
                    </span>
                    <h3 className="font-bold text-slate-900 dark:text-zinc-50 mt-3">{c.name}</h3>
                    <p className="text-xs text-slate-400 font-mono mt-1">ID: {c.courseId}</p>
                  </div>
                  <div className="mt-8">
                    <div className="flex justify-between items-center text-xs font-medium text-slate-500 mb-1.5">
                      <span>Course Progress</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800 mb-4">
                      <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 group-hover:text-blue-700 transition">Resume Course <ChevronRight size={14} /></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-zinc-800/50">
                  <tr>
                    <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Course ID</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Course Name</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Category</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-right">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {myLearningCourses.map((c, idx) => {
                    const progress = c.progress ?? learnerProgress[c.courseId] ?? 0;
                    const categoryIdToUse = c.categoryId ?? (c as any).category?.id;
                    const catName = categoriesList.find((cat) => cat.categoryId === categoryIdToUse)?.categoryName || (c as any).category?.name || c.categoryName || "Training";
                    const catStyle = getCategoryStyle(catName);
                    
                    return (
                      <tr 
                        key={`${c.courseId}-${idx}`} 
                        onClick={async () => {
                          router.push(`/dashboard/learn/${c.courseId}`);
                        }}
                        className="border-b border-slate-100 hover:bg-slate-50/50 dark:border-zinc-800 dark:hover:bg-zinc-800/10 transition cursor-pointer"
                      >
                        <td className="py-3 px-4 font-mono text-sm font-bold text-slate-550 dark:text-zinc-400">{c.courseId}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-zinc-100 text-sm truncate max-w-xs">{c.name}</td>
                        <td className="py-3 px-4 text-xs font-semibold">
                          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${catStyle.bg} ${catStyle.text}`}>
                            {catName}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <span className="font-bold text-blue-600 dark:text-blue-400 text-xs">{progress}%</span>
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800 hidden sm:block">
                              <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {myLearningTotalPages > 1 && (
          <div className="flex justify-between items-center mt-4">
            <button
              disabled={myLearningPage === 1}
              onClick={() => setMyLearningPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
              Page {myLearningPage} of {myLearningTotalPages}
            </span>
            <button
              disabled={myLearningPage === myLearningTotalPages}
              onClick={() => setMyLearningPage((p) => Math.min(myLearningTotalPages, p + 1))}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
          </>
        )}
      </div>
    );
  };

  const renderCourseCatalog = () => {
    const pageSize = courseViewMode === "card" ? 6 : 10;
    const noResults = !catalogIsLoading && catalogCourses.length === 0;

    return (
      <div className="flex flex-col gap-5 pb-6 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">Course Catalog</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Search and register for professional development training sessions.</p>
          </div>
        </div>

        {/* Filter / View switcher bar (Admin-style) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-1 flex-col sm:flex-row items-center gap-3 max-w-2xl">
            {/* Search Input */}
            <div className="flex flex-1 w-full gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadCatalogPage(1);
                  }}
                  placeholder="Search catalog by name or ID..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
                />
              </div>
              <button
                onClick={() => loadCatalogPage(1)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shrink-0"
              >
                Search
              </button>
            </div>

            {/* Category Select */}
            <div className="w-full sm:w-48">
              <SelectDropdown
                value={activeCategoryFilter != null ? String(activeCategoryFilter) : ""}
                onChange={(val) => {
                  const catId = val === "" ? null : Number(val);
                  setActiveCategoryFilter(catId);
                }}
                options={[
                  { value: "", label: "All Categories" },
                  ...categoriesList.map((cat) => ({ value: String(cat.categoryId), label: cat.categoryName })),
                ]}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                ariaLabel="Filter catalog by category"
              />
            </div>
          </div>

          {/* Grid/List switcher */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 border-l pl-4 border-slate-100 dark:border-zinc-800/80">
              <button
                onClick={() => setCourseViewMode("card")}
                className={`rounded-lg p-1.5 text-xs font-bold transition flex items-center gap-1 ${courseViewMode === "card" ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400" : "text-slate-655 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-850"}`}
                title="Grid View"
              >
                <LayoutGrid size={15} />
                <span className="hidden lg:inline">Grid</span>
              </button>
              <button
                onClick={() => setCourseViewMode("list")}
                className={`rounded-lg p-1.5 text-xs font-bold transition flex items-center gap-1 ${courseViewMode === "list" ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400" : "text-slate-655 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-850"}`}
                title="List View"
              >
                <List size={15} />
                <span className="hidden lg:inline">List</span>
              </button>
            </div>
          </div>
        </div>

        {catalogIsLoading ? (
          <LoadingSpinner />
        ) : noResults ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 dark:bg-[#121212] dark:border-zinc-800">
            <p className="text-sm text-slate-400">No active courses match your query.</p>
          </div>
        ) : courseViewMode === "card" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {catalogCourses.map((c) => {
              const progress = learnerProgress[c.courseId];
              const isEnrolled = progress !== undefined && progress >= 0;
              const categoryIdToUse = c.categoryId ?? (c as any).category?.id;
              const catName = categoriesList.find((cat) => cat.categoryId === categoryIdToUse)?.categoryName || (c as any).category?.name || c.categoryName || "Training";
              const catStyle = getCategoryStyle(catName);

              return (
                <div
                  key={c.courseId}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-slate-300 dark:border-zinc-800 dark:bg-[#121212] dark:hover:border-zinc-700 transition flex flex-col justify-between min-w-0 sm:min-w-[260px]"
                >
                  <div className="w-full aspect-video bg-slate-100 dark:bg-zinc-800 relative overflow-hidden border-b border-slate-100 dark:border-zinc-800">
                    {c.thumbnailUrl ? (
                      <img src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}${c.thumbnailUrl}`} alt={c.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 dark:text-zinc-600 bg-slate-50 dark:bg-zinc-800/50">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1 opacity-50"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                        <span className="text-[10px] font-semibold tracking-wider uppercase opacity-75">No Image</span>
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      <span className={`inline-block rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${catStyle.bg} ${catStyle.text} bg-white/95 dark:bg-black/95 backdrop-blur-md shadow-sm border-white/20 dark:border-black/20`}>
                        {catName}
                      </span>
                    </div>
                  </div>
                  
<div className="p-4 flex flex-col flex-1">
                     <div>
                       <h4 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition dark:text-zinc-50 line-clamp-2 leading-tight">{c.name}</h4>
                       <p className="text-[11px] text-slate-450 dark:text-zinc-500 font-mono mt-1.5">ID: {c.courseId}</p>
                        {c.description ? (
                          <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mt-2 line-clamp-3">{c.description}</p>
                        ) : (
                          <p className="text-xs text-slate-400 italic mt-2">No description provided for this course yet.</p>
                        )}
                     </div>

<div className="mt-5 pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-left">
                            <span className="text-[10px] text-slate-400 block font-medium">Chapters</span>
                            <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">{c.totalLessons ?? c.lessons?.length ?? 0}</span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setViewCourseModalCourse(c); }}
                            className="flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <Eye size={12} /> View Details
                          </button>
                        </div>

                        {isEnrolled ? (
                          <button
                            onClick={async () => {
                              router.push(`/dashboard/learn/${c.courseId}?from=catalog`);
                            }}
                            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                          >
                            Resume →
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEnroll(c)}
                            disabled={actionLoading}
                            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 transition disabled:opacity-50 shadow-sm"
                          >
                            Enroll Now
                          </button>
                        )}
                      </div>
                   </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-[#121212] shadow-sm animate-fadeIn">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 font-bold text-xs uppercase">
                    <th className="py-2.5 px-4">Course ID</th>
                    <th className="py-2.5 px-4">Course Name</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4">Chapters</th>
                    <th className="py-2.5 px-4">Learners</th>
                    <th className="py-2.5 px-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogCourses.map((c) => {
                    const progress = learnerProgress[c.courseId];
                    const isEnrolled = progress !== undefined && progress >= 0;
                    const categoryIdToUse = c.categoryId ?? (c as any).category?.id;
                    const catName = categoriesList.find((cat) => cat.categoryId === categoryIdToUse)?.categoryName || (c as any).category?.name || c.categoryName || "Training";
                    const catStyle = getCategoryStyle(catName);
                    return (
                      <tr key={c.courseId} className="border-b border-slate-100 hover:bg-slate-50/50 dark:border-zinc-800 dark:hover:bg-zinc-800/10 transition">
                        <td className="py-2.5 px-4 font-mono text-sm font-bold text-slate-550 dark:text-zinc-400">{c.courseId}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-zinc-100 text-sm truncate max-w-xs">{c.name}</td>
                        <td className="py-2.5 px-4 text-xs font-semibold">
                          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${catStyle.bg} ${catStyle.text}`}>
                            {catName}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-sm font-semibold text-slate-650 dark:text-zinc-350">{c.totalLessons ?? c.lessons?.length ?? 0}</td>
                        <td className="py-2.5 px-4 text-sm font-semibold text-slate-650 dark:text-zinc-350">{c.enrolled}</td>
                        <td className="py-2.5 px-4">
                          {isEnrolled ? (
                            <button
                              onClick={async () => {
                                router.push(`/dashboard/learn/${c.courseId}?from=catalog`);
                              }}
                              className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            >
                              Resume
                            </button>
                          ) : (
                            <button
                              onClick={() => handleEnroll(c)}
                              disabled={actionLoading}
                              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 transition disabled:opacity-50"
                            >
                              Enroll
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {catalogTotalPages > 1 && (
          <div className="flex items-center justify-between bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-2xl p-3 shadow-sm animate-fadeIn">
            <span className="text-xs font-semibold text-slate-500">
              Page {catalogPage} of {catalogTotalPages} ({catalogTotalItems} total courses)
            </span>
            <div className="flex gap-2">
              <button
                disabled={catalogPage <= 1}
                onClick={() => loadCatalogPage(Math.max(1, catalogPage - 1))}
                className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
              >
                Previous
              </button>
              <button
                disabled={catalogPage >= catalogTotalPages}
                onClick={() => loadCatalogPage(Math.min(catalogTotalPages, catalogPage + 1))}
                className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // RENDER LEARNER PROGRESS REPORT (User/Learner Only)
  const renderLearnerProgressReport = () => {
    if (isCoursesLoading || isProgressLoading) return <LoadingSpinner />;


    const enrolledCourses = allCourses.filter((c) => {
      const p = learnerProgress[c.courseId];
      return p !== undefined && p >= 0;
    });

    const completedCount = enrolledCourses.filter((c) => learnerProgress[c.courseId] === 100).length;
    const enrolledCount = enrolledCourses.length;
    const sumProgress = enrolledCourses.reduce((sum, c) => sum + (learnerProgress[c.courseId] || 0), 0);
    const avgProgress = enrolledCount > 0 ? Math.round(sumProgress / enrolledCount) : 0;

    return (
      <div className="flex flex-col gap-6 pb-8 animate-fadeIn">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">My Progress</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Overview of your training completions and success metrics.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2">
            <StatCard icon={<BookOpen size={18} />} label="Active Enrollments" value={enrolledCount} accent="#3b82f6" />
            <button
              onClick={() => router.push("/dashboard?tab=my-learning")}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 self-start pl-2 transition-all"
            >
              See all enrolled courses →
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <StatCard icon={<CheckCircle size={18} />} label="Completed Courses" value={completedCount} accent="#10b981" />
            <button
              onClick={() => router.push("/dashboard?tab=certificates")}
              className="text-[11px] font-bold text-emerald-600 hover:bg-emerald-700 dark:text-emerald-400 self-start pl-2 transition-all"
            >
              See all completed courses →
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <StatCard icon={<TrendingUp size={18} />} label="Average Progress Rate" value={`${avgProgress}%`} accent="#f59e0b" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#121212] shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-zinc-50 mb-4">Topic Performance Breakdown</h3>
          <div className="flex flex-col gap-5">
            {enrolledCourses.map((c, i) => {
              const progress = learnerProgress[c.courseId] ?? 0;
              return (
                <div key={c.courseId}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">{c.name}</span>
                    <span className="text-sm font-bold text-slate-950 dark:text-zinc-55">{progress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: getColor(i) }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // RENDER CERTIFICATES (User/Learner Only)
  const renderCertificates = () => {
    const apiBase = (api.defaults.baseURL || "http://localhost:3000").replace(/\/$/, "");

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

    const statusBadge = (status: string) => (
      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border capitalize ${
        status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40"
        : status === "issued" ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/40"
        : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40"
      }`}>{status}</span>
    );

    return (
      <div className="flex flex-col gap-6 pb-8 animate-fadeIn">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">My Certificates</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Take every test in a course, then apply for an official TrainXcel certificate.</p>
        </div>

        {isCertificatesLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <Loader2 size={30} className="text-amber-500 animate-spin" />
            <p className="text-xs text-slate-400 animate-pulse">Loading your certificates...</p>
          </div>
        ) : myCertificates.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#121212]">
            <Award size={42} className="text-slate-300" />
            <h4 className="font-bold text-slate-800 dark:text-zinc-200">No Certificates Yet</h4>
            <p className="text-xs text-slate-400 max-w-sm">Complete all the tests inside an active course, then apply for a certificate from that course&apos;s Certifications tab.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {myCertificates.map((cert: any) => (
              <div key={cert.id} className={`relative overflow-hidden rounded-2xl border-2 p-6 shadow-sm animate-scaleIn ${
                cert.status === "issued" ? "border-amber-200 bg-amber-50/10 dark:border-amber-900/30 dark:bg-[#1a1613]"
                : cert.status === "pending" ? "border-amber-300 bg-amber-50/40 dark:border-amber-900/50 dark:bg-[#1a1613]"
                : "border-rose-200 bg-rose-50/20 dark:border-rose-900/40 dark:bg-[#1a1613]"
              }`}>
                <div className="absolute right-4 top-4 opacity-10 dark:opacity-20 text-amber-500">
                  <Award size={96} />
                </div>
                <div>
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <Award size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">TrainXcel Credential</span>
                  </div>
                  <h3 className="font-extrabold text-slate-900 dark:text-zinc-50 mt-4 text-xl tracking-tight">{cert.courseName}</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                    Course Code: <span className="font-mono font-bold">{cert.courseId}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Recipient: <span className="font-semibold text-slate-700 dark:text-zinc-300">{cert.userName}</span>
                    {cert.certificateId && <span className="font-mono"> · {cert.certificateId}</span>}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    {statusBadge(cert.status)}
                    <span className="text-[10px] text-slate-400">Applied {new Date(cert.appliedAt || cert.createdAt).toLocaleDateString()}</span>
                  </div>
                  {cert.status === "rejected" && cert.rejectionReason && (
                    <div className="mt-3 p-3 rounded-xl border border-rose-200 bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-950/10">
                      <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Rejected</p>
                      <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1">Reason: {cert.rejectionReason}</p>
                    </div>
                  )}
                </div>
                <div className="mt-8 pt-4 border-t border-amber-100 dark:border-amber-900/30 flex justify-between items-center">
                  {cert.status === "issued" ? (
                    <div className="flex items-center gap-2">
                      <a href={`${apiBase}${cert.certificateUrl}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm">
                        <Eye size={12} /> View
                      </a>
                      <button type="button" onClick={() => downloadCertificatePdf(cert.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800">
                        <FileText size={12} /> Download PDF
                      </button>
                    </div>
                  ) : cert.status === "pending" ? (
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Under Review</span>
                  ) : (
                    <span className="text-[10px] font-semibold text-rose-500 uppercase">Rejected</span>
                  )}
                  <span className="text-xs font-bold text-green-600 dark:text-green-400">{cert.status === "issued" ? "Active" : cert.status === "pending" ? "Pending" : "Rejected"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // SYSTEM SETTINGS VIEW
  const renderRecycleBin = () => {



    const confirmRestoreCourse = (courseId: string) => {
      triggerConfirm(
        "Restore Course",
        "Restore this course from the recycle bin?",
        async () => {
          try {
            await restoreCourse(courseId);
            toast.success("Course restored successfully!");
            await loadTrash();
            await fetchCourses();
            await loadPaginatedCourses(courseSearchQuery, courseFilterCategoryId, courseFilterStatus);
          } catch (err: any) {
            toast.error(err.message || "Failed to restore course.");
          }
        },
        "Restore"
      );
    };

    const confirmRestoreLesson = (courseId: string, lessonId: string) => {
      triggerConfirm(
        "Restore Lesson",
        "Restore this lesson from the recycle bin?",
        async () => {
          try {
            await restoreLesson(courseId, lessonId);
            toast.success("Lesson restored successfully!");
            await loadTrash();
            await fetchCourses();
            await loadCourseLessons(courseId);
          } catch (err: any) {
            toast.error(err.message || "Failed to restore lesson.");
          }
        },
        "Restore"
      );
    };

    const confirmHardDeleteCourse = (courseId: string) => {
      triggerConfirm(
        "Permanently Delete Course",
        "This will permanently remove the course from the database. This cannot be undone.",
        async () => {
          try {
            await hardDeleteCourse(courseId);
            toast.success("Course deleted permanently.");
            removeFromRecentlyViewed(courseId);
            await loadTrash();
            await fetchCourses();
            await loadPaginatedCourses(courseSearchQuery, courseFilterCategoryId, courseFilterStatus);
          } catch (err: any) {
            toast.error(err.message || "Failed to delete course permanently.");
          }
        },
        "Delete Permanently"
      );
    };

    const confirmHardDeleteLesson = (courseId: string, lessonId: string) => {
      triggerConfirm(
        "Permanently Delete Lesson",
        "This will permanently remove the lesson from the database. This cannot be undone.",
        async () => {
          try {
            await hardDeleteLesson(courseId, lessonId);
            toast.success("Lesson deleted permanently.");
            if (selectedLesson && (selectedLesson.lessonId === lessonId || String(selectedLesson.id) === String(lessonId))) {
              setSelectedLesson(null);
            }
            await loadTrash();
            await fetchCourses();
            await loadCourseLessons(courseId);
          } catch (err: any) {
            toast.error(err.message || "Failed to delete lesson permanently.");
          }
        },
        "Delete Permanently"
      );
    };

    const confirmEmptyTrash = () => {
      triggerConfirm(
        "Empty Recycle Bin",
        "This will permanently delete ALL items currently in the recycle bin. This cannot be undone.",
        async () => {
          try {
            await emptyTrash();
            toast.success("Recycle Bin emptied.");
            await loadTrash();
          } catch (err: any) {
            toast.error(err.message || "Failed to empty recycle bin.");
          }
        },
        "Empty Bin"
      );
    };

    const formatTrashItem = (item: any) => {
      const type = item?.type ?? item?.itemType ?? item?.entityType;
      if (type === "lesson") {
        return {
          type: "lesson" as const,
          courseId: item.courseId,
          lessonId: item.lessonId ?? item.id,
          title: item.name ?? item.lessonTitle ?? item.title,
          materialType: item.materialType,
          deletedAt: item.deletedAt ?? item.deleted_at,
        };
      }
      return {
        type: "course" as const,
        courseId: item.courseId ?? item.id,
        title: item.name ?? item.courseName ?? item.title,
        deletedAt: item.deletedAt ?? item.deleted_at,
      };
    };

    return (
      <div className="flex flex-col gap-6 pb-8 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">Recycle Bin</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Soft-deleted courses and lessons. Restore or permanently delete.</p>
          </div>
          <button
            onClick={confirmEmptyTrash}
            className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 transition disabled:opacity-50 shrink-0 w-full sm:w-auto flex items-center justify-center gap-1.5"
            disabled={isLoadingTrash || trashItems.length === 0}
          >
            <Trash2 size={14} />
            Empty Recycle Bin
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#121212] shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <div className="flex-1 flex gap-2 items-center">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={trashQuery}
                  onChange={(e) => setTrashQuery(e.target.value)}
                  placeholder="Search in trash by course/lesson ID or title..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
                />
              </div>
              <button
                onClick={loadTrash}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shrink-0"
                disabled={isLoadingTrash}
              >
                Search
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SelectDropdown
                value={trashType}
                onChange={(v) => setTrashType(v as any)}
                options={[
                  { value: "all", label: "All" },
                  { value: "course", label: "Courses" },
                  { value: "lesson", label: "Lessons" },
                ]}
                className="rounded-xl border border-slate-200 bg-white p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                ariaLabel="Filter trash by type"
              />

              <SelectDropdown
                value={trashSortOrder}
                onChange={(v) => setTrashSortOrder(v as any)}
                options={[
                  { value: "DESC", label: "Newest" },
                  { value: "ASC", label: "Oldest" },
                ]}
                className="rounded-xl border border-slate-200 bg-white p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                ariaLabel="Sort trash"
              />
            </div>
          </div>
        </div>

        {isLoadingTrash ? (
          <LoadingSpinner />
        ) : trashItems.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 dark:bg-[#121212] dark:border-zinc-800">
            <p className="text-sm text-slate-400">Trash is empty.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-[#121212] shadow-sm">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 font-bold text-xs uppercase">
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Details</th>
                  <th className="py-2.5 px-4">Deleted At & Purge Counter</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {trashItems.map((raw, idx) => {
                  const item = formatTrashItem(raw);
                  const key = item.type === "lesson" ? `${item.courseId}-${item.lessonId}` : `${item.courseId}`;

                  return (
                    <tr key={key} className="border-b border-slate-100 hover:bg-slate-50/50 dark:border-zinc-800 dark:hover:bg-zinc-800/10">
                      <td className="py-3 px-4">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                          item.type === "course" ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30" : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/30"
                        }`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-zinc-100">{item.title ?? "—"}</span>
                          <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono mt-0.5">
                            {item.type === "course" ? `CID: ${item.courseId}` : `CID: ${item.courseId} · LES: ${item.lessonId}`}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <TrashCountdown deletedAt={item.deletedAt} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={async () => {
                              if (item.type === "course") {
                                try {
                                  setActionLoading(true);
                                  const res = await api.get(`/courses/${item.courseId}`);
                                  setSelectedCourse(res.data);
                                  await loadCourseLessons(item.courseId, true);
                                  router.push(`/dashboard?tab=manage-courses`);
                                } finally {
                                  setActionLoading(false);
                                }
                              } else {
                                // Lesson details: open deleted lesson modal
                                try {
                                  setActionLoading(true);
                                  const lessonRes = await api.get(`/courses/${item.courseId}/lessons/${item.lessonId}`);
                                  setDeletedLessonDetails(lessonRes.data);
                                } catch (e: any) {
                                  toast.error(e?.response?.data?.message || "Failed to fetch deleted lesson details.");
                                } finally {
                                  setActionLoading(false);
                                }
                              }
                            }}
                            className="text-xs font-bold text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            View Details
                          </button>

                          {item.type === "course" ? (
                            <>
                              <button
                                onClick={() => confirmRestoreCourse(item.courseId)}
                                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1 transition"
                              >
                                Restore
                              </button>
                              <button
                                onClick={() => confirmHardDeleteCourse(item.courseId)}
                                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1 transition"
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => confirmRestoreLesson(item.courseId, item.lessonId)}
                                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1 transition"
                              >
                                Restore
                              </button>
                              <button
                                onClick={() => confirmHardDeleteLesson(item.courseId, item.lessonId)}
                                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1 transition"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const [showResetPassForm, setShowResetPassForm] = useState(false);
  const [resetPassForm, setResetPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [resetPassShow, setResetPassShow] = useState({ current: false, new: false, confirm: false });
  const [resetPassError, setResetPassError] = useState('');
  const [resetPassSuccess, setResetPassSuccess] = useState('');
  const [resetPassSubmitting, setResetPassSubmitting] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetPassError('');
    setResetPassSuccess('');

    if (!resetPassForm.currentPassword || !resetPassForm.newPassword || !resetPassForm.confirmPassword) {
      setResetPassError('All password fields are required.');
      return;
    }
    if (resetPassForm.newPassword.length < 6) {
      setResetPassError('New password must be at least 6 characters long.');
      return;
    }
    if (resetPassForm.newPassword !== resetPassForm.confirmPassword) {
      setResetPassError('New passwords do not match.');
      return;
    }

    setResetPassSubmitting(true);
    try {
      await api.patch('/auth/reset-password', {
        currentPassword: resetPassForm.currentPassword,
        newPassword: resetPassForm.newPassword,
      });
      setResetPassSuccess('Password changed successfully.');
      setResetPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setResetPassError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setResetPassSubmitting(false);
    }
  };

  const renderSettings = () => {
    return (
      <div className="flex flex-col gap-6 pb-8 animate-fadeIn">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">Settings</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Review platform and account metrics configuration details.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#121212] shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-zinc-50 mb-4">Account Profile</h3>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-400">Full Name</label>
                <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100 mt-0.5">{name}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400">Email Address</label>
                <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100 mt-0.5">{email}</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400">Clearance Role</label>
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mt-0.5">{role}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#121212] shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-zinc-50">Reset Password</h3>
            <button type="button" onClick={() => { setShowResetPassForm(v => !v); setResetPassError(''); setResetPassSuccess(''); }} className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition">
              {showResetPassForm ? 'Cancel' : 'Change Password'}
            </button>
          </div>
          {showResetPassForm && (
            <div className="mt-4 animate-fadeIn">
              {resetPassSuccess && (
                <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-950/30 dark:text-green-400">{resetPassSuccess}</div>
              )}
              {resetPassError && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">{resetPassError}</div>
              )}
              <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500">Current Password</label>
                  <div className="relative">
                    <input type={resetPassShow.current ? 'text' : 'password'} value={resetPassForm.currentPassword} onChange={e => setResetPassForm(f => ({ ...f, currentPassword: e.target.value }))} placeholder="Enter current password" className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 pr-10 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:text-zinc-100" />
                    <button type="button" onClick={() => setResetPassShow(s => ({ ...s, current: !s.current }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300">{resetPassShow.current ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500">New Password</label>
                  <div className="relative">
                    <input type={resetPassShow.new ? 'text' : 'password'} value={resetPassForm.newPassword} onChange={e => setResetPassForm(f => ({ ...f, newPassword: e.target.value }))} placeholder="At least 6 characters" className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 pr-10 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:text-zinc-100" />
                    <button type="button" onClick={() => setResetPassShow(s => ({ ...s, new: !s.new }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300">{resetPassShow.new ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500">Confirm New Password</label>
                  <div className="relative">
                    <input type={resetPassShow.confirm ? 'text' : 'password'} value={resetPassForm.confirmPassword} onChange={e => setResetPassForm(f => ({ ...f, confirmPassword: e.target.value }))} placeholder="Re-enter new password" className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 pr-10 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:text-zinc-100" />
                    <button type="button" onClick={() => setResetPassShow(s => ({ ...s, confirm: !s.confirm }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300">{resetPassShow.confirm ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                  </div>
                </div>
                <button type="submit" disabled={resetPassSubmitting} className="self-start flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-70">
                  {resetPassSubmitting ? <><Loader2 size={14} className="animate-spin" /> Updating...</> : 'Update Password'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  };

  // =========================================================================
  // VIEW DIRECTORY ROUTER
  // =========================================================================

  const navItems: { key: string; label: string; tab?: string }[] = isAdminOrEmployee
    ? [
        { key: "overview", label: "Overview" },
        { key: "manage-courses", label: "Manage Courses" },
        { key: "manage-exam-groups", label: "Manage Exams" },
        { key: "evaluations", label: "Evaluations" },
        { key: "trash", label: "Recycle Bin" },
        { key: "users", label: "Users" },
        { key: "settings", label: "Settings" },
      ]
    : [
        { key: "progress", label: "My Progress" },
        { key: "overview", label: "My Learning" },
        { key: "catalog", label: "Catalog" },
        { key: "exam-groups", label: "Exam Groups" },
        { key: "certificates", label: "Certificates" },
        { key: "settings", label: "Settings" },
      ];



  const renderViewContent = () => {

    if (isAdminOrEmployee) {
      switch (currentTab) {
        case "overview":
          return renderAdminOverview();
        case "manage-courses":
          return renderManageCourses();
        case "manage-exam-groups":
          return <ExamGroupManager />;
        case "evaluations":
          return <EvaluationsDashboard />;
        case "trash":
          return renderRecycleBin();
        case "users":
          return isAdmin ? renderUserManagement() : renderAdminOverview();
        case "settings":
          return renderSettings();
        default:
          return renderAdminOverview();
      }
    } else {
      switch (currentTab) {
        case "my-learning":
        case "overview":
          return renderMyLearning();
        case "catalog":
          return renderCourseCatalog();
        case "exam-groups":
          return <StudentExamGroupsList />;
        case "progress":
          return renderLearnerProgressReport();
        case "certificates":
          return renderCertificates();
        case "settings":
          return renderSettings();
        default:
          return renderMyLearning();
      }
    }
  };

  return (
    <>
      {/* Desktop/tablet content */}
      <div className="min-h-screen">
        {renderViewContent()}
      </div>

      {lessonsLoading && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="flex flex-col items-center gap-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-8 rounded-3xl shadow-2xl animate-scaleIn">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-bold text-slate-800 dark:text-zinc-200">Loading course syllabus...</p>
            <p className="text-xs text-slate-400">Preparing lessons & materials</p>
          </div>
        </div>
      )}

      {/* Deleted Lesson Details Modal */}
      {deletedLessonDetails && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-[#121212] animate-scaleUp">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-zinc-800/80">
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
                <FileText size={18} className="text-amber-600" /> Deleted Lesson Details
              </h3>
              <button
                onClick={() => setDeletedLessonDetails(null)}
                className="rounded-lg p-1 text-slate-450 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
              >
                <span className="text-xl font-bold">×</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Lesson Title</label>
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{deletedLessonDetails.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Lesson ID</label>
                  <p className="text-xs font-mono text-slate-600 dark:text-zinc-400">{deletedLessonDetails.lessonId}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Status</label>
                  <span className="inline-block rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                    {deletedLessonDetails.status}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Material Details</label>
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{deletedLessonDetails.materialType}</p>
                <a href={deletedLessonDetails.materialLink} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline break-all mt-1 inline-block">
                  {deletedLessonDetails.materialLink}
                </a>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Description</label>
                <p className="text-xs text-slate-600 dark:text-zinc-400 max-h-24 overflow-y-auto whitespace-pre-wrap">{deletedLessonDetails.description || "No description provided."}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Deleted At</label>
                  <p className="text-xs font-mono text-rose-600 dark:text-rose-400">
                    {deletedLessonDetails.deletedAt ? new Date(deletedLessonDetails.deletedAt).toLocaleString() : "Unknown"}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Created At</label>
                  <p className="text-xs font-mono text-slate-500 dark:text-zinc-500">
                    {deletedLessonDetails.createdAt ? new Date(deletedLessonDetails.createdAt).toLocaleString() : "Unknown"}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletedLessonDetails(null)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 transition dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Close Window
              </button>
              <button
                onClick={() => {
                  const { courseId, lessonId } = deletedLessonDetails;
                  triggerConfirm(
                    "Restore Lesson",
                    "Restore this lesson from the recycle bin?",
                    async () => {
                      await restoreLesson(courseId, lessonId);
                      setDeletedLessonDetails(null);
                      await loadTrash();
                      await fetchCourses();
                      if (selectedCourse?.courseId === courseId) {
                        await loadCourseLessons(courseId);
                      }
                    },
                    "Restore"
                  );
                }}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 flex items-center gap-1.5 transition"
              >
                <RotateCcw size={13} /> Restore Lesson
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Categories Modal overlay */}
      {isManageCategoriesModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn" onClick={() => setIsManageCategoriesModalOpen(false)}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-zinc-800/80">
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-50">Manage Categories</h3>
              <button
                onClick={() => setIsManageCategoriesModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-850 transition"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryNameInput}
                  onChange={(e) => setNewCategoryNameInput(e.target.value)}
                  placeholder="New Category Name..."
                  className="flex-1 rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-800"
                />
                <button
                  onClick={submitNewCategory}
                  disabled={!newCategoryNameInput.trim() || isAddingCategory}
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

      {/* Create Course Modal overlay */}
      {isCreateCourseModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-[#121212] animate-scaleUp">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-zinc-800/80">
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
                <PlusCircle size={18} className="text-blue-600" /> Create Professional Course
              </h3>
              <button
                onClick={() => setIsCreateCourseModalOpen(false)}
                className="rounded-lg p-1 text-slate-455 hover:bg-slate-50 dark:hover:bg-zinc-850 transition"
              >
                <span className="text-xl font-bold">×</span>
              </button>
            </div>

            {courseFormError && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">{courseFormError}</div>}
            {courseFormSuccess && <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-950/30 dark:text-green-400">{courseFormSuccess}</div>}

            <form
              onSubmit={handleCreateCourse}
              className="flex flex-col gap-4"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Course Name</label>
                <input
                  type="text" value={newCourseName} onChange={(e) => setNewCourseName(e.target.value)}
                  placeholder="e.g. Next.js Enterprise Scaling"
                  className="rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-800"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-500">Category Tag</label>
                  <button type="button" onClick={handleAddCategory} className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline">+ New Category</button>
                </div>
                <SelectDropdown
                  value={String(newCourseCategory)}
                  onChange={(v) => setNewCourseCategory(Number(v))}
                  options={categoriesList.map((cat) => ({ value: String(cat.categoryId), label: cat.categoryName }))}
                  className="rounded-xl border border-slate-200 bg-white p-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                  ariaLabel="Select category tag"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Publication Status</label>
                <SelectDropdown
                  value={newCourseStatus}
                  onChange={(v) => setNewCourseStatus(v)}
                  options={[
                    { value: "draft", label: "Draft mode (Hidden)" },
                    { value: "active", label: "Active (Deploy to Catalog)" },
                  ]}
                  className="rounded-xl border border-slate-200 bg-white p-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                  ariaLabel="Select publication status"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Course Thumbnail <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setNewCourseThumbnail(e.target.files[0]);
                    }
                  }}
                  className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-800"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Course Description <span className="text-slate-400 font-normal">(optional)</span></label>
                <textarea
                  value={newCourseDescription}
                  onChange={(e) => setNewCourseDescription(e.target.value)}
                  placeholder="Brief overview of what learners will gain from this course..."
                  className="rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-800 min-h-[72px]"
                />
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setIsCreateCourseModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-705 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={actionLoading}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition disabled:opacity-50"
                >
                  Create Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Lesson Modal overlay */}
      {editingLesson && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-zinc-800/80">
              <h3 className="font-bold text-slate-900 dark:text-zinc-50">Edit Lesson</h3>
              <button
                onClick={() => setEditingLesson(null)}
                className="rounded-lg p-1 hover:bg-slate-50 dark:hover:bg-zinc-850 text-slate-400 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            {editLessonError && (
              <div className="mt-3 p-3 text-xs bg-red-50 text-red-600 rounded-xl border border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30">
                {editLessonError}
              </div>
            )}

            <form onSubmit={handleEditLessonSubmit} className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Lesson Title</label>
                <input
                  type="text"
                  value={editLessonTitle}
                  onChange={(e) => setEditLessonTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Description</label>
                <textarea
                  value={editLessonDescription}
                  onChange={(e) => setEditLessonDescription(e.target.value)}
                  placeholder="Lesson description..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 min-h-[70px]"
                />
              </div>

              <div className="flex items-center gap-4 mt-1">
                <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="radio"
                    checked={editLessonInputMode === "link"}
                    onChange={() => setEditLessonInputMode("link")}
                    className="accent-blue-600"
                  />
                  Provide Link
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="radio"
                    checked={editLessonInputMode === "file"}
                    onChange={() => setEditLessonInputMode("file")}
                    className="accent-blue-600"
                  />
                  Documents
                </label>
              </div>

              {editLessonInputMode === "link" ? (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Material Link</label>
                  <input
                    type="text"
                    value={editLessonLink}
                    onChange={(e) => setEditLessonLink(e.target.value)}
                    placeholder="e.g. YouTube URL or PDF URL"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
                    required
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Upload File</label>
                  <input
                    type="file"
                    accept="video/*,.pdf,.ppt,.pptx,.docx"
                    onChange={handleEditLessonFileUpload}
                    className="text-xs block w-full text-slate-505 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-zinc-800 dark:file:text-zinc-200"
                  />
                  {isUploadingEditFile && (
                    <span className="text-[10px] text-blue-500 animate-pulse mt-1">Uploading file...</span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 mt-4 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setEditingLesson(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-705 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingLesson || isUploadingEditFile}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {isUpdatingLesson ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Employee Modal overlay */}
      {isCreateEmployeeModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-[#121212] animate-scaleUp">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-zinc-800/80">
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
                <PlusCircle size={18} className="text-emerald-600" /> Add Employee User
              </h3>
              <button
                onClick={() => setIsCreateEmployeeModalOpen(false)}
                className="rounded-lg p-1 text-slate-455 hover:bg-slate-50 dark:hover:bg-zinc-850 transition"
              >
                <span className="text-xl font-bold">×</span>
              </button>
            </div>

            {employeeFormError && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">{employeeFormError}</div>}
            {employeeFormSuccess && <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-950/30 dark:text-green-400">{employeeFormSuccess}</div>}

            <form
              onSubmit={handleCreateEmployee}
              className="flex flex-col gap-4"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Full Name</label>
                <input
                  type="text" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="e.g. Jane Developer" required
                  className="rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none dark:border-zinc-800"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Email Address</label>
                <input
                  type="email" value={employeeEmail} onChange={(e) => setEmployeeEmail(e.target.value)}
                  placeholder="e.g. new.staff@example.com" required
                  className="rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none dark:border-zinc-800"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Password</label>
                <div className="relative">
                  <input
                    type={showEmployeePassword ? "text" : "password"} value={employeePassword} onChange={(e) => setEmployeePassword(e.target.value)}
                    placeholder="e.g. supersecurepassword123" required
                    className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 pr-11 text-sm focus:border-emerald-600 focus:outline-none dark:border-zinc-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmployeePassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition"
                    tabIndex={-1}
                    aria-label={showEmployeePassword ? "Hide password" : "Show password"}
                  >
                    {showEmployeePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Role</label>
                <SelectDropdown
                  value={employeeRole}
                  onChange={(v) => setEmployeeRole(v)}
                  options={[
                    { value: "employee", label: "Employee" },
                    { value: "admin", label: "Admin" },
                    { value: "user", label: "User" },
                  ]}
                  className="rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                  ariaLabel="Select role"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Phone Number (Optional)</label>
                <input
                  type="text" value={employeePhone} onChange={(e) => setEmployeePhone(e.target.value)}
                  placeholder="e.g. 555-0101"
                  className="rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none dark:border-zinc-800"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Office Address (Optional)</label>
                <input
                  type="text" value={employeeAddress} onChange={(e) => setEmployeeAddress(e.target.value)}
                  placeholder="e.g. Redmond Office HQ"
                  className="rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none dark:border-zinc-800"
                />
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setIsCreateEmployeeModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-705 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={isCreatingEmployee}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isCreatingEmployee ? (
                    <>
                      <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                      Creating...
                    </>
                  ) : (
                    "Create Employee"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Marks Review Modal */}
      {reviewStudentSubmission && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn" onClick={() => setReviewStudentSubmission(null)}>
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-100 dark:border-zinc-800/80">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50 mb-1">Student Submission Details</h3>
                <p className="text-sm text-slate-500">Student: <span className="font-semibold text-slate-700 dark:text-zinc-300">{reviewStudentSubmission.user?.name}</span> | Test: <span className="font-semibold">{reviewStudentSubmission.test?.title}</span></p>
              </div>
              <button onClick={() => setReviewStudentSubmission(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-850 transition">
                <X size={24} />
              </button>
            </div>
            
            <p className="text-sm text-slate-500 mb-6">Total Score obtained: <span className="font-bold text-blue-600 dark:text-blue-400 text-lg">{reviewStudentSubmission.marksObtained}</span> points</p>
            <div className="flex flex-col gap-6">
              {(reviewStudentSubmission.answers || []).map((ans: any, idx: number) => {
                const isCQ = ans.question.type === "CQ" || ans.question.type === "Video";
                const provided = Array.isArray(ans.providedAnswer) ? ans.providedAnswer : [ans.providedAnswer];
                const correct = ans.question.correctAnswers || [];
                const isCorrect = !isCQ && provided.length === correct.length && provided.every((v: string) => correct.includes(v));
                return (
                  <div key={ans.id} className="p-5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-zinc-800/40 dark:border-zinc-700">
                    <h5 className="font-semibold text-slate-800 dark:text-zinc-100 mb-1">{idx + 1}. {ans.question.questionText}</h5>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                      <span>Total Marks: {ans.question.marks}</span>
                      <span className={`font-bold ${isCorrect || (isCQ && ans.marksAwarded > 0) ? "text-green-600" : (isCQ && reviewStudentSubmission.status === "Pending Evaluation" ? "text-amber-500" : "text-rose-600")}`}>
                        Marks Awarded: {isCQ && reviewStudentSubmission.status === "Pending Evaluation" ? "Pending" : (ans.marksAwarded ?? 0)}
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
                                {wasSelected && <span className="text-slate-400 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">Student's Answer</span>}
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
                                <span className="text-slate-500 text-xs font-bold">Student Video Answer:</span>
                                <video 
                                  src={(() => {
                                    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
                                    return ans.providedAnswer?.startsWith("http") 
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
                          );
                        })() : (
                          <>
                            <div className="p-4 rounded-xl border border-slate-200 bg-white dark:bg-zinc-900 text-sm">
                              <p className="text-slate-500 text-xs font-bold mb-1">Student Answer:</p>
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
        </div>
      )}

      <ConfirmModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText}
        onConfirm={modalState.onConfirm}
        onCancel={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        isLoading={actionLoading}
      />


      {/* Course Details Modal */}
            {viewCourseModalCourse && (
        <CourseDetailsModal
          course={viewCourseModalCourse}
          onClose={() => { setViewCourseModalCourse(null); setModalCourseDetails(null); }}
          onEnroll={handleEnroll}
          isAdminOrEmployee={isAdminOrEmployee}
          learnerProgress={learnerProgress}
          actionLoading={actionLoading}
          fullscreenImage={fullscreenImage}
          setFullscreenImage={setFullscreenImage}
          onUpdateCourseStatus={handleUpdateCourseStatus}
        />
      )}

      {/* User Details Modal */}
      {viewUserModalUser && (
        <UserDetailsModal
          user={viewUserModalUser}
          onClose={() => setViewUserModalUser(null)}
          setFullscreenImage={setFullscreenImage}
        />
      )}

      {fullscreenImage && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4" onClick={() => setFullscreenImage(null)}>
          <button
            onClick={() => setFullscreenImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition z-10"
          >
            <X size={24} />
          </button>
          <img
            src={fullscreenImage}
            alt="Fullscreen"
            className="w-full h-full max-w-5xl max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

// ── Sub-components ──

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}



function Card({ title, subtitle, icon, className = "", children }: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#121212] ${className}`}>
      <div className="flex items-start gap-2">
        {icon && <div className="mt-0.5">{icon}</div>}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#121212]">
      <div className="mb-3 inline-flex rounded-xl p-2.5" style={{ backgroundColor: `${accent}18`, color: accent }}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-zinc-50">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-zinc-400">{label}</p>
      <div className="absolute bottom-0 left-0 h-[3px] w-full" style={{ backgroundColor: accent, opacity: 0.8 }} />
    </div>
  );
}

interface CourseDetailsModalProps {
  course: any;
  onClose: () => void;
  onEnroll: (course: any) => void;
  isAdminOrEmployee: boolean;
  learnerProgress: Record<string, number>;
  actionLoading: boolean;
  fullscreenImage: string | null;
  setFullscreenImage: (url: string | null) => void;
  onUpdateCourseStatus: (courseId: string, status: string) => void;
}

function CourseDetailsModal({ course, onClose, onEnroll, isAdminOrEmployee, learnerProgress, actionLoading, fullscreenImage, setFullscreenImage, onUpdateCourseStatus }: CourseDetailsModalProps) {
  const isEnrolled = learnerProgress[course.courseId] !== undefined && learnerProgress[course.courseId] >= 0;
  const catName = (course as any).category?.name || (course.categoryId === 1 ? "Software" : course.categoryId === 2 ? "Business" : "Compliance");

  useEffect(() => {
    const scrollContainer = document.querySelector("main > div.overflow-y-auto") as HTMLElement;
    if (scrollContainer) {
      const originalOverflow = scrollContainer.style.overflowY || "auto";
      scrollContainer.style.overflowY = "hidden";
      return () => {
        scrollContainer.style.overflowY = originalOverflow;
      };
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-zinc-800/80 shrink-0">
            <h3 className="pl-4 text-base font-bold text-slate-900 dark:text-zinc-50">Course Details</h3>          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-850 transition">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          <div className="w-full aspect-video max-h-44 bg-slate-100 dark:bg-zinc-800 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-800 relative">
            {course.thumbnailUrl ? (
              <img src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}${course.thumbnailUrl}`} alt={course.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 dark:text-zinc-600 bg-slate-50 dark:bg-zinc-800/50">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1 opacity-50"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                <span className="text-[10px] font-semibold tracking-wider uppercase opacity-75">No Thumbnail</span>
              </div>
            )}
            {course.thumbnailUrl && (
              <button
                onClick={() => setFullscreenImage(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}${course.thumbnailUrl}`)}
                className="absolute bottom-2 left-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition"
                title="View Fullscreen"
              >
                <Maximize2 size={14} />
              </button>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-50">{course.name}</h2>
            <p className="text-[11px] text-slate-450 dark:text-zinc-500 font-mono mt-0.5">ID: {course.courseId}</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-2.5 bg-slate-50 dark:bg-zinc-800/40 rounded-xl border border-slate-100 dark:border-zinc-850">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Category</span>
              <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">{catName}</span>
            </div>
            {isAdminOrEmployee && (
              <div className="p-2.5 bg-slate-50 dark:bg-zinc-800/40 rounded-xl border border-slate-100 dark:border-zinc-850">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Status</span>
                <span className={`text-xs font-bold capitalize ${course.status === "active" ? "text-green-600" : course.status === "draft" ? "text-amber-600" : "text-rose-600"}`}>{course.status}</span>
                <button
                  onClick={() => onUpdateCourseStatus(course.id || course.courseId, course.status === "active" ? "inactive" : "active")}
                  className="mt-2 rounded-lg text-[10px] font-bold px-3 py-1.5 transition border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800"
                >
                  {course.status === "active" ? "Set Inactive" : "Set Active"}
                </button>
              </div>
            )}
            <div className="p-2.5 bg-slate-50 dark:bg-zinc-800/40 rounded-xl border border-slate-100 dark:border-zinc-850">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Chapters</span>
              <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">{course.totalLessons ?? course.lessons?.length ?? 0}</span>
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
          {!isAdminOrEmployee && !isEnrolled && (
            <button
              onClick={() => { onEnroll(course); onClose(); }}
              disabled={actionLoading}
              className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 transition disabled:opacity-50 shadow-sm"
            >
              Enroll Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface UserDetailsModalProps {
  user: any;
  onClose: () => void;
  setFullscreenImage: (url: string | null) => void;
}

function UserDetailsModal({ user, onClose, setFullscreenImage }: UserDetailsModalProps) {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

  useEffect(() => {
    const scrollContainer = document.querySelector("main > div.overflow-y-auto") as HTMLElement;
    if (scrollContainer) {
      const originalOverflow = scrollContainer.style.overflowY || "auto";
      scrollContainer.style.overflowY = "hidden";
      return () => {
        scrollContainer.style.overflowY = originalOverflow;
      };
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/courses/user-learning/${user.userId}`)
      .then((res) => {
        if (active) {
          setCourses(res.data?.data || []);
        }
      })
      .catch((err) => {
        console.error("Failed to load user courses", err);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [user.userId]);

  const completedCount = courses.filter((c) => c.progress === 100).length;
  const enrolledCount = courses.length;
  const sumProgress = courses.reduce((sum, c) => sum + (c.progress || 0), 0);
  const avgProgress = enrolledCount > 0 ? Math.round(sumProgress / enrolledCount) : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-zinc-800/80 shrink-0">
          <h3 className="text-base font-bold text-slate-900 dark:text-zinc-50">User Performance & Details</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* User profile details header */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50/50 dark:bg-zinc-800/20 py-2.5 px-3.5 rounded-xl border border-slate-100 dark:border-zinc-850">
            <div 
              onClick={() => user.profilePictureUrl && setFullscreenImage(`${backendUrl}${user.profilePictureUrl}`)}
              className={`h-12 w-12 overflow-hidden rounded-full border border-slate-200 dark:border-zinc-700 flex items-center justify-center bg-blue-600 text-lg font-bold text-white shrink-0 ${user.profilePictureUrl ? 'cursor-pointer hover:opacity-90 transition' : ''}`}
              title={user.profilePictureUrl ? "Click to view full screen" : undefined}
            >
              {user.profilePictureUrl ? (
                <img src={`${backendUrl}${user.profilePictureUrl}`} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 text-center sm:text-left min-w-0">
              <h4 className="text-base font-bold text-slate-900 dark:text-zinc-50 truncate">{user.name}</h4>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">{user.email}</p>
              <div className="mt-0.5 flex flex-wrap gap-2 justify-center sm:justify-start">
                <span className="inline-block rounded-full bg-blue-100 dark:bg-blue-950 px-2 py-0.5 text-[9px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                  {user.role}
                </span>
                <span className="text-[9px] text-slate-400 font-mono self-center">ID: {user.userId}</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 flex-1">
              <Loader2 size={32} className="text-blue-500 animate-spin" />
              <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 animate-pulse">Querying performance analytics...</span>
            </div>
          ) : (
            <>
              {/* User metadata properties grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
                <div className="p-2 bg-slate-50/30 dark:bg-zinc-800/10 rounded-xl border border-slate-100 dark:border-zinc-850">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Phone Number</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">{user.phoneNumber || "Not Specified"}</span>
                </div>
                <div className="p-2 bg-slate-50/30 dark:bg-zinc-800/10 rounded-xl border border-slate-100 dark:border-zinc-850">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Address</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate block">{user.address || "Not Specified"}</span>
                </div>
              </div>

              {/* Stats Breakdown */}
              <div className="grid grid-cols-3 gap-3 shrink-0">
                <div className="p-2 bg-blue-50/40 dark:bg-blue-900/10 rounded-xl border border-blue-100/50 dark:border-blue-900/30 text-center">
                  <span className="text-[9px] text-blue-500 font-bold uppercase tracking-wider block mb-0.5">Enrolled</span>
                  <span className="text-lg font-bold text-blue-700 dark:text-blue-400">{enrolledCount}</span>
                </div>
                <div className="p-2 bg-emerald-50/40 dark:bg-emerald-900/10 rounded-xl border border-emerald-100/50 dark:border-emerald-900/30 text-center">
                  <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider block mb-0.5">Completed</span>
                  <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{completedCount}</span>
                </div>
                <div className="p-2 bg-amber-50/40 dark:bg-amber-900/10 rounded-xl border border-amber-100/50 dark:border-amber-900/30 text-center">
                  <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider block mb-0.5">Avg Progress</span>
                  <span className="text-lg font-bold text-amber-700 dark:text-amber-400">{avgProgress}%</span>
                </div>
              </div>

              {/* Topics Performance Breakdown */}
              <div className="flex flex-col flex-1 min-h-[220px]">
                <h4 className="font-bold text-slate-900 dark:text-zinc-50 mb-2.5 text-sm">Course Performance Details</h4>
                {courses.length === 0 ? (
                  <div className="text-center py-10 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 flex-1 flex flex-col items-center justify-center">
                    <p className="text-xs text-slate-400">This user is not enrolled in any courses yet.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 overflow-y-auto max-h-[48vh] pr-1">
                    {courses.map((c, index) => (
                      <div key={`${c.courseId || c.id || index}-${index}`} className="p-3 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/20 dark:bg-zinc-900/10 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block leading-tight">{c.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {c.courseId}</span>
                          </div>
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{c.progress}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                          <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${c.progress}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StudentExamGroupsList() {
  const { userId, role } = useUser();
  const [examGroups, setExamGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "enrolled">("all");
  const [enrolledIds, setEnrolledIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    api.get("/exam-groups", { params: { page: 1, limit: 50, q: search || undefined } })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
        setExamGroups(data);
        
        const newEnrolled = new Set<number>();
        data.forEach((eg: any) => {
          if (eg.enrollments?.some((e: any) => e.user?.userId === userId)) {
            newEnrolled.add(eg.id);
          }
        });
        setEnrolledIds((prev) => {
          const merged = new Set(prev);
          newEnrolled.forEach((id) => merged.add(id));
          return merged;
        });
      })
      .finally(() => setLoading(false));
  }, [userId, search]);

  const handleJoin = async (examGroupId: number) => {
    try {
      await api.post(`/exam-groups/${examGroupId}/join`);
      toast.success("Joined exam successfully!");
      setEnrolledIds((prev) => new Set(prev).add(examGroupId));
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to join exam.");
    }
  };

  const handleView = (examGroupId: number) => {
    window.location.href = `/exam-groups/${examGroupId}`;
  };

  return (
    <div className="flex flex-col gap-5 pb-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">Exam Groups</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Browse and join available exams.</p>
        </div>
        <div className="relative w-full sm:w-auto flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl dark:bg-zinc-800">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${filter === "all" ? "bg-white text-slate-800 shadow-sm dark:bg-zinc-700 dark:text-zinc-50" : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"}`}
            >
              All Exams
            </button>
            <button
              onClick={() => setFilter("enrolled")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${filter === "enrolled" ? "bg-white text-slate-800 shadow-sm dark:bg-zinc-700 dark:text-zinc-50" : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"}`}
            >
              My Exams
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search exams..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-48 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Loading exam groups...</p>
        </div>
      ) : examGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
          <BookOpen size={40} className="text-slate-300 dark:text-zinc-700" />
          <p className="text-sm text-slate-500">No exam groups available.</p>
        </div>
      ) : (
        (() => {
          const displayedGroups = filter === "enrolled" ? examGroups.filter(eg => enrolledIds.has(eg.id)) : examGroups;
          
          if (displayedGroups.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
                <BookOpen size={40} className="text-slate-300 dark:text-zinc-700" />
                <p className="text-sm text-slate-500">No {filter === "enrolled" ? "enrolled " : ""}exams found.</p>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedGroups.map((eg) => (
                <ExamGroupCard
                  key={eg.id}
                  examGroup={{ ...eg, totalQuestions: eg.questions?.length ?? 0 }}
                  onClick={() => handleView(eg.id)}
                  onJoin={() => handleJoin(eg.id)}
                  showActions
                  userRole="user"
                  isEnrolled={enrolledIds.has(eg.id)}
                />
              ))}
            </div>
          );
        })()
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <DashboardPageContent />
    </Suspense>
  );
}
