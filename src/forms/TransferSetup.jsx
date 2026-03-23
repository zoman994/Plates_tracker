import { useState } from "react";
import { clonesPerPlate } from "../lib/geometry";
import Btn from "../components/Btn";
import { inputClass } from "./styles";
import { useTheme } from "../lib/ThemeContext";

export default function TransferSetup({ plates, onStart }) {
  const { isDark } = useTheme();
  const [srcId, setSrcId] = useState("");
  const [type, setType] = useState("passage96");
  const [replicates, setReplicates] = useState(3);
  const [layout, setLayout] = useState("rows");

  const src96 = plates.filter((p) => p.format === 96);
  const sp = plates.find((p) => p.id === srcId);
  const nCl = sp ? Object.values(sp.wells).filter((w) => w.status === "picked").length : 0;
  const cpPlate = clonesPerPlate(replicates, layout);
  const ic = inputClass(isDark);
  const btnCls = (active) => `px-3 py-1.5 text-[11px] rounded border font-mono cursor-pointer ${
    isDark ? "text-zinc-300" : "text-zinc-700"
  } ${active
    ? "border-emerald-600 bg-emerald-500/10"
    : isDark ? "border-zinc-700 bg-transparent" : "border-zinc-300 bg-transparent"
  }`;

  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <label className="text-[10px] text-zinc-500">Source</label>
        <select className={ic} value={srcId} onChange={(e) => setSrcId(e.target.value)}>
          <option value="">Выбери...</option>
          {src96.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {Object.values(p.wells).filter((w) => w.status === "picked").length} кл.
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[10px] text-zinc-500">Тип</label>
        <div className="flex gap-1.5 mt-1">
          {[["passage96", "96→96 (пассаж)"], ["96to48", "96→48-DWP"]].map(([k, l]) => (
            <button key={k} className={btnCls(type === k)} onClick={() => setType(k)}>{l}</button>
          ))}
        </div>
      </div>
      {type === "96to48" && (
        <>
          <div>
            <label className="text-[10px] text-zinc-500">Повторы</label>
            <div className="flex gap-1.5 mt-1">
              {[2, 3].map((n) => (
                <button key={n} className={btnCls(replicates === n)} onClick={() => setReplicates(n)}>
                  {n}× ({clonesPerPlate(n, layout)} кл./пл.)
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500">Раскладка повторностей</label>
            <div className="flex gap-1.5 mt-1">
              <button className={btnCls(layout === "rows")} onClick={() => setLayout("rows")}>
                По строкам →
              </button>
              <button className={btnCls(layout === "cols")} onClick={() => setLayout("cols")}>
                По столбцам ↓
              </button>
            </div>
            <div className={`text-[9px] mt-1 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
              {layout === "rows"
                ? "Повторы идут горизонтально (K1.r1, K1.r2, K1.r3 в одной строке)"
                : "Повторы идут вертикально (K1.r1, K1.r2, K1.r3 в одном столбце)"}
            </div>
          </div>
        </>
      )}
      {type === "96to48" && srcId && (
        <div className={`text-[11px] rounded p-2.5 ${isDark ? "bg-zinc-900 text-zinc-400" : "bg-zinc-50 text-zinc-500"}`}>
          <b>{nCl}</b> → <b>{Math.ceil(nCl / cpPlate)}</b> × 48-DWP · {replicates}× · {layout === "rows" ? "по строкам" : "по столбцам"}
        </div>
      )}
      <div className="flex justify-end">
        <Btn onClick={() => onStart(srcId, type, replicates, layout)} disabled={!srcId}>Предпросмотр →</Btn>
      </div>
    </div>
  );
}
