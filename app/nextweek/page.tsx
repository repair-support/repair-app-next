"use client";

import { useEffect, useMemo, useState } from "react";

type Task = {
  id: string;
  project: string;
  week: string;
  title: string;
  text: string;
  progress?: string;
  sourceRow: number;
  lane?: string;
};

type ApiData = {
  generatedAt: string;
  sheetName: string;
  lanes: string[];
  tasks: Task[];
};

const DEFAULT_LANES = ["未整理", "月", "火", "水", "木", "金", "完了"];
const STORAGE_KEY = "nextweek-task-board:vercel:v1";

export default function NextweekPage() {
  const [lanes, setLanes] = useState(DEFAULT_LANES);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("読み込み中...");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadTasks();
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

  async function loadTasks() {
    setStatus("読み込み中...");
    setError("");
    try {
      const response = await fetch("/api/nextweek/tasks", { cache: "no-store" });
      const data = (await response.json()) as ApiData & { error?: string; detail?: string };
      if (!response.ok || data.error) {
        throw new Error(data.error || data.detail || "データ取得に失敗しました");
      }

      const saved = loadSaved();
      const savedById = new Map(saved.map((item) => [item.id, item]));
      const merged = data.tasks
        .map((task, index) => {
          const savedItem = savedById.get(task.id);
          return {
            ...task,
            lane: savedItem?.lane && data.lanes.includes(savedItem.lane) ? savedItem.lane : "未整理",
            rank: savedItem?.rank ?? index,
          };
        })
        .sort((a, b) => {
          const laneDiff = data.lanes.indexOf(a.lane || "未整理") - data.lanes.indexOf(b.lane || "未整理");
          return laneDiff || a.rank - b.rank || a.sourceRow - b.sourceRow;
        });

      setLanes(data.lanes.length ? data.lanes : DEFAULT_LANES);
      setTasks(merged);
      setStatus(`${data.sheetName} から ${data.tasks.length} 件を読み込みました`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("読み込みに失敗しました");
    }
  }

  function saveOrder(nextTasks = tasks) {
    const payload = nextTasks.map((task, index) => ({
      id: task.id,
      lane: task.lane || "未整理",
      rank: index,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setStatus(`${payload.length} 件の並び順を保存しました`);
  }

  function resetOrder() {
    if (!window.confirm("自分用の並び順をリセットしますか？")) return;
    localStorage.removeItem(STORAGE_KEY);
    void loadTasks();
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
          <button className="h-10 rounded-md bg-white px-4 font-semibold text-[#17202a]" onClick={() => void loadTasks()}>
            再読み込み
          </button>
          <button className="h-10 rounded-md bg-white px-4 font-semibold text-[#17202a]" onClick={resetOrder}>
            リセット
          </button>
          <button className="h-10 rounded-md bg-[#dbeafe] px-4 font-semibold text-[#1d4ed8]" onClick={() => saveOrder()}>
            保存
          </button>
        </div>
      </header>

      <section className="px-5 py-4">
        <div className={`mb-3 text-sm ${error ? "text-red-700" : "text-slate-600"}`}>{error || status}</div>
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
              />
            );
          })}
        </div>
      </section>
    </main>
  );
}

function Lane({
  lane,
  tasks,
  draggingId,
  onDragStart,
  onDropTask,
}: {
  lane: string;
  tasks: Task[];
  draggingId: string | null;
  onDragStart: (id: string | null) => void;
  onDropTask: (taskId: string, lane: string, beforeId?: string) => void;
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
          <TaskCard key={task.id} task={task} lane={lane} onDragStart={onDragStart} onDropTask={onDropTask} />
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
}: {
  task: Task;
  lane: string;
  onDragStart: (id: string | null) => void;
  onDropTask: (taskId: string, lane: string, beforeId?: string) => void;
}) {
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
      className={`cursor-grab rounded-lg border border-[#dfe5ee] border-l-4 bg-white p-3 shadow-sm active:cursor-grabbing ${
        task.lane === "完了" ? "border-l-[#198754] opacity-65" : "border-l-[#5f3dc4]"
      }`}
    >
      <h2 className="mb-2 overflow-anywhere text-sm font-bold leading-snug">{task.title}</h2>
      <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
        <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{task.project}</span>
        <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{task.week}</span>
        {task.progress ? (
          <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700">{task.progress}</span>
        ) : null}
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{task.text}</p>
    </article>
  );
}

function loadSaved(): Array<{ id: string; lane: string; rank: number }> {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
