// Preload dell'overlay "Giochiamo": CommonJS perché gira in sandbox.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlayAPI", {
  pick: () => ipcRenderer.send("play:pick"),
  cancel: () => ipcRenderer.send("play:cancel"),
});
