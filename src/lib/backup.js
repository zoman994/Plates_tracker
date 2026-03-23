/**
 * Backup/restore utilities.
 * Works in both Electron (via electronAPI) and browser (via download/upload).
 */

function getDataSnapshot(store) {
  const s = store.getState();
  // Include Tecan config in backup
  let tecanConfig = null;
  try { tecanConfig = JSON.parse(localStorage.getItem("ct-tecan-config")); } catch {}
  return JSON.stringify({
    _version: 3,
    _date: new Date().toISOString(),
    experiments: s.experiments,
    plates: s.plates,
    transfers: s.transfers,
    tecanConfig,
  }, null, 2);
}

// ── Auto-save to disk (Electron only) ──
export function autoSaveToDisk(store) {
  if (!window.electronAPI) return;
  const json = getDataSnapshot(store);
  window.electronAPI.saveData(json);
}

// ── Load from disk on startup (Electron only) ──
// Compares file backup with localStorage, uses newer version
export async function loadFromDiskIfNewer(store) {
  if (!window.electronAPI) return;
  try {
    const result = await window.electronAPI.loadData();
    if (!result.ok || !result.data) return;
    const fileData = JSON.parse(result.data);
    if (!Array.isArray(fileData.experiments) || !Array.isArray(fileData.plates)) return;

    const storeData = store.getState();
    const fileTotal = fileData.experiments.length + fileData.plates.length + fileData.transfers.length;
    const storeTotal = storeData.experiments.length + storeData.plates.length + storeData.transfers.length;

    // If localStorage is empty but file has data — restore from file
    if (storeTotal === 0 && fileTotal > 0) {
      store.setState({
        experiments: fileData.experiments,
        plates: fileData.plates,
        transfers: fileData.transfers,
      });
      console.log("Restored from disk backup:", fileTotal, "items");
    }
    // If file has more data (localStorage was cleared) — offer restore
    else if (fileTotal > storeTotal && storeTotal === 0) {
      store.setState({
        experiments: fileData.experiments,
        plates: fileData.plates,
        transfers: fileData.transfers,
      });
    }
  } catch (e) {
    console.warn("Failed to load disk backup:", e);
  }
}

// ── Export backup ──
export async function exportBackup(store) {
  const json = getDataSnapshot(store);

  if (window.electronAPI) {
    // Electron: native save dialog
    const result = await window.electronAPI.exportBackup(json);
    return result;
  } else {
    // Browser fallback: download
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clonetracker-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  }
}

// ── Import backup ──
export async function importBackup(store) {
  let data;

  if (window.electronAPI) {
    // Electron: native open dialog
    const result = await window.electronAPI.importBackup();
    if (!result.ok) return result;
    try {
      data = JSON.parse(result.data);
    } catch {
      return { ok: false, error: "Невалидный JSON" };
    }
  } else {
    // Browser fallback: file input
    data = await new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) { resolve(null); return; }
        const text = await file.text();
        try { resolve(JSON.parse(text)); } catch { resolve(null); }
      };
      input.click();
    });
    if (!data) return { ok: false, error: "cancelled" };
  }

  // Validate structure
  if (!Array.isArray(data.experiments) || !Array.isArray(data.plates) || !Array.isArray(data.transfers)) {
    return { ok: false, error: "Файл не содержит данных CloneTracker (experiments/plates/transfers должны быть массивами)" };
  }
  // Validate basic shape
  for (const exp of data.experiments) {
    if (!exp.id || typeof exp.id !== "string") return { ok: false, error: `Невалидный эксперимент: отсутствует id` };
  }
  for (const plate of data.plates) {
    if (!plate.id || !plate.wells || typeof plate.wells !== "object") return { ok: false, error: `Невалидный планшет: ${plate.id || "unknown"}` };
  }

  // Apply
  const s = store.getState();
  s._pushUndo();
  store.setState({
    experiments: data.experiments,
    plates: data.plates,
    transfers: data.transfers,
  });

  // Restore Tecan config if present
  if (data.tecanConfig && typeof data.tecanConfig === "object") {
    localStorage.setItem("ct-tecan-config", JSON.stringify(data.tecanConfig));
  }

  return { ok: true, count: data.experiments.length };
}

// ── Share single experiment (mobile-friendly) ──

export async function exportExperimentJson(store, expId) {
  const s = store.getState();
  const exp = s.experiments.find((e) => e.id === expId);
  if (!exp) return;

  const expPlates = s.plates.filter((p) => p.expId === expId);
  const expTransfers = s.transfers.filter((t) => t.expId === expId);

  const jsonStr = JSON.stringify({
    _version: 3,
    _type: "experiment",
    _date: new Date().toISOString(),
    experiment: exp,
    plates: expPlates,
    transfers: expTransfers,
  }, null, 2);

  const filename = `${expId}.json`;
  const blob = new Blob([jsonStr], { type: "application/json" });

  // Try Web Share API (mobile)
  try {
    if (navigator.share) {
      const file = new File([blob], filename, { type: "application/json" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `CloneTracker: ${expId}` });
        return;
      }
    }
  } catch (e) {
    // Share cancelled or failed — fall through to download
  }

  // Fallback: download via link
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importExperimentJson(store) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) { resolve({ ok: false }); return; }
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (data._type === "experiment" && data.experiment && data.plates) {
          // Single experiment import
          const s = store.getState();
          s._pushUndo();

          // Check for duplicate experiment
          const existing = s.experiments.find((ex) => ex.id === data.experiment.id);
          if (existing) {
            // Merge: replace plates and transfers for this experiment
            store.setState({
              plates: [
                ...s.plates.filter((p) => p.expId !== data.experiment.id),
                ...data.plates,
              ],
              transfers: [
                ...s.transfers.filter((t) => t.expId !== data.experiment.id),
                ...data.transfers,
              ],
            });
            resolve({ ok: true, action: "merged", id: data.experiment.id });
          } else {
            // Add new experiment
            store.setState({
              experiments: [...s.experiments, data.experiment],
              plates: [...s.plates, ...data.plates],
              transfers: [...s.transfers, ...data.transfers],
            });
            resolve({ ok: true, action: "added", id: data.experiment.id });
          }
        } else if (data.experiments && data.plates && data.transfers) {
          // Full backup — delegate to importBackup
          const r = await importBackup(store);
          resolve(r);
        } else {
          resolve({ ok: false, error: "Неизвестный формат файла" });
        }
      } catch (err) {
        resolve({ ok: false, error: "Ошибка: " + err.message });
      }
    };
    input.click();
  });
}
