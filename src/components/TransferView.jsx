import { useState, useMemo, useRef } from "react";
import { ROWS_96, COLS_96, clonesPerPlate, posToWell } from "../lib/geometry";
import { generate48Layout } from "../lib/generate48Layout";
import { useTheme } from "../lib/ThemeContext";
import PlateMap from "./PlateMap";
import Btn from "./Btn";

export default function TransferView({ sourcePlate, type, replicates = 3, layout = "rows", compact = true, onConfirm, onCancel }) {
  const { isDark } = useTheme();
  const [hovClone, setHovClone] = useState(null);
  const [previewIdx, setPreviewIdx] = useState(0);

  // Drag-selection on source plate
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);

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

  const [excluded, setExcluded] = useState(new Set());
  const [customOrder, setCustomOrder] = useState(null);

  // Drag-and-drop state for clone list
  const [dragClone, setDragClone] = useState(null);

  const activeClones = useMemo(() => {
    const filtered = allClones.filter((c) => !excluded.has(c.cloneId));
    if (customOrder) {
      const map = new Map(filtered.map((c) => [c.cloneId, c]));
      const ordered = customOrder.filter((id) => map.has(id)).map((id) => map.get(id));
      for (const c of filtered) {
        if (!customOrder.includes(c.cloneId)) ordered.push(c);
      }
      return ordered;
    }
    return filtered;
  }, [allClones, excluded, customOrder]);

  const cpPlate = clonesPerPlate(replicates, layout);

  // ── Source plate drag-selection ──
  const dragSel = useMemo(() => {
    if (!dragStart || !dragEnd) return new Set();
    const r1 = Math.min(dragStart.r, dragEnd.r), r2 = Math.max(dragStart.r, dragEnd.r);
    const c1 = Math.min(dragStart.c, dragEnd.c), c2 = Math.max(dragStart.c, dragEnd.c);
    const s = new Set();
    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++) {
        const well = posToWell(r, c);
        const w = sourcePlate.wells[well];
        if (w && w.status === "picked") s.add(w.cloneId);
      }
    return s;
  }, [dragStart, dragEnd, sourcePlate]);

  function onSrcMouseDown(ri, ci, e) {
    e.preventDefault();
    setDragging(true);
    setDragStart({ r: ri, c: ci });
    setDragEnd({ r: ri, c: ci });
  }
  function onSrcMouseEnter(ri, ci) {
    if (dragging) setDragEnd({ r: ri, c: ci });
  }
  function onSrcMouseUp() {
    setDragging(false);
  }

  function excludeSelected() {
    if (dragSel.size === 0) return;
    setExcluded((prev) => {
      const next = new Set(prev);
      for (const id of dragSel) next.add(id);
      return next;
    });
    setDragStart(null);
    setDragEnd(null);
    setPreviewIdx(0);
  }

  function includeSelected() {
    if (dragSel.size === 0) return;
    setExcluded((prev) => {
      const next = new Set(prev);
      for (const id of dragSel) next.delete(id);
      return next;
    });
    setDragStart(null);
    setDragEnd(null);
  }

  function toggleClone(cloneId) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(cloneId)) next.delete(cloneId);
      else next.add(cloneId);
      return next;
    });
    setPreviewIdx(0);
  }

  // ── Clone list drag-and-drop ──
  function onDragStart(e, cloneId) {
    setDragClone(cloneId);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDragOver(e, targetCloneId) {
    e.preventDefault();
    if (!dragClone || dragClone === targetCloneId) return;
    const ids = activeClones.map((c) => c.cloneId);
    const fromIdx = ids.indexOf(dragClone);
    const toIdx = ids.indexOf(targetCloneId);
    if (fromIdx < 0 || toIdx < 0) return;
    const newIds = [...ids];
    newIds.splice(fromIdx, 1);
    newIds.splice(toIdx, 0, dragClone);
    setCustomOrder(newIds);
  }
  function onDragEnd() {
    setDragClone(null);
  }

  // Build previews (memoized)
  const previews = useMemo(() => {
    if (type === "passage96") {
      const passageWells = {};
      for (const [k, v] of Object.entries(sourcePlate.wells)) {
        if (v.status === "picked" && excluded.has(v.cloneId)) {
          passageWells[k] = { status: "empty", cloneId: null };
        } else {
          passageWells[k] = { ...v };
        }
      }
      return [{ format: 96, wells: passageWells, label: `Passage (${activeClones.length} кл.)` }];
    }
    const chunks = [];
    for (let i = 0; i < activeClones.length; i += cpPlate)
      chunks.push(activeClones.slice(i, i + cpPlate));
    return chunks.map((chunk, i) => ({
      format: 48,
      wells: generate48Layout(chunk, replicates, layout),
      label: `48-DWP #${i + 1} (${chunk.length} кл. + WT, ${replicates}×)`,
      cloneIds: new Set(chunk.map((c) => c.cloneId)),
    }));
  }, [type, activeClones, excluded, sourcePlate, cpPlate, replicates, layout]);

  const cur = previews[previewIdx] || previews[0];
  const previewIds = cur?.cloneIds ||
    new Set(Object.values(cur?.wells || {}).filter((w) => w.status === "picked").map((w) => w.cloneId));

  function handleConfirm() {
    onConfirm(sourcePlate.id, type, replicates, activeClones, layout, compact);
  }

  // Source plate SVG dimensions
  const srcCellS = 22, srcGap = 2, srcLabelW = 16, srcLabelH = 14;
  const srcW = srcLabelW + COLS_96.length * (srcCellS + srcGap);
  const srcH = srcLabelH + ROWS_96.length * (srcCellS + srcGap);

  const emptyFill = isDark ? "#27272a" : "#f4f4f5";
  const emptyStroke = isDark ? "#3f3f46" : "#d4d4d8";
  const deadFill = isDark ? "#7f1d1d" : "#fecaca";
  const exFill = isDark ? "#3f3f46" : "#d4d4d8";
  const exStroke = isDark ? "#52525b" : "#a1a1aa";

  const hasSelection = dragSel.size > 0;
  // How many of selected are currently excluded vs included
  const selExcludedCount = [...dragSel].filter((id) => excluded.has(id)).length;
  const selIncludedCount = dragSel.size - selExcludedCount;

  return (
    <div className={`border ${isDark ? "border-zinc-800" : "border-zinc-200"} rounded-lg p-4`}>
      <div className="flex justify-between items-center mb-3">
        <span className={`font-bold ${isDark ? "text-zinc-200" : "text-zinc-900"} text-[13px]`}>
          Transfer: {sourcePlate.name} → {type === "passage96" ? "Passage" : `${previews.length} × 48-DWP`}
        </span>
        <div className="flex gap-1.5">
          <Btn variant="secondary" onClick={onCancel}>Отмена</Btn>
          <Btn onClick={handleConfirm} disabled={activeClones.length === 0}>
            Подтвердить ({previews.length} пл.)
          </Btn>
        </div>
      </div>

      <div className="flex gap-4 mb-2 text-[11px] text-zinc-400 flex-wrap">
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

      {/* Selection action bar */}
      {hasSelection && (
        <div className={`flex items-center gap-2 mb-2 p-2 rounded ${isDark ? "bg-cyan-900/20 border-cyan-800" : "bg-cyan-50 border-cyan-200"} border`}>
          <span className="text-[10px] text-cyan-500">Выделено: <b>{dragSel.size}</b> клонов</span>
          {selIncludedCount > 0 && (
            <Btn small variant="danger" onClick={excludeSelected}>✗ Исключить ({selIncludedCount})</Btn>
          )}
          {selExcludedCount > 0 && (
            <Btn small onClick={includeSelected}>✓ Вернуть ({selExcludedCount})</Btn>
          )}
          <Btn small variant="ghost" onClick={() => { setDragStart(null); setDragEnd(null); }}>Сброс</Btn>
        </div>
      )}

      <div className="flex gap-4 items-start overflow-x-auto">
        {/* SOURCE — drag-selection to exclude sectors */}
        <div className="flex-shrink-0">
          <div className={`text-[10px] text-zinc-500 mb-1 uppercase tracking-wider`}>
            Source · тяни для выделения
          </div>
          <svg width={srcW} height={srcH}
            style={{ fontFamily: "'JetBrains Mono',monospace", userSelect: "none" }}
            onMouseUp={onSrcMouseUp} onMouseLeave={onSrcMouseUp}>
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
                const isInDragSel = w.status === "picked" && dragSel.has(w.cloneId);

                let fill = emptyFill, stroke = emptyStroke;
                if (w.status === "picked") {
                  if (isExcluded) { fill = exFill; stroke = exStroke; }
                  else if (isOnPreview) { fill = "#059669"; stroke = "#10b981"; }
                  else { fill = "#1a3a2a"; stroke = "#27472f"; }
                } else if (w.status === "control-wt") { fill = "#d97706"; stroke = "#f59e0b"; }
                else if (w.status === "control-blank") { fill = "#52525b"; stroke = "#71717a"; }
                else if (w.status === "dead") { fill = deadFill; stroke = "#991b1b"; }

                return (
                  <g key={well}
                    onMouseDown={(e) => { if (w.status === "picked") onSrcMouseDown(ri, ci, e); }}
                    onMouseEnter={() => {
                      onSrcMouseEnter(ri, ci);
                      if (w.cloneId && w.status === "picked") setHovClone(w.cloneId);
                      else setHovClone(null);
                    }}
                    style={{ cursor: w.status === "picked" ? "crosshair" : "default" }}>
                    <rect x={x} y={y} width={srcCellS} height={srcCellS} rx={2}
                      fill={fill}
                      stroke={isInDragSel ? "#22d3ee" : isHov ? "#22d3ee" : stroke}
                      strokeWidth={isInDragSel ? 2 : isHov ? 1.5 : 0.5} />
                    {isInDragSel && (
                      <rect x={x + 1} y={y + 1} width={srcCellS - 2} height={srcCellS - 2} rx={1}
                        fill="rgba(34,211,238,0.15)" stroke="none" />
                    )}
                    {isExcluded && !isInDragSel && (
                      <text x={x + srcCellS / 2} y={y + srcCellS / 2 + 3}
                        textAnchor="middle" fill="#ef4444" fontSize={10} fontWeight="bold">✗</text>
                    )}
                  </g>
                );
              })
            )}
          </svg>
        </div>

        <div className={`flex items-center pt-20 ${isDark ? "text-zinc-700" : "text-zinc-400"} text-2xl`}>→</div>

        {/* DESTINATION */}
        <div className="flex-shrink-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{cur?.label}</span>
            {previews.length > 1 && (
              <div className="flex gap-1">
                <button onClick={() => setPreviewIdx(Math.max(0, previewIdx - 1))}
                  disabled={previewIdx === 0}
                  className={`bg-transparent border ${isDark ? "border-zinc-700" : "border-zinc-300"} rounded ${isDark ? "text-zinc-400" : "text-zinc-600"} cursor-pointer px-1.5 py-px text-[10px] font-mono disabled:opacity-30`}>◀</button>
                <span className="text-[10px] text-zinc-500 px-1 py-0.5">{previewIdx + 1}/{previews.length}</span>
                <button onClick={() => setPreviewIdx(Math.min(previews.length - 1, previewIdx + 1))}
                  disabled={previewIdx === previews.length - 1}
                  className={`bg-transparent border ${isDark ? "border-zinc-700" : "border-zinc-300"} rounded ${isDark ? "text-zinc-400" : "text-zinc-600"} cursor-pointer px-1.5 py-px text-[10px] font-mono disabled:opacity-30`}>▶</button>
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

      {/* Clone list with drag-and-drop reordering */}
      {type === "96to48" && activeClones.length > 0 && (
        <div className={`mt-3 border ${isDark ? "border-zinc-800" : "border-zinc-200"} rounded p-2 max-h-44 overflow-y-auto`}>
          <div className={`text-[9px] ${isDark ? "text-zinc-600" : "text-zinc-500"} mb-1`}>
            Порядок клонов (перетаскивай для изменения):
          </div>
          <div className="flex flex-wrap gap-1">
            {activeClones.map((cl, i) => (
              <div key={cl.cloneId}
                draggable
                onDragStart={(e) => onDragStart(e, cl.cloneId)}
                onDragOver={(e) => onDragOver(e, cl.cloneId)}
                onDragEnd={onDragEnd}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono border cursor-grab active:cursor-grabbing ${
                  dragClone === cl.cloneId
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 opacity-50"
                    : hovClone === cl.cloneId
                      ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                      : isDark ? "border-zinc-700 text-zinc-400" : "border-zinc-300 text-zinc-600"
                }`}
                onMouseEnter={() => setHovClone(cl.cloneId)}
                onMouseLeave={() => setHovClone(null)}>
                <span className={`${isDark ? "text-zinc-600" : "text-zinc-400"} w-3 text-[8px]`}>{i + 1}</span>
                <span>{cl.sourceWell}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-3 mt-2.5 text-[9px] text-zinc-500 flex-wrap">
        <span><span className="inline-block w-2.5 h-2.5 bg-emerald-600 rounded-sm align-middle mr-1" />Пересев</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1" style={{ background: "#1a3a2a" }} />Другой 48-DWP</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1" style={{ background: isDark ? "#3f3f46" : "#d4d4d8" }} />Исключён</span>
        {excluded.size > 0 && (
          <button onClick={() => { setExcluded(new Set()); setPreviewIdx(0); }}
            className={`${isDark ? "text-zinc-600" : "text-zinc-500"} hover:text-emerald-500 bg-transparent border-none cursor-pointer font-mono underline text-[9px]`}>
            Вернуть все
          </button>
        )}
      </div>
    </div>
  );
}
