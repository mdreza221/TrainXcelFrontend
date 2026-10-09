"use client";

import { useEffect, useState } from "react";
import { api } from "@/libs/api";
import { useUser } from "@/hooks/useUser";

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface DashboardStats {
  totalUsers: number;
  totalCourses: number;
  totalEmployees: number;
  overallCompletionRate: number;
}

export interface MonthlyProgress {
  month: string;
  progress: number;
}

export interface CourseComparison {
  courseId: string;
  name: string;
  enrolledCount: number;
  completionRate: number;
}

export interface CategoryStat {
  categoryId: number;
  categoryName: string;
  coursesCount: number;
  totalEnrolled: number;
  averageProgress: number;
}

export interface MaterialStat {
  materialType: string;
  availableLessonsCount: number;
  totalCompletedLessonsCount: number;
}

export interface AtRiskUser {
  userId: string;
  name: string;
  email: string;
  courseId: string;
  courseName: string;
  progress: number;
}

export interface RecentActivity {
  activityId: number;
  type: string;
  userId: string;
  userName: string;
  courseId: string;
  courseName: string;
  message: string;
  timestamp: string;
}

export interface UserPerformance {
  userId: string;
  name: string;
  email: string;
  role: string;
  completedCoursesCount: number;
  activeCoursesCount: number;
  averageProgress: number;
}

export function useDashboardStats() {
  const { userId, role } = useUser();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthly, setMonthly] = useState<MonthlyProgress[]>([]);
  const [courseComparison, setCourseComparison] = useState<CourseComparison[]>([]);
  const [categories, setCategories] = useState<PaginatedResponse<CategoryStat> | null>(null);
  const [materials, setMaterials] = useState<MaterialStat[]>([]);
  const [atRisk, setAtRisk] = useState<PaginatedResponse<AtRiskUser> | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [userPerformance, setUserPerformance] = useState<PaginatedResponse<UserPerformance> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingLeaderboard, setIsFetchingLeaderboard] = useState(false);
  const [isFetchingCategories, setIsFetchingCategories] = useState(false);
  const [isFetchingAtRisk, setIsFetchingAtRisk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    if (role === 'user') {
      setIsLoading(false);
      return;
    }

    const fetchAll = async () => {
      try {
        const [
          statsRes,
          monthlyRes,
          comparisonRes,
          categoriesRes,
          materialsRes,
          atRiskRes,
          activityRes,
          userPerfRes,
        ] = await Promise.all([
          api.get("/courses/stats/dashboard"),
          api.get("/courses/stats/monthly-progress"),
          api.get("/courses/stats/course-progress-comparison"),
          api.get("/courses/stats/categories?page=1&limit=6"),
          api.get("/courses/stats/materials"),
          api.get("/courses/stats/at-risk?page=1&limit=6"),
          api.get("/courses/stats/recent-activity"),
          api.get("/courses/stats/user-performance?page=1&limit=6"),
        ]);

        setStats(statsRes.data);
        setMonthly(monthlyRes.data);
        setCourseComparison(comparisonRes.data);
        setCategories(categoriesRes.data);
        setMaterials(materialsRes.data);
        setAtRisk(atRiskRes.data);
        setRecentActivity(activityRes.data);
        setUserPerformance(userPerfRes.data);
      } catch {
        setError("Failed to load dashboard data.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, [userId, role]);

  const fetchUserPerformance = async (page: number) => {
    setIsFetchingLeaderboard(true);
    try {
      const res = await api.get(`/courses/stats/user-performance?page=${page}&limit=6`);
      setUserPerformance(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingLeaderboard(false);
    }
  };

  const fetchCategories = async (page: number) => {
    setIsFetchingCategories(true);
    try {
      const res = await api.get(`/courses/stats/categories?page=${page}&limit=6`);
      setCategories(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingCategories(false);
    }
  };

  const fetchAtRisk = async (page: number) => {
    setIsFetchingAtRisk(true);
    try {
      const res = await api.get(`/courses/stats/at-risk?page=${page}&limit=6`);
      setAtRisk(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingAtRisk(false);
    }
  };

  return {
    stats,
    monthly,
    courseComparison,
    categories,
    materials,
    atRisk,
    recentActivity,
    userPerformance,
    isLoading,
    error,
    fetchUserPerformance,
    fetchCategories,
    fetchAtRisk,
    isFetchingLeaderboard,
    isFetchingCategories,
    isFetchingAtRisk,
  };
}
