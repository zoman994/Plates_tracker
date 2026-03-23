import { useState } from "react";
import Btn from "../components/Btn";
import { inputClass } from "./styles";
import { parseAssayXlsx } from "../lib/xlsxParser";
import { downloadAssayTemplate } from "../lib/templateDownload";
import { useTheme } from "../lib/ThemeContext";

export default function AssayForm({ plates, onImport }) {
  const { isDark } = useTheme();
  const [pid, setPid] = useState("");
  const [raw, setRaw] = useState("");
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("file");
  const [error, setError] = useState(null);
  const ic = inputClass(isDark);

  async function handleSubmit() {
    setError(null);
    if (mode === "file" && file) {
      try {
        const matrix = await parseAssayXlsx(file);
        const text = matrix.map((row) => row.map((v) => v ?? "").join("\t")).join("\n");
        onImport(pid, text);
      } catch (e) {
        setError("Ошибка чтения файла: " + e.message);
      }
    } else {
      onImport(pid, raw);
    }
  }

  const canSubmit = pid && (mode === "file" ? !!file : raw.trim().length > 0);

  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <label className="text-[10px] text-zinc-500">Планшет</label>
        <select className={ic} value={pid} onChange={(e) => setPid(e.target.value)}>
          <option value="">Выбери...</option>
          {plates.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        {[["file", "Загрузить .xlsx"], ["paste", "Вставить текст"]].map(([k, l]) => (
          <button key={k}
            className={`px-3 py-1 text-[10px] rounded border font-mono cursor-pointer ${
              mode === k
                ? "border-emerald-600 bg-emerald-500/10 text-emerald-500"
                : isDark
                  ? "border-zinc-700 text-zinc-500"
                  : "border-zinc-300 text-zinc-500"
            }`}
            onClick={() => setMode(k)}>{l}</button>
        ))}
        <div className="flex-1" />
        <button onClick={downloadAssayTemplate}
          className={`text-[9px] hover:text-emerald-500 cursor-pointer bg-transparent border-none font-mono underline ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
          ⬇ Скачать шаблон
        </button>
      </div>

      {mode === "file" ? (
        <div>
          <input type="file" accept=".xlsx,.xls,.csv"
            onChange={(e) => { setFile(e.target.files[0]); setError(null); }}
            className={`block text-[10px] text-zinc-400 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border file:text-[10px] file:font-mono file:cursor-pointer ${
              isDark
                ? "file:border-zinc-700 file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700"
                : "file:border-zinc-300 file:bg-white file:text-zinc-700 hover:file:bg-zinc-100"
            }`} />
        </div>
      ) : (
        <div>
          <textarea
            className={`${ic} text-[10px] h-[120px] resize-none`}
            style={{ fontFamily: "'JetBrains Mono',monospace" }}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={"0.12\t0.11\t0.13\t..."}
          />
        </div>
      )}

      {error && <div className="text-red-500 text-[10px]">{error}</div>}

      <div className="flex justify-end">
        <Btn onClick={handleSubmit} disabled={!canSubmit}>Импорт</Btn>
      </div>
    </div>
  );
}
