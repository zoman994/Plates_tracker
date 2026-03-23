import { useState, useEffect } from "react";
import useStore from "../store/useStore";
import { useTheme } from "../lib/ThemeContext";
import { PLATE_TYPES } from "../lib/geometry";
import { exportBackup, importBackup } from "../lib/backup";
import { exportExperiment } from "../lib/exportXlsx";
import { generatePassageGwl, generateTransfer96to48Gwl, downloadGwl } from "../lib/tecanGwl";

export default function Sidebar() {
  const { isDark, toggleTheme } = useTheme();
  const experiments = useStore((s) => s.experiments);
  const plates = useStore((s) => s.plates);
  const selExp = useStore((s) => s.selExp);
  const setSelExp = useStore((s) => s.setSelExp);
  const selPlate = useStore((s) => s.selPlate);
  const setSelPlate = useStore((s) => s.setSelPlate);
  const setTab = useStore((s) => s.setTab);
  const setModal = useStore((s) => s.setModal);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const pastLen = useStore((s) => s._past.length);
  const futureLen = useStore((s) => s._future.length);

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const expPlates = plates.filter((p) => p.expId === selExp);

  // Auto-close sidebar on mobile when navigating
  const closeMobile = () => setMobileOpen(false);

  const sideBtn = (active, onClick, children) => (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-[10px] rounded font-mono cursor-pointer transition-colors ${
        active
          ? "bg-emerald-500/10 text-emerald-500"
          : isDark ? "text-zinc-400 hover:bg-zinc-800/50" : "text-zinc-600 hover:bg-zinc-100"
      }`}>{children}</button>
  );

  const iconBtn = (onClick, title, children) => (
    <button onClick={onClick} title={title}
      className={`bg-transparent border rounded cursor-pointer px-1.5 py-1 text-[10px] font-mono disabled:opacity-20 ${
        isDark ? "border-zinc-800 text-zinc-500 hover:bg-zinc-800" : "border-zinc-200 text-zinc-400 hover:bg-zinc-100"
      }`}>{children}</button>
  );

  const menuItem = (onClick, children, disabled = false) => (
    <button onClick={() => { onClick(); setMenuOpen(false); }} disabled={disabled}
      className={`text-left px-2 py-1 text-[9px] rounded font-mono cursor-pointer disabled:opacity-30 ${
        isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100"
      }`}>{children}</button>
  );

  return (
    <>
    {/* Mobile burger button */}
    <button onClick={() => setMobileOpen(true)}
      className={`md:hidden fixed top-2 left-2 z-50 p-2 rounded ${isDark ? "bg-zinc-900 text-zinc-400" : "bg-white text-zinc-600"} border ${isDark ? "border-zinc-700" : "border-zinc-300"}`}>
      ☰
    </button>

    {/* Overlay backdrop on mobile */}
    {mobileOpen && (
      <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={closeMobile} />
    )}

    <div className={`flex-shrink-0 flex flex-col border-r h-screen sticky top-0 z-50
      ${isDark ? "border-zinc-800 bg-zinc-950" : "border-zinc-200 bg-zinc-50"}
      w-52
      max-md:fixed max-md:top-0 max-md:left-0 max-md:h-full max-md:shadow-xl
      max-md:transition-transform max-md:duration-200
      ${mobileOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full"}
    `}>
      {/* Logo */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-1.5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#10b981" strokeWidth="2" />
            <circle cx="8" cy="10" r="2" fill="#10b981" />
            <circle cx="15" cy="9" r="1.5" fill="#10b981" opacity="0.7" />
            <circle cx="12" cy="15" r="2.5" fill="#10b981" opacity="0.5" />
            <circle cx="16" cy="14" r="1" fill="#10b981" opacity="0.4" />
          </svg>
          <div>
            <div className="text-emerald-500 font-bold text-[13px] leading-tight">CloneTracker</div>
            <div className={`text-[8px] ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>v1.0</div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className={`flex items-center gap-0.5 px-3 pb-2 border-b ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
        {iconBtn(undo, "Отменить (Ctrl+Z)", "↩")}
        {iconBtn(redo, "Повторить (Ctrl+Shift+Z)", "↪")}
        <div className="flex-1" />
        {iconBtn(toggleTheme, "Тема", isDark ? "☀️" : "🌙")}
      </div>

      {/* Experiments */}
      <div className="flex-1 overflow-y-auto">
        <div className={`px-3 pt-2 pb-1 text-[9px] uppercase tracking-wider ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
          Эксперименты
        </div>
        {experiments.map((exp) => (
          <div key={exp.id} className="px-1">
            {sideBtn(selExp === exp.id, () => { setSelExp(exp.id); setTab("plates"); closeMobile(); },
              <div className="flex justify-between items-center">
                <span className="font-bold truncate">{exp.id}</span>
                <span className={`text-[8px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>{exp.type}</span>
              </div>
            )}
          </div>
        ))}
        <div className="px-1 mt-0.5">
          <button onClick={() => setModal("newExp")}
            className={`w-full text-left px-3 py-1 text-[10px] rounded font-mono cursor-pointer ${
              isDark ? "text-emerald-700 hover:text-emerald-500" : "text-emerald-600 hover:text-emerald-500"
            }`}>+ Новый</button>
        </div>

        {/* Plates */}
        {selExp && expPlates.length > 0 && (
          <>
            <div className={`px-3 pt-3 pb-1 text-[9px] uppercase tracking-wider ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
              Планшеты · {selExp}
            </div>
            {["source", "passage", "culture", "flask"].map((type) => {
              const tp = expPlates.filter((p) => p.type === type);
              if (!tp.length) return null;
              return tp.map((p) => (
                <div key={p.id} className="px-1">
                  {sideBtn(selPlate === p.id, () => { setSelPlate(p.id); setTab("plates"); closeMobile(); },
                    <span>{PLATE_TYPES[type]?.icon} {p.name}</span>
                  )}
                </div>
              ));
            })}
            <div className="px-1 mt-0.5">
              <button onClick={() => setModal("newPlate")}
                className={`w-full text-left px-3 py-1 text-[10px] rounded font-mono cursor-pointer ${
                  isDark ? "text-emerald-700 hover:text-emerald-500" : "text-emerald-600 hover:text-emerald-500"
                }`}>+ Планшет</button>
            </div>
          </>
        )}
      </div>

      {/* Bottom menu */}
      <div className={`border-t px-2 py-2 flex flex-col gap-0.5 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
        <button onClick={() => setMenuOpen(!menuOpen)}
          className={`w-full text-left px-2 py-1 text-[10px] rounded font-mono cursor-pointer ${
            isDark ? "text-zinc-500 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100"
          }`}>☰ Сервис</button>
        {menuOpen && (
          <div className="flex flex-col gap-0.5 ml-2">
            {menuItem(() => exportBackup(useStore), "💾 Сохранить бэкап (Ctrl+S)")}
            {menuItem(async () => { const r = await importBackup(useStore); if (r.ok) alert(`Импортировано: ${r.count} экспериментов`); }, "📂 Загрузить бэкап")}
            {menuItem(() => setModal("tecanConfig"), "⚙ Настройки Tecan")}
            {selExp && menuItem(() => exportExperiment(plates, selExp), "📊 Экспорт эксп. Excel")}
            {selExp && menuItem(() => {
              const src = expPlates.find((p) => p.type === "source");
              const culture = expPlates.filter((p) => p.type === "culture");
              if (src && culture.length > 0) downloadGwl(generateTransfer96to48Gwl(src.name, culture), `${selExp}-transfer.gwl`);
              else if (src) downloadGwl(generatePassageGwl(src, "Dest"), `${selExp}-passage.gwl`);
            }, "🤖 Экспорт Tecan .gwl", !expPlates.find((p) => p.type === "source"))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
