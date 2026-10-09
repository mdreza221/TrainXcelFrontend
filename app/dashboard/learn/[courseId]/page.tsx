"use client";

import React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CourseDetailView } from "@/components/CourseDetailView";
import { useUser } from "@/hooks/useUser";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function LearnerCourseDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const courseId = params.courseId as string;
  const { role, userId } = useUser();

  const fromSource = searchParams.get("from") || "my-learning";
  const backUrl = `/dashboard?tab=${fromSource}`;
  const lessonParam = searchParams.get("lesson");
  const tabParam = searchParams.get("tab");

  const isAdminOrEmployee = role === "admin" || role === "employee";
  const isAdmin = role === "admin";

  return (
    <ProtectedRoute>
      <CourseDetailView
        courseId={courseId}
        backUrl={backUrl}
        isAdminOrEmployee={isAdminOrEmployee}
        isAdmin={isAdmin}
        userId={userId}
        initialLessonId={lessonParam}
        initialTab={tabParam}
      />
    </ProtectedRoute>
  );
}
