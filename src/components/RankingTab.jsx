import useStore from "../store/useStore";
import { computeRanking } from "../lib/ranking";

export default function RankingTab({ expId }) {
  const plates = useStore((s) => s.plates);
  const { ranked, wtMean, wtN } = computeRanking(plates, expId);

  if (!ranked.length)
    return (
      <div className="text-center text-zinc-600 py-16">
        <div className="text-4xl mb-2">📊</div>
        <div className="text-xs">Нет данных</div>
      </div>
    );

  const maxM = ranked[0].mean;
  const repCounts = [...new Set(ranked.map((c) => c.n))];
  const repLabel = repCounts.length === 1 ? `mean ${repCounts[0]}×` : `mean ${repCounts.join("/")}×`;

  const stats = [
    ["Всего", ranked.length, ""],
    ["Лучший", maxM.toFixed(2), ranked[0].sourceWell],
    ["WT", wtMean.toFixed(2), "n=" + wtN],
    ["Top/WT", ranked[0].ratio.toFixed(1) + "×", ""],
  ];

  return (
    <div>
      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
        Ранкинг · {expId} · {ranked.length} кл. · {repLabel}
      </span>

      <div className="grid grid-cols-4 gap-2.5 my-3">
        {stats.map(([label, value, sub], i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-md p-2.5">
            <div className="text-[9px] text-zinc-500 uppercase">{label}</div>
            <div className={`text-xl font-bold ${
              i === 1 ? "text-emerald-500" : i === 2 ? "text-amber-600" : "text-zinc-200"
            }`}>{value}</div>
            {sub && <div className="text-[9px] text-zinc-600">{sub}</div>}
          </div>
        ))}
      </div>

      <div className="border border-zinc-800 rounded-md overflow-hidden">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-zinc-900 text-zinc-500 text-[9px] uppercase">
              <th className="py-1.5 px-2.5 text-left w-8">#</th>
              <th className="py-1.5 px-2.5 text-left">Clone</th>
              <th className="py-1.5 px-2.5 text-left">Src</th>
              <th className="py-1.5 px-2.5 text-right">Mean±SD</th>
              <th className="py-1.5 px-2.5 text-right">n</th>
              <th className="py-1.5 px-2.5 text-right">Ratio</th>
              <th className="py-1.5 px-2.5 w-[100px]"></th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((cl, i) => (
              <tr key={cl.cloneId}
                className={`border-t border-zinc-900 ${i < 3 ? "bg-emerald-500/[0.04]" : ""}`}>
                <td className="py-1 px-2.5 text-zinc-600 font-bold">{i + 1}</td>
                <td className="py-1 px-2.5 text-zinc-300 text-[10px]">{cl.cloneId}</td>
                <td className="py-1 px-2.5 text-zinc-500 text-[10px]">{cl.sourceWell}</td>
                <td className="py-1 px-2.5 text-right text-emerald-500">
                  {cl.mean.toFixed(3)}±{cl.std.toFixed(3)}
                </td>
                <td className="py-1 px-2.5 text-right text-zinc-500">{cl.n}</td>
                <td className="py-1 px-2.5 text-right text-amber-600">{cl.ratio.toFixed(2)}×</td>
                <td className="py-1 px-2.5">
                  <div className="w-full h-1.5 bg-zinc-800 rounded-sm">
                    <div className="h-1.5 bg-emerald-600 rounded-sm"
                      style={{ width: (cl.mean / maxM * 100) + "%" }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
