// Avvio dell'app e finestra del pet. Il resto è diviso per funzione:
// movement/ (drag, salto, camminata, corsa), play/ (Giochiamo), bubble/ (Salutami), credits/
import { app, BrowserWindow, screen } from "electron";
import path from "node:path";
import squirrelStartup from "electron-squirrel-startup";
import { WINDOW_SIZE, setPetWindow } from "./shared.js";
import { registerMenu } from "./menu.js";
import { registerDrag } from "./movement/drag.js";
import { registerJump } from "./movement/jump.js";
import { registerWalk } from "./movement/walk.js";
import { registerRun } from "./movement/run.js";
import { registerPlay } from "./play/play.js";
import { registerBubble, positionBubble } from "./bubble/bubble.js";

function createWindow() {
    const win = new BrowserWindow({
        width: WINDOW_SIZE,
        height: WINDOW_SIZE,

        // Finestra senza bordi
        frame: false,

        // Sfondo trasparente
        transparent: true,
        backgroundColor: "#00000000",

        resizable: false,

        // Sempre in primo piano
        alwaysOnTop: true,

        // Nessuna ombra
        hasShadow: false,

        webPreferences: {
            preload: path.join(import.meta.dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    setPetWindow(win);

    // il fumetto segue il pet in ogni movimento (camminata, salto, corsa, drag)
    win.on("move", positionBubble);

    //posizione sullo schermo
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    win.setPosition(
        width - WINDOW_SIZE,
        height - WINDOW_SIZE
    );

    win.setAlwaysOnTop(true, "floating");

    win.once("ready-to-show", () => {
        win.show();
    });

    if (app.isPackaged) {
        win.loadFile(path.join(import.meta.dirname, "../dist/index.html"));
    } else {
        win.loadURL("http://127.0.0.1:5173");
    }
    if (!app.isPackaged) {
        win.webContents.openDevTools({ mode: "detach" });
    }
}

registerDrag();
registerJump();
registerWalk();
registerRun();
registerPlay();
registerBubble();
registerMenu();

// Squirrel (l'installer Windows) avvia l'app durante installazione e disinstallazione:
// in quel caso va chiusa subito, senza mostrare il pet.
// Una sola copia alla volta: un secondo avvio si chiude, così non compaiono due gatti.
if (squirrelStartup || !app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.whenReady().then(() => {
        createWindow();
    });
}

app.on("window-all-closed", () => {
    app.quit();
});
