export function formatAction(action: string) {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
}

const ACTION_COLORS: Record<string, string> = {
  COURSE_CREATED: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40",
  COURSE_UPDATED: "bg-teal-50 text-teal-700 border-teal-100 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900/40",
  COURSE_STATUS_CHANGED: "bg-cyan-50 text-cyan-700 border-cyan-100 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-900/40",
  COURSE_DELETED: "bg-red-50 text-red-700 border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40",
  COURSE_RESTORED: "bg-lime-50 text-lime-700 border-lime-100 dark:bg-lime-950/30 dark:text-lime-400 dark:border-lime-900/40",
  COURSE_PERMANENTLY_DELETED: "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/40",
  LESSON_CREATED: "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40",
  LESSON_UPDATED: "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/40",
  LESSON_DELETED: "bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/40",
  LESSON_RESTORED: "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900/40",
  LESSON_PERMANENTLY_DELETED: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100 dark:bg-fuchsia-950/30 dark:text-fuchsia-400 dark:border-fuchsia-900/40",
  TEST_CREATED: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40",
  TEST_UPDATED: "bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-900/40",
  TEST_DELETED: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800/40",
  TEST_MARKS_EVALUATED: "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900/40",
  MARKS_EDITED: "bg-pink-50 text-pink-700 border-pink-100 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-900/40",
  CATEGORY_CREATED: "bg-green-50 text-green-700 border-green-100 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900/40",
  CATEGORY_DELETED: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800/40",
  USER_ENROLLED: "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900/40",
  EMPLOYEE_CREATED: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-800/40",
  PROFILE_UPDATED: "bg-slate-50 text-slate-700 border-slate-100 dark:bg-slate-950/30 dark:text-slate-400 dark:border-slate-900/40",
  ROLE_CHANGED: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800/40",
  USER_LOGIN: "bg-zinc-50 text-zinc-700 border-zinc-100 dark:bg-zinc-950/30 dark:text-zinc-400 dark:border-zinc-900/40",
  USER_LOGOUT: "bg-gray-50 text-gray-700 border-gray-100 dark:bg-gray-950/30 dark:text-gray-400 dark:border-gray-900/40",
  CERTIFICATE_APPLIED: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800/40",
  CERTIFICATE_GENERATED: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800/40",
  CERTIFICATE_REJECTED: "bg-red-200 text-red-900 border-red-300 dark:bg-red-900/60 dark:text-red-200 dark:border-red-800/60",
  RECYCLE_BIN_EMPTIED: "bg-neutral-50 text-neutral-700 border-neutral-100 dark:bg-neutral-950/30 dark:text-neutral-400 dark:border-neutral-900/40",
};

const DEFAULT_COLOR = "bg-slate-200 text-slate-800 border-slate-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700";

export function getActionBadgeClasses(action: string) {
  return ACTION_COLORS[action] || DEFAULT_COLOR;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900/30",
  employee: "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900/30",
  user: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
};

const DEFAULT_ROLE_COLOR = "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900/30";

export function getRoleBadgeClasses(role: string) {
  return ROLE_COLORS[role] || DEFAULT_ROLE_COLOR;
}
