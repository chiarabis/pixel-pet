// file che genera e gestisce una window
import { app, BrowserWindow, ipcMain, screen } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";


const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WINDOW_SIZE = 200;

function createWindow() {
    const win = new BrowserWindow({
        width: 200,
        height: 200,

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
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    //posizione sullo schermo
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    win.setPosition(
        width - 200 - 24,
        height - 200 - 24
    );

    win.setAlwaysOnTop(true, "floating");

    win.once("ready-to-show", () => {
        win.show();
    });

    if (app.isPackaged) {
        win.loadFile(path.join(__dirname, "../dist/index.html"));
    } else {
        win.loadURL("http://127.0.0.1:5173");
    }
    if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: "detach" });
}
}

// Il trascinamento è gestito qui nel main: la posizione del cursore si legge
// direttamente dal sistema, senza dipendere dagli eventi del renderer.
let dragTimer = null;

function stopDrag() {
    clearInterval(dragTimer);
    dragTimer = null;
}

ipcMain.on("pet:drag-start", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;

    stopDrag();
    cancelWalk(true);

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

// Camminata automatica: la finestra scorre in orizzontale restando nell'area di lavoro
const WALK_SPEED = 150;
let currentWalk = null;
let pausedRoute = null;

// discard = true: la camminata è finita per sempre; false: può essere ripresa
function cancelWalk(discard = false) {
    if (!currentWalk) return;
    currentWalk.cancelled = true;
    currentWalk.discard = discard;
}

// Sposta la finestra da `fromX` a `toX` (y fissa); risolve con la x raggiunta
function walkTo(win, walk, fromX, toX, y) {
    return new Promise((resolve) => {
        const direction = toX > fromX ? 1 : -1;
        let x = fromX;
        let last = Date.now();

        const timer = setInterval(() => {
            if (walk.cancelled || win.isDestroyed()) {
                clearInterval(timer);
                return resolve(x);
            }

            const now = Date.now();
            x += direction * WALK_SPEED * ((now - last) / 1000);
            last = now;

            const arrived = direction > 0 ? x >= toX : x <= toX;
            if (arrived) x = toX;

            win.setBounds({
                x: Math.round(x),
                y,
                width: WINDOW_SIZE,
                height: WINDOW_SIZE,
            });

            if (arrived) {
                clearInterval(timer);
                resolve(x);
            }
        }, 16);
    });
}

// resume = true: riparte dalle tappe rimaste di una camminata in pausa, dalla posizione attuale
ipcMain.handle("pet:walk", async (event, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return "cancelled";

    cancelWalk(true);
    stopDrag();

    const walk = { cancelled: false, discard: false };
    currentWalk = walk;

    const bounds = win.getBounds();
    let remaining;

    if (options?.resume && pausedRoute) {
        remaining = pausedRoute;
    } else {
        const area = screen.getDisplayMatching(bounds).workArea;
        const minX = area.x;
        const maxX = area.x + area.width - WINDOW_SIZE;

        // due attraversamenti dello schermo (destra→sinistra→destra), poi ritorno al punto di partenza
        remaining = [maxX, minX, maxX, bounds.x];
    }
    pausedRoute = null;

    let x = bounds.x;
    while (remaining.length > 0) {
        const target = remaining[0];

        if (target !== x) {
            event.sender.send("pet:walk-direction", target > x ? "right" : "left");
            x = await walkTo(win, walk, x, target, bounds.y);

            if (walk.cancelled || win.isDestroyed()) break;
        }

        remaining.shift();
    }

    const done = !walk.cancelled && !win.isDestroyed();

    if (currentWalk === walk) {
        currentWalk = null;
        if (!done && !walk.discard) pausedRoute = remaining;
    }

    return done ? "done" : "cancelled";
});

ipcMain.on("pet:walk-cancel", (_event, discard) => cancelWalk(Boolean(discard)));

// app.whenReady().then(createWindow);
app.whenReady().then(() => {
    createWindow()
})

app.on("window-all-closed", () => {
    app.quit();
});
