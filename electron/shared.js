import { getSettings, updateSettings } from "./settings.js";

export const WINDOW_SIZE = 200;
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

let spriteLayout = { left: 36, top: 0, size: 128, flipped: false };

export function setSpriteLayout(layout) {
    spriteLayout = layout;
}

export function getSpriteLayout() {
    return spriteLayout;
}

export function sendPlayEvent(win, event) {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.send("pet:play", event);
    }
}
