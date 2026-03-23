import { ROWS_96, COLS_96 } from "../lib/geometry";
import { useTheme } from "../lib/ThemeContext";

export default function SourceView({ wells, previewIds, hovClone, onHover }) {
  const { isDark } = useTheme();
  const cellS = 26, gap = 2, labelW = 20, labelH = 16;
  const totalW = labelW + COLS_96.length * (cellS + gap);
  const totalH = labelH + ROWS_96.length * (cellS + gap);

  const emptyFill = isDark ? "#27272a" : "#f4f4f5";
  const emptyStroke = isDark ? "#3f3f46" : "#d4d4d8";
  const deadFill = isDark ? "#7f1d1d" : "#fecaca";

  return (
    <svg width={totalW} height={totalH}
      style={{ fontFamily: "'JetBrains Mono',monospace", userSelect: "none" }}>
      {COLS_96.map((c, ci) => (
        <text key={ci} x={labelW + ci * (cellS + gap) + cellS / 2} y={11}
          textAnchor="middle" fill="#71717a" fontSize={8}>{c}</text>
      ))}
      {ROWS_96.map((r, ri) => (
        <text key={ri} x={10} y={labelH + ri * (cellS + gap) + cellS / 2 + 3}
          textAnchor="middle" fill="#71717a" fontSize={8}>{r}</text>
      ))}
      {ROWS_96.map((r, ri) =>
        COLS_96.map((c, ci) => {
          const well = `${r}${c}`;
          const w = wells[well] || { status: "empty" };
          const x = labelW + ci * (cellS + gap);
          const y = labelH + ri * (cellS + gap);
          const isHov = hovClone && w.cloneId === hovClone;

          let fill = emptyFill, stroke = emptyStroke;
          if (w.status === "picked") {
            if (previewIds.has(w.cloneId)) { fill = "#059669"; stroke = "#10b981"; }
            else { fill = "#1a3a2a"; stroke = "#27472f"; }
          } else if (w.status === "control-wt") { fill = "#d97706"; stroke = "#f59e0b"; }
          else if (w.status === "control-blank") { fill = "#52525b"; stroke = "#71717a"; }
          else if (w.status === "dead") { fill = deadFill; stroke = "#991b1b"; }

          return (
            <g key={well}
              onMouseEnter={() => {
                if (w.cloneId && w.status === "picked") onHover(w.cloneId);
                else onHover(null);
              }}
              style={{ cursor: "default" }}>
              <rect x={x} y={y} width={cellS} height={cellS} rx={2}
                fill={fill} stroke={isHov ? "#22d3ee" : stroke}
                strokeWidth={isHov ? 2 : 0.5} />
            </g>
          );
        })
      )}
    </svg>
  );
}
