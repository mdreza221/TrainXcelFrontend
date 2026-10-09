"use client";

import { useState, useCallback } from "react";
import { api } from "@/libs/api";

type ApiErrorShape = {
  response?: {
    data?: {
      message?: string;
    };
  };
};


export interface Lesson {
  id: number;
  lessonId: string;
  title: string;
  description?: string;
  materialType: string;
  materialLink: string;
  status: string;
  practiceEnabled?: boolean;
  deletedAt?: string;
  tests?: { id: number }[];
}

export interface Course {
  id: number;
  courseId: string;
  name: string;
  enrolled: number;
  status: string;
  categoryId: number;
  lessons?: Lesson[];
  categoryName?: string;
  totalLessons?: number;
  progress?: number;
  description?: string;
  thumbnailUrl?: string;
}

export interface UserProfile {
  id: number;
  userId: string;
  email: string;
  name: string;
  role: string;
  phoneNumber?: string;
  address?: string;
  profilePictureUrl?: string;
}

export function useCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async (query: string = "") => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get(`/courses/search?q=${encodeURIComponent(query)}`);
      setCourses(response.data || []);
    } catch (err) {
      const message = (err as ApiErrorShape)?.response?.data?.message;
      setError(message || "Failed to fetch courses.");

    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMyLearning = useCallback(async (page: number = 1, limit: number = 6, status: string = 'all') => {
    try {
      const response = await api.get(`/courses/my-learning?page=${page}&limit=${limit}&status=${status}`);
      return response.data;
    } catch (err) {
      const message = (err as ApiErrorShape)?.response?.data?.message;
      throw new Error(message || "Failed to fetch my learning courses.");
    }
  }, []);

  const enrollInCourse = useCallback(async (courseId: string) => {
    try {
      const response = await api.post(`/courses/${courseId}/enroll`);
      return response.data;
    } catch (err) {
      const message = (err as ApiErrorShape)?.response?.data?.message;
      throw new Error(message || "Failed to enroll in course.");

    }
  }, []);

  const completeLesson = useCallback(async (courseId: string, lessonId: string) => {
    try {
      const response = await api.post(`/courses/${courseId}/lessons/${lessonId}/complete`);
      return response.data;
    } catch (err) {
      const message = (err as ApiErrorShape)?.response?.data?.message;
      throw new Error(message || "Failed to complete lesson.");

    }
  }, []);

  const createCourse = useCallback(async (courseData: { name: string; categoryId?: number; status?: string; description?: string; thumbnailUrl?: string }) => {
    try {
      const response = await api.post("/courses", courseData);
      return response.data;
    } catch (err) {
      const message = (err as ApiErrorShape)?.response?.data?.message;
      throw new Error(message || "Failed to create course.");

    }
  }, []);

  const addLesson = useCallback(
    async (
      courseId: string,
      lessonData: {
        title: string;
        description?: string;
        materialType: "Video" | "PDF" | "PPT" | "DOCX";
        materialLink: string;
        status?: string;
        practiceEnabled?: boolean;
      }
    ) => {
      try {
        const response = await api.post(`/courses/${courseId}/lessons`, lessonData);
        return response.data;
      } catch (err) {
        const message = (err as ApiErrorShape)?.response?.data?.message;
        throw new Error(message || "Failed to add lesson.");
      }

    },
    []
  );

  const updateCourse = useCallback(async (courseId: string, data: { name?: string; categoryId?: number; status?: string; description?: string; thumbnailUrl?: string }) => {
    try {
      const res = await api.patch(`/courses/${courseId}`, data);
      return res.data;
    } catch (err) {
      const message = (err as ApiErrorShape)?.response?.data?.message;
      throw new Error(message || "Failed to update course.");
    }
  }, []);

  const updateLesson = useCallback(async (courseId: string, lessonId: string, data: { title?: string; description?: string; materialType?: string; materialLink?: string; status?: string; practiceEnabled?: boolean }) => {
    try {
      const res = await api.patch(`/courses/${courseId}/lessons/${lessonId}`, data);
      return res.data;
    } catch (err) {
      const message = (err as ApiErrorShape)?.response?.data?.message;
      throw new Error(message || "Failed to update lesson.");
    }
  }, []);


  const searchUsers = useCallback(async (query: string = "") => {
    try {
      const response = await api.get(`/auth/users/search?q=${encodeURIComponent(query)}`);
      return response.data as UserProfile[];
    } catch (err) {
      const message = (err as ApiErrorShape)?.response?.data?.message;
      throw new Error(message || "Failed to search users.");
    }
  }, []);

  const updateUserRole = useCallback(async (userId: string, role: string) => {
    try {
      const response = await api.patch(`/auth/users/${userId}/role`, { role });
      return response.data;
    } catch (err) {
      const message = (err as ApiErrorShape)?.response?.data?.message;
      throw new Error(message || "Failed to update user role.");
    }
  }, []);

  const updateProfile = useCallback(async (userId: string, data: { name: string; phoneNumber?: string; address?: string }) => {
    try {
      const response = await api.patch(`/auth/users/${userId}`, data);
      return response.data;
    } catch (err) {
      const message = (err as ApiErrorShape)?.response?.data?.message;
      throw new Error(message || "Failed to update profile.");
    }
  }, []);


  const fetchCoursesPaginated = useCallback(async (
    page: number = 1,
    limit: number = 6,
    q: string = "",
    categoryId: number | null = null,
    status: string = ""
  ) => {
    try {
      let url = `/courses?page=${page}&limit=${limit}`;
      if (q) url += `&q=${encodeURIComponent(q)}`;
      if (categoryId) url += `&categoryId=${categoryId}`;
      if (status && status !== "all") url += `&status=${status}`;
      const response = await api.get(url);
      return response.data;
    } catch (err) {
      const message = (err as ApiErrorShape)?.response?.data?.message;
      throw new Error(message || "Failed to fetch paginated courses.");
    }
  }, []);


  const fetchUsersPaginated = useCallback(async (page: number = 1, limit: number = 10) => {
    try {
      const response = await api.get(`/auth/users?page=${page}&limit=${limit}`);
      return response.data;
    } catch (err) {
      const message = (err as ApiErrorShape)?.response?.data?.message;
      throw new Error(message || "Failed to fetch paginated users.");
    }

  }, []);

  const softDeleteCourse = useCallback(async (courseId: string) => {
    try {
      const res = await api.delete(`/courses/${courseId}`);
      return res.data;
    } catch (err) {
      const message = (err as ApiErrorShape)?.response?.data?.message;
      throw new Error(message || "Failed to delete course.");
    }
  }, []);

  const softDeleteLesson = useCallback(async (courseId: string, lessonId: string) => {
    try {
      const res = await api.delete(`/courses/${courseId}/lessons/${lessonId}`);
      return res.data;
    } catch (err) {
      const message = (err as ApiErrorShape)?.response?.data?.message;
      throw new Error(message || "Failed to delete lesson.");
    }
  }, []);

  const fetchTrash = useCallback(
    async (params: {
      q?: string;
      type?: "course" | "lesson" | "all";
      sortOrder?: "ASC" | "DESC";
    } = {}) => {
      try {
        const { q = "", type = "all", sortOrder = "DESC" } = params;
        const query = new URLSearchParams();
        if (q) query.set("q", q);
        if (type && type !== "all") query.set("type", type);
        if (sortOrder) query.set("sortOrder", sortOrder);

        const res = await api.get(`/courses/trash${query.toString() ? `?${query.toString()}` : ""}`);
        return res.data;
      } catch (err) {
        const message = (err as ApiErrorShape)?.response?.data?.message;
        throw new Error(message || "Failed to fetch recycle bin items.");
      }
    },
    []
  );

  const restoreCourse = useCallback(async (courseId: string) => {
    try {
      const res = await api.patch(`/courses/${courseId}/restore`);
      return res.data;
    } catch (err) {
      const message = (err as ApiErrorShape)?.response?.data?.message;
      throw new Error(message || "Failed to restore course.");
    }
  }, []);

  const restoreLesson = useCallback(async (courseId: string, lessonId: string) => {
    try {
      const res = await api.patch(`/courses/${courseId}/lessons/${lessonId}/restore`);
      return res.data;
    } catch (err) {
      const message = (err as ApiErrorShape)?.response?.data?.message;
      throw new Error(message || "Failed to restore lesson.");
    }
  }, []);

  const hardDeleteCourse = useCallback(async (courseId: string) => {
    try {
      const res = await api.delete(`/courses/${courseId}/permanent`);
      return res.data;
    } catch (err) {
      const message = (err as ApiErrorShape)?.response?.data?.message;
      throw new Error(message || "Failed to permanently delete course.");
    }
  }, []);

  const hardDeleteLesson = useCallback(async (courseId: string, lessonId: string) => {
    try {
      const res = await api.delete(`/courses/${courseId}/lessons/${lessonId}/permanent`);
      return res.data;
    } catch (err) {
      const message = (err as ApiErrorShape)?.response?.data?.message;
      throw new Error(message || "Failed to permanently delete lesson.");
    }
  }, []);

  const emptyTrash = useCallback(async () => {
    try {
      const res = await api.delete(`/courses/trash/empty`);
      return res.data;
    } catch (err) {
      const message = (err as ApiErrorShape)?.response?.data?.message;
      throw new Error(message || "Failed to empty recycle bin.");
    }
  }, []);

  const createEmployee = useCallback(async (employeeData: {
    email: string;
    name: string;
    password?: string;
    phoneNumber?: string;
    address?: string;
    role?: string;
  }) => {
    try {
      const response = await api.post("/auth/users/employee", employeeData);
      return response.data;
    } catch (err) {
      const message = (err as ApiErrorShape)?.response?.data?.message;
      throw new Error(message || "Failed to create employee.");
    }
  }, []);

  return {
    courses,
    isLoading,
    error,
    fetchCourses,
    fetchMyLearning,
    enrollInCourse,
    completeLesson,
    createCourse,
    addLesson,
    searchUsers,
    updateUserRole,
    updateProfile,
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
  };
}
