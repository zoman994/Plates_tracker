import { useState } from "react";
import { ROWS_48, COLS_48, WELL_STATUS } from "../lib/geometry";
import Btn from "./Btn";

export default function EditClonesModal({ plate, onSave, onClose }) {
  // Deep copy wells for editing
  const [wells, setWells] = useState(() =>
    JSON.parse(JSON.stringify(plate.wells))
  );
  const [selWell, setSelWell] = useState(null);
  const [editCloneId, setEditCloneId] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editStatus, setEditStatus] = useState("picked");

  const replicates = plate.replicates || 3;

  function handleWellClick(well) {
    const w = wells[well] || {};
    setSelWell(well);
    setEditCloneId(w.cloneId || "");
    setEditSource(w.sourceWell || "");
    setEditStatus(w.status || "empty");
  }

  function applyEdit() {
    if (!selWell) return;
    setWells((prev) => {
      const nw = { ...prev };
      nw[selWell] = {
        ...nw[selWell],
        status: editStatus,
        cloneId: editStatus === "picked" ? editCloneId : (editStatus === "control-wt" ? "WT" : null),
        sourceWell: editStatus === "picked" ? editSource : null,
      };
      return nw;
    });
    setSelWell(null);
  }

  function swapWells(wellA, wellB) {
    setWells((prev) => {
      const nw = { ...prev };
      const tmp = { ...nw[wellA] };
      nw[wellA] = { ...nw[wellB] };
      nw[wellB] = tmp;
      return nw;
    });
  }

  function handleSave() {
    onSave(plate.id, wells);
    onClose();
  }

  // Count changes
  const changedCount = Object.keys(wells).filter((k) => {
    const a = plate.wells[k];
    const b = wells[k];
    return a.cloneId !== b.cloneId || a.status !== b.status;
  }).length;

  const cellW = 48, cellH = 26, gap = 2, labelW = 20, labelH = 16;
  const svgW = labelW + COLS_48.length * (cellW + gap);
  const svgH = labelH + ROWS_48.length * (cellH + gap);

  const statusColors = {
    empty: { bg: "#27272a", text: "#71717a" },
    picked: { bg: "#059669", text: "#fff" },
    "control-wt": { bg: "#d97706", text: "#fff" },
    "control-blank": { bg: "#52525b", text: "#fff" },
    dead: { bg: "#7f1d1d", text: "#fff" },
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[10px] text-zinc-500">
        Кликни по лунке чтобы изменить клон. Изменено: <b className="text-cyan-400">{changedCount}</b>
      </div>

      {/* SVG plate */}
      <div className="flex justify-center overflow-x-auto">
        <svg width={svgW} height={svgH}
          style={{ fontFamily: "'JetBrains Mono',monospace", userSelect: "none" }}>
          {COLS_48.map((c, ci) => (
            <text key={c} x={labelW + ci * (cellW + gap) + cellW / 2} y={11}
              textAnchor="middle" fill="#71717a" fontSize={8}>{c}</text>
          ))}
          {ROWS_48.map((r, ri) => (
            <text key={r} x={10} y={labelH + ri * (cellH + gap) + cellH / 2 + 3}
              textAnchor="middle" fill="#71717a" fontSize={8}>{r}</text>
          ))}
          {ROWS_48.map((r, ri) =>
            COLS_48.map((c, ci) => {
              const well = `${r}${c}`;
              const w = wells[well] || { status: "empty" };
              const sc = statusColors[w.status] || statusColors.empty;
              const isSel = selWell === well;
              const x = labelW + ci * (cellW + gap);
              const y = labelH + ri * (cellH + gap);

              // Changed from original?
              const orig = plate.wells[well];
              const changed = orig.cloneId !== w.cloneId || orig.status !== w.status;

              let label = "";
              if (w.status === "picked" && w.replicateNum === 1 && w.sourceWell) label = w.sourceWell;
              else if (w.status === "picked" && w.replicateNum > 1) label = `r${w.replicateNum}`;
              else if (w.status === "control-wt") label = "WT";
              else if (w.status === "control-blank") label = "BL";

              return (
                <g key={well} onClick={() => handleWellClick(well)} style={{ cursor: "pointer" }}>
                  <rect x={x} y={y} width={cellW} height={cellH} rx={2}
                    fill={sc.bg}
                    stroke={isSel ? "#22d3ee" : changed ? "#f59e0b" : "#3f3f46"}
                    strokeWidth={isSel ? 2 : changed ? 1.5 : 0.5} />
                  <text x={x + cellW / 2} y={y + cellH / 2 + 3}
                    textAnchor="middle" fill={sc.text} fontSize={7}>
                    {label}
                  </text>
                </g>
              );
            })
          )}
        </svg>
      </div>

      {/* Edit panel */}
      {selWell && (
        <div className="bg-zinc-800 border border-zinc-600 rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] text-zinc-200 font-bold">{selWell}</span>
            <span className="text-[10px] text-zinc-500">
              текущий: {wells[selWell]?.cloneId || "пусто"}
            </span>
          </div>

          <div className="flex gap-1.5 mb-2">
            {[["picked", "Клон"], ["control-wt", "WT"], ["control-blank", "Blank"], ["dead", "Dead"], ["empty", "Пусто"]].map(([s, l]) => (
              <button key={s}
                className={`px-2 py-0.5 text-[9px] rounded border font-mono cursor-pointer ${
                  editStatus === s
                    ? "border-emerald-600 bg-emerald-500/10 text-emerald-500"
                    : "border-zinc-700 text-zinc-500"
                }`}
                onClick={() => setEditStatus(s)}>{l}</button>
            ))}
          </div>

          {editStatus === "picked" && (
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <label className="text-[9px] text-zinc-600">Clone ID</label>
                <input value={editCloneId} onChange={(e) => setEditCloneId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-[10px] text-zinc-200 font-mono outline-none mt-0.5"
                  placeholder="NTG1-S01-A1" />
              </div>
              <div className="w-20">
                <label className="text-[9px] text-zinc-600">Source</label>
                <input value={editSource} onChange={(e) => setEditSource(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-[10px] text-zinc-200 font-mono outline-none mt-0.5"
                  placeholder="A1" />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-1.5">
            <Btn small variant="ghost" onClick={() => setSelWell(null)}>Отмена</Btn>
            <Btn small onClick={applyEdit}>Применить</Btn>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center">
        <div className="text-[9px] text-zinc-600">
          Жёлтая рамка = изменённая лунка
        </div>
        <div className="flex gap-1.5">
          <Btn variant="secondary" onClick={onClose}>Отмена</Btn>
          <Btn onClick={handleSave} disabled={changedCount === 0}>
            Сохранить ({changedCount} изм.)
          </Btn>
        </div>
      </div>
    </div>
  );
}
