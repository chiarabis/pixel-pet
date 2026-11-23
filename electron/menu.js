import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
import { startPlaySelection } from "./play/play.js";
import { startGreeting } from "./bubble/bubble.js";
import { showCredits } from "./credits/credits.js";
import { isAlwaysOnTop, setAlwaysOnTop } from "./shared.js";
import { isAlarmEnabled, isAlarmRinging, showAlarmWindow } from "./alarm/alarm.js";

// Si apre nel browser solo quando si sceglie la voce del menu: l'app non contatta mai Ko-fi da sola
const KOFI_URL = "https://ko-fi.com/chiarabis";

// Menu del tasto destro: è un menu nativo
export function registerMenu() {
    ipcMain.on("pet:show-menu", (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win || win.isDestroyed()) return;

        // durante una pausa della sveglia il pet salta e basta: giocare o scrivere un saluto aspetta
        const busy = isAlarmRinging();

        const menu = Menu.buildFromTemplate([
            { label: "Giochiamo", enabled: !busy, click: () => startPlaySelection(win) },
            { label: "Fammi parlare", enabled: !busy, click: () => startGreeting(win) },
            { type: "separator" },
            {
                // la spunta mostra solo se è accesa: un clic apre la finestra, dove si accende, si spegne e si scelgono gli orari
                label: "Modalità sveglia",
                type: "checkbox",
                checked: isAlarmEnabled(),
                click: showAlarmWindow,
            },
            {
                // senza la spunta il pet si comporta come una finestra normale: sta dietro a quella in cui lavori
                label: "Sempre in primo piano",
                type: "checkbox",
                checked: isAlwaysOnTop(),
                click: (item) => setAlwaysOnTop(item.checked),
            },
            { type: "separator" },
            { label: "Offri un caffè ☕", click: () => shell.openExternal(KOFI_URL) },
            { label: "Crediti", click: showCredits },
            { label: "Esci", click: () => app.quit() },
        ]);

        menu.popup({ window: win });
    });
}
