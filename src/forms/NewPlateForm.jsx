import { useState, useEffect } from "react";
import { PLATE_TYPES } from "../lib/geometry";
import Btn from "../components/Btn";
import { useTheme } from "../lib/ThemeContext";

export default function NewPlateForm({ expId, onSubmit, existing }) {
  const { isDark } = useTheme();
  const [type, setType] = useState("source");
  const [format, setFormat] = useState(96);

  const name = (() => {
    const pre = { source: "S", passage: "P", culture: "C", flask: "F" }[type];
    const n = existing.filter((x) => x.startsWith(pre)).length + 1;
    return `${pre}${n.toString().padStart(2, "0")}`;
  })();

  useEffect(() => {
    setFormat(type === "culture" ? 48 : 96);
  }, [type]);

  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <label className="text-[10px] text-zinc-500">Тип</label>
        <div className="flex gap-1 mt-1 flex-wrap">
          {Object.entries(PLATE_TYPES).map(([k, v]) => (
            <button key={k}
              className={`px-2.5 py-1 text-[10px] rounded border font-mono cursor-pointer ${
                type === k
                  ? "border-emerald-600 bg-emerald-500/10 text-emerald-500"
                  : isDark
                    ? "border-zinc-700 bg-transparent text-zinc-500"
                    : "border-zinc-300 bg-transparent text-zinc-500"
              }`}
              onClick={() => setType(k)}>{v.icon} {v.label}</button>
          ))}
        </div>
      </div>
      <div className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
        Имя: <b>{name}</b> · {format === 48 ? "8×6" : "8×12"}
        {format === 48 && <span className={isDark ? "text-zinc-600" : "text-zinc-400"}> · 15+WT×3</span>}
      </div>
      <div className="flex justify-end">
        <Btn onClick={() => onSubmit(expId, name, format, type)}
          disabled={existing.includes(name)}>Создать</Btn>
      </div>
    </div>
  );
}
