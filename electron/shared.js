// Stato e costanti condivisi tra i moduli del main
export const WINDOW_SIZE = 200;

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
