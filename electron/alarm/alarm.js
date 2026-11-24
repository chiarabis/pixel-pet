import { BrowserWindow, ipcMain, powerMonitor } from "electron";
import path from "node:path";
import { getSettings, updateSettings } from "../settings.js";
import { getPetWindow } from "../shared.js";
import { log } from "../log.js";
import { haltPet } from "../movement/halt.js";
import { cancelPlaySelection } from "../play/play.js";
import { showAlarmBubble, hideAlarmBubble, onAlarmBubbleClose } from "../bubble/bubble.js";
import { KINDS, MAX_CUSTOM_TEXT, breakText, dueBreak, firedAfterEdit, normalizeBreaks, todayKey } from "./schedule.js";

// Modalità sveglia: agli orari scelti il pet salta senza fermarsi e mostra un fumetto (es. "Coffee break ☕")
// finché non lo si clicca. Gli orari valgono ogni giorno, finché la modalità è accesa.
const CHECK_INTERVAL_MS = 15000;

// Se nessuno clicca il gatto, la pausa (salto e fumetto) finisce da sola dopo 30 secondi e il pet torna normale
const ALARM_DURATION_MS = 30000;

let ringing = null; // la pausa in corso, oppure null
let ringTimer = null; // fa finire la pausa dopo ALARM_DURATION_MS
let alarmWin = null;

export function isAlarmEnabled() {
    return getSettings().alarm.enabled;
}

export function isAlarmRinging() {
    return ringing !== null;
}

function sendToPet(event) {
    const win = getPetWindow();

    if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send("pet:alarm", event);
}

function applyEnabled(enabled, now = new Date()) {
    const alarm = getSettings().alarm;
    if (alarm.enabled === enabled) return;

    // accendendola, gli orari già passati oggi non scattano: non è una pausa "persa" ma un orario che c'era prima
    const fired = enabled ? firedAfterEdit(now, [], {}, alarm.breaks) : alarm.fired;

    updateSettings({ alarm: { ...alarm, enabled, fired } });
    log(`modalità sveglia: ${enabled ? "accesa" : "spenta"}`);

    if (!enabled) endAlarm();
}

export function setAlarmEnabled(value) {
    const enabled = Boolean(value);

    applyEnabled(enabled);

    // senza orari non c'è niente che possa scattare: si apre subito la finestra per sceglierli
    if (enabled && getSettings().alarm.breaks.length === 0) showAlarmWindow();
}

// Salva le pause scelte dall'utente. Gli orari già passati oggi non scattano subito.
export function saveBreaks(input, now = new Date()) {
    const alarm = getSettings().alarm;
    const breaks = normalizeBreaks(input);
    const fired = firedAfterEdit(now, alarm.breaks, alarm.fired, breaks);

    updateSettings({ alarm: { ...alarm, breaks, fired } });
    log(`pause sveglia: ${breaks.map((item) => item.time).join(", ") || "nessuna"}`);

    return getSettings().alarm;
}

function startAlarm(item, now) {
    const petWin = getPetWindow();
    if (!petWin || petWin.isDestroyed()) return;

    ringing = item;

    const alarm = getSettings().alarm;
    updateSettings({ alarm: { ...alarm, fired: { ...alarm.fired, [item.time]: todayKey(now) } } });
    log(`pausa delle ${item.time}: parte`);

    // il pet smette di fare quello che faceva (camminata, corsa, scelta del punto di "Giochiamo")
    haltPet();
    cancelPlaySelection();

    // si vede anche se la finestra era nascosta o dietro le altre (senza prendere il focus)
    petWin.showInactive();
    petWin.moveTop();

    showAlarmBubble(breakText(item));
    sendToPet({ type: "start" });

    clearTimeout(ringTimer);
    ringTimer = setTimeout(() => endAlarm(`scaduta dopo ${ALARM_DURATION_MS / 1000} secondi`), ALARM_DURATION_MS);
}

export function endAlarm(reason = "chiusa") {
    if (!ringing) return;

    // arriva anche da ipcMain.on e da onAlarmBubbleClose, che passano altri argomenti: conta solo il testo
    const why = typeof reason === "string" ? reason : "chiusa";

    clearTimeout(ringTimer);
    ringTimer = null;

    log(`pausa delle ${ringing.time}: finita (${why})`);
    ringing = null;

    hideAlarmBubble();
    sendToPet({ type: "end" });
}

export function checkAlarms(now = new Date()) {
    const alarm = getSettings().alarm;

    if (!alarm.enabled || ringing) return;

    const item = dueBreak(now, alarm.breaks, alarm.fired);
    if (item) startAlarm(item, now);
}

// Da chiamare a finestra del pet creata: controlla subito (all'avvio) e poi ogni pochi secondi,
// e di nuovo quando il PC esce dalla sospensione.
export function startAlarmScheduler() {
    checkAlarms();

    setInterval(() => checkAlarms(), CHECK_INTERVAL_MS);
    powerMonitor.on("resume", () => checkAlarms());
}

export function showAlarmWindow() {
    if (alarmWin && !alarmWin.isDestroyed()) {
        if (alarmWin.isMinimized()) alarmWin.restore();
        alarmWin.focus();
        return;
    }

    alarmWin = new BrowserWindow({
        width: 480,
        height: 520,
        title: "Sveglia · Pixel Pet",
        autoHideMenuBar: true,
        minimizable: false,
        maximizable: false,
        resizable: false,
        webPreferences: {
            preload: path.join(import.meta.dirname, "alarm-preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });

    alarmWin.webContents.on("will-navigate", (event) => event.preventDefault());
    alarmWin.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    alarmWin.on("closed", () => {
        alarmWin = null;
    });

    alarmWin.loadFile(path.join(import.meta.dirname, "alarm.html"));
}

export function registerAlarm() {
    // la X del fumetto e il clic sul pet chiudono la pausa
    onAlarmBubbleClose(endAlarm);
    ipcMain.on("pet:alarm-dismiss", endAlarm);

    // la finestra riceve anche l'elenco dei tipi di pausa, così ce n'è una sola fonte (schedule.js)
    ipcMain.handle("alarm:get", () => ({
        ...getSettings().alarm,
        kinds: KINDS.map(({ kind, label }) => ({ kind, label })),
        maxCustomText: MAX_CUSTOM_TEXT,
    }));

    // il toggle della finestra vale subito, senza premere "Salva": la spunta nel menu deve dire la verità
    ipcMain.handle("alarm:set-enabled", (_event, value) => {
        applyEnabled(Boolean(value));

        return getSettings().alarm;
    });

    ipcMain.handle("alarm:save", (_event, data) => {
        saveBreaks(data?.breaks);
        applyEnabled(Boolean(data?.enabled));

        return getSettings().alarm;
    });
}
