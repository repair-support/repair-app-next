"use client";

import { useEffect, useState } from "react";

export default function StaffSettingsPanel({ store }: { store: string }) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState("読み込み中...");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetch(`/api/staff?store=${encodeURIComponent(store)}&mode=staff`)
      .then((response) => response.json())
      .then((body) => {
        if (!body.ok) throw new Error(body.error ?? "スタッフ設定を取得できませんでした");
        setText((body.data as string[]).join("\n"));
        setMessage("");
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "スタッフ設定を取得できませんでした");
      });
  }, [store]);

  async function save() {
    setPending(true);
    setMessage("");
    try {
      const staffNames = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const response = await fetch("/api/staff", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeName: store, staffNames }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "スタッフ設定を保存できませんでした");
      setText((body.data as string[]).join("\n"));
      setMessage("スタッフ設定を保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "スタッフ設定を保存できませんでした");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold">スタッフ設定</h2>
      <p className="mt-1 text-sm text-slate-600">1行に1名ずつ入力してください。受付担当・修理担当・査定員の候補に反映されます。</p>
      <textarea
        className="input mt-3 min-h-32"
        value={text}
        placeholder={"中村\n成田\n浅利"}
        onChange={(event) => setText(event.target.value)}
      />
      <button className="button mt-3 disabled:opacity-50" disabled={pending} type="button" onClick={save}>
        {pending ? "保存中..." : "スタッフ設定を保存"}
      </button>
      {message && <p className="mt-3 text-sm font-bold">{message}</p>}
    </section>
  );
}
