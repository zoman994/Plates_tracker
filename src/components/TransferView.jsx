import { useState, useMemo } from "react";
import { ROWS_96, COLS_96, ROWS_48, COLS_48, WELL_STATUS, clonesPerPlate, posToWell } from "../lib/geometry";
import { generate48Layout } from "../lib/generate48Layout";
import PlateMap from "./PlateMap";
import Btn from "./Btn";

export default function TransferView({ sourcePlate, type, replicates = 3, onConfirm, onCancel }) {
  const [hovClone, setHovClone] = useState(null);
  const [previewIdx, setPreviewIdx] = useState(0);

  // All picked clones from source
  const allClones = useMemo(() => {
    const arr = [];
    for (const r of ROWS_96)
      for (const c of COLS_96) {
        const w = `${r}${c}`;
        const d = sourcePlate.wells[w];
        if (d && d.status === "picked") arr.push({ cloneId: d.cloneId, sourceWell: w });
      }
    return arr;
  }, [sourcePlate]);

  // Excluded clone IDs
  const [excluded, setExcluded] = useState(new Set());
  // Custom order (indexes into allClones, filtered by excluded)
  const [customOrder, setCustomOrder] = useState(null);

  // Active clones (filtered + ordered)
  const activeClones = useMemo(() => {
    const filtered = allClones.filter((c) => !excluded.has(c.cloneId));
    if (customOrder) {
      // customOrder is array of cloneIds in desired order
      const map = new Map(filtered.map((c) => [c.cloneId, c]));
      const ordered = customOrder.filter((id) => map.has(id)).map((id) => map.get(id));
      // Add any new ones not in customOrder
      for (const c of filtered) {
        if (!customOrder.includes(c.cloneId)) ordered.push(c);
      }
      return ordered;
    }
    return filtered;
  }, [allClones, excluded, customOrder]);

  const cpPlate = clonesPerPlate(replicates);

  // Toggle clone exclusion by clicking on source plate
  function toggleClone(cloneId) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(cloneId)) next.delete(cloneId);
      else next.add(cloneId);
      return next;
    });
    setPreviewIdx(0);
  }

  // Move clone in list
  function moveClone(cloneId, direction) {
    const ids = activeClones.map((c) => c.cloneId);
    const idx = ids.indexOf(cloneId);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= ids.length) return;
    const newIds = [...ids];
    [newIds[idx], newIds[newIdx]] = [newIds[newIdx], newIds[idx]];
    setCustomOrder(newIds);
  }

  // Build previews
  let previews = [];
  if (type === "passage96") {
    // For passage, show only non-excluded wells
    const passageWells = {};
    for (const [k, v] of Object.entries(sourcePlate.wells)) {
      if (v.status === "picked" && excluded.has(v.cloneId)) {
        passageWells[k] = { status: "empty", cloneId: null };
      } else {
        passageWells[k] = { ...v };
      }
    }
    previews = [{ format: 96, wells: passageWells, label: `Passage (${activeClones.length} кл.)` }];
  } else {
    const chunks = [];
    for (let i = 0; i < activeClones.length; i += cpPlate)
      chunks.push(activeClones.slice(i, i + cpPlate));
    previews = chunks.map((chunk, i) => ({
      format: 48,
      wells: generate48Layout(chunk, replicates),
      label: `48-DWP #${i + 1} (${chunk.length} кл. + WT, ${replicates}×)`,
      cloneIds: new Set(chunk.map((c) => c.cloneId)),
    }));
  }

  const cur = previews[previewIdx] || previews[0];
  const previewIds = cur?.cloneIds ||
    new Set(Object.values(cur?.wells || {}).filter((w) => w.status === "picked").map((w) => w.cloneId));

  // Custom confirm that passes filtered clones
  function handleConfirm() {
    onConfirm(sourcePlate.id, type, replicates, activeClones);
  }

  // Source plate SVG with clickable wells
  const srcCellS = 22, srcGap = 2, srcLabelW = 16, srcLabelH = 14;
  const srcW = srcLabelW + COLS_96.length * (srcCellS + srcGap);
  const srcH = srcLabelH + ROWS_96.length * (srcCellS + srcGap);

  return (
    <div className="border border-zinc-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <span className="font-bold text-zinc-200 text-[13px]">
          Transfer: {sourcePlate.name} → {type === "passage96" ? "Passage" : `${previews.length} × 48-DWP`}
        </span>
        <div className="flex gap-1.5">
          <Btn variant="secondary" onClick={onCancel}>Отмена</Btn>
          <Btn onClick={handleConfirm} disabled={activeClones.length === 0}>
            Подтвердить ({previews.length} пл.)
          </Btn>
        </div>
      </div>

      <div className="flex gap-4 mb-3 text-[11px] text-zinc-400">
        <span>Всего: <b>{allClones.length}</b></span>
        {excluded.size > 0 && <span>Исключено: <b className="text-red-400">{excluded.size}</b></span>}
        <span>Пересев: <b className="text-emerald-500">{activeClones.length}</b></span>
        {type === "96to48" && (
          <>
            <span>Планшетов: <b>{previews.length}</b></span>
            <span>{cpPlate} кл. + WT × {replicates}×</span>
          </>
        )}
      </div>

      <div className="flex gap-4 items-start overflow-x-auto">
        {/* SOURCE — interactive, click to exclude */}
        <div className="flex-shrink-0">
          <div className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">
            Source · клик = исключить
          </div>
          <svg width={srcW} height={srcH}
            style={{ fontFamily: "'JetBrains Mono',monospace", userSelect: "none" }}>
            {COLS_96.map((c, ci) => (
              <text key={ci} x={srcLabelW + ci * (srcCellS + srcGap) + srcCellS / 2} y={10}
                textAnchor="middle" fill="#71717a" fontSize={7}>{c}</text>
            ))}
            {ROWS_96.map((r, ri) => (
              <text key={ri} x={8} y={srcLabelH + ri * (srcCellS + srcGap) + srcCellS / 2 + 3}
                textAnchor="middle" fill="#71717a" fontSize={7}>{r}</text>
            ))}
            {ROWS_96.map((r, ri) =>
              COLS_96.map((c, ci) => {
                const well = `${r}${c}`;
                const w = sourcePlate.wells[well] || { status: "empty" };
                const x = srcLabelW + ci * (srcCellS + srcGap);
                const y = srcLabelH + ri * (srcCellS + srcGap);
                const isExcluded = w.status === "picked" && excluded.has(w.cloneId);
                const isHov = hovClone && w.cloneId === hovClone;
                const isOnPreview = w.status === "picked" && !isExcluded && previewIds.has(w.cloneId);

                let fill = "#27272a", stroke = "#3f3f46";
                if (w.status === "picked") {
                  if (isExcluded) { fill = "#3f3f46"; stroke = "#52525b"; }
                  else if (isOnPreview) { fill = "#059669"; stroke = "#10b981"; }
                  else { fill = "#1a3a2a"; stroke = "#27472f"; }
                } else if (w.status === "control-wt") { fill = "#d97706"; stroke = "#f59e0b"; }
                else if (w.status === "control-blank") { fill = "#52525b"; stroke = "#71717a"; }
                else if (w.status === "dead") { fill = "#7f1d1d"; stroke = "#991b1b"; }

                return (
                  <g key={well}
                    onClick={() => {
                      if (w.status === "picked") toggleClone(w.cloneId);
                    }}
                    onMouseEnter={() => {
                      if (w.cloneId && w.status === "picked") setHovClone(w.cloneId);
                      else setHovClone(null);
                    }}
                    style={{ cursor: w.status === "picked" ? "pointer" : "default" }}>
                    <rect x={x} y={y} width={srcCellS} height={srcCellS} rx={2}
                      fill={fill} stroke={isHov ? "#22d3ee" : stroke}
                      strokeWidth={isHov ? 2 : 0.5} />
                    {isExcluded && (
                      <text x={x + srcCellS / 2} y={y + srcCellS / 2 + 3}
                        textAnchor="middle" fill="#ef4444" fontSize={10} fontWeight="bold">✗</text>
                    )}
                  </g>
                );
              })
            )}
          </svg>
        </div>

        <div className="flex items-center pt-20 text-zinc-700 text-2xl">→</div>

        {/* DESTINATION */}
        <div className="flex-shrink-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{cur?.label}</span>
            {previews.length > 1 && (
              <div className="flex gap-1">
                <button onClick={() => setPreviewIdx(Math.max(0, previewIdx - 1))}
                  disabled={previewIdx === 0}
                  className="bg-transparent border border-zinc-700 rounded text-zinc-400 cursor-pointer px-1.5 py-px text-[10px] font-mono disabled:opacity-30">◀</button>
                <span className="text-[10px] text-zinc-500 px-1 py-0.5">{previewIdx + 1}/{previews.length}</span>
                <button onClick={() => setPreviewIdx(Math.min(previews.length - 1, previewIdx + 1))}
                  disabled={previewIdx === previews.length - 1}
                  className="bg-transparent border border-zinc-700 rounded text-zinc-400 cursor-pointer px-1.5 py-px text-[10px] font-mono disabled:opacity-30">▶</button>
              </div>
            )}
          </div>
          {cur && (
            <PlateMap format={cur.format} wells={cur.wells} readOnly hoveredClone={hovClone}
              onWellHover={(w) => {
                const d = cur.wells[w];
                if (d && d.cloneId && d.cloneId !== "WT") setHovClone(d.cloneId);
                else setHovClone(null);
              }} />
          )}
        </div>
      </div>

      {/* Clone list for reordering (96to48 only) */}
      {type === "96to48" && activeClones.length > 0 && (
        <div className="mt-3 border border-zinc-800 rounded p-2 max-h-40 overflow-y-auto">
          <div className="text-[9px] text-zinc-600 mb-1">Порядок клонов (↑↓ для перестановки):</div>
          <div className="flex flex-wrap gap-1">
            {activeClones.map((cl, i) => (
              <div key={cl.cloneId}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                  hovClone === cl.cloneId
                    ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                    : "border-zinc-700 text-zinc-400"
                }`}
                onMouseEnter={() => setHovClone(cl.cloneId)}
                onMouseLeave={() => setHovClone(null)}>
                <span className="text-zinc-600 w-3">{i + 1}</span>
                <span>{cl.sourceWell}</span>
                <button onClick={() => moveClone(cl.cloneId, -1)}
                  className="text-zinc-600 hover:text-zinc-300 cursor-pointer bg-transparent border-none text-[8px] px-0.5">↑</button>
                <button onClick={() => moveClone(cl.cloneId, 1)}
                  className="text-zinc-600 hover:text-zinc-300 cursor-pointer bg-transparent border-none text-[8px] px-0.5">↓</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-3 mt-2.5 text-[9px] text-zinc-500">
        <span><span className="inline-block w-2.5 h-2.5 bg-emerald-600 rounded-sm align-middle mr-1" />Пересев</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1" style={{ background: "#1a3a2a" }} />Другой 48-DWP</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1" style={{ background: "#3f3f46" }} />Исключён</span>
        {excluded.size > 0 && (
          <button onClick={() => setExcluded(new Set())}
            className="text-zinc-600 hover:text-emerald-500 bg-transparent border-none cursor-pointer font-mono underline text-[9px]">
            Вернуть все
          </button>
        )}
      </div>
    </div>
  );
}
