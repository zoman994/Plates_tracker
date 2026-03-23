import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ROWS_96, COLS_96, ROWS_48, COLS_48,
  posToWell, genId, clonesPerPlate,
} from "../lib/geometry";
import { generate48Layout } from "../lib/generate48Layout";

const MAX_UNDO = 30;

// Deep clone for undo snapshots — structuredClone where available, JSON fallback
const deepClone = typeof structuredClone === "function"
  ? structuredClone
  : (obj) => JSON.parse(JSON.stringify(obj));

const useStore = create(
  persist(
    (set, get) => ({
      // ── Data ──
      experiments: [],
      plates: [],
      transfers: [],

      // ── Undo/Redo ──
      _past: [],
      _future: [],
      _saveCounter: 0,

      _pushUndo: () => {
        const { experiments, plates, transfers } = get();
        const snap = deepClone({ experiments, plates, transfers });
        set((prev) => ({
          _past: [...prev._past.slice(-(MAX_UNDO - 1)), snap],
          _future: [],
          _saveCounter: Date.now(),
        }));
      },

      undo: () => {
        const s = get();
        if (s._past.length === 0) return;
        const prev = s._past[s._past.length - 1];
        const current = deepClone({ experiments: s.experiments, plates: s.plates, transfers: s.transfers });
        set({
          _past: s._past.slice(0, -1),
          _future: [...s._future, current],
          ...prev,
          _saveCounter: Date.now(),
        });
      },

      redo: () => {
        const s = get();
        if (s._future.length === 0) return;
        const next = s._future[s._future.length - 1];
        const current = deepClone({ experiments: s.experiments, plates: s.plates, transfers: s.transfers });
        set({
          _future: s._future.slice(0, -1),
          _past: [...s._past, current],
          ...next,
          _saveCounter: Date.now(),
        });
      },

      // ── UI ──
      tab: "experiments",
      selExp: null,
      selPlate: null,
      modal: null,
      hovWell: null,
      hovClone: null,
      transferMode: null,
      pendingDelete: null, // {type: "exp"|"plate", id: string} — for confirm dialog

      // ── UI Actions ──
      setTab: (tab) => set({ tab, transferMode: null }),
      setSelExp: (id) => set({ selExp: id }),
      setSelPlate: (id) => set({ selPlate: id }),
      setModal: (modal) => set({ modal }),
      setHovWell: (well) => set({ hovWell: well }),
      setHovClone: (cloneId) => set({ hovClone: cloneId }),
      setTransferMode: (mode) => set({ transferMode: mode }),

      // ── Delete with confirmation (no confirm() in store) ──
      requestDelete: (type, id) => set({ pendingDelete: { type, id }, modal: "confirmDelete" }),
      cancelDelete: () => set({ pendingDelete: null, modal: null }),
      confirmDelete: () => {
        const { pendingDelete } = get();
        if (!pendingDelete) return;
        get()._pushUndo();
        if (pendingDelete.type === "exp") {
          const eid = pendingDelete.id;
          set((s) => ({
            experiments: s.experiments.filter((e) => e.id !== eid),
            plates: s.plates.filter((p) => p.expId !== eid),
            transfers: s.transfers.filter((t) => t.expId !== eid),
            selExp: s.selExp === eid ? null : s.selExp,
            pendingDelete: null,
            modal: null,
          }));
        } else if (pendingDelete.type === "plate") {
          const pid = pendingDelete.id;
          set((s) => ({
            plates: s.plates.filter((p) => p.id !== pid),
            transfers: s.transfers.filter((t) => t.sourceId !== pid && !t.targetIds.includes(pid)),
            selPlate: s.selPlate === pid ? null : s.selPlate,
            pendingDelete: null,
            modal: null,
          }));
        }
      },

      // ── Data Actions ──
      createExp: (id, type, name, notes) => {
        get()._pushUndo();
        set((s) => ({
          experiments: [
            ...s.experiments,
            { id, type, name, notes, date: new Date().toISOString().split("T")[0] },
          ],
          selExp: id,
          modal: null,
          tab: "plates",
        }));
      },

      createPlate: (expId, name, format, type) => {
        get()._pushUndo();
        const id = `${expId}-${name}`;
        const rows = format === 96 ? ROWS_96 : ROWS_48;
        const cols = format === 96 ? COLS_96 : COLS_48;
        const wells = {};
        for (const r of rows)
          for (const c of cols)
            wells[`${r}${c}`] = { status: "empty", cloneId: null };
        set((s) => ({
          plates: [
            ...s.plates,
            { id, expId, name, format, type, wells, created: new Date().toISOString() },
          ],
          selPlate: id,
          modal: null,
        }));
      },

      duplicatePlate: (plateId) => {
        get()._pushUndo();
        const s = get();
        const src = s.plates.find((p) => p.id === plateId);
        if (!src) return;
        // Generate unique name: S01-copy, S01-copy-2, S01-copy-3...
        const existingNames = new Set(s.plates.map((p) => p.name));
        let copyName = src.name + "-copy";
        let n = 2;
        while (existingNames.has(copyName)) {
          copyName = `${src.name}-copy-${n++}`;
        }
        const copyId = `${src.expId}-${copyName}`;
        const newWells = deepClone(src.wells);
        set((prev) => ({
          plates: [...prev.plates, { ...src, id: copyId, name: copyName, wells: newWells, created: new Date().toISOString() }],
          selPlate: copyId,
        }));
      },

      batchWellAction: (plateId, wls, action) => {
        get()._pushUndo();
        set((s) => ({
          plates: s.plates.map((p) => {
            if (p.id !== plateId) return p;
            const w = { ...p.wells };
            for (const well of wls) {
              if (action === "pick")
                w[well] = { status: "picked", cloneId: `${p.expId}-${p.name}-${well}` };
              else if (action === "dead")
                w[well] = { ...w[well], status: "dead" };
              else if (action === "wt")
                w[well] = { status: "control-wt", cloneId: null };
              else if (action === "blank")
                w[well] = { status: "control-blank", cloneId: null };
              else if (action === "clear")
                w[well] = { status: "empty", cloneId: null };
            }
            return { ...p, wells: w };
          }),
        }));
      },

      startTransfer: (srcId, type, replicates = 3, layout = "rows") =>
        set({ transferMode: { sourceId: srcId, type, replicates, layout }, modal: null }),

      confirmTransfer: (srcId, type, replicates = 3, customClones = null, layout = "rows") => {
        get()._pushUndo();
        const s = get();
        const src = s.plates.find((p) => p.id === srcId);
        if (!src) return;

        if (type === "passage96") {
          const n = s.plates.filter((p) => p.expId === src.expId && p.type === "passage").length + 1;
          const name = `P${n.toString().padStart(2, "0")}`;
          const id = `${src.expId}-${name}`;
          const nw = {};
          const activeIds = customClones ? new Set(customClones.map((c) => c.cloneId)) : null;
          for (const [k, v] of Object.entries(src.wells)) {
            if (activeIds && v.status === "picked" && !activeIds.has(v.cloneId)) {
              // Excluded picked clone → empty, but keep WT/blank/dead as-is
              nw[k] = { status: "empty", cloneId: null };
            } else {
              nw[k] = { ...v };
            }
          }
          set({
            plates: [
              ...s.plates,
              { id, expId: src.expId, name, format: 96, type: "passage", wells: nw, created: new Date().toISOString() },
            ],
            transfers: [
              ...s.transfers,
              { id: genId(), expId: src.expId, sourceId: srcId, targetIds: [id], type, date: new Date().toISOString() },
            ],
            transferMode: null,
          });
        } else if (type === "96to48") {
          const cpPlate = clonesPerPlate(replicates, layout);
          let clones;
          if (customClones) {
            clones = customClones;
          } else {
            clones = [];
            for (const r of ROWS_96)
              for (const c of COLS_96) {
                const w = `${r}${c}`;
                const d = src.wells[w];
                if (d && d.status === "picked")
                  clones.push({ cloneId: d.cloneId, sourceWell: w });
              }
          }
          const chunks = [];
          for (let i = 0; i < clones.length; i += cpPlate)
            chunks.push(clones.slice(i, i + cpPlate));
          const existing = s.plates.filter((p) => p.expId === src.expId && p.type === "culture").length;
          const newPlates = chunks.map((chunk, ci) => {
            const name = `C${(existing + ci + 1).toString().padStart(2, "0")}`;
            return {
              id: `${src.expId}-${name}`,
              expId: src.expId,
              name,
              format: 48,
              type: "culture",
              replicates,
              layout,
              wells: generate48Layout(chunk, replicates, layout),
              created: new Date().toISOString(),
            };
          });
          set({
            plates: [...s.plates, ...newPlates],
            transfers: [
              ...s.transfers,
              {
                id: genId(),
                expId: src.expId,
                sourceId: srcId,
                targetIds: newPlates.map((p) => p.id),
                type,
                replicates,
                layout,
                date: new Date().toISOString(),
              },
            ],
            transferMode: null,
          });
        }
      },

      importAssay: (plateId, rawText) => {
        get()._pushUndo();
        const lines = rawText.trim().split("\n").map((l) =>
          l.split(/[\t,;]/).map((v) => v.trim())
        );
        const s = get();
        const plate = s.plates.find((p) => p.id === plateId);
        if (!plate) return;
        const nw = { ...plate.wells };
        for (let ri = 0; ri < Math.min(lines.length, ROWS_48.length); ri++)
          for (let ci = 0; ci < Math.min(lines[ri].length, COLS_48.length); ci++) {
            const val = parseFloat(lines[ri][ci]);
            const well = posToWell(ri, ci);
            if (!isNaN(val) && nw[well]) nw[well] = { ...nw[well], value: val };
          }
        set((prev) => ({
          plates: prev.plates.map((p) => (p.id === plateId ? { ...p, wells: nw } : p)),
          modal: null,
        }));
      },

      updateWellValue: (plateId, well, value) => {
        get()._pushUndo();
        set((s) => ({
          plates: s.plates.map((p) => {
            if (p.id !== plateId) return p;
            const w = { ...p.wells };
            if (value === null) {
              const { value: _, ...rest } = w[well] || {};
              w[well] = rest;
            } else {
              w[well] = { ...w[well], value };
            }
            return { ...p, wells: w };
          }),
        }));
      },

      replaceWells: (plateId, newWells) => {
        get()._pushUndo();
        set((s) => ({
          plates: s.plates.map((p) =>
            p.id === plateId ? { ...p, wells: newWells } : p
          ),
        }));
      },

      applyPhotoAnalysis: (plateId, pickedWells, deadWells) => {
        get()._pushUndo();
        set((s) => ({
          plates: s.plates.map((p) => {
            if (p.id !== plateId) return p;
            const w = { ...p.wells };
            for (const well of pickedWells)
              w[well] = { status: "picked", cloneId: `${p.expId}-${p.name}-${well}` };
            for (const well of deadWells)
              w[well] = { ...w[well], status: "dead" };
            return { ...p, wells: w };
          }),
        }));
      },
    }),
    {
      name: "ct-v4",
      partialize: (state) => ({
        experiments: state.experiments,
        plates: state.plates,
        transfers: state.transfers,
      }),
    }
  )
);

export default useStore;
