import { useState } from "react";
import { EXP_TYPES } from "../lib/geometry";
import Btn from "../components/Btn";
import { INPUT_CLASS } from "./styles";

export default function NewExpForm({ onSubmit, existing }) {
  const [id, setId] = useState("");
  const [type, setType] = useState("NTG");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  const fid = id.toUpperCase().replace(/\s+/g, "_");
  const dup = existing.includes(fid);

  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <label className="text-[10px] text-zinc-500">ID</label>
        <input className={INPUT_CLASS} value={id} onChange={(e) => setId(e.target.value)}
          placeholder="NTG1" autoFocus />
        {dup && <div className="text-red-500 text-[10px] mt-0.5">Уже существует</div>}
      </div>
      <div>
        <label className="text-[10px] text-zinc-500">Тип</label>
        <div className="flex gap-1 mt-1">
          {EXP_TYPES.map((t) => (
            <button key={t}
              className={`px-2 py-0.5 text-[10px] rounded border font-mono cursor-pointer ${
                type === t
                  ? "border-emerald-600 bg-emerald-500/10 text-emerald-500"
                  : "border-zinc-700 bg-transparent text-zinc-500"
              }`}
              onClick={() => setType(t)}>{t}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[10px] text-zinc-500">Описание</label>
        <input className={INPUT_CLASS} value={name} onChange={(e) => setName(e.target.value)}
          placeholder="NTG мутагенез F-1064" />
      </div>
      <div>
        <label className="text-[10px] text-zinc-500">Заметки</label>
        <textarea className={`${INPUT_CLASS} resize-none h-12`}
          value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Kill rate..." />
      </div>
      <div className="flex justify-end">
        <Btn onClick={() => onSubmit(fid, type, name, notes)} disabled={!id || dup}>Создать</Btn>
      </div>
    </div>
  );
}
