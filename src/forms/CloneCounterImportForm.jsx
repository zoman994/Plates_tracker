import { useState } from "react";
import Btn from "../components/Btn";
import { parseCloneCounterFile } from "../lib/cloneCounterImport";
import { useTheme } from "../lib/ThemeContext";

export default function CloneCounterImportForm({ plateId, onApply, onClose }) {
  const { isDark } = useTheme();
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleParse() {
    if (!file) return;
    setError(null);
    try {
      const data = await parseCloneCounterFile(file);
      setResult(data);
    } catch (e) {
      setError(e.message);
    }
  }

  function handleApply() {
    if (!result) return;
    // Apply wells as picked
    onApply(plateId, result.wells, "pick");
    onClose();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
        Импорт данных из CloneCounter (JSON с координатами колоний)
      </div>

      <div>
        <input type="file" accept=".json"
          onChange={(e) => { setFile(e.target.files[0]); setResult(null); setError(null); }}
          className={`block text-[10px] text-zinc-400 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border file:text-[10px] file:font-mono file:cursor-pointer ${
            isDark
              ? "file:border-zinc-700 file:bg-zinc-800 file:text-zinc-300"
              : "file:border-zinc-300 file:bg-white file:text-zinc-700"
          }`} />
      </div>

      {error && <div className="text-red-500 text-[10px]">{error}</div>}

      {!result && file && (
        <div className="flex justify-end">
          <Btn onClick={handleParse}>Прочитать</Btn>
        </div>
      )}

      {result && (
        <>
          <div className={`rounded p-2.5 text-[11px] ${isDark ? "bg-zinc-900 text-zinc-400" : "bg-zinc-50 text-zinc-600"}`}>
            <div>Источник: <b>{result.source}</b></div>
            <div>Чашка: <b>{result.plateName}</b></div>
            <div>Колоний: <b className="text-emerald-500">{result.totalColonies}</b></div>
            <div>Лунок для пикинга: <b className="text-emerald-500">{result.wells.length}</b></div>
            {result.date && <div>Дата: {result.date}</div>}
          </div>

          <div className="flex justify-end gap-1.5">
            <Btn variant="secondary" onClick={() => setResult(null)}>Назад</Btn>
            <Btn onClick={handleApply}>Применить ({result.wells.length} кл.)</Btn>
          </div>
        </>
      )}
    </div>
  );
}
