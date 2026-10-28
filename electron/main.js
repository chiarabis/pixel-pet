// Avvio dell'app e finestra del pet. Il resto è diviso per funzione:
// movement/ (drag, salto, camminata, corsa), play/ (Giochiamo), bubble/ (Salutami), credits/
import { app, BrowserWindow, screen } from "electron";
import path from "node:path";
import squirrelStartup from "electron-squirrel-startup";
import { WINDOW_SIZE, setPetWindow, getPetWindow, isAlwaysOnTop, onAlwaysOnTopChange } from "./shared.js";
import { log } from "./log.js";
import { registerMenu } from "./menu.js";
import { registerDrag } from "./movement/drag.js";
import { registerJump } from "./movement/jump.js";
import { registerWalk } from "./movement/walk.js";
import { registerRun } from "./movement/run.js";
import { registerPlay } from "./play/play.js";
import { registerBubble, positionBubble } from "./bubble/bubble.js";

app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");

const SHOW_FALLBACK_MS = 3000;
const VISIBILITY_CHECKS = 10;
const VISIBILITY_INTERVAL_MS = 1500;


function placeBottomRight(win) {
    const { workArea } = screen.getPrimaryDisplay();

    win.setBounds({
        x: workArea.x + workArea.width - WINDOW_SIZE,
        y: workArea.y + workArea.height - WINDOW_SIZE,
        width: WINDOW_SIZE,
        height: WINDOW_SIZE,
    });
}

function watchVisibility(win) {
    let checks = 0;

    const timer = setInterval(async () => {
        if (win.isDestroyed()) return clearInterval(timer);

        checks++;

        let state;
        try {
            state = await win.webContents.executeJavaScript("document.visibilityState");
        } catch (error) {
            state = `errore (${error.message})`;
        }

        const pageVisible = state === "visible";
        const windowVisible = win.isVisible();

        if (pageVisible && windowVisible) {
            if (checks === 1) log("controllo: pagina e finestra visibili");
        } else if (!win.isMinimized()) {
            log(`controllo #${checks}: pagina "${state}", finestra ${windowVisible ? "visibile" : "nascosta"}: la rimostro`);
            win.hide();
            win.showInactive();
            win.moveTop();
        }

        if (checks >= VISIBILITY_CHECKS) {
            clearInterval(timer);
            log("controlli iniziali finiti");
        }
    }, VISIBILITY_INTERVAL_MS);
}

function logWindowEvents(win) {
    for (const name of ["show", "hide", "minimize", "restore"]) {
        win.on(name, () => log(`finestra: ${name}`));
    }

    const contents = win.webContents;

    contents.on("did-finish-load", () => log("pagina caricata"));
    contents.on("did-fail-load", (_event, code, description, url) => {
        log(`caricamento fallito (${code}): ${description} ${url}`);
    });
    contents.on("render-process-gone", (_event, details) => {
        log(`processo della pagina terminato: ${details.reason} (codice ${details.exitCode})`);
    });
    contents.on("unresponsive", () => log("la pagina non risponde"));
    contents.on("responsive", () => log("la pagina risponde di nuovo"));

    contents.on("console-message", (event) => {
        if (event.level === "error") log("errore nella pagina:", event.message);
    });
}

async function logStartup() {
    log("=== avvio ===");
    log(`Pixel Pet ${app.getVersion()} | Electron ${process.versions.electron} | Chromium ${process.versions.chrome}`);
    log(`Windows ${process.getSystemVersion()} | ${process.arch} | ${app.isPackaged ? "installata" : "sviluppo"}`);

    const primary = screen.getPrimaryDisplay().id;
    log("schermi:", screen.getAllDisplays().map((d) => {
        return `${d.bounds.width}x${d.bounds.height} a (${d.bounds.x},${d.bounds.y}) scala ${d.scaleFactor}${d.id === primary ? " [principale]" : ""}`;
    }).join(" | "));

    // la scheda grafica va interrogata per prima: lo stato delle sue funzioni è affidabile solo dopo
    try {
        const gpu = (await app.getGPUInfo("basic")).gpuDevice?.[0];
        if (gpu) log(`scheda grafica: ${gpu.vendorId}:${gpu.deviceId} driver ${gpu.driverVersion ?? "?"}`);
    } catch {
        // informazione facoltativa
    }

    const features = app.getGPUFeatureStatus();
    log(`grafica: composizione=${features.gpu_compositing} rasterizzazione=${features.rasterization} webgl=${features.webgl}`);
}

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

        // Sempre in primo piano (si può cambiare dal menu e viene ricordato)
        alwaysOnTop: isAlwaysOnTop(),

        hasShadow: false,
        show: false,

        webPreferences: {
            preload: path.join(import.meta.dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false,
        },
    });

    setPetWindow(win);
    logWindowEvents(win);

    // il fumetto segue il pet in ogni movimento (camminata, salto, corsa, drag)
    win.on("move", positionBubble);

    placeBottomRight(win);

    win.setAlwaysOnTop(isAlwaysOnTop(), "floating");
    onAlwaysOnTopChange((enabled) => {
        if (!win.isDestroyed()) win.setAlwaysOnTop(enabled, "floating");
    });

    let readyToShowFired = false;
    win.once("ready-to-show", () => {
        readyToShowFired = true;
        log("ready-to-show: mostro il pet");
        win.showInactive();
    });

    setTimeout(() => {
        if (!win.isDestroyed() && !readyToShowFired && !win.isVisible()) {
            log(`ready-to-show non arrivato dopo ${SHOW_FALLBACK_MS} ms: mostro il pet`);
            win.showInactive();
        }
    }, SHOW_FALLBACK_MS);

    watchVisibility(win);

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

// Squirrel (l'installer Windows) avvia l'app durante installazione e disinstallazione
if (squirrelStartup || !app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on("second-instance", () => {
        const win = getPetWindow();
        if (!win || win.isDestroyed()) return;

        log("secondo avvio: riporto il pet in basso a destra");
        if (win.isMinimized()) win.restore();
        placeBottomRight(win);
        win.showInactive();
        win.moveTop();
    });

    app.whenReady().then(() => {
        logStartup();
        createWindow();
    });
}

app.on("window-all-closed", () => {
    app.quit();
});
