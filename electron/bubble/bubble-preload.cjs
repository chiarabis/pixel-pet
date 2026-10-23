// Preload del fumetto "Salutami": CommonJS perché gira in sandbox.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bubbleAPI", {
  onMode: (callback) => ipcRenderer.on("bubble:mode", (_event, data) => callback(data)),
  onTail: (callback) => ipcRenderer.on("bubble:tail", (_event, x) => callback(x)),

  resize: (width, height) => ipcRenderer.send("bubble:resize", { width, height }),
  submit: (text) => ipcRenderer.send("bubble:submit", text),
  cancel: () => ipcRenderer.send("bubble:cancel"),
  close: () => ipcRenderer.send("bubble:close"),
  hover: (hovered) => ipcRenderer.send("bubble:hover", hovered),
});
