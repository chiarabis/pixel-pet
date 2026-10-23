// Il preload gira in sandbox: deve essere CommonJS (.cjs), non un modulo ES.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petAPI", {
  startDrag: () => ipcRenderer.send("pet:drag-start"),
  stopDrag: () => ipcRenderer.send("pet:drag-stop"),
  showMenu: () => ipcRenderer.send("pet:show-menu"),

  // Posizione dello sprite nella finestra e specchio: il fumetto ci allinea la punta
  setSpriteLayout: (layout) => ipcRenderer.send("pet:sprite-layout", layout),

  // "Giochiamo": eventi { type: "select" | "run" | "end" | "cancel", direction? } dal main
  onPlay: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("pet:play", listener);
    return () => ipcRenderer.removeListener("pet:play", listener);
  },
  cancelRun: () => ipcRenderer.send("pet:run-cancel"),

  // Sposta la finestra in orizzontale durante il salto: direction = 1 destra, -1 sinistra
  jump: (options) => ipcRenderer.send("pet:jump", options),
  cancelJump: () => ipcRenderer.send("pet:jump-cancel"),
  // Risolve con "done" a percorso finito, "cancelled" se interrotto
  // options.resume: riprende una camminata messa in pausa
  walk: (options) => ipcRenderer.invoke("pet:walk", options),
  // discard = true: non si potrà riprendere; false: resta in pausa
  cancelWalk: (discard = false) => ipcRenderer.send("pet:walk-cancel", discard),
  // { active: true } quando il pet si ferma a graffiare a un bordo, { active: false } quando riparte
  onWalkScratch: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("pet:walk-scratch", listener);
    return () => ipcRenderer.removeListener("pet:walk-scratch", listener);
  },
  onWalkDirection: (callback) => {
    const listener = (_event, direction) => callback(direction);
    ipcRenderer.on("pet:walk-direction", listener);
    return () => ipcRenderer.removeListener("pet:walk-direction", listener);
  },
});
