import { useState, useMemo } from "react";
import useStore from "../store/useStore";
import { computeRanking } from "../lib/ranking";
import { useTheme } from "../lib/ThemeContext";
import Btn from "./Btn";

export default function StatsTab({ expId }) {
  const { isDark } = useTheme();
  const plates = useStore((s) => s.plates);
  const experiments = useStore((s) => s.experiments);
  const [searchQuery, setSearchQuery] = useState("");

  const expPlates = plates.filter((p) => p.expId === expId);
  const sourcePlates = expPlates.filter((p) => p.type === "source");
  const passagePlates = expPlates.filter((p) => p.type === "passage");
  const culturePlates = expPlates.filter((p) => p.type === "culture");

  // Clone stats
  const allClones = useMemo(() => {
    const map = {};
    for (const p of expPlates) {
      for (const [well, w] of Object.entries(p.wells)) {
        if (w.status === "picked" && w.cloneId && w.cloneId !== "WT") {
          if (!map[w.cloneId]) {
            map[w.cloneId] = { sourceWell: w.sourceWell, plates: [], values: [], status: "alive" };
          }
          if (!map[w.cloneId].plates.includes(p.name)) map[w.cloneId].plates.push(p.name);
          if (w.value !== undefined) map[w.cloneId].values.push(w.value);
        }
        if (w.status === "dead" && w.cloneId) {
          if (map[w.cloneId]) map[w.cloneId].status = "dead";
        }
      }
    }
    return map;
  }, [expPlates]);

  const totalClones = Object.keys(allClones).length;
  const aliveClones = Object.values(allClones).filter((c) => c.status === "alive").length;
  const deadClones = Object.values(allClones).filter((c) => c.status === "dead").length;
  const assayedClones = Object.values(allClones).filter((c) => c.values.length > 0).length;
  const survivalRate = totalClones > 0 ? ((aliveClones / totalClones) * 100).toFixed(1) : "—";

  // OD distribution
  const allOdValues = Object.values(allClones).flatMap((c) => c.values);
  const odMean = allOdValues.length > 0 ? (allOdValues.reduce((a, b) => a + b, 0) / allOdValues.length) : 0;
  const odMax = allOdValues.length > 0 ? Math.max(...allOdValues) : 0;
  const odMin = allOdValues.length > 0 ? Math.min(...allOdValues) : 0;

  // OD histogram (10 bins)
  const histogram = useMemo(() => {
    if (allOdValues.length === 0) return [];
    const bins = 10;
    const range = odMax - odMin || 1;
    const binSize = range / bins;
    const counts = Array(bins).fill(0);
    for (const v of allOdValues) {
      const idx = Math.min(Math.floor((v - odMin) / binSize), bins - 1);
      counts[idx]++;
    }
    return counts.map((count, i) => ({
      from: (odMin + i * binSize).toFixed(3),
      to: (odMin + (i + 1) * binSize).toFixed(3),
      count,
    }));
  }, [allOdValues]);

  const histMax = histogram.length > 0 ? Math.max(...histogram.map((h) => h.count)) : 1;

  // Ranking
  const { ranked, wtMean, wtN } = computeRanking(plates, expId);

  // Search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toUpperCase();
    return Object.entries(allClones)
      .filter(([id]) => id.toUpperCase().includes(q))
      .slice(0, 20)
      .map(([id, data]) => {
        const mean = data.values.length > 0 ? data.values.reduce((a, b) => a + b, 0) / data.values.length : null;
        return { id, ...data, mean };
      });
  }, [searchQuery, allClones]);

  // Multi-experiment ranking
  const [multiExp, setMultiExp] = useState(false);
  const multiRanked = useMemo(() => {
    if (!multiExp) return null;
    const allExpIds = experiments.map((e) => e.id);
    const cloneMap = {};
    for (const eid of allExpIds) {
      const { ranked: r } = computeRanking(plates, eid);
      for (const cl of r) {
        const key = cl.cloneId;
        if (!cloneMap[key]) cloneMap[key] = { ...cl, exp: eid };
        else if (cl.mean > cloneMap[key].mean) cloneMap[key] = { ...cl, exp: eid };
      }
    }
    return Object.values(cloneMap).sort((a, b) => b.mean - a.mean).slice(0, 50);
  }, [multiExp, experiments, plates]);

  if (expPlates.length === 0)
    return (
      <div className="text-center text-zinc-600 py-16">
        <div className="text-4xl mb-2">📈</div>
        <div className="text-xs">Нет данных</div>
      </div>
    );

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Статистика · {expId}</span>
        <div className="flex items-center gap-2">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Поиск клона..."
            className={`${isDark ? "bg-zinc-800 border-zinc-700 text-zinc-200" : "bg-white border-zinc-300 text-zinc-900"} border rounded px-2.5 py-1 text-[10px] font-mono outline-none w-44`}
          />
        </div>
      </div>

      {/* Search results */}
      {searchResults && (
        <div className={`border ${isDark ? "border-zinc-800" : "border-zinc-200"} rounded-lg p-3 mb-4`}>
          <div className="text-[10px] text-zinc-500 mb-2">
            Найдено: {searchResults.length} {searchResults.length >= 20 ? "(показано 20)" : ""}
          </div>
          {searchResults.length === 0 ? (
            <div className="text-zinc-600 text-xs">Ничего не найдено</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="text-zinc-500 text-[9px] uppercase">
                    <th className="text-left py-1 px-2">Clone</th>
                    <th className="text-left py-1 px-2">Source</th>
                    <th className="text-left py-1 px-2">Планшеты</th>
                    <th className="text-right py-1 px-2">Mean OD</th>
                    <th className="text-center py-1 px-2">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((cl) => (
                    <tr key={cl.id} className={`border-t ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
                      <td className={`py-1 px-2 ${isDark ? "text-zinc-200" : "text-zinc-900"} font-bold`}>{cl.id}</td>
                      <td className="py-1 px-2 text-zinc-400">{cl.sourceWell}</td>
                      <td className="py-1 px-2 text-zinc-500">{cl.plates.join(", ")}</td>
                      <td className="py-1 px-2 text-right text-emerald-500">
                        {cl.mean !== null ? cl.mean.toFixed(3) : "—"}
                      </td>
                      <td className="py-1 px-2 text-center">
                        {cl.status === "dead"
                          ? <span className="text-red-500">dead</span>
                          : <span className="text-emerald-600">alive</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          ["Планшетов", expPlates.length, isDark ? "text-zinc-200" : "text-zinc-900"],
          ["Клонов", `${aliveClones}/${totalClones}`, "text-emerald-500"],
          ["Выживаемость", `${survivalRate}%`, "text-emerald-500"],
          ["Скринировано", `${assayedClones}/${totalClones}`, "text-amber-500"],
          ["Source", sourcePlates.length, isDark ? "text-zinc-300" : "text-zinc-700"],
          ["Passage", passagePlates.length, isDark ? "text-zinc-300" : "text-zinc-700"],
          ["Culture", culturePlates.length, isDark ? "text-zinc-300" : "text-zinc-700"],
          ["Dead", deadClones, "text-red-500"],
        ].map(([label, value, color], i) => (
          <div key={i} className={`${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"} border rounded p-2`}>
            <div className={`text-[9px] ${isDark ? "text-zinc-600" : "text-zinc-500"} uppercase`}>{label}</div>
            <div className={`text-lg font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* OD Distribution histogram */}
      {histogram.length > 0 && (
        <div className={`border ${isDark ? "border-zinc-800" : "border-zinc-200"} rounded-lg p-3 mb-4`}>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
            Распределение OD · n={allOdValues.length} · mean={odMean.toFixed(3)} · range={odMin.toFixed(3)}–{odMax.toFixed(3)}
          </div>
          <div className="flex items-end gap-1 h-20">
            {histogram.map((bin, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full bg-emerald-600 rounded-t-sm"
                  style={{ height: `${(bin.count / histMax) * 100}%`, minHeight: bin.count > 0 ? 2 : 0 }} />
                <span className={`text-[7px] ${isDark ? "text-zinc-600" : "text-zinc-500"}`}>{bin.from}</span>
              </div>
            ))}
          </div>
          {wtN > 0 && (
            <div className="text-[10px] text-amber-600 mt-2">
              WT mean: {wtMean.toFixed(3)} (n={wtN})
            </div>
          )}
        </div>
      )}

      {/* Multi-experiment ranking */}
      <div className={`border ${isDark ? "border-zinc-800" : "border-zinc-200"} rounded-lg p-3`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
            {multiExp ? "Мульти-эксперимент ранкинг (top 50)" : "Ранкинг этого эксперимента"}
          </span>
          {experiments.length > 1 && (
            <Btn small variant={multiExp ? "primary" : "secondary"}
              onClick={() => setMultiExp(!multiExp)}>
              {multiExp ? "Только этот" : "Все эксперименты"}
            </Btn>
          )}
        </div>

        {(() => {
          const data = multiExp ? multiRanked : ranked;
          if (!data || data.length === 0) return <div className="text-zinc-600 text-xs py-4 text-center">Нет данных ранкинга</div>;
          const maxM = data[0].mean;
          return (
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead className={`sticky top-0 ${isDark ? "bg-zinc-900" : "bg-zinc-50"}`}>
                  <tr className="text-zinc-500 text-[9px] uppercase">
                    <th className="text-left py-1 px-2 w-6">#</th>
                    <th className="text-left py-1 px-2">Clone</th>
                    {multiExp && <th className="text-left py-1 px-2">Exp</th>}
                    <th className="text-left py-1 px-2">Src</th>
                    <th className="text-right py-1 px-2">Mean±SD</th>
                    <th className="text-right py-1 px-2">Ratio</th>
                    <th className="py-1 px-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((cl, i) => (
                    <tr key={cl.cloneId + (cl.exp || "")}
                      className={`border-t ${isDark ? "border-zinc-800" : "border-zinc-200"} ${i < 3 ? "bg-emerald-500/[0.04]" : ""}`}>
                      <td className={`py-1 px-2 ${isDark ? "text-zinc-600" : "text-zinc-400"} font-bold`}>{i + 1}</td>
                      <td className={`py-1 px-2 ${isDark ? "text-zinc-200" : "text-zinc-900"} text-[9px]`}>{cl.cloneId}</td>
                      {multiExp && <td className="py-1 px-2 text-zinc-500">{cl.exp}</td>}
                      <td className="py-1 px-2 text-zinc-500">{cl.sourceWell}</td>
                      <td className="py-1 px-2 text-right text-emerald-500">{cl.mean.toFixed(3)}±{cl.std.toFixed(3)}</td>
                      <td className="py-1 px-2 text-right text-amber-600">{cl.ratio.toFixed(2)}×</td>
                      <td className="py-1 px-2">
                        <div className={`w-full h-1.5 ${isDark ? "bg-zinc-800" : "bg-zinc-200"} rounded-sm`}>
                          <div className="h-1.5 bg-emerald-600 rounded-sm" style={{ width: `${(cl.mean / maxM) * 100}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
