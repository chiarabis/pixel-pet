import { BrowserWindow, ipcMain, screen } from "electron";
import { WINDOW_SIZE } from "../shared.js";
import { haltPet } from "./halt.js";

// Il trascinamento è gestito qui nel main: la posizione del cursore si legge
// direttamente dal sistema, senza dipendere dagli eventi del renderer.
let dragTimer = null;

function stopDrag() {
    clearInterval(dragTimer);
    dragTimer = null;
}

export function registerDrag() {
    ipcMain.on("pet:drag-start", (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win || win.isDestroyed()) return;

        stopDrag();
        haltPet();

        const start = screen.getCursorScreenPoint();
        const [winX, winY] = win.getPosition();

        dragTimer = setInterval(() => {
            if (win.isDestroyed()) return stopDrag();

            const cursor = screen.getCursorScreenPoint();

            // setBounds con dimensioni fisse evita che la finestra cambi taglia su schermi con scaling
            win.setBounds({
                x: winX + cursor.x - start.x,
                y: winY + cursor.y - start.y,
                width: WINDOW_SIZE,
                height: WINDOW_SIZE,
            });
        }, 8);
    });

    ipcMain.on("pet:drag-stop", stopDrag);
}
