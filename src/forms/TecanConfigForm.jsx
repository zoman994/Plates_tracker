import { useState } from "react";
import { getTecanConfig, saveTecanConfig } from "../lib/tecanGwl";
import Btn from "../components/Btn";
import { inputClass } from "./styles";
import { useTheme } from "../lib/ThemeContext";

export default function TecanConfigForm({ onClose }) {
  const { isDark } = useTheme();
  const ic = inputClass(isDark);
  const [config, setConfig] = useState(getTecanConfig);

  function update(key, value) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    saveTecanConfig(config);
    onClose();
  }

  const btnCls = (active) => `px-2.5 py-1 text-[10px] rounded border font-mono cursor-pointer ${
    active
      ? "border-emerald-600 bg-emerald-500/10 text-emerald-500"
      : isDark ? "border-zinc-700 text-zinc-500" : "border-zinc-300 text-zinc-500"
  }`;

  return (
    <div className="flex flex-col gap-3">
      <div className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-500"} uppercase tracking-wider`}>
        Позиции на деке (имена rack'ов в EVOware)
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          ["source96Rack", "Source 96-well"],
          ["dest96Rack", "Dest 96-well (passage)"],
          ["dest48Rack", "Dest 48-DWP"],
          ["petriRack", "Petri (для пикинга)"],
        ].map(([key, label]) => (
          <div key={key}>
            <label className="text-[9px] text-zinc-500">{label}</label>
            <input className={ic} value={config[key]}
              onChange={(e) => update(key, e.target.value)} />
          </div>
        ))}
      </div>

      <div className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-500"} uppercase tracking-wider mt-1`}>
        Объёмы (µL)
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          ["aspirateVol", "Aspirate"],
          ["dispenseVol", "Dispense"],
          ["transferVol", "Transfer (×rep)"],
        ].map(([key, label]) => (
          <div key={key}>
            <label className="text-[9px] text-zinc-500">{label}</label>
            <input className={ic} type="number" step="0.5" value={config[key]}
              onChange={(e) => update(key, parseFloat(e.target.value) || 0)} />
          </div>
        ))}
      </div>

      <div>
        <label className="text-[10px] text-zinc-500">Смена наконечников</label>
        <div className="flex gap-1.5 mt-1">
          {[
            ["always", "Каждый раз"],
            ["between_clones", "Между клонами"],
            ["never", "Без смены"],
          ].map(([k, l]) => (
            <button key={k} className={btnCls(config.tipChangeMode === k)}
              onClick={() => update("tipChangeMode", k)}>{l}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[10px] text-zinc-500">Wash station</label>
        <div className="flex gap-1.5 mt-1">
          <button className={btnCls(config.washStation)} onClick={() => update("washStation", true)}>Да</button>
          <button className={btnCls(!config.washStation)} onClick={() => update("washStation", false)}>Нет</button>
        </div>
      </div>

      <div className="flex justify-end gap-1.5 mt-2">
        <Btn variant="secondary" onClick={onClose}>Отмена</Btn>
        <Btn onClick={handleSave}>Сохранить</Btn>
      </div>
    </div>
  );
}
