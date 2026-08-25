import type { Metadata } from "next";
import { CourseGrid } from "@/components/courses/CourseGrid";

export const metadata: Metadata = { title: "Courses — Steady" };

export default function CoursesPage() {
  return <CourseGrid />;
}
