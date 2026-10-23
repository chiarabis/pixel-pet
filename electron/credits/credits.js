import { BrowserWindow, shell } from "electron";
import path from "node:path";

// Crediti: finestra normale con le licenze della grafica; i link si aprono nel browser
let creditsWin = null;

export function showCredits() {
    if (creditsWin && !creditsWin.isDestroyed()) {
        if (creditsWin.isMinimized()) creditsWin.restore();
        creditsWin.focus();
        return;
    }

    creditsWin = new BrowserWindow({
        width: 480,
        height: 680,
        title: "Crediti · Pixel Pet",
        autoHideMenuBar: true,
        minimizable: false,
        maximizable: false,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });

    // i link (target="_blank") non aprono finestre di Electron ma il browser predefinito
    creditsWin.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith("https://")) shell.openExternal(url);
        return { action: "deny" };
    });
    creditsWin.webContents.on("will-navigate", (event) => event.preventDefault());

    creditsWin.on("closed", () => {
        creditsWin = null;
    });

    creditsWin.loadFile(path.join(import.meta.dirname, "credits.html"));
}
