// Il preload gira in sandbox: deve essere CommonJS (.cjs), non un modulo ES.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petAPI", {
  startDrag: () => ipcRenderer.send("pet:drag-start"),
  stopDrag: () => ipcRenderer.send("pet:drag-stop"),

  // Risolve con "done" a percorso finito, "cancelled" se interrotto
  // options.resume: riprende una camminata messa in pausa
  walk: (options) => ipcRenderer.invoke("pet:walk", options),
  // discard = true: non si potrà riprendere; false: resta in pausa
  cancelWalk: (discard = false) => ipcRenderer.send("pet:walk-cancel", discard),
  onWalkDirection: (callback) => {
    const listener = (_event, direction) => callback(direction);
    ipcRenderer.on("pet:walk-direction", listener);
    return () => ipcRenderer.removeListener("pet:walk-direction", listener);
  },
});
