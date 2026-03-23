import { useState } from "react";
import { clonesPerPlate } from "../lib/geometry";
import Btn from "../components/Btn";
import { INPUT_CLASS } from "./styles";

export default function TransferSetup({ plates, onStart }) {
  const [srcId, setSrcId] = useState("");
  const [type, setType] = useState("passage96");
  const [replicates, setReplicates] = useState(3);

  const src96 = plates.filter((p) => p.format === 96);
  const sp = plates.find((p) => p.id === srcId);
  const nCl = sp ? Object.values(sp.wells).filter((w) => w.status === "picked").length : 0;
  const cpPlate = clonesPerPlate(replicates);

  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <label className="text-[10px] text-zinc-500">Source</label>
        <select className={INPUT_CLASS} value={srcId} onChange={(e) => setSrcId(e.target.value)}>
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
            <button key={k}
              className={`px-3 py-1.5 text-[11px] rounded border font-mono cursor-pointer text-zinc-300 ${
                type === k
                  ? "border-emerald-600 bg-emerald-500/10"
                  : "border-zinc-700 bg-transparent"
              }`}
              onClick={() => setType(k)}>{l}</button>
          ))}
        </div>
      </div>
      {type === "96to48" && (
        <div>
          <label className="text-[10px] text-zinc-500">Повторы</label>
          <div className="flex gap-1.5 mt-1">
            {[2, 3].map((n) => (
              <button key={n}
                className={`px-3 py-1.5 text-[11px] rounded border font-mono cursor-pointer text-zinc-300 ${
                  replicates === n
                    ? "border-emerald-600 bg-emerald-500/10"
                    : "border-zinc-700 bg-transparent"
                }`}
                onClick={() => setReplicates(n)}>
                {n}× ({clonesPerPlate(n)} кл./пл.)
              </button>
            ))}
          </div>
        </div>
      )}
      {type === "96to48" && srcId && (
        <div className="text-[11px] bg-zinc-900 rounded p-2.5 text-zinc-400">
          <b>{nCl}</b> → <b>{Math.ceil(nCl / cpPlate)}</b> × 48-DWP · {replicates}× повторов
        </div>
      )}
      <div className="flex justify-end">
        <Btn onClick={() => onStart(srcId, type, replicates)} disabled={!srcId}>Предпросмотр →</Btn>
      </div>
    </div>
  );
}
