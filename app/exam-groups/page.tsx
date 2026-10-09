import { redirect } from "next/navigation";

export default function ExamGroupsRedirect() {
  redirect("/dashboard?tab=exam-groups");
}
