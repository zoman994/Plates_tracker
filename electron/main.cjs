const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

// Auto-save path: next to the exe / in userData
const dataDir = app.isPackaged
  ? path.dirname(process.execPath)
  : path.join(__dirname, "..");
const autoSavePath = path.join(dataDir, "clonetracker-data.json");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: "CloneTracker",
    backgroundColor: "#09090b",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

// ── IPC Handlers ──

// Auto-save: write JSON to disk
ipcMain.handle("save-data", async (_event, jsonString) => {
  try {
    fs.writeFileSync(autoSavePath, jsonString, "utf-8");
    return { ok: true, path: autoSavePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Auto-load: read JSON from disk
ipcMain.handle("load-data", async () => {
  try {
    if (fs.existsSync(autoSavePath)) {
      const data = fs.readFileSync(autoSavePath, "utf-8");
      return { ok: true, data };
    }
    return { ok: false, error: "no file" };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Export backup: save dialog
ipcMain.handle("export-backup", async (_event, jsonString) => {
  const { filePath } = await dialog.showSaveDialog({
    title: "Экспорт базы данных",
    defaultPath: `clonetracker-backup-${new Date().toISOString().split("T")[0]}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!filePath) return { ok: false, error: "cancelled" };
  try {
    fs.writeFileSync(filePath, jsonString, "utf-8");
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Import backup: open dialog
ipcMain.handle("import-backup", async () => {
  const { filePaths } = await dialog.showOpenDialog({
    title: "Импорт базы данных",
    filters: [{ name: "JSON", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (!filePaths || filePaths.length === 0) return { ok: false, error: "cancelled" };
  try {
    const data = fs.readFileSync(filePaths[0], "utf-8");
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Get save path info
ipcMain.handle("get-data-path", () => autoSavePath);

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});
