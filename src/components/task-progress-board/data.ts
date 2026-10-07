/* Types + demo data for the Task Progress Board. */

export type BoardTone = "slate" | "blue" | "amber" | "green";
export type TaskPriority = "high" | "medium" | "low";

export interface BoardColumn {
  id: string;
  label: string;
  /** Colour family for the column. Defaults by position: slate, blue, amber, green. */
  tone?: BoardTone;
  /** Optional work-in-progress limit. The count turns red when the column goes over it. */
  limit?: number;
  /** Marks the column that counts as finished (default: the last column). */
  done?: boolean;
}

export interface BoardPerson {
  id: string;
  name: string;
  /** Avatar colour. Worked out from the position when omitted. */
  color?: string;
}

export interface BoardTask {
  id: string;
  title: string;
  /** The id of the column the task sits in. */
  status: string;
  /** A person id. */
  assignee?: string;
  /** YYYY-MM-DD */
  due?: string;
  priority?: TaskPriority;
  checklist?: { done: number; total: number };
}

export interface TaskBoardData {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  today?: string;
  columns: BoardColumn[];
  people: BoardPerson[];
  tasks: BoardTask[];
}

export const demoBoard: TaskBoardData = {
  eyebrow: "Sprint board",
  title: "Website relaunch · Brightside Dental",
  subtitle: "Sprint 14 · 29 Sep – 10 Oct 2026",
  today: "2026-10-02",
  columns: [
    { id: "todo", label: "To do", tone: "slate" },
    { id: "doing", label: "In progress", tone: "blue", limit: 3 },
    { id: "review", label: "Review", tone: "amber" },
    { id: "done", label: "Done", tone: "green", done: true },
  ],
  people: [
    { id: "mc", name: "Maya Chen" },
    { id: "jo", name: "Jonah Okafor" },
    { id: "pr", name: "Priya Raman" },
    { id: "lb", name: "Leo Brandt" },
  ],
  tasks: [
    { id: "BD-148", title: "Write FAQ copy for the clear aligners page", status: "todo", assignee: "pr", due: "2026-10-07", priority: "medium", checklist: { done: 0, total: 4 } },
    { id: "BD-151", title: "Set up call-tracking numbers", status: "todo", assignee: "lb", due: "2026-10-09", priority: "low", checklist: { done: 0, total: 3 } },
    { id: "BD-152", title: "Collect six new patient testimonials", status: "todo", assignee: "mc", due: "2026-10-06", priority: "medium", checklist: { done: 1, total: 6 } },
    { id: "BD-139", title: "Rebuild the booking form as three short steps", status: "doing", assignee: "jo", due: "2026-10-03", priority: "high", checklist: { done: 3, total: 5 } },
    { id: "BD-143", title: "Compress hero images and lazy-load the gallery", status: "doing", assignee: "lb", due: "2026-10-01", priority: "high", checklist: { done: 2, total: 4 } },
    { id: "BD-146", title: "Draft the October email newsletter", status: "doing", assignee: "pr", due: "2026-10-05", priority: "medium", checklist: { done: 1, total: 3 } },
    { id: "BD-135", title: "Location pages for Eastside and Midtown", status: "review", assignee: "mc", due: "2026-10-02", priority: "high", checklist: { done: 5, total: 6 } },
    { id: "BD-141", title: "Refresh the map listing photos", status: "review", assignee: "jo", due: "2026-10-04", priority: "low", checklist: { done: 4, total: 4 } },
    { id: "BD-128", title: "Move blog posts to the new CMS", status: "done", assignee: "lb", due: "2026-09-29", priority: "medium", checklist: { done: 8, total: 8 } },
    { id: "BD-130", title: "New colour palette and type scale", status: "done", assignee: "mc", due: "2026-09-30", priority: "medium", checklist: { done: 5, total: 5 } },
    { id: "BD-132", title: "Update the cookie banner and privacy page", status: "done", assignee: "jo", due: "2026-09-30", priority: "low", checklist: { done: 3, total: 3 } },
    { id: "BD-136", title: "Track booking-form submissions as conversions", status: "done", assignee: "pr", due: "2026-10-01", priority: "high", checklist: { done: 4, total: 4 } },
  ],
};
