/**
 * Backup/restore utilities.
 * Works in both Electron (via electronAPI) and browser (via download/upload).
 */

function getDataSnapshot(store) {
  const s = store.getState();
  return JSON.stringify({
    _version: 2,
    _date: new Date().toISOString(),
    experiments: s.experiments,
    plates: s.plates,
    transfers: s.transfers,
  }, null, 2);
}

// ── Auto-save to disk (Electron only) ──
export function autoSaveToDisk(store) {
  if (!window.electronAPI) return;
  const json = getDataSnapshot(store);
  window.electronAPI.saveData(json);
}

// ── Load from disk on startup (Electron only) ──
export async function loadFromDisk() {
  if (!window.electronAPI) return null;
  const result = await window.electronAPI.loadData();
  if (result.ok && result.data) {
    try {
      return JSON.parse(result.data);
    } catch { return null; }
  }
  return null;
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

  // Validate
  if (!data.experiments || !data.plates || !data.transfers) {
    return { ok: false, error: "Файл не содержит данных CloneTracker" };
  }

  // Apply
  const s = store.getState();
  s._pushUndo();
  store.setState({
    experiments: data.experiments,
    plates: data.plates,
    transfers: data.transfers,
  });

  return { ok: true, count: data.experiments.length };
}
