// Preload della finestra Sveglia: CommonJS perché gira in sandbox.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("alarmAPI", {
  // { enabled, breaks: [{ time: "HH:MM", kind }], fired }
  get: () => ipcRenderer.invoke("alarm:get"),
  // accende o spegne la modalità subito (il toggle della finestra)
  setEnabled: (value) => ipcRenderer.invoke("alarm:set-enabled", value),
  // salva e restituisce lo stato ripulito dal main (orari doppi o non validi tolti)
  save: (data) => ipcRenderer.invoke("alarm:save", data),
});
