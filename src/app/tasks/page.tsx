import type { Metadata } from "next";
import { ComingNext } from "@/components/ui/ComingNext";

export const metadata: Metadata = { title: "Tasks — Steady" };

export default function TasksPage() {
  return (
    <ComingNext
      title="Tasks"
      intro="The full list lives here, so the Focus screen never has to show it. For now you can add and complete tasks from Focus or from a course."
      items={[
        "Breaking an assignment into sub-steps, with a suggested first step.",
        "A Pomodoro timer attached to the step you are on, not to the app in general.",
        "Grouping by course and by week, with everything past this week collapsed by default.",
      ]}
    />
  );
}
