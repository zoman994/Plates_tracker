import { useState } from "react";
import { ROWS_96, COLS_96, ROWS_48, COLS_48, WELL_STATUS, posToWell } from "../lib/geometry";
import { useTheme } from "../lib/ThemeContext";
import Btn from "./Btn";

export default function PlateMap({ format, wells, onBatchAction, onWellHover, readOnly, hoveredClone, compact }) {
  const { isDark } = useTheme();
  const rows = format === 96 ? ROWS_96 : ROWS_48;
  const cols = format === 96 ? COLS_96 : COLS_48;
  const is48 = format === 48;
  const cellW = compact ? 22 : (is48 ? 48 : 26);
  const cellH = compact ? 22 : (is48 ? 26 : 26);
  const gap = 2, labelW = 20, labelH = 16;
  const totalW = labelW + cols.length * (cellW + gap);
  const totalH = labelH + rows.length * (cellH + gap);

  const [selected, setSelected] = useState(new Set());
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);

  // Theme-aware color overrides for well statuses
  const wellColors = {
    empty:          { color: isDark ? "#27272a" : "#f4f4f5", border: isDark ? "#3f3f46" : "#d4d4d8" },
    picked:         { color: "#059669", border: "#10b981" },
    "control-wt":   { color: "#d97706", border: "#f59e0b" },
    "control-blank": { color: "#52525b", border: "#71717a" },
    dead:           { color: isDark ? "#7f1d1d" : "#fecaca", border: "#991b1b" },
  };

  const dragSel = (() => {
    if (!dragStart || !dragEnd) return new Set();
    const r1 = Math.min(dragStart.r, dragEnd.r), r2 = Math.max(dragStart.r, dragEnd.r);
    const c1 = Math.min(dragStart.c, dragEnd.c), c2 = Math.max(dragStart.c, dragEnd.c);
    const s = new Set();
    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++)
        s.add(posToWell(r, c));
    return s;
  })();

  const activeSel = dragging ? dragSel : selected;

  function onMD(ri, ci, e) {
    if (readOnly) return;
    e.preventDefault();
    setDragging(true);
    setDragStart({ r: ri, c: ci });
    setDragEnd({ r: ri, c: ci });
  }
  function onME(ri, ci) {
    onWellHover?.(posToWell(ri, ci));
    if (dragging) setDragEnd({ r: ri, c: ci });
  }
  function onMU() {
    if (!dragging) return;
    setSelected(new Set(dragSel));
    setDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }
  function selRow(ri) {
    if (readOnly) return;
    const s = new Set();
    for (let c = 0; c < cols.length; c++) s.add(posToWell(ri, c));
    setSelected(s);
  }
  function selCol(ci) {
    if (readOnly) return;
    const s = new Set();
    for (let r = 0; r < rows.length; r++) s.add(posToWell(r, ci));
    setSelected(s);
  }
  function selAll() {
    const s = new Set();
    for (let r = 0; r < rows.length; r++)
      for (let c = 0; c < cols.length; c++)
        s.add(posToWell(r, c));
    setSelected(s);
  }
  function batch(action) {
    if (activeSel.size === 0) return;
    onBatchAction?.(Array.from(activeSel), action);
    setSelected(new Set());
  }

  const selCount = activeSel.size;

  return (
    <div>
      {!readOnly && (
        <div className="flex items-center gap-1.5 mb-1.5 min-h-[24px] flex-wrap">
          {selCount > 0 ? (
            <>
              <span className={`text-[10px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                Выбрано: <b className="text-cyan-400">{selCount}</b>
              </span>
              <Btn small onClick={() => batch("pick")}>✓ Клоны</Btn>
              <Btn small variant="secondary" onClick={() => batch("wt")}>WT</Btn>
              <Btn small variant="secondary" onClick={() => batch("blank")}>BL</Btn>
              <Btn small variant="danger" onClick={() => batch("dead")}>✗ Мёрт</Btn>
              <Btn small variant="secondary" onClick={() => batch("clear")}>Очист</Btn>
              <Btn small variant="ghost" onClick={() => setSelected(new Set())}>✕</Btn>
            </>
          ) : (
            <span className={`text-[9px] ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>Тяни мышью · клик по букве/цифре = ряд</span>
          )}
          <div className="flex-1" />
          <Btn small variant="ghost" onClick={selAll}>Всё</Btn>
        </div>
      )}
      <svg width={totalW} height={totalH}
        style={{ fontFamily: "'JetBrains Mono',monospace", userSelect: "none" }}
        onMouseUp={onMU} onMouseLeave={onMU}>
        {cols.map((c, ci) => (
          <text key={ci} x={labelW + ci * (cellW + gap) + cellW / 2} y={11}
            textAnchor="middle" fill="#71717a" fontSize={8}
            style={{ cursor: readOnly ? "default" : "pointer" }}
            onClick={() => selCol(ci)}>{c}</text>
        ))}
        {rows.map((r, ri) => (
          <text key={ri} x={10} y={labelH + ri * (cellH + gap) + cellH / 2 + 3}
            textAnchor="middle" fill="#71717a" fontSize={8}
            style={{ cursor: readOnly ? "default" : "pointer" }}
            onClick={() => selRow(ri)}>{r}</text>
        ))}
        {rows.map((r, ri) =>
          cols.map((c, ci) => {
            const well = `${r}${c}`;
            const w = wells[well] || { status: "empty" };
            const st = wellColors[w.status] || wellColors.empty;
            const isHov = hoveredClone && w.cloneId === hoveredClone;
            const isSel = activeSel.has(well);
            const x = labelW + ci * (cellW + gap);
            const y = labelH + ri * (cellH + gap);
            return (
              <g key={well}
                onMouseDown={(e) => onMD(ri, ci, e)}
                onMouseEnter={() => onME(ri, ci)}
                style={{ cursor: readOnly ? "default" : "crosshair" }}>
                <rect x={x} y={y} width={cellW} height={cellH} rx={2}
                  fill={st.color}
                  stroke={isSel ? "#22d3ee" : isHov ? "#22d3ee" : st.border}
                  strokeWidth={isSel || isHov ? 1.5 : 0.5} />
                {isSel && (
                  <rect x={x + 1} y={y + 1} width={cellW - 2} height={cellH - 2} rx={1}
                    fill="rgba(34,211,238,0.15)" stroke="none" />
                )}
                {w.status === "control-wt" && (
                  <text x={x + cellW / 2} y={y + cellH / 2 + 3}
                    textAnchor="middle" fill="#fff" fontSize={compact ? 6 : 8} fontWeight="bold">WT</text>
                )}
                {w.status === "control-blank" && (
                  <text x={x + cellW / 2} y={y + cellH / 2 + 3}
                    textAnchor="middle" fill="#a1a1aa" fontSize={compact ? 6 : 7}>BL</text>
                )}
                {w.status === "picked" && !compact && format === 48 && w.replicateNum === 1 && (
                  <text x={x + cellW / 2} y={y + cellH / 2 + 3}
                    textAnchor="middle" fill={isDark ? "#d4d4d8" : "#3f3f46"} fontSize={7}>{w.sourceWell || ""}</text>
                )}
                {w.status === "picked" && !compact && format === 48 && w.replicateNum > 1 && (
                  <text x={x + cellW / 2} y={y + cellH / 2 + 3}
                    textAnchor="middle" fill="#71717a" fontSize={7}>r{w.replicateNum}</text>
                )}
                {w.value !== undefined && (
                  <text x={x + cellW / 2} y={y + cellH / 2 + 3}
                    textAnchor="middle" fill={isDark ? "#fff" : "#18181b"} fontSize={7} fontWeight="bold">{w.value.toFixed(1)}</text>
                )}
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
}
