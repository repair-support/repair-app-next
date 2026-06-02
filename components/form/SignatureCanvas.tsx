"use client";

import { useRef } from "react";
import SignaturePad from "react-signature-canvas";

export default function SignatureCanvas({ onChange }: { onChange: (data: string) => void }) {
  const ref = useRef<SignaturePad>(null);
  function capture() {
    onChange(ref.current?.isEmpty() ? "" : ref.current?.toDataURL("image/png") ?? "");
  }
  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-slate-300 bg-white">
        <SignaturePad ref={ref} canvasProps={{ className: "h-40 w-full" }} onEnd={capture} />
      </div>
      <button className="mt-2 text-sm font-bold text-blue-700" type="button" onClick={() => { ref.current?.clear(); onChange(""); }}>
        署名を消去
      </button>
    </div>
  );
}
