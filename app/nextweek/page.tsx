"use client";

import { useEffect, useMemo, useState } from "react";

type Priority = "none" | "low" | "medium" | "high" | "urgent";
type ActionKey = "reload" | "reset" | "sort" | "save" | "add" | null;

type Task = {
  id: string;
  project: string;
  week: string;
  title: string;
  text: string;
  progress?: string;
  sourceRow: number;
  lane?: string;
  isCustom?: boolean;
  priority?: Priority;
};

type ApiData = {
  generatedAt: string;
  sheetName: string;
  lanes: string[];
  tasks: Task[];
};

const DEFAULT_LANES = ["未整理", "月", "火", "水", "木", "金", "完了"];
const STORAGE_KEY = "nextweek-task-board:vercel:v1";
const CUSTOM_TASKS_KEY = "nextweek-task-board:custom-tasks:v1";
const PRIORITY_OPTIONS: Array<{ value: Priority; label: string }> = [
  { value: "none", label: "重要度なし" },
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
  { value: "urgent", label: "最優先" },
];

const PRIORITY_WEIGHT: Record<Priority, number> = {
  urgent: 5,
  high: 4,
  medium: 3,
  low: 2,
  none: 1,
};

const PRIORITY_STYLES: Record<Priority, { card: string; pill: string; label: string }> = {
  none: {
    card: "border-l-[#5f3dc4] bg-white",
    pill: "bg-slate-100 text-slate-600",
    label: "重要度なし",
  },
  low: {
    card: "border-l-[#0f766e] bg-emerald-50/40",
    pill: "bg-emerald-100 text-emerald-800",
    label: "低",
  },
  medium: {
    card: "border-l-[#d97706] bg-amber-50/50",
    pill: "bg-amber-100 text-amber-800",
    label: "中",
  },
  high: {
    card: "border-l-[#dc2626] bg-red-50/50",
    pill: "bg-red-100 text-red-800",
    label: "高",
  },
  urgent: {
    card: "border-l-[#7c2d12] bg-orange-100/70",
    pill: "bg-orange-200 text-orange-950",
    label: "最優先",
  },
};

export default function NextweekPage() {
  const [lanes, setLanes] = useState(DEFAULT_LANES);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskLane, setNewTaskLane] = useState("未整理");
  const [status, setStatus] = useState("読み込み中...");
  const [error, setError] = useState("");
  const [activeAction, setActiveAction] = useState<ActionKey>("reload");
  const [completedAction, setCompletedAction] = useState<ActionKey>(null);

  useEffect(() => {
    void loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleTasks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return tasks;
    return tasks.filter((task) =>
      [task.project, task.week, task.title, task.text, task.progress]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [query, tasks]);

  async function loadTasks(feedbackAction: Exclude<ActionKey, null> = "reload") {
    setActiveAction(feedbackAction);
    setCompletedAction(null);
    setStatus("読み込み中...");
    setError("");
    try {
      const response = await fetch("/api/nextweek/tasks", { cache: "no-store" });
      const data = (await response.json()) as ApiData & { error?: string; detail?: string };
      if (!response.ok || data.error) {
        throw new Error(data.error || data.detail || "データ取得に失敗しました");
      }

      const saved = loadSaved();
      const customTasks = loadCustomTasks();
      const savedById = new Map(saved.map((item) => [item.id, item]));
      const sourceTasks = [...data.tasks, ...customTasks];
      const activeLanes = data.lanes.length ? data.lanes : DEFAULT_LANES;
      const merged = sourceTasks
        .map((task, index) => {
          const savedItem = savedById.get(task.id);
          return {
            ...task,
            lane:
              savedItem?.lane && activeLanes.includes(savedItem.lane)
                ? savedItem.lane
                : task.lane && activeLanes.includes(task.lane)
                  ? task.lane
                  : "未整理",
            priority: savedItem?.priority || task.priority || "none",
            rank: savedItem?.rank ?? index,
          };
        })
        .sort((a, b) => {
          const laneDiff = activeLanes.indexOf(a.lane || "未整理") - activeLanes.indexOf(b.lane || "未整理");
          return laneDiff || a.rank - b.rank || a.sourceRow - b.sourceRow;
        });

      setLanes(activeLanes);
      setNewTaskLane((current) => (activeLanes.includes(current) ? current : "未整理"));
      setTasks(merged);
      setStatus(`${data.sheetName} から ${data.tasks.length} 件、自分用 ${customTasks.length} 件を読み込みました`);
      flashCompleted(feedbackAction);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("読み込みに失敗しました");
    } finally {
      setActiveAction(null);
    }
  }

  function saveOrder(nextTasks = tasks) {
    const payload = nextTasks.map((task, index) => ({
      id: task.id,
      lane: task.lane || "未整理",
      rank: index,
      priority: task.priority || "none",
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setStatus(`${payload.length} 件の並び順を保存しました`);
    flashCompleted("save");
  }

  function resetOrder() {
    if (!window.confirm("自分用の並び順をリセットしますか？")) return;
    setActiveAction("reset");
    localStorage.removeItem(STORAGE_KEY);
    void loadTasks("reset");
  }

  function addCustomTask() {
    const text = newTaskText.trim();
    if (!text) {
      setStatus("追加するタスクを入力してください");
      return;
    }

    const customTask: Task = {
      id: `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      project: "追加タスク",
      week: "自分用",
      title: text.length > 34 ? `${text.slice(0, 34)}...` : text,
      text,
      progress: "",
      sourceRow: 0,
      lane: newTaskLane,
      isCustom: true,
      priority: "none",
    };
    const nextTasks = [...tasks, customTask];
    const nextCustomTasks = [...loadCustomTasks(), customTask];
    localStorage.setItem(CUSTOM_TASKS_KEY, JSON.stringify(nextCustomTasks));
    setTasks(nextTasks);
    setNewTaskText("");
    saveOrder(nextTasks);
    setStatus("自分用タスクを追加しました");
    flashCompleted("add");
  }

  function deleteCustomTask(taskId: string) {
    if (!window.confirm("この追加タスクを削除しますか？")) return;
    const nextTasks = tasks.filter((task) => task.id !== taskId);
    const nextCustomTasks = loadCustomTasks().filter((task) => task.id !== taskId);
    localStorage.setItem(CUSTOM_TASKS_KEY, JSON.stringify(nextCustomTasks));
    setTasks(nextTasks);
    saveOrder(nextTasks);
    setStatus("追加タスクを削除しました");
  }

  function moveTask(taskId: string, lane: string, beforeId?: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    const withoutTask = tasks.filter((item) => item.id !== taskId);
    const moved = { ...task, lane };
    const beforeIndex = beforeId ? withoutTask.findIndex((item) => item.id === beforeId) : -1;
    const nextTasks =
      beforeIndex >= 0
        ? [...withoutTask.slice(0, beforeIndex), moved, ...withoutTask.slice(beforeIndex)]
        : [...withoutTask, moved];

    setTasks(nextTasks);
    saveOrder(nextTasks);
  }

  function updatePriority(taskId: string, priority: Priority) {
    const nextTasks = tasks.map((task) => (task.id === taskId ? { ...task, priority } : task));
    const nextCustomTasks = loadCustomTasks().map((task) => (task.id === taskId ? { ...task, priority } : task));
    localStorage.setItem(CUSTOM_TASKS_KEY, JSON.stringify(nextCustomTasks));
    setTasks(nextTasks);
    saveOrder(nextTasks);
  }

  function sortByPriority() {
    const originalIndex = new Map(tasks.map((task, index) => [task.id, index]));
    const nextTasks = lanes.flatMap((lane) =>
      tasks
        .filter((task) => (task.lane || "未整理") === lane)
        .sort((a, b) => {
          const priorityDiff =
            PRIORITY_WEIGHT[b.priority || "none"] - PRIORITY_WEIGHT[a.priority || "none"];
          return priorityDiff || (originalIndex.get(a.id) || 0) - (originalIndex.get(b.id) || 0);
        }),
    );
    setTasks(nextTasks);
    saveOrder(nextTasks);
    setStatus("各レーン内を重要度が高い順に並び替えました");
    flashCompleted("sort");
  }

  function flashCompleted(action: Exclude<ActionKey, null>) {
    setCompletedAction(action);
    window.setTimeout(() => {
      setCompletedAction((current) => (current === action ? null : current));
    }, 1400);
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#17202a]">
      <header className="flex flex-col gap-3 bg-[#1e3148] px-5 py-4 text-white lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold">次週タスクボード</h1>
          <p className="mt-1 text-sm text-slate-200">週次ログの「次週のタスク」だけを自分用に整理</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 min-w-60 rounded-md border border-slate-300 px-3 text-[#17202a]"
            placeholder="検索"
            type="search"
          />
          <ActionButton
            action="reload"
            activeAction={activeAction}
            completedAction={completedAction}
            completedLabel="再読込済み"
            label="再読み込み"
            loadingLabel="読込中..."
            onClick={() => void loadTasks()}
          />
          <ActionButton
            action="reset"
            activeAction={activeAction}
            completedAction={completedAction}
            completedLabel="リセット済み"
            label="リセット"
            loadingLabel="リセット中..."
            onClick={resetOrder}
          />
          <ActionButton
            action="sort"
            activeAction={activeAction}
            completedAction={completedAction}
            completedLabel="並替済み"
            label="優先度順"
            loadingLabel="並替中..."
            onClick={sortByPriority}
          />
          <ActionButton
            action="save"
            activeAction={activeAction}
            completedAction={completedAction}
            completedLabel="保存済み"
            label="保存"
            loadingLabel="保存中..."
            onClick={() => saveOrder()}
            variant="primary"
          />
        </div>
      </header>

      <section className="px-5 py-4">
        <div className={`mb-3 text-sm ${error ? "text-red-700" : "text-slate-600"}`}>{error || status}</div>
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-[#d8dee8] bg-white p-3 shadow-sm sm:flex-row">
          <input
            value={newTaskText}
            onChange={(event) => setNewTaskText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) addCustomTask();
            }}
            className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 px-3"
            placeholder="自分用タスクを追加"
            type="text"
          />
          <select
            value={newTaskLane}
            onChange={(event) => setNewTaskLane(event.target.value)}
            className="h-10 rounded-md border border-slate-300 bg-white px-3"
          >
            {lanes.map((lane) => (
              <option key={lane} value={lane}>
                {lane}
              </option>
            ))}
          </select>
          <ActionButton
            action="add"
            activeAction={activeAction}
            completedAction={completedAction}
            completedLabel="追加済み"
            label="追加"
            loadingLabel="追加中..."
            onClick={addCustomTask}
            variant="dark"
          />
        </div>
        <div className="grid auto-cols-[minmax(220px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-4 lg:grid-flow-row lg:grid-cols-7">
          {lanes.map((lane) => {
            const laneTasks = visibleTasks.filter((task) => (task.lane || "未整理") === lane);
            return (
              <Lane
                key={lane}
                lane={lane}
                tasks={laneTasks}
                draggingId={draggingId}
                onDragStart={setDraggingId}
                onDropTask={moveTask}
                onDeleteTask={deleteCustomTask}
                onPriorityChange={updatePriority}
              />
            );
          })}
        </div>
      </section>
    </main>
  );
}

function ActionButton({
  action,
  activeAction,
  completedAction,
  completedLabel,
  label,
  loadingLabel,
  onClick,
  variant = "secondary",
}: {
  action: Exclude<ActionKey, null>;
  activeAction: ActionKey;
  completedAction: ActionKey;
  completedLabel: string;
  label: string;
  loadingLabel: string;
  onClick: () => void;
  variant?: "secondary" | "primary" | "dark";
}) {
  const isActive = activeAction === action;
  const isCompleted = completedAction === action;
  const variantClass =
    variant === "primary"
      ? "border-[#93c5fd] bg-[#dbeafe] text-[#1d4ed8] hover:bg-[#bfdbfe]"
      : variant === "dark"
        ? "border-[#1e3148] bg-[#1e3148] text-white hover:bg-[#17263a]"
        : "border-slate-300 bg-white text-[#17202a] hover:bg-slate-100";
  const stateClass = isCompleted
    ? "border-emerald-500 bg-emerald-100 text-emerald-800 shadow-[inset_0_0_0_1px_#10b981]"
    : isActive
      ? "translate-y-px scale-[0.98] border-blue-500 bg-blue-100 text-blue-900 shadow-inner"
      : `${variantClass} shadow-sm`;

  return (
    <button
      className={`h-10 rounded-md border px-4 font-semibold transition-all duration-150 active:translate-y-px active:scale-[0.98] active:shadow-inner disabled:cursor-wait ${stateClass}`}
      disabled={isActive}
      onClick={onClick}
      type="button"
    >
      {isActive ? loadingLabel : isCompleted ? completedLabel : label}
    </button>
  );
}

function Lane({
  lane,
  tasks,
  draggingId,
  onDragStart,
  onDropTask,
  onDeleteTask,
  onPriorityChange,
}: {
  lane: string;
  tasks: Task[];
  draggingId: string | null;
  onDragStart: (id: string | null) => void;
  onDropTask: (taskId: string, lane: string, beforeId?: string) => void;
  onDeleteTask: (taskId: string) => void;
  onPriorityChange: (taskId: string, priority: Priority) => void;
}) {
  const [over, setOver] = useState(false);

  return (
    <section
      className={`min-h-[70vh] rounded-lg border border-[#d8dee8] bg-[#eef2f6] p-3 ${over ? "outline outline-2 outline-blue-500" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const taskId = event.dataTransfer.getData("text/plain") || draggingId;
        if (taskId) onDropTask(taskId, lane);
      }}
    >
      <div className="mb-3 flex items-center justify-between text-sm font-bold">
        <span>{lane}</span>
        <span className="text-xs font-semibold text-slate-500">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? <div className="rounded-md p-3 text-center text-sm text-slate-500">空</div> : null}
      <div className="space-y-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            lane={lane}
            onDragStart={onDragStart}
            onDropTask={onDropTask}
            onDeleteTask={onDeleteTask}
            onPriorityChange={onPriorityChange}
          />
        ))}
      </div>
    </section>
  );
}

function TaskCard({
  task,
  lane,
  onDragStart,
  onDropTask,
  onDeleteTask,
  onPriorityChange,
}: {
  task: Task;
  lane: string;
  onDragStart: (id: string | null) => void;
  onDropTask: (taskId: string, lane: string, beforeId?: string) => void;
  onDeleteTask: (taskId: string) => void;
  onPriorityChange: (taskId: string, priority: Priority) => void;
}) {
  const priority = task.priority || "none";
  const priorityStyle = task.lane === "完了" ? PRIORITY_STYLES.low : PRIORITY_STYLES[priority];

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
        onDragStart(task.id);
      }}
      onDragEnd={() => onDragStart(null)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const taskId = event.dataTransfer.getData("text/plain");
        if (taskId && taskId !== task.id) onDropTask(taskId, lane, task.id);
      }}
      className={`cursor-grab rounded-lg border border-[#dfe5ee] border-l-4 p-3 shadow-sm active:cursor-grabbing ${
        task.lane === "完了" ? `${priorityStyle.card} opacity-65` : priorityStyle.card
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="overflow-anywhere text-sm font-bold leading-snug">{task.title}</h2>
        {task.isCustom ? (
          <button
            className="shrink-0 rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
            onClick={() => onDeleteTask(task.id)}
            type="button"
          >
            削除
          </button>
        ) : null}
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
        <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{task.project}</span>
        <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{task.week}</span>
        {priority !== "none" ? (
          <span className={`rounded-full px-2 py-1 font-semibold ${priorityStyle.pill}`}>
            重要度: {priorityStyle.label}
          </span>
        ) : null}
        {task.progress ? (
          <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700">{task.progress}</span>
        ) : null}
      </div>
      <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
        <span>重要度</span>
        <select
          value={priority}
          onChange={(event) => onPriorityChange(task.id, event.target.value as Priority)}
          className="h-8 min-w-24 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700"
        >
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{task.text}</p>
    </article>
  );
}

function loadSaved(): Array<{ id: string; lane: string; rank: number; priority?: Priority }> {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadCustomTasks(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_TASKS_KEY);
    const tasks = raw ? (JSON.parse(raw) as Task[]) : [];
    return tasks.map((task) => ({ ...task, isCustom: true }));
  } catch {
    return [];
  }
}
