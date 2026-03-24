import { useState, useMemo } from "react";
import useStore from "../store/useStore";
import { useTheme } from "../lib/ThemeContext";
import Btn from "./Btn";

const FLASK_PARAMS = [
  { key: "od", label: "OD", unit: "", step: "0.001" },
  { key: "activity", label: "Активность ГА", unit: "ед/мл", step: "0.1" },
  { key: "biomass", label: "Биомасса", unit: "г/л", step: "0.01" },
  { key: "ph", label: "pH", unit: "", step: "0.1" },
  { key: "glucose", label: "Глюкоза", unit: "г/л", step: "0.1" },
  { key: "time", label: "Время культ.", unit: "ч", step: "1" },
];

export default function FlaskTab({ expId }) {
  const { isDark } = useTheme();
  const plates = useStore((s) => s.plates);
  const experiments = useStore((s) => s.experiments);
  const createFlask = useStore((s) => s.createFlask);
  const updateFlaskData = useStore((s) => s.updateFlaskData);
  const requestDelete = useStore((s) => s.requestDelete);

  const [selFlask, setSelFlask] = useState(null);
  const [sortKey, setSortKey] = useState("activity");
  const [sortDir, setSortDir] = useState("desc");

  const flasks = useMemo(() =>
    plates.filter((p) => p.expId === expId && p.type === "flask"),
    [plates, expId]
  );

  const curFlask = flasks.find((f) => f.id === selFlask);

  // WT reference from culture plates
  const culturePlates = plates.filter((p) => p.expId === expId && p.type === "culture");
  const wtValues = [];
  for (const cp of culturePlates)
    for (const w of Object.values(cp.wells))
      if (w.status === "control-wt" && w.value !== undefined) wtValues.push(w.value);
  const wtMean = wtValues.length > 0 ? wtValues.reduce((a, b) => a + b, 0) / wtValues.length : 1;

  // Sorted flask table
  const sortedFlasks = useMemo(() => {
    return [...flasks].sort((a, b) => {
      const va = a.flaskData?.[sortKey] ?? -Infinity;
      const vb = b.flaskData?.[sortKey] ?? -Infinity;
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [flasks, sortKey, sortDir]);

  function handleSort(key) {
    if (sortKey === key) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function handleParamChange(flaskId, key, value) {
    const v = value === "" ? null : parseFloat(value);
    if (value !== "" && isNaN(v)) return;
    updateFlaskData(flaskId, key, v);
  }

  const bd = isDark ? "border-zinc-800" : "border-zinc-200";
  const bg2 = isDark ? "bg-zinc-900" : "bg-zinc-50";

  if (flasks.length === 0)
    return (
      <div className="text-center text-zinc-500 py-16">
        <div className="text-4xl mb-3">🏺</div>
        <div className="text-sm">Нет колб</div>
        <div className={`text-[10px] mt-1 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
          Отбери клоны из ранкинга или создай колбу вручную
        </div>
        <div className="mt-3">
          <Btn onClick={() => createFlask(expId)}>+ Создать колбу</Btn>
        </div>
      </div>
    );

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
          Колбы · {expId} · {flasks.length} шт.
        </span>
        <Btn onClick={() => createFlask(expId)}>+ Колба</Btn>
      </div>

      {/* Flask table */}
      <div className={`border ${bd} rounded-lg overflow-hidden mb-4`}>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className={`${bg2} text-zinc-500 text-[9px] uppercase`}>
                <th className="py-1.5 px-2 text-left">Колба</th>
                <th className="py-1.5 px-2 text-left">Клон</th>
                <th className="py-1.5 px-2 text-left">Source</th>
                {FLASK_PARAMS.map((p) => (
                  <th key={p.key} className="py-1.5 px-2 text-right cursor-pointer hover:text-emerald-500"
                    onClick={() => handleSort(p.key)}>
                    {p.label} {sortKey === p.key ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </th>
                ))}
                <th className="py-1.5 px-2 text-left">Заметки</th>
                <th className="py-1.5 px-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {sortedFlasks.map((flask) => {
                const d = flask.flaskData || {};
                const ratio = d.activity && wtMean > 0 ? (d.activity / wtMean).toFixed(1) + "×" : "";
                const isSel = selFlask === flask.id;
                return (
                  <tr key={flask.id}
                    className={`border-t ${bd} cursor-pointer ${isSel ? "bg-emerald-500/[0.05]" : ""}`}
                    onClick={() => setSelFlask(isSel ? null : flask.id)}>
                    <td className={`py-1 px-2 font-bold ${isDark ? "text-zinc-200" : "text-zinc-900"}`}>{flask.name}</td>
                    <td className="py-1 px-2 text-emerald-500">{flask.flaskData?.cloneId || "—"}</td>
                    <td className="py-1 px-2 text-zinc-500">{flask.flaskData?.sourceWell || "—"}</td>
                    {FLASK_PARAMS.map((p) => (
                      <td key={p.key} className={`py-1 px-2 text-right ${
                        p.key === "activity" ? "text-emerald-500 font-bold" : isDark ? "text-zinc-300" : "text-zinc-700"
                      }`}>
                        {d[p.key] !== null && d[p.key] !== undefined ? d[p.key] : "—"}
                        {p.key === "activity" && ratio && <span className="text-amber-600 ml-1 text-[8px]">{ratio}</span>}
                      </td>
                    ))}
                    <td className="py-1 px-2 text-zinc-500 max-w-[120px] truncate">{d.notes || ""}</td>
                    <td className="py-1 px-2">
                      <button onClick={(e) => { e.stopPropagation(); requestDelete("plate", flask.id); }}
                        className="text-red-500 hover:text-red-400 bg-transparent border-none cursor-pointer text-[10px]">✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Flask detail / edit */}
      {curFlask && (
        <div className={`border ${bd} rounded-lg p-4`}>
          <div className="flex justify-between items-center mb-3">
            <span className={`font-bold ${isDark ? "text-zinc-200" : "text-zinc-900"}`}>
              {curFlask.name} — {curFlask.flaskData?.cloneId || "не назначен"}
            </span>
          </div>

          {/* Clone assignment */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[9px] text-zinc-500">Clone ID</label>
              <input value={curFlask.flaskData?.cloneId || ""}
                onChange={(e) => updateFlaskData(curFlask.id, "cloneId", e.target.value)}
                className={`w-full ${isDark ? "bg-zinc-800 border-zinc-700 text-zinc-200" : "bg-white border-zinc-300 text-zinc-900"} border rounded px-2 py-1 text-[10px] font-mono outline-none mt-0.5`}
                placeholder="NTG1-S01-B7" />
            </div>
            <div>
              <label className="text-[9px] text-zinc-500">Source Well</label>
              <input value={curFlask.flaskData?.sourceWell || ""}
                onChange={(e) => updateFlaskData(curFlask.id, "sourceWell", e.target.value)}
                className={`w-full ${isDark ? "bg-zinc-800 border-zinc-700 text-zinc-200" : "bg-white border-zinc-300 text-zinc-900"} border rounded px-2 py-1 text-[10px] font-mono outline-none mt-0.5`}
                placeholder="B7" />
            </div>
          </div>

          {/* Parameters */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {FLASK_PARAMS.map((p) => (
              <div key={p.key}>
                <label className="text-[9px] text-zinc-500">{p.label} {p.unit && `(${p.unit})`}</label>
                <input type="number" step={p.step}
                  value={curFlask.flaskData?.[p.key] ?? ""}
                  onChange={(e) => handleParamChange(curFlask.id, p.key, e.target.value)}
                  className={`w-full ${isDark ? "bg-zinc-800 border-zinc-700 text-zinc-200" : "bg-white border-zinc-300 text-zinc-900"} border rounded px-2 py-1 text-[10px] font-mono outline-none mt-0.5`} />
              </div>
            ))}
          </div>

          {/* Notes */}
          <div>
            <label className="text-[9px] text-zinc-500">Заметки</label>
            <textarea value={curFlask.flaskData?.notes || ""}
              onChange={(e) => updateFlaskData(curFlask.id, "notes", e.target.value)}
              className={`w-full ${isDark ? "bg-zinc-800 border-zinc-700 text-zinc-200" : "bg-white border-zinc-300 text-zinc-900"} border rounded px-2 py-1 text-[10px] font-mono outline-none mt-0.5 resize-none h-12`}
              placeholder="Условия, наблюдения..." />
          </div>
        </div>
      )}
    </div>
  );
}
