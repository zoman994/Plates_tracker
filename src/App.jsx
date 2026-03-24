import { useEffect, useMemo } from "react";
import useStore from "./store/useStore";
import { useTheme } from "./lib/ThemeContext";
import { WELL_STATUS, PLATE_TYPES } from "./lib/geometry";

import Sidebar from "./components/Sidebar";
import PlateToolbar from "./components/PlateToolbar";
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
import FlaskTab from "./components/FlaskTab";
import { exportBackup } from "./lib/backup";

export default function CloneTracker() {
  const { isDark } = useTheme();
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const selExp = useStore((s) => s.selExp);
  const selPlate = useStore((s) => s.selPlate);
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
  const confirmDeleteAction = useStore((s) => s.confirmDelete);
  const cancelDelete = useStore((s) => s.cancelDelete);
  const pendingDelete = useStore((s) => s.pendingDelete);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);

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

  // Load from disk backup if localStorage is empty (Electron)
  // Zustand persist handles file storage automatically via custom storage adapter.

  // Derived state
  const curExp = experiments.find((e) => e.id === selExp);
  const expPlates = plates.filter((p) => p.expId === selExp);
  const curPlate = plates.find((p) => p.id === selPlate);
  const curWD = curPlate && hovWell ? curPlate.wells[hovWell] : null;
  const pickedN = curPlate ? Object.values(curPlate.wells).filter((w) => w.status === "picked").length : 0;
  const deadN = curPlate ? Object.values(curPlate.wells).filter((w) => w.status === "dead").length : 0;
  const hasData = curPlate ? Object.values(curPlate.wells).some((w) => w.value !== undefined) : false;
  const tSrc = transferMode ? plates.find((p) => p.id === transferMode.sourceId) : null;
  const curRep = curPlate?.replicates || 3;

  // Memoize maxVal for heatmap
  const maxVal = useMemo(() => {
    if (!curPlate || !hasData) return 1;
    const vals = Object.values(curPlate.wells).filter((w) => w.value !== undefined).map((w) => w.value);
    return vals.length > 0 ? Math.max(...vals) : 1;
  }, [curPlate, hasData]);

  return (
    <div className={`min-h-screen font-mono text-xs flex ${isDark ? "bg-zinc-950 text-zinc-300" : "bg-white text-zinc-800"}`}>
      <Sidebar />

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 min-h-screen overflow-y-auto">
        {/* Tab bar */}
        <div className={`sticky top-0 z-30 px-4 max-md:pl-12 py-1.5 flex items-center gap-1 border-b ${
          isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200"
        }`}>
          {[["plates", "Планшеты"], ["analysis", "Анализ"], ["flasks", "Колбы"], ["pipeline", "Пайплайн"], ["stats", "Статистика"]].map(([id, label]) => (
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
          {/* No experiment */}
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

                  <PlateToolbar plate={curPlate} expId={selExp} hasData={hasData} />

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

                  <div className="flex justify-center overflow-x-auto">
                    {hasData ? (
                      <HeatmapPlate wells={curPlate.wells} maxVal={maxVal} />
                    ) : (
                      <PlateMap format={curPlate.format} wells={curPlate.wells}
                        onBatchAction={(w, a) => batchWellAction(curPlate.id, w, a)}
                        onWellHover={(w) => { setHovWell(w); setHovClone(curPlate.wells[w]?.cloneId); }}
                        readOnly={curPlate.type === "culture" || curPlate.type === "flask"}
                        hoveredClone={hovClone} />
                    )}
                  </div>

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

          {selExp && tab === "plates" && transferMode && tSrc && (
            <TransferView sourcePlate={tSrc} type={transferMode.type}
              replicates={transferMode.replicates || 3} layout={transferMode.layout || "rows"}
              onConfirm={confirmTransfer}
              onCancel={() => useStore.getState().setTransferMode(null)} />
          )}

          {selExp && tab === "analysis" && <AnalysisTab expId={selExp} />}
          {selExp && tab === "flasks" && <FlaskTab expId={selExp} />}
          {selExp && tab === "pipeline" && <PipelineView expId={selExp} />}
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
