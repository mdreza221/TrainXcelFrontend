"use client";

import DashboardLayout from "../dashboard/layout";

export default function ExamGroupsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
