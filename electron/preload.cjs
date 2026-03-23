const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  saveData: (json) => ipcRenderer.invoke("save-data", json),
  loadData: () => ipcRenderer.invoke("load-data"),
  exportBackup: (json) => ipcRenderer.invoke("export-backup", json),
  importBackup: () => ipcRenderer.invoke("import-backup"),
  getDataPath: () => ipcRenderer.invoke("get-data-path"),
});
