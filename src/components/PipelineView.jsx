import useStore from "../store/useStore";
import { PLATE_TYPES } from "../lib/geometry";
import { useTheme } from "../lib/ThemeContext";

const typeColors = {
  source: { fill: "#064e3b", stroke: "#10b981" },
  passage: { fill: "#1e3a5f", stroke: "#3b82f6" },
  culture: { fill: "#4a2040", stroke: "#a855f7" },
  flask: { fill: "#4a3520", stroke: "#f59e0b" },
};

const typeColorsLight = {
  source: { fill: "#d1fae5", stroke: "#10b981" },
  passage: { fill: "#dbeafe", stroke: "#3b82f6" },
  culture: { fill: "#f3e8ff", stroke: "#a855f7" },
  flask: { fill: "#fef3c7", stroke: "#f59e0b" },
};

export default function PipelineView({ expId }) {
  const { isDark } = useTheme();
  const plates = useStore((s) => s.plates).filter((p) => p.expId === expId);
  const transfers = useStore((s) => s.transfers).filter((t) => t.expId === expId);
  const setSelPlate = useStore((s) => s.setSelPlate);
  const setTab = useStore((s) => s.setTab);

  const colors = isDark ? typeColors : typeColorsLight;

  const typeOrder = ["source", "passage", "culture", "flask"];
  const columns = typeOrder
    .map((type) => plates.filter((p) => p.type === type))
    .filter((col) => col.length > 0);

  if (columns.length === 0)
    return (
      <div className="text-center text-zinc-600 py-16">
        <div className="text-4xl mb-2">🔬</div>
        <div className="text-xs">Нет планшетов</div>
      </div>
    );

  const nodeW = 130, nodeH = 50, gapX = 80, gapY = 16, padX = 40, padY = 40;

  const nodePositions = new Map();
  columns.forEach((col, ci) => {
    col.forEach((plate, ri) => {
      nodePositions.set(plate.id, {
        x: padX + ci * (nodeW + gapX),
        y: padY + ri * (nodeH + gapY),
      });
    });
  });

  const svgW = padX * 2 + columns.length * (nodeW + gapX) - gapX;
  const maxColLen = Math.max(...columns.map((c) => c.length));
  const svgH = padY * 2 + maxColLen * (nodeH + gapY) - gapY;

  const edges = [];
  for (const t of transfers) {
    const srcPos = nodePositions.get(t.sourceId);
    if (!srcPos) continue;
    for (const tid of t.targetIds) {
      const tgtPos = nodePositions.get(tid);
      if (!tgtPos) continue;
      edges.push({
        x1: srcPos.x + nodeW, y1: srcPos.y + nodeH / 2,
        x2: tgtPos.x, y2: tgtPos.y + nodeH / 2,
        type: t.type,
      });
    }
  }

  function handleClick(plateId) {
    setSelPlate(plateId);
    setTab("plates");
  }

  const arrowFill = isDark ? "#52525b" : "#a1a1aa";
  const edgeStroke = isDark ? "#3f3f46" : "#d4d4d8";
  const nodeTextPrimary = isDark ? "#e4e4e7" : "#18181b";

  return (
    <div className={`border ${isDark ? "border-zinc-800" : "border-zinc-200"} rounded-lg p-4 overflow-x-auto`}>
      <span className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3 block">
        Пайплайн · {expId}
      </span>
      <svg width={svgW} height={svgH} style={{ fontFamily: "'JetBrains Mono',monospace" }}>
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={arrowFill} />
          </marker>
        </defs>
        {edges.map((e, i) => (
          <path key={i}
            d={`M${e.x1},${e.y1} C${e.x1 + 40},${e.y1} ${e.x2 - 40},${e.y2} ${e.x2},${e.y2}`}
            fill="none" stroke={edgeStroke} strokeWidth={1.5}
            markerEnd="url(#arrowhead)" />
        ))}
        {plates.map((plate) => {
          const pos = nodePositions.get(plate.id);
          if (!pos) return null;
          const tc = colors[plate.type] || colors.source;
          const cloneCount = Object.values(plate.wells).filter((w) => w.status === "picked").length;
          return (
            <g key={plate.id} onClick={() => handleClick(plate.id)} style={{ cursor: "pointer" }}>
              <rect x={pos.x} y={pos.y} width={nodeW} height={nodeH} rx={6}
                fill={tc.fill} stroke={tc.stroke} strokeWidth={1} />
              <text x={pos.x + nodeW / 2} y={pos.y + 20}
                textAnchor="middle" fill={nodeTextPrimary} fontSize={11} fontWeight="bold">
                {PLATE_TYPES[plate.type]?.icon} {plate.name}
              </text>
              <text x={pos.x + nodeW / 2} y={pos.y + 36}
                textAnchor="middle" fill="#a1a1aa" fontSize={9}>
                {plate.format === 48 ? "48-DWP" : "96-well"} · {cloneCount} кл.
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
