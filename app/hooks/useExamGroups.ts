"use client";

import { useState, useEffect } from "react";
import { api } from "@/libs/api";
import toast from "react-hot-toast";

export interface ExamGroup {
  id: number;
  examGroupId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  status: string;
  startTime: string | null;
  endTime: string | null;
  timePerQuestion: number | null;
  totalStudents: number;
  totalQuestions?: number;
}

export interface ExamGroupQuestion {
  id: number;
  questionText: string;
  options: string[];
  correctAnswers: string[];
  marks: number;
}

export interface ExamGroupEnrollment {
  id: number;
  user: {
    id: number;
    name: string;
    email: string;
    userId: string;
  };
  createdAt: string;
}

export interface ExamGroupSubmission {
  id: number;
  marksObtained: number;
  status: string;
  user: {
    id: number;
    name: string;
    email: string;
    userId: string;
  };
  submittedAt: string;
}

export function useExamGroups(role: string, userId?: string) {
  const [examGroups, setExamGroups] = useState<ExamGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<any>(null);

  const fetchExamGroups = async (page = 1, q?: string, status?: string) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 10 };
      if (q) params.q = q;
      if (status) params.status = status;
      const res = await api.get("/exam-groups", { params });
      const data = res.data;
      if (Array.isArray(data)) {
        setExamGroups(data);
        setMeta({ totalItems: data.length, totalPages: 1, currentPage: 1 });
      } else {
        setExamGroups(data.data || []);
        setMeta(data.meta || {});
      }
    } catch {
      setExamGroups([]);
    } finally {
      setLoading(false);
    }
  };

  return { examGroups, loading, meta, fetchExamGroups };
}

export function useExamGroupDetail() {
  const [examGroup, setExamGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchExamGroup = async (id: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/exam-groups/${id}`);
      setExamGroup(res.data);
    } catch {
      setExamGroup(null);
    } finally {
      setLoading(false);
    }
  };

  return { examGroup, loading, fetchExamGroup };
}

export function useExamGroupSubmissions(examGroupId: number) {
  const [submissions, setSubmissions] = useState<ExamGroupSubmission[]>([]);
  const [remaining, setRemaining] = useState<{ remaining: number; totalEnrolled: number; totalSubmitted: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubmissions = async () => {
    if (!examGroupId) return;
    setLoading(true);
    try {
      const [subRes, remRes] = await Promise.all([
        api.get(`/exam-groups/${examGroupId}/submissions`),
        api.get(`/exam-groups/${examGroupId}/remaining`),
      ]);
      setSubmissions(subRes.data || []);
      setRemaining(remRes.data || null);
    } catch {
      setSubmissions([]);
      setRemaining(null);
    } finally {
      setLoading(false);
    }
  };

  return { submissions, remaining, loading, fetchSubmissions };
}

export function useMyExamSubmissions(examGroupId: number, userId: string) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMySubmissions = async () => {
    if (!examGroupId || !userId) return;
    setLoading(true);
    try {
      const res = await api.get(`/exam-groups/${examGroupId}/my-submissions?userId=${encodeURIComponent(userId)}`);
      setSubmissions(res.data || []);
    } catch {
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  return { submissions, loading, fetchMySubmissions };
}
