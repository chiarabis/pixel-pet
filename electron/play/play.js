import { BrowserWindow, ipcMain, screen } from "electron";
import path from "node:path";
import { getPetWindow, sendPlayEvent } from "../shared.js";
import { haltPet } from "../movement/halt.js";
import { runTo } from "../movement/run.js";

// Giochiamo: un overlay trasparente a tutto schermo raccoglie un click, poi il pet corre lì.
// Dopo la corsa torna idle; per rigiocare bisogna riscegliere la voce dal menu.
let overlays = [];

function closeOverlays() {
    for (const overlay of overlays) {
        if (!overlay.isDestroyed()) overlay.close();
    }
    overlays = [];
}

export function startPlaySelection(petWin) {
    closeOverlays();
    haltPet();

    sendPlayEvent(petWin, { type: "select" });

    overlays = screen.getAllDisplays().map((display) => {
        const overlay = new BrowserWindow({
            ...display.bounds,
            frame: false,
            transparent: true,
            backgroundColor: "#00000000",
            resizable: false,
            movable: false,
            fullscreenable: false,
            skipTaskbar: true,
            hasShadow: false,
            show: false,
            webPreferences: {
                preload: path.join(import.meta.dirname, "overlay-preload.cjs"),
                contextIsolation: true,
                nodeIntegration: false,
            },
        });

        overlay.setAlwaysOnTop(true, "screen-saver");
        overlay.loadFile(path.join(import.meta.dirname, "overlay.html"));
        overlay.once("ready-to-show", () => {
            overlay.setBounds(display.bounds);
            overlay.show();
            overlay.focus();
        });

        return overlay;
    });
}

export function registerPlay() {
    ipcMain.on("play:pick", () => {
        const point = screen.getCursorScreenPoint();
        const petWindow = getPetWindow();

        closeOverlays();
        if (petWindow && !petWindow.isDestroyed()) runTo(petWindow, point);
    });

    ipcMain.on("play:cancel", () => {
        const petWindow = getPetWindow();

        closeOverlays();
        if (petWindow && !petWindow.isDestroyed()) sendPlayEvent(petWindow, { type: "cancel" });
    });
}
