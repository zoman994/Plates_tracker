import { ROWS_48, COLS_48 } from "../lib/geometry";

export default function HeatmapPlate({ wells, maxVal }) {
  const cellW = 52, cellH = 28, gap = 2, labelW = 20, labelH = 16;
  const mv = maxVal || 1;
  const totalW = labelW + COLS_48.length * (cellW + gap);
  const totalH = labelH + ROWS_48.length * (cellH + gap);

  return (
    <svg width={totalW} height={totalH} style={{ fontFamily: "'JetBrains Mono',monospace" }}>
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
          const w = wells[well] || {};
          const val = w.value;
          const x = labelW + ci * (cellW + gap);
          const y = labelH + ri * (cellH + gap);
          const int = val !== undefined ? Math.min(val / mv, 1) : 0;
          const fill = val !== undefined
            ? `rgba(16,185,129,${0.08 + int * 0.92})`
            : w.status === "control-wt"
              ? "rgba(245,158,11,0.3)"
              : "#27272a";
          return (
            <g key={well}>
              <rect x={x} y={y} width={cellW} height={cellH} rx={2}
                fill={fill} stroke="#3f3f46" strokeWidth={0.5} />
              <text x={x + cellW / 2} y={y + cellH / 2 + 3}
                textAnchor="middle" fill="#fff" fontSize={8}>
                {val !== undefined ? val.toFixed(2) : w.status === "control-wt" ? "WT" : ""}
              </text>
            </g>
          );
        })
      )}
    </svg>
  );
}
