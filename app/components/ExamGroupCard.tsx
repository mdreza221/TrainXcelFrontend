import { ExamGroup } from "@/hooks/useExamGroups";
import { Clock, Users, FileText, BookOpen, Trash2 } from "lucide-react";

interface ExamGroupCardProps {
  examGroup: ExamGroup;
  onClick?: () => void;
  onManage?: () => void;
  onJoin?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
  userRole?: string;
  isEnrolled?: boolean;
}

export function ExamGroupCard({
  examGroup,
  onClick,
  onManage,
  onJoin,
  onDelete,
  showActions = true,
  userRole = "user",
  isEnrolled = false,
}: ExamGroupCardProps) {
  const statusColors: Record<string, string> = {
    draft: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
    active: "bg-green-50 text-green-600 border-green-100 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30",
    completed: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30",
    cancelled: "bg-red-50 text-red-600 border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30",
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "Not set";
    const d = new Date(dateStr);
    return d.toLocaleString();
  };

  const totalMins = examGroup.timePerQuestion ?? null;
  const isEnded = examGroup.endTime ? new Date(examGroup.endTime).getTime() < new Date().getTime() : false;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition flex flex-col">
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono">
              {examGroup.examGroupId}
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-50 mt-1 line-clamp-2">
              {examGroup.title}
            </h3>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${isEnded ? "bg-slate-100 text-slate-500 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700" : statusColors[examGroup.status] || statusColors.draft}`}>
              {isEnded ? "Ended" : examGroup.status}
            </span>
            {userRole === "admin" && onDelete && (
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition dark:hover:bg-red-950/30"
                title="Delete Exam Group"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2">
          {examGroup.description || "No description provided."}
        </p>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-zinc-400">
          <span className="flex items-center gap-1">
            <FileText size={12} className="text-blue-500" />
            {examGroup.totalQuestions ?? 0} questions
          </span>
          <span className="flex items-center gap-1">
            <Users size={12} className="text-purple-500" />
            {examGroup.totalStudents} enrolled
          </span>
          {totalMins && (
            <span className="flex items-center gap-1">
              <Clock size={12} className="text-amber-500" />
              {totalMins} min
            </span>
          )}
        </div>

        <div className="text-[11px] text-slate-400 dark:text-zinc-500 flex flex-col gap-0.5">
          <span>Starts: {formatDateTime(examGroup.startTime)}</span>
          <span>Ends: {formatDateTime(examGroup.endTime)}</span>
        </div>
      </div>

      {showActions && (
        <div className="px-5 py-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2">
          {userRole !== "user" && (
            <button
              onClick={(e) => { e.stopPropagation(); onManage?.(); }}
              className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
            >
              <BookOpen size={12} /> Manage
            </button>
          )}
          {userRole === "user" && !isEnded && !isEnrolled && (
            <button
              onClick={(e) => { e.stopPropagation(); onJoin?.(); }}
              disabled={examGroup.status !== "active"}
              className="flex items-center gap-1 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 text-xs font-bold transition"
            >
              Join Exam
            </button>
          )}
          {userRole === "user" && isEnded && (
            <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 px-2 py-1.5">
              Exam Ended
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onClick?.(); }}
            className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
          >
            View
          </button>
        </div>
      )}
    </div>
  );
}
