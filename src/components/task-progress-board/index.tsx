import { useState } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { DemoBar, DemoButton } from "../../ui";
import { TaskProgressBoard, type TaskMoveDetail } from "./TaskProgressBoard";
import { demoBoard } from "./data";

const COL_NAMES: Record<string, string> = Object.fromEntries(demoBoard.columns.map(c => [c.id, c.label]));

export function Demo({ mode }: { mode: DemoMode }) {
  const [version, setVersion] = useState(0);
  const [last, setLast] = useState<TaskMoveDetail | null>(null);
  const board = (
    <TaskProgressBoard key={version} eyebrow={demoBoard.eyebrow} title={demoBoard.title} subtitle={demoBoard.subtitle}
      today={demoBoard.today} columns={demoBoard.columns} people={demoBoard.people} tasks={demoBoard.tasks}
      onTaskMove={mode === "page" ? d => setLast(d) : undefined} />
  );
  if (mode === "preview") return board;
  return (
    <div className="flex w-full flex-col items-center gap-6">
      {board}
      <DemoBar note="Example data — not real client results.">
        <span aria-live="polite" className="max-w-[46ch] font-mono text-[11.5px] text-ink-3">
          {last ? <><b className="font-semibold text-ink">{last.id} → {COL_NAMES[last.to] ?? last.to}</b> via {last.via} · onTaskMove · progress {last.progress}%</> : "Drag a card, use ← → or the Move menu."}
        </span>
        <DemoButton icon="refresh" onClick={() => { setVersion(v => v + 1); setLast(null); }}>Reset board</DemoButton>
      </DemoBar>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "tasks", type: "BoardTask[]", description: "Initial tasks: { id, title, status (column id), assignee?, due? (YYYY-MM-DD), priority? ('high' | 'medium' | 'low'), checklist? { done, total } }. The board keeps its own order and status after that; change the key to reset." },
    { name: "columns", type: "BoardColumn[]", description: "{ id, label, tone?, limit?, done? } in board order. tone is slate, blue, amber or green. limit is a work-in-progress limit (the count turns red above it). done marks the finished column (default: the last)." },
    { name: "people", type: "BoardPerson[]", description: "{ id, name, color? }. Initials and avatar colours are worked out from the name and position." },
    { name: "eyebrow · title · subtitle", type: "string", description: "Optional header text." },
    { name: "today", type: "string", description: "YYYY-MM-DD used to mark due dates as overdue, today or tomorrow. Defaults to the real date." },
    { name: "assignee · defaultAssignee", type: "string", description: "Assignee filter: a person id or 'all'. Pass assignee to control it, or defaultAssignee to start from a person." },
    { name: "labels", type: "Partial<TaskBoardLabels>", description: "Override any built-in text, e.g. { progress: 'Sprint progress' }." },
    { name: "locale", type: "string", description: "Locale for due dates (default en-US)." },
    { name: "ref", type: "Ref<TaskBoardHandle>", description: "Imperative handle: moveTask(id, column, index?) and getTasks()." },
  ],
  usage: `import { TaskProgressBoard, type TaskBoardHandle } from "./TaskProgressBoard";

const board = useRef<TaskBoardHandle>(null);

<TaskProgressBoard
  ref={board}
  title="Website relaunch"
  today="2026-10-02"
  columns={[
    { id: "todo", label: "To do", tone: "slate" },
    { id: "doing", label: "In progress", tone: "blue", limit: 3 },
    { id: "done", label: "Done", tone: "green", done: true },
  ]}
  people={[{ id: "mc", name: "Maya Chen" }]}
  tasks={[{ id: "BD-148", title: "Write FAQ copy", status: "todo", assignee: "mc",
            due: "2026-10-07", priority: "medium", checklist: { done: 0, total: 4 } }]}
  onTaskMove={(d, tasks) => save(tasks)}
/>

board.current?.moveTask("BD-148", "done");`,
  events: [
    { name: "onTaskMove(detail, tasks)", description: "A card moved by drag, arrow key, the Move menu or moveTask(). detail = { id, title, from, to, index, via: 'drag' | 'keyboard' | 'menu' | 'api', progress } plus a copy of all tasks." },
    { name: "onAssigneeChange(assignee)", description: "An assignee chip was picked ('all' or a person id)." },
  ],
  notes: [
    "Mouse: drag after 6 px. Touch: long-press a card or drag its grip. Esc cancels a drag.",
    "Keyboard: focus a card, ← / → moves it to the next column, ↑ / ↓ / Home / End moves focus, Enter or Space opens the Move menu.",
    "Below ~512 px the columns stack into collapsible sections; dragging over a collapsed column opens it.",
  ],
};
