import { useEffect } from "react";
import useStore from "./store/useStore";
import { WELL_STATUS, PLATE_TYPES } from "./lib/geometry";

import PlateMap from "./components/PlateMap";
import HeatmapPlate from "./components/HeatmapPlate";
import TransferView from "./components/TransferView";
import RankingTab from "./components/RankingTab";
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
import { exportPlate, exportExperiment } from "./lib/exportXlsx";
import { exportBackup, importBackup, autoSaveToDisk } from "./lib/backup";
import { generatePassageGwl, buildTransferMapping, generateTransfer96to48Gwl, downloadGwl } from "./lib/tecanGwl";

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
  const deleteExp = useStore((s) => s.deleteExp);
  const createPlate = useStore((s) => s.createPlate);
  const batchWellAction = useStore((s) => s.batchWellAction);
  const startTransfer = useStore((s) => s.startTransfer);
  const confirmTransfer = useStore((s) => s.confirmTransfer);
  const importAssay = useStore((s) => s.importAssay);
  const applyPhotoAnalysis = useStore((s) => s.applyPhotoAnalysis);
  const replaceWells = useStore((s) => s.replaceWells);

  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const pastLen = useStore((s) => s._past.length);
  const futureLen = useStore((s) => s._future.length);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  // Auto-save to disk (Electron)
  const dataVersion = useStore((s) => s.experiments.length + s.plates.length + s.transfers.length);
  useEffect(() => {
    const timer = setTimeout(() => autoSaveToDisk(useStore), 2000);
    return () => clearTimeout(timer);
  }, [dataVersion]);

  const curExp = experiments.find((e) => e.id === selExp);
  const expPlates = plates.filter((p) => p.expId === selExp);
  const curPlate = plates.find((p) => p.id === selPlate);
  const curWD = curPlate && hovWell ? curPlate.wells[hovWell] : null;
  const pickedN = curPlate ? Object.values(curPlate.wells).filter((w) => w.status === "picked").length : 0;
  const deadN = curPlate ? Object.values(curPlate.wells).filter((w) => w.status === "dead").length : 0;
  const hasData = curPlate ? Object.values(curPlate.wells).some((w) => w.value !== undefined) : false;
  const tSrc = transferMode ? plates.find((p) => p.id === transferMode.sourceId) : null;
  const curRep = curPlate?.replicates || 3;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-mono text-xs">
      {/* HEADER */}
      <div className="border-b border-zinc-800 px-4 py-2 flex justify-between items-center sticky top-0 bg-zinc-950 z-40">
        <div className="flex items-center gap-2">
          <span className="text-emerald-500 font-bold text-[15px] -tracking-wide">◉ CloneTracker</span>
          <span className="text-zinc-700 text-[10px]">v0.5</span>
          <div className="flex items-center gap-0.5 ml-2">
            <button onClick={undo} disabled={pastLen === 0}
              className="bg-transparent border border-zinc-800 rounded text-zinc-500 cursor-pointer px-1.5 py-0.5 text-[10px] font-mono disabled:opacity-20 hover:bg-zinc-800"
              title="Отменить (Ctrl+Z)">↩</button>
            <button onClick={redo} disabled={futureLen === 0}
              className="bg-transparent border border-zinc-800 rounded text-zinc-500 cursor-pointer px-1.5 py-0.5 text-[10px] font-mono disabled:opacity-20 hover:bg-zinc-800"
              title="Повторить (Ctrl+Shift+Z)">↪</button>
          </div>
          <div className="flex items-center gap-0.5 ml-2">
            <button onClick={() => exportBackup(useStore)}
              className="bg-transparent border border-zinc-800 rounded text-zinc-600 cursor-pointer px-1.5 py-0.5 text-[9px] font-mono hover:bg-zinc-800 hover:text-zinc-400"
              title="Экспорт бэкапа">💾</button>
            <button onClick={async () => { const r = await importBackup(useStore); if (r.ok) alert(`Импортировано: ${r.count} экспериментов`); }}
              className="bg-transparent border border-zinc-800 rounded text-zinc-600 cursor-pointer px-1.5 py-0.5 text-[9px] font-mono hover:bg-zinc-800 hover:text-zinc-400"
              title="Импорт бэкапа">📂</button>
          </div>
        </div>
        <div className="flex gap-0.5">
          {[["experiments", "Эксперименты"], ["plates", "Планшеты"], ["analysis", "Анализ"], ["pipeline", "Пайплайн"], ["stats", "Статистика"]].map(([id, label]) => (
            <button key={id}
              className={`px-3 py-1 text-[11px] rounded border-none cursor-pointer font-mono ${
                tab === id
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-transparent text-zinc-500"
              }`}
              onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto p-4">
        {/* EXPERIMENTS TAB */}
        {tab === "experiments" && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Эксперименты</span>
              <Btn onClick={() => setModal("newExp")}>+ Новый</Btn>
            </div>
            {experiments.length === 0 ? (
              <div className="text-center text-zinc-600 py-16">
                <div className="text-4xl mb-2">🧫</div>
                <div>Создай первый эксперимент</div>
              </div>
            ) : (
              experiments.map((exp) => {
                const nC = plates.filter((p) => p.expId === exp.id)
                  .reduce((a, p) => a + Object.values(p.wells).filter((w) => w.status === "picked").length, 0);
                const nP = plates.filter((p) => p.expId === exp.id).length;
                return (
                  <div key={exp.id}
                    className={`border rounded-lg p-3 cursor-pointer mb-2 ${
                      selExp === exp.id
                        ? "border-emerald-600 bg-emerald-500/[0.03]"
                        : "border-zinc-800"
                    }`}
                    onClick={() => { setSelExp(exp.id); setTab("plates"); }}>
                    <div className="flex justify-between">
                      <div>
                        <span className="font-bold text-zinc-200">{exp.id}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 ml-2">{exp.type}</span>
                        <div className="text-[10px] text-zinc-500 mt-1">{exp.name} · {exp.date}</div>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                        <span>{nC} кл.</span>
                        <span>{nP} пл.</span>
                        <Btn variant="danger" small onClick={(e) => { e.stopPropagation(); deleteExp(exp.id); }}>✕</Btn>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* PLATES TAB (normal) */}
        {tab === "plates" && !transferMode && (
          <div>
            {!selExp ? (
              <div className="text-center text-zinc-600 py-16 text-xs">Выбери эксперимент</div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-200">{selExp}</span>
                    <span className="text-[10px] text-zinc-600">{curExp?.name}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <Btn variant="secondary" onClick={() => setModal("transfer")}
                      disabled={expPlates.length === 0}>Transfer →</Btn>
                    <Btn variant="secondary" onClick={() => setModal("assay")}
                      disabled={expPlates.filter((p) => p.type === "culture").length === 0}>Импорт</Btn>
                    <Btn variant="secondary" onClick={() => exportExperiment(plates, selExp)}
                      disabled={expPlates.length === 0}>⬇ Excel</Btn>
                    <Btn variant="secondary" onClick={() => {
                      const src = expPlates.find((p) => p.type === "source");
                      const culture = expPlates.filter((p) => p.type === "culture");
                      if (src && culture.length > 0) {
                        const mapping = buildTransferMapping(src, culture);
                        const gwl = generateTransfer96to48Gwl(src.name, mapping);
                        downloadGwl(gwl, `${selExp}-worklist.gwl`);
                      } else if (src) {
                        const gwl = generatePassageGwl(src, "Dest");
                        downloadGwl(gwl, `${selExp}-passage.gwl`);
                      }
                    }} disabled={expPlates.filter((p) => p.type === "source").length === 0}>⬇ .gwl</Btn>
                    <Btn onClick={() => setModal("newPlate")}>+ Планшет</Btn>
                  </div>
                </div>

                {expPlates.length > 0 && (
                  <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
                    {["source", "passage", "culture", "flask"].map((type) => {
                      const tp = expPlates.filter((p) => p.type === type);
                      if (!tp.length) return null;
                      return (
                        <div key={type} className="flex items-center gap-1">
                          {tp.map((p) => (
                            <button key={p.id}
                              className={`px-2.5 py-1 text-[10px] rounded border cursor-pointer font-mono ${
                                selPlate === p.id
                                  ? "border-emerald-600 bg-emerald-500/10 text-emerald-500"
                                  : "border-zinc-700 text-zinc-400"
                              }`}
                              onClick={() => setSelPlate(p.id)}>
                              {PLATE_TYPES[type]?.icon} {p.name}
                            </button>
                          ))}
                          <span className="text-zinc-700 text-sm">→</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {curPlate && curPlate.expId === selExp ? (
                  <div className="border border-zinc-800 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <span className="font-bold text-zinc-200">{curPlate.name}</span>
                        <span className="text-[10px] text-zinc-500 ml-2">
                          {PLATE_TYPES[curPlate.type]?.label} · {curPlate.format === 48 ? "8×6" : "8×12"}
                        </span>
                        {curPlate.format === 48 && (
                          <span className="text-[10px] text-zinc-600 ml-2">
                            {curRep}× · {Math.floor(pickedN / curRep)} кл.
                          </span>
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
                    {/* Toolbar */}
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      {curPlate.format === 96 && !hasData && (
                        <>
                          <Btn small variant="secondary" onClick={() => setModal("picking")}>📋 Импорт .xlsx</Btn>
                          <Btn small variant="secondary" onClick={() => setModal("photo")}>📷 Фото</Btn>
                        </>
                      )}
                      {curPlate.format === 48 && !hasData && (
                        <Btn small variant="secondary" onClick={() => setModal("assay")}>📊 OD .xlsx</Btn>
                      )}
                      {curPlate.format === 48 && (
                        <Btn small variant="secondary" onClick={() => setModal("editClones")}>✏️ Клоны</Btn>
                      )}
                      <Btn small variant="secondary" onClick={() => exportPlate(curPlate, selExp)}>⬇ .xlsx</Btn>
                      <Btn small variant="secondary" onClick={() => setModal("label")}>🏷 Этикетка</Btn>
                    </div>

                    <div className="h-3.5 mb-1 text-[11px] text-zinc-500">
                      {curWD && hovWell && (
                        <span>
                          <b className="text-zinc-300">{hovWell}</b>
                          {" · "}{WELL_STATUS[curWD.status]?.label}
                          {curWD.cloneId && curWD.cloneId !== "WT" && ` · ${curWD.cloneId}`}
                          {curWD.replicateNum && ` · rep ${curWD.replicateNum}/${curRep}`}
                          {curWD.value !== undefined && ` · OD: ${curWD.value.toFixed(3)}`}
                        </span>
                      )}
                    </div>

                    <div className="flex justify-center overflow-x-auto">
                      {hasData ? (
                        <HeatmapPlate wells={curPlate.wells}
                          maxVal={Math.max(...Object.values(curPlate.wells).filter((w) => w.value !== undefined).map((w) => w.value))} />
                      ) : (
                        <PlateMap
                          format={curPlate.format}
                          wells={curPlate.wells}
                          onBatchAction={(w, a) => batchWellAction(curPlate.id, w, a)}
                          onWellHover={(w) => {
                            setHovWell(w);
                            setHovClone(curPlate.wells[w]?.cloneId);
                          }}
                          readOnly={curPlate.type === "culture" || curPlate.type === "flask"}
                          hoveredClone={hovClone}
                        />
                      )}
                    </div>

                    <div className="flex gap-3 justify-center mt-2.5">
                      {Object.entries(WELL_STATUS).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-1 text-[9px] text-zinc-500">
                          <div className="w-2 h-2 rounded-sm"
                            style={{ background: v.color, border: `1px solid ${v.border}` }} />
                          {v.label}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-zinc-600 py-10 text-xs">
                    {expPlates.length === 0 ? "Создай планшет" : "Выбери планшет"}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TRANSFER DUAL VIEW */}
        {tab === "plates" && transferMode && tSrc && (
          <TransferView sourcePlate={tSrc} type={transferMode.type}
            replicates={transferMode.replicates || 3}
            onConfirm={confirmTransfer}
            onCancel={() => useStore.getState().setTransferMode(null)} />
        )}

        {/* ANALYSIS TAB */}
        {tab === "analysis" && (
          <div>
            {!selExp ? (
              <div className="text-center text-zinc-600 py-16 text-xs">Выбери эксперимент</div>
            ) : (
              <AnalysisTab expId={selExp} />
            )}
          </div>
        )}

        {/* PIPELINE TAB */}
        {tab === "pipeline" && (
          <div>
            {!selExp ? (
              <div className="text-center text-zinc-600 py-16 text-xs">Выбери эксперимент</div>
            ) : (
              <PipelineView expId={selExp} />
            )}
          </div>
        )}

        {/* STATS TAB */}
        {tab === "stats" && (
          <div>
            {!selExp ? (
              <div className="text-center text-zinc-600 py-16 text-xs">Выбери эксперимент</div>
            ) : (
              <StatsTab expId={selExp} />
            )}
          </div>
        )}
      </div>

      {/* MODALS */}
      <Modal open={modal === "newExp"} onClose={() => setModal(null)} title="Новый эксперимент">
        <NewExpForm onSubmit={createExp} existing={experiments.map((e) => e.id)} />
      </Modal>
      <Modal open={modal === "newPlate"} onClose={() => setModal(null)} title="Новый планшет">
        <NewPlateForm expId={selExp} onSubmit={createPlate} existing={expPlates.map((p) => p.name)} />
      </Modal>
      <Modal open={modal === "transfer"} onClose={() => setModal(null)} title="Transfer">
        <TransferSetup plates={expPlates} onStart={startTransfer} />
      </Modal>
      <Modal open={modal === "assay"} onClose={() => setModal(null)} title="Импорт данных">
        <AssayForm plates={expPlates.filter((p) => p.type === "culture")} onImport={importAssay} />
      </Modal>
      <Modal open={modal === "photo"} onClose={() => setModal(null)} title="Анализ фото" wide>
        {curPlate && (
          <PhotoAnalysis plateId={curPlate.id} onApply={applyPhotoAnalysis} onClose={() => setModal(null)} />
        )}
      </Modal>
      <Modal open={modal === "picking"} onClose={() => setModal(null)} title="Импорт пикинга (.xlsx)">
        {curPlate && (
          <PickingImportForm plateId={curPlate.id}
            onApply={(pid, wells, action) => batchWellAction(pid, wells, action)}
            onClose={() => setModal(null)} />
        )}
      </Modal>
      <Modal open={modal === "label"} onClose={() => setModal(null)} title="Этикетка для печати">
        {curPlate && (
          <LabelPrint plate={curPlate} expId={selExp} onClose={() => setModal(null)} />
        )}
      </Modal>
      <Modal open={modal === "editClones"} onClose={() => setModal(null)} title="Редактирование клонов" wide>
        {curPlate && (
          <EditClonesModal plate={curPlate}
            onSave={(pid, newWells) => replaceWells(pid, newWells)}
            onClose={() => setModal(null)} />
        )}
      </Modal>
    </div>
  );
}
