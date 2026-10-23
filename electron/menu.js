import { app, BrowserWindow, ipcMain, Menu } from "electron";
import { startPlaySelection } from "./play/play.js";
import { startGreeting } from "./bubble/bubble.js";
import { showCredits } from "./credits/credits.js";

// Menu del tasto destro: è un menu nativo
export function registerMenu() {
    ipcMain.on("pet:show-menu", (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win || win.isDestroyed()) return;

        const menu = Menu.buildFromTemplate([
            { label: "Giochiamo", click: () => startPlaySelection(win) },
            { label: "Fammi parlare", click: () => startGreeting(win) },
            { type: "separator" },
            { label: "Crediti", click: showCredits },
            { label: "Esci", click: () => app.quit() },
        ]);

        menu.popup({ window: win });
    });
}
