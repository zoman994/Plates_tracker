import { useState, useRef } from "react";
import useStore from "../store/useStore";
import { ROWS_48, COLS_48, PLATE_TYPES, posToWell } from "../lib/geometry";
import { parseAssayXlsx } from "../lib/xlsxParser";
import { downloadAssayTemplate } from "../lib/templateDownload";
import { computeRanking } from "../lib/ranking";
import { useTheme } from "../lib/ThemeContext";
import Btn from "./Btn";

export default function AnalysisTab({ expId }) {
  const { isDark } = useTheme();
  const plates = useStore((s) => s.plates);
  const importAssay = useStore((s) => s.importAssay);
  const updateWellValue = useStore((s) => s.updateWellValue);

  const [selPlate, setSelPlate] = useState(null);
  const [editWell, setEditWell] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const culturePlates = plates.filter((p) => p.expId === expId && p.type === "culture");
  const curPlate = culturePlates.find((p) => p.id === selPlate);

  // Stats
  const allValues = curPlate
    ? Object.values(curPlate.wells).filter((w) => w.value !== undefined).map((w) => w.value)
    : [];
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 1;
  const filledCount = allValues.length;
  const totalWells = curPlate ? Object.keys(curPlate.wells).length : 0;

  // Ranking summary
  const { ranked, wtMean, wtN } = computeRanking(plates, expId);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file || !selPlate) return;
    setError(null);
    try {
      const matrix = await parseAssayXlsx(file);
      const text = matrix.map((row) => row.map((v) => v ?? "").join("\t")).join("\n");
      importAssay(selPlate, text);
    } catch (err) {
      setError("Ошибка чтения: " + err.message);
    }
    e.target.value = "";
  }

  function handleWellClick(well) {
    if (!curPlate) return;
    const w = curPlate.wells[well];
    setEditWell(well);
    setEditVal(w?.value !== undefined ? String(w.value) : "");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleEditSave() {
    if (!editWell || !selPlate) return;
    const val = editVal.trim() === "" ? null : parseFloat(editVal);
    if (editVal.trim() !== "" && isNaN(val)) return;
    updateWellValue(selPlate, editWell, val);
    setEditWell(null);
    setEditVal("");
  }

  function handleEditKey(e) {
    if (e.key === "Enter") handleEditSave();
    if (e.key === "Escape") { setEditWell(null); setEditVal(""); }
  }

  // Heatmap dimensions — rectangular wells to match 96-well plate width
  const cellW = 52, cellH = 28, gap = 3, labelW = 22, labelH = 18;
  const svgW = labelW + COLS_48.length * (cellW + gap);
  const svgH = labelH + ROWS_48.length * (cellH + gap);

  const emptyFill = isDark ? "#27272a" : "#f4f4f5";
  const borderStroke = isDark ? "#3f3f46" : "#d4d4d8";
  const textOnWell = isDark ? "#fff" : "#18181b";

  if (culturePlates.length === 0)
    return (
      <div className="text-center text-zinc-600 py-16">
        <div className="text-4xl mb-2">📊</div>
        <div className="text-xs">Нет culture-планшетов. Сначала сделай transfer 96→48-DWP.</div>
      </div>
    );

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Анализ · {expId}</span>
        <button onClick={downloadAssayTemplate}
          className={`text-[9px] ${isDark ? "text-zinc-600" : "text-zinc-500"} hover:text-emerald-500 cursor-pointer bg-transparent border-none font-mono underline`}>
          ⬇ Скачать шаблон .xlsx
        </button>
      </div>

      {/* Plate selector */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {culturePlates.map((p) => {
          const hasData = Object.values(p.wells).some((w) => w.value !== undefined);
          return (
            <button key={p.id}
              className={`px-3 py-1.5 text-[10px] rounded border font-mono cursor-pointer ${
                selPlate === p.id
                  ? "border-emerald-600 bg-emerald-500/10 text-emerald-500"
                  : isDark ? "border-zinc-700 text-zinc-400" : "border-zinc-300 text-zinc-600"
              }`}
              onClick={() => { setSelPlate(p.id); setEditWell(null); }}>
              {PLATE_TYPES.culture.icon} {p.name}
              {hasData && <span className="ml-1 text-emerald-700">✓</span>}
            </button>
          );
        })}
      </div>

      {!curPlate && (
        <div className="text-center text-zinc-600 py-10 text-xs">Выбери планшет</div>
      )}

      {curPlate && (
        <div className={`border ${isDark ? "border-zinc-800" : "border-zinc-200"} rounded-lg p-4`}>
          {/* Header with upload */}
          <div className="flex justify-between items-center mb-3">
            <div>
              <span className={`font-bold ${isDark ? "text-zinc-200" : "text-zinc-900"}`}>{curPlate.name}</span>
              <span className="text-[10px] text-zinc-500 ml-2">
                48-DWP · {curPlate.replicates || 3}× ·
                {filledCount > 0
                  ? ` ${filledCount}/${totalWells} лунок`
                  : " нет данных"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className={`inline-flex items-center px-3 py-1 ${isDark ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-300"} rounded cursor-pointer text-[10px] font-mono border transition-colors`}>
                📊 Загрузить .xlsx
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
              </label>
            </div>
          </div>

          {error && <div className="text-red-500 text-[10px] mb-2">{error}</div>}

          {/* Edit popover */}
          {editWell && (
            <div className={`${isDark ? "bg-zinc-800 border-zinc-600" : "bg-zinc-100 border-zinc-300"} border rounded p-2 mb-2 flex items-center gap-2`}>
              <span className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-800"} font-bold`}>{editWell}</span>
              <span className="text-[10px] text-zinc-500">
                {curPlate.wells[editWell]?.cloneId || "—"}
              </span>
              <input ref={inputRef}
                type="number" step="0.001"
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onKeyDown={handleEditKey}
                className={`w-24 ${isDark ? "bg-zinc-900 border-zinc-600 text-zinc-200" : "bg-white border-zinc-300 text-zinc-900"} border rounded px-2 py-0.5 text-xs font-mono outline-none`}
                placeholder="OD"
              />
              <Btn small onClick={handleEditSave}>✓</Btn>
              <Btn small variant="ghost" onClick={() => { setEditWell(null); setEditVal(""); }}>✕</Btn>
              {editVal.trim() === "" && curPlate.wells[editWell]?.value !== undefined && (
                <span className={`text-[9px] ${isDark ? "text-zinc-600" : "text-zinc-500"}`}>пусто = удалить</span>
              )}
            </div>
          )}

          {/* Interactive heatmap */}
          <div className="flex justify-center overflow-x-auto">
            <svg width={svgW} height={svgH}
              style={{ fontFamily: "'JetBrains Mono',monospace", userSelect: "none" }}>
              {COLS_48.map((c, ci) => (
                <text key={c} x={labelW + ci * (cellW + gap) + cellW / 2} y={12}
                  textAnchor="middle" fill="#71717a" fontSize={9}>{c}</text>
              ))}
              {ROWS_48.map((r, ri) => (
                <text key={r} x={11} y={labelH + ri * (cellH + gap) + cellH / 2 + 3}
                  textAnchor="middle" fill="#71717a" fontSize={9}>{r}</text>
              ))}
              {ROWS_48.map((r, ri) =>
                COLS_48.map((c, ci) => {
                  const well = `${r}${c}`;
                  const w = curPlate.wells[well] || {};
                  const val = w.value;
                  const x = labelW + ci * (cellW + gap);
                  const y = labelH + ri * (cellH + gap);
                  const int = val !== undefined ? Math.min(val / maxVal, 1) : 0;
                  const isEditing = editWell === well;

                  let fill = emptyFill;
                  if (val !== undefined) fill = `rgba(16,185,129,${0.08 + int * 0.92})`;
                  else if (w.status === "control-wt") fill = "rgba(245,158,11,0.3)";

                  return (
                    <g key={well} onClick={() => handleWellClick(well)} style={{ cursor: "pointer" }}>
                      <rect x={x} y={y} width={cellW} height={cellH} rx={3}
                        fill={fill}
                        stroke={isEditing ? "#22d3ee" : borderStroke}
                        strokeWidth={isEditing ? 2 : 0.5} />
                      <text x={x + cellW / 2} y={y + cellH / 2 - 1}
                        textAnchor="middle" fill={textOnWell} fontSize={9} fontWeight="bold">
                        {val !== undefined ? val.toFixed(2) : w.status === "control-wt" ? "WT" : ""}
                      </text>
                      <text x={x + cellW / 2} y={y + cellH / 2 + 9}
                        textAnchor="middle" fill="#71717a" fontSize={7}>
                        {w.cloneId && w.cloneId !== "WT"
                          ? (w.replicateNum === 1 ? (w.sourceWell || "") : `r${w.replicateNum}`)
                          : ""}
                      </text>
                    </g>
                  );
                })
              )}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex gap-4 justify-center mt-3 text-[9px] text-zinc-500">
            <span><span className="inline-block w-3 h-3 rounded-sm align-middle mr-1" style={{ background: "rgba(16,185,129,0.9)" }} />Высокий OD</span>
            <span><span className="inline-block w-3 h-3 rounded-sm align-middle mr-1" style={{ background: "rgba(16,185,129,0.15)" }} />Низкий OD</span>
            <span><span className="inline-block w-3 h-3 rounded-sm align-middle mr-1" style={{ background: "rgba(245,158,11,0.3)" }} />WT контроль</span>
            <span><span className="inline-block w-3 h-3 rounded-sm align-middle mr-1" style={{ background: emptyFill }} />Нет данных</span>
            <span className={isDark ? "text-zinc-600" : "text-zinc-500"}>· клик = редактировать</span>
          </div>

          {/* Quick stats */}
          {filledCount > 0 && ranked.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-4">
              {[
                ["Лунок", `${filledCount}/${totalWells}`],
                ["WT mean", wtN > 0 ? wtMean.toFixed(3) : "—"],
                ["Top клон", ranked.length > 0 ? ranked[0].mean.toFixed(3) : "—"],
                ["Top/WT", ranked.length > 0 && wtN > 0 ? ranked[0].ratio.toFixed(2) + "×" : "—"],
              ].map(([label, value], i) => (
                <div key={i} className={`${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"} border rounded p-2`}>
                  <div className={`text-[9px] ${isDark ? "text-zinc-600" : "text-zinc-500"} uppercase`}>{label}</div>
                  <div className={`text-sm font-bold ${
                    i === 2 ? "text-emerald-500" : i === 1 ? "text-amber-600" : isDark ? "text-zinc-300" : "text-zinc-700"
                  }`}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
