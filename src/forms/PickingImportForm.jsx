import { useState } from "react";
import Btn from "../components/Btn";
import { INPUT_CLASS } from "./styles";
import { parsePickingXlsx } from "../lib/xlsxParser";
import { downloadPickingTemplate } from "../lib/templateDownload";

export default function PickingImportForm({ plateId, onApply, onClose }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [wtWells, setWtWells] = useState("");
  const [blankWells, setBlankWells] = useState("");

  async function handleParse() {
    if (!file) return;
    setError(null);
    try {
      const result = await parsePickingXlsx(file);
      setPreview(result);
    } catch (e) {
      setError("Ошибка чтения: " + e.message);
    }
  }

  function parseWellList(text) {
    return text.toUpperCase().split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  }

  function handleApply() {
    const picked = [], dead = [], wt = [], blank = [];

    // From xlsx
    if (preview) {
      for (const [well, status] of Object.entries(preview)) {
        if (status === "pick") picked.push(well);
        else if (status === "dead") dead.push(well);
        else if (status === "wt") wt.push(well);
        else if (status === "blank") blank.push(well);
      }
    }

    // From manual WT/Blank fields (override xlsx if specified)
    const extraWt = parseWellList(wtWells);
    const extraBlank = parseWellList(blankWells);
    for (const w of extraWt) {
      if (!wt.includes(w)) wt.push(w);
      // Remove from picked if was there
      const idx = picked.indexOf(w);
      if (idx >= 0) picked.splice(idx, 1);
    }
    for (const w of extraBlank) {
      if (!blank.includes(w)) blank.push(w);
      const idx = picked.indexOf(w);
      if (idx >= 0) picked.splice(idx, 1);
    }

    if (picked.length) onApply(plateId, picked, "pick");
    if (wt.length) onApply(plateId, wt, "wt");
    if (blank.length) onApply(plateId, blank, "blank");
    if (dead.length) onApply(plateId, dead, "dead");
    onClose();
  }

  const counts = preview ? {
    pick: Object.values(preview).filter((v) => v === "pick").length,
    wt: Object.values(preview).filter((v) => v === "wt").length,
    blank: Object.values(preview).filter((v) => v === "blank").length,
    dead: Object.values(preview).filter((v) => v === "dead").length,
  } : null;

  const extraWtCount = parseWellList(wtWells).length;
  const extraBlankCount = parseWellList(blankWells).length;

  return (
    <div className="flex flex-col gap-3">
      {/* File upload */}
      <div className="flex items-center gap-2">
        <input type="file" accept=".xlsx,.xls,.csv"
          onChange={(e) => { setFile(e.target.files[0]); setPreview(null); setError(null); }}
          className="flex-1 text-[10px] text-zinc-400 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border file:border-zinc-700 file:text-[10px] file:font-mono file:bg-zinc-800 file:text-zinc-300 file:cursor-pointer hover:file:bg-zinc-700" />
        <button onClick={downloadPickingTemplate}
          className="text-[9px] text-zinc-600 hover:text-emerald-500 cursor-pointer bg-transparent border-none font-mono underline whitespace-nowrap">
          ⬇ Шаблон
        </button>
      </div>

      {error && <div className="text-red-500 text-[10px]">{error}</div>}

      {!preview && file && (
        <div className="flex justify-end">
          <Btn onClick={handleParse}>Прочитать</Btn>
        </div>
      )}

      {/* Preview */}
      {preview && counts && (
        <div className="bg-zinc-900 rounded p-2.5 text-[11px] text-zinc-400">
          Из файла:
          <span className="ml-2">Клоны: <b className="text-emerald-500">{counts.pick}</b></span>
          {counts.wt > 0 && <span className="ml-2">WT: <b className="text-amber-500">{counts.wt}</b></span>}
          {counts.blank > 0 && <span className="ml-2">Blank: <b className="text-zinc-300">{counts.blank}</b></span>}
          {counts.dead > 0 && <span className="ml-2">Dead: <b className="text-red-500">{counts.dead}</b></span>}
        </div>
      )}

      {/* Manual WT / Blank wells */}
      <div>
        <label className="text-[10px] text-zinc-500">
          WT контроли <span className="text-zinc-700">(лунки через запятую, напр. H1, H2)</span>
        </label>
        <input className={INPUT_CLASS} value={wtWells}
          onChange={(e) => setWtWells(e.target.value)}
          placeholder="H1, H2, H3" />
        {extraWtCount > 0 && (
          <div className="text-[9px] text-amber-600 mt-0.5">{extraWtCount} WT лунок</div>
        )}
      </div>

      <div>
        <label className="text-[10px] text-zinc-500">
          Blank контроли <span className="text-zinc-700">(лунки через запятую)</span>
        </label>
        <input className={INPUT_CLASS} value={blankWells}
          onChange={(e) => setBlankWells(e.target.value)}
          placeholder="H10, H11, H12" />
        {extraBlankCount > 0 && (
          <div className="text-[9px] text-zinc-400 mt-0.5">{extraBlankCount} Blank лунок</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-1.5">
        {preview && <Btn variant="secondary" onClick={() => setPreview(null)}>Назад</Btn>}
        <Btn onClick={handleApply}
          disabled={!preview && extraWtCount === 0 && extraBlankCount === 0}>
          Применить
        </Btn>
      </div>
    </div>
  );
}
