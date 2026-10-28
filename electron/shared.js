import { getSettings, updateSettings } from "./settings.js";

// Stato e costanti condivisi tra i moduli del main
export const WINDOW_SIZE = 200;

// "Sempre in primo piano": vale per il pet e per il suo fumetto, che lo segue.
// Chi ha una finestra da tenere allineata si registra con onAlwaysOnTopChange.
const alwaysOnTopListeners = new Set();

export function isAlwaysOnTop() {
    return getSettings().alwaysOnTop;
}

export function setAlwaysOnTop(value) {
    const enabled = Boolean(value);

    updateSettings({ alwaysOnTop: enabled });
    for (const listener of alwaysOnTopListeners) listener(enabled);
}

export function onAlwaysOnTopChange(listener) {
    alwaysOnTopListeners.add(listener);
}

let petWindow = null;

export function setPetWindow(win) {
    petWindow = win;
}

export function getPetWindow() {
    return petWindow;
}

// Dove sta lo sprite dentro la finestra del pet (px) e se è specchiato; lo aggiorna il renderer.
// I valori iniziali valgono finché non arriva la prima misura.
let spriteLayout = { left: 36, top: 0, size: 128, flipped: false };

export function setSpriteLayout(layout) {
    spriteLayout = layout;
}

export function getSpriteLayout() {
    return spriteLayout;
}

// Eventi "gioco" verso il renderer del pet: select | run | end | cancel
// (usati da "Giochiamo" e da "Salutami" per fermare il pet mentre si sceglie/scrive)
export function sendPlayEvent(win, event) {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.send("pet:play", event);
    }
}
