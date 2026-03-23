import { useEffect, useState } from "react";
import useStore from "./store/useStore";
import { useTheme } from "./lib/ThemeContext";
import { WELL_STATUS, PLATE_TYPES } from "./lib/geometry";

import PlateMap from "./components/PlateMap";
import HeatmapPlate from "./components/HeatmapPlate";
import TransferView from "./components/TransferView";
import PipelineView from "./components/PipelineView";
import AnalysisTab from "./components/AnalysisTab";
import StatsTab from "./components/StatsTab";
import PhotoAnalysis from "./components/PhotoAnalysis";
import LabelPrint from "./components/LabelPrint";
import EditClonesModal from "./components/EditClonesModal";
import Modal from "./components/Modal";
import Btn from "./components/Btn";

import NewExpForm from "./forms/NewExpForm";
import NewPlateForm from "./forms/NewPlateForm";
import TransferSetup from "./forms/TransferSetup";
import AssayForm from "./forms/AssayForm";
import PickingImportForm from "./forms/PickingImportForm";
import CloneCounterImportForm from "./forms/CloneCounterImportForm";
import TecanConfigForm from "./forms/TecanConfigForm";
import { exportPlate, exportExperiment } from "./lib/exportXlsx";
import { exportBackup, importBackup, autoSaveToDisk } from "./lib/backup";
import { generatePassageGwl, generateTransfer96to48Gwl, downloadGwl } from "./lib/tecanGwl";

export default function CloneTracker() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const selExp = useStore((s) => s.selExp);
  const setSelExp = useStore((s) => s.setSelExp);
  const selPlate = useStore((s) => s.selPlate);
  const setSelPlate = useStore((s) => s.setSelPlate);
  const modal = useStore((s) => s.modal);
  const setModal = useStore((s) => s.setModal);
  const hovWell = useStore((s) => s.hovWell);
  const setHovWell = useStore((s) => s.setHovWell);
  const hovClone = useStore((s) => s.hovClone);
  const setHovClone = useStore((s) => s.setHovClone);
  const transferMode = useStore((s) => s.transferMode);
  const experiments = useStore((s) => s.experiments);
  const plates = useStore((s) => s.plates);
  const createExp = useStore((s) => s.createExp);
  const createPlate = useStore((s) => s.createPlate);
  const batchWellAction = useStore((s) => s.batchWellAction);
  const startTransfer = useStore((s) => s.startTransfer);
  const confirmTransfer = useStore((s) => s.confirmTransfer);
  const importAssay = useStore((s) => s.importAssay);
  const applyPhotoAnalysis = useStore((s) => s.applyPhotoAnalysis);
  const replaceWells = useStore((s) => s.replaceWells);
  const requestDelete = useStore((s) => s.requestDelete);
  const confirmDeleteAction = useStore((s) => s.confirmDelete);
  const cancelDelete = useStore((s) => s.cancelDelete);
  const pendingDelete = useStore((s) => s.pendingDelete);
  const duplicatePlate = useStore((s) => s.duplicatePlate);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const pastLen = useStore((s) => s._past.length);
  const futureLen = useStore((s) => s._future.length);
  const { isDark, toggleTheme } = useTheme();

  const [menuOpen, setMenuOpen] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); exportBackup(useStore); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  // Save on close (no blocking dialog — autosave handles it)
  useEffect(() => {
    const handler = () => autoSaveToDisk(useStore);
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const saveCounter = useStore((s) => s._saveCounter);
  useEffect(() => {
    if (saveCounter === 0) return;
    const timer = setTimeout(() => autoSaveToDisk(useStore), 1500);
    return () => clearTimeout(timer);
  }, [saveCounter]);

  const curExp = experiments.find((e) => e.id === selExp);
  const expPlates = plates.filter((p) => p.expId === selExp);
  const curPlate = plates.find((p) => p.id === selPlate);
  const curWD = curPlate && hovWell ? curPlate.wells[hovWell] : null;
  const pickedN = curPlate ? Object.values(curPlate.wells).filter((w) => w.status === "picked").length : 0;
  const deadN = curPlate ? Object.values(curPlate.wells).filter((w) => w.status === "dead").length : 0;
  const hasData = curPlate ? Object.values(curPlate.wells).some((w) => w.value !== undefined) : false;
  const tSrc = transferMode ? plates.find((p) => p.id === transferMode.sourceId) : null;
  const curRep = curPlate?.replicates || 3;

  const sideBtn = (active, onClick, children) => (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-[10px] rounded font-mono cursor-pointer transition-colors ${
        active
          ? "bg-emerald-500/10 text-emerald-500"
          : isDark ? "text-zinc-400 hover:bg-zinc-800/50" : "text-zinc-600 hover:bg-zinc-100"
      }`}>{children}</button>
  );

  const iconBtn = (onClick, title, children, cls = "") => (
    <button onClick={onClick} title={title}
      className={`bg-transparent border rounded cursor-pointer px-1.5 py-1 text-[10px] font-mono ${
        isDark ? "border-zinc-800 text-zinc-500 hover:bg-zinc-800" : "border-zinc-200 text-zinc-400 hover:bg-zinc-100"
      } ${cls}`}>{children}</button>
  );

  return (
    <div className={`min-h-screen font-mono text-xs flex ${isDark ? "bg-zinc-950 text-zinc-300" : "bg-white text-zinc-800"}`}>

      {/* ═══ SIDEBAR ═══ */}
      <div className={`w-52 flex-shrink-0 flex flex-col border-r h-screen sticky top-0 ${
        isDark ? "border-zinc-800 bg-zinc-950" : "border-zinc-200 bg-zinc-50"
      }`}>

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
              {sideBtn(selExp === exp.id, () => { setSelExp(exp.id); setTab("plates"); },
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

          {/* Plates (if experiment selected) */}
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
                    {sideBtn(selPlate === p.id, () => { setSelPlate(p.id); setTab("plates"); },
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
              <button onClick={() => { exportBackup(useStore); setMenuOpen(false); }}
                className={`text-left px-2 py-1 text-[9px] rounded font-mono cursor-pointer ${isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100"}`}>
                💾 Сохранить бэкап (Ctrl+S)
              </button>
              <button onClick={async () => { const r = await importBackup(useStore); if (r.ok) alert(`Импортировано: ${r.count} экспериментов`); setMenuOpen(false); }}
                className={`text-left px-2 py-1 text-[9px] rounded font-mono cursor-pointer ${isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100"}`}>
                📂 Загрузить бэкап
              </button>
              <button onClick={() => { setModal("tecanConfig"); setMenuOpen(false); }}
                className={`text-left px-2 py-1 text-[9px] rounded font-mono cursor-pointer ${isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100"}`}>
                ⚙ Настройки Tecan
              </button>
              {selExp && (
                <>
                  <button onClick={() => { exportExperiment(plates, selExp); setMenuOpen(false); }}
                    className={`text-left px-2 py-1 text-[9px] rounded font-mono cursor-pointer ${isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100"}`}>
                    📊 Экспорт эксп. Excel
                  </button>
                  <button onClick={() => {
                    const src = expPlates.find((p) => p.type === "source");
                    const culture = expPlates.filter((p) => p.type === "culture");
                    if (src && culture.length > 0) { downloadGwl(generateTransfer96to48Gwl(src.name, culture), `${selExp}-transfer.gwl`); }
                    else if (src) { downloadGwl(generatePassageGwl(src, "Dest"), `${selExp}-passage.gwl`); }
                    setMenuOpen(false);
                  }} disabled={!expPlates.find((p) => p.type === "source")}
                    className={`text-left px-2 py-1 text-[9px] rounded font-mono cursor-pointer ${isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100"} disabled:opacity-30`}>
                    🤖 Экспорт Tecan .gwl
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 min-h-screen overflow-y-auto">
        {/* Tab bar */}
        <div className={`sticky top-0 z-30 px-4 py-1.5 flex items-center gap-1 border-b ${
          isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200"
        }`}>
          {[["plates", "Планшеты"], ["analysis", "Анализ"], ["pipeline", "Пайплайн"], ["stats", "Статистика"]].map(([id, label]) => (
            <button key={id}
              className={`px-3 py-1 text-[11px] rounded border-none cursor-pointer font-mono ${
                tab === id ? "bg-emerald-500/10 text-emerald-500" : "bg-transparent text-zinc-500"
              }`}
              onClick={() => setTab(id)}>{label}</button>
          ))}
          {selExp && (
            <span className={`ml-auto text-[10px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
              {selExp}{curExp ? ` · ${curExp.name}` : ""}
            </span>
          )}
        </div>

        <div className="p-4">
          {/* No experiment selected */}
          {!selExp && (
            <div className="text-center text-zinc-500 py-20">
              <div className="text-4xl mb-3">🧫</div>
              <div className="text-sm">Выбери эксперимент в боковой панели</div>
              <div className={`text-[10px] mt-1 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>или создай новый</div>
            </div>
          )}

          {/* PLATES */}
          {selExp && tab === "plates" && !transferMode && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Btn variant="secondary" onClick={() => setModal("transfer")} disabled={expPlates.length === 0}>Пересев →</Btn>
                <Btn onClick={() => setModal("newPlate")}>+ Планшет</Btn>
              </div>

              {curPlate && curPlate.expId === selExp ? (
                <div className={`border rounded-lg p-4 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
                  {/* Plate header */}
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <span className={`font-bold ${isDark ? "text-zinc-200" : "text-zinc-900"}`}>{curPlate.name}</span>
                      <span className="text-[10px] text-zinc-500 ml-2">
                        {PLATE_TYPES[curPlate.type]?.label} · {curPlate.format === 48 ? "8×6" : "8×12"}
                      </span>
                      {curPlate.format === 48 && (
                        <span className="text-[10px] text-zinc-600 ml-2">{curRep}× · {Math.floor(pickedN / curRep)} кл.</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                      {curPlate.format === 96 && (
                        <>
                          <span>Клоны: <span className="text-emerald-500">{pickedN}</span></span>
                          <span>Мёртв: <span className="text-red-500">{deadN}</span></span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Toolbar — grouped: Ввод | Экспорт | Действия */}
                  <div className={`flex items-center gap-1 mb-2 flex-wrap py-1.5 px-2 rounded ${isDark ? "bg-zinc-900/50" : "bg-zinc-50"}`}>
                    {/* Ввод данных */}
                    {curPlate.format === 96 && !hasData && (
                      <>
                        <span className={`text-[8px] uppercase tracking-wider mr-1 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>Ввод:</span>
                        <Btn small variant="secondary" onClick={() => setModal("cloneCounter")}>CloneCounter</Btn>
                        <Btn small variant="secondary" onClick={() => setModal("picking")}>Из Excel</Btn>
                        <Btn small variant="secondary" onClick={() => setModal("photo")}>Фото</Btn>
                      </>
                    )}
                    {curPlate.format === 48 && !hasData && (
                      <>
                        <span className={`text-[8px] uppercase tracking-wider mr-1 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>Ввод:</span>
                        <Btn small variant="secondary" onClick={() => setModal("assay")}>OD из Excel</Btn>
                      </>
                    )}
                    {curPlate.format === 48 && (
                      <Btn small variant="secondary" onClick={() => setModal("editClones")}>Редактировать клоны</Btn>
                    )}

                    <span className={`mx-1 ${isDark ? "text-zinc-800" : "text-zinc-300"}`}>|</span>

                    {/* Экспорт */}
                    <span className={`text-[8px] uppercase tracking-wider mr-1 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>Экспорт:</span>
                    <Btn small variant="secondary" onClick={() => exportPlate(curPlate, selExp)}>Excel</Btn>
                    <Btn small variant="secondary" onClick={() => setModal("label")}>Печать</Btn>

                    <div className="flex-1" />

                    {/* Действия */}
                    <Btn small variant="secondary" onClick={() => duplicatePlate(curPlate.id)}>Копия</Btn>
                    <Btn small variant="danger" onClick={() => requestDelete("plate", curPlate.id)}>Удалить</Btn>
                  </div>

                  {/* Well info */}
                  <div className="h-3.5 mb-1 text-[11px] text-zinc-500">
                    {curWD && hovWell && (
                      <span>
                        <b className={isDark ? "text-zinc-300" : "text-zinc-700"}>{hovWell}</b>
                        {" · "}{WELL_STATUS[curWD.status]?.label}
                        {curWD.cloneId && curWD.cloneId !== "WT" && ` · ${curWD.cloneId}`}
                        {curWD.replicateNum && ` · rep ${curWD.replicateNum}/${curRep}`}
                        {curWD.value !== undefined && ` · OD: ${curWD.value.toFixed(3)}`}
                      </span>
                    )}
                  </div>

                  {/* Plate visualization */}
                  <div className="flex justify-center overflow-x-auto">
                    {hasData ? (
                      <HeatmapPlate wells={curPlate.wells}
                        maxVal={Math.max(...Object.values(curPlate.wells).filter((w) => w.value !== undefined).map((w) => w.value))} />
                    ) : (
                      <PlateMap format={curPlate.format} wells={curPlate.wells}
                        onBatchAction={(w, a) => batchWellAction(curPlate.id, w, a)}
                        onWellHover={(w) => { setHovWell(w); setHovClone(curPlate.wells[w]?.cloneId); }}
                        readOnly={curPlate.type === "culture" || curPlate.type === "flask"}
                        hoveredClone={hovClone} />
                    )}
                  </div>

                  {/* Legend */}
                  <div className="flex gap-3 justify-center mt-2.5">
                    {Object.entries(WELL_STATUS).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-1 text-[9px] text-zinc-500">
                        <div className="w-2 h-2 rounded-sm" style={{ background: v.color, border: `1px solid ${v.border}` }} />
                        {v.label}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center text-zinc-600 py-10 text-xs">
                  {expPlates.length === 0 ? "Создай планшет" : "Выбери планшет в боковой панели"}
                </div>
              )}
            </div>
          )}

          {/* TRANSFER */}
          {selExp && tab === "plates" && transferMode && tSrc && (
            <TransferView sourcePlate={tSrc} type={transferMode.type}
              replicates={transferMode.replicates || 3} layout={transferMode.layout || "rows"}
              onConfirm={confirmTransfer}
              onCancel={() => useStore.getState().setTransferMode(null)} />
          )}

          {/* ANALYSIS */}
          {selExp && tab === "analysis" && <AnalysisTab expId={selExp} />}

          {/* PIPELINE */}
          {selExp && tab === "pipeline" && <PipelineView expId={selExp} />}

          {/* STATS */}
          {selExp && tab === "stats" && <StatsTab expId={selExp} />}
        </div>
      </div>

      {/* ═══ MODALS ═══ */}
      <Modal open={modal === "newExp"} onClose={() => setModal(null)} title="Новый эксперимент">
        <NewExpForm onSubmit={createExp} existing={experiments.map((e) => e.id)} />
      </Modal>
      <Modal open={modal === "newPlate"} onClose={() => setModal(null)} title="Новый планшет">
        <NewPlateForm expId={selExp} onSubmit={createPlate} existing={expPlates.map((p) => p.name)} />
      </Modal>
      <Modal open={modal === "transfer"} onClose={() => setModal(null)} title="Настройка пересева">
        <TransferSetup plates={expPlates} onStart={startTransfer} />
      </Modal>
      <Modal open={modal === "assay"} onClose={() => setModal(null)} title="Импорт OD данных">
        <AssayForm plates={expPlates.filter((p) => p.type === "culture")} onImport={importAssay} />
      </Modal>
      <Modal open={modal === "photo"} onClose={() => setModal(null)} title="Распознавание фото планшета" wide>
        {curPlate && <PhotoAnalysis plateId={curPlate.id} onApply={applyPhotoAnalysis} onClose={() => setModal(null)} />}
      </Modal>
      <Modal open={modal === "picking"} onClose={() => setModal(null)} title="Импорт карты пикинга из Excel">
        {curPlate && <PickingImportForm plateId={curPlate.id}
          onApply={(pid, wells, action) => batchWellAction(pid, wells, action)} onClose={() => setModal(null)} />}
      </Modal>
      <Modal open={modal === "label"} onClose={() => setModal(null)} title="Печать этикетки и карты">
        {curPlate && <LabelPrint plate={curPlate} expId={selExp} onClose={() => setModal(null)} />}
      </Modal>
      <Modal open={modal === "editClones"} onClose={() => setModal(null)} title="Редактирование клонов" wide>
        {curPlate && <EditClonesModal plate={curPlate}
          onSave={(pid, nw) => replaceWells(pid, nw)} onClose={() => setModal(null)} />}
      </Modal>
      <Modal open={modal === "cloneCounter"} onClose={() => setModal(null)} title="Импорт из CloneCounter">
        {curPlate && <CloneCounterImportForm plateId={curPlate.id}
          onApply={(pid, wells, action) => batchWellAction(pid, wells, action)} onClose={() => setModal(null)} />}
      </Modal>
      <Modal open={modal === "tecanConfig"} onClose={() => setModal(null)} title="Настройки Tecan EVO150">
        <TecanConfigForm onClose={() => setModal(null)} />
      </Modal>
      <Modal open={modal === "confirmDelete"} onClose={cancelDelete} title="Подтверждение">
        <div className="flex flex-col gap-3">
          <div className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
            {pendingDelete?.type === "exp"
              ? `Удалить эксперимент «${pendingDelete?.id}»? Все планшеты и данные будут удалены.`
              : `Удалить планшет «${pendingDelete?.id}»?`}
          </div>
          <div className="flex justify-end gap-1.5">
            <Btn variant="secondary" onClick={cancelDelete}>Отмена</Btn>
            <Btn variant="danger" onClick={confirmDeleteAction}>Удалить</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
