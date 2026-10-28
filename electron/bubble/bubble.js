import { BrowserWindow, ipcMain, screen } from "electron";
import path from "node:path";
import {
    WINDOW_SIZE,
    getPetWindow,
    getSpriteLayout,
    setSpriteLayout,
    sendPlayEvent,
    isAlwaysOnTop,
    onAlwaysOnTopChange,
} from "../shared.js";
import { haltPet } from "../movement/halt.js";


// La frase ricompare ogni GREETING_INTERVAL ms per GREETING_VISIBLE ms; la X del fumetto la toglie.
const GREETING_MAX_WORDS = 6;
const GREETING_INTERVAL = 10000;
const GREETING_VISIBLE = 4000;
const GREETING_LEAVE_DELAY = 1500;
const BUBBLE_LIFT = 0;
const BUBBLE_SHIFT_X = 20;

// Dove sta la "testa" nello sprite idle (frame 32x32): la punta del fumetto va tra le due orecchie
const SPRITE_FRAME = 32;
const EARS_CENTER_X = 19.5;
const EARS_DIP_Y = 3;

let bubbleWin = null;
let bubbleReady = false;
let bubbleSize = { width: 240, height: 90 };
let bubbleTailX = null;
let pendingMode = null;
let pendingShow = null;
let isBubbleInput = false;
let greeting = null;

function createBubbleWindow() {
    bubbleReady = false;

    bubbleWin = new BrowserWindow({
        ...bubbleSize,
        frame: false,
        transparent: true,
        backgroundColor: "#00000000",
        resizable: false,
        skipTaskbar: true,
        hasShadow: false,
        show: false,
        alwaysOnTop: isAlwaysOnTop(),
        webPreferences: {
            preload: path.join(import.meta.dirname, "bubble-preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false,
        },
    });

    bubbleWin.setAlwaysOnTop(isAlwaysOnTop(), "floating");
    bubbleWin.loadFile(path.join(import.meta.dirname, "bubble.html"));

    bubbleWin.webContents.once("did-finish-load", () => {
        bubbleReady = true;
        if (pendingMode) sendBubbleMode(pendingMode);
        pendingMode = null;
    });

    // cliccando altrove mentre si scrive, il fumetto di input si chiude
    bubbleWin.on("blur", () => {
        if (isBubbleInput) cancelBubbleInput();
    });

    bubbleWin.on("closed", () => {
        bubbleWin = null;
    });
}

function sendBubbleMode(data) {
    if (!bubbleWin || bubbleWin.isDestroyed()) createBubbleWindow();

    if (!bubbleReady) {
        pendingMode = data;
        return;
    }

    bubbleWin.webContents.send("bubble:mode", { ...data, maxWords: GREETING_MAX_WORDS });
}

function hideBubble() {
    pendingShow = null;
    if (bubbleWin && !bubbleWin.isDestroyed()) bubbleWin.hide();
}

export function positionBubble() {
    const petWindow = getPetWindow();
    if (!bubbleWin || bubbleWin.isDestroyed() || !petWindow || petWindow.isDestroyed()) return;

    const pet = petWindow.getBounds();
    const { width, height } = bubbleSize;
    const area = screen.getDisplayMatching(pet).workArea;

    // posizione dello sprite nella finestra del pet, comunicata dal renderer (cambia con CSS e specchio)
    const { left, top, size, flipped } = getSpriteLayout();
    const scale = size / SPRITE_FRAME;

    // punto tra le due orecchie: con lo sprite specchiato la colonna si riflette
    const earsX = pet.x + left + (flipped ? SPRITE_FRAME - EARS_CENTER_X : EARS_CENTER_X) * scale;
    const earsY = pet.y + top + EARS_DIP_Y * scale;

    const petCenterX = pet.x + WINDOW_SIZE / 2;
    const x = Math.min(area.x + area.width - width, Math.max(area.x, Math.round(petCenterX - width / 2 - BUBBLE_SHIFT_X)));
    const y = Math.max(area.y, Math.round(earsY - height - BUBBLE_LIFT));

    bubbleWin.setBounds({ x, y, width, height });

    // la punta del fumetto punta alle orecchie anche quando il fumetto è spinto contro il bordo
    const tailX = Math.round(earsX - x);
    if (tailX !== bubbleTailX) {
        bubbleTailX = tailX;
        bubbleWin.webContents.send("bubble:tail", tailX);
    }
}

function stopGreeting() {
    if (!greeting) return;

    clearInterval(greeting.intervalTimer);
    clearTimeout(greeting.hideTimer);
    greeting = null;
}

function showGreeting() {
    // mentre si scrive una nuova frase il fumetto di input ha la precedenza
    if (!greeting || isBubbleInput) return;

    clearTimeout(greeting.hideTimer);
    greeting.hovered = false;
    greeting.hideTimer = setTimeout(hideGreeting, GREETING_VISIBLE);

    pendingShow = "inactive";
    sendBubbleMode({ mode: "show", text: greeting.text });
}

function hideGreeting() {
    // con il mouse sul fumetto resta, per poter premere la X
    if (!greeting || greeting.hovered) return;

    hideBubble();
}

export function startGreeting(petWin) {
    isBubbleInput = true;

    // il pet resta fermo mentre si scrive (stesso evento usato da "Giochiamo")
    haltPet();
    sendPlayEvent(petWin, { type: "select" });

    pendingShow = "input";
    sendBubbleMode({ mode: "input", text: greeting?.text ?? "" });
}

function cancelBubbleInput() {
    const petWindow = getPetWindow();

    isBubbleInput = false;
    hideBubble();

    if (petWindow && !petWindow.isDestroyed()) sendPlayEvent(petWindow, { type: "cancel" });
}

export function registerBubble() {
    // il fumetto segue il pet: se il pet non sta più sopra le altre finestre, nemmeno lui
    onAlwaysOnTopChange((enabled) => {
        if (bubbleWin && !bubbleWin.isDestroyed()) bubbleWin.setAlwaysOnTop(enabled, "floating");
    });

    // il renderer dice dove sta lo sprite nella finestra e se è specchiato
    ipcMain.on("pet:sprite-layout", (_event, layout) => {
        const { left, top, size, flipped } = layout ?? {};
        if (![left, top, size].every(Number.isFinite) || size <= 0) return;

        setSpriteLayout({ left, top, size, flipped: Boolean(flipped) });
        bubbleTailX = null;
        positionBubble();
    });

    ipcMain.on("bubble:resize", (_event, size) => {
        const width = Math.ceil(Number(size?.width));
        const height = Math.ceil(Number(size?.height));
        if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return;

        bubbleSize = { width, height };
        bubbleTailX = null; // la misura è cambiata: la punta va riposizionata
        positionBubble();

        if (!bubbleWin || bubbleWin.isDestroyed()) return;

        if (pendingShow === "input") {
            bubbleWin.show();
            bubbleWin.focus();
        } else if (pendingShow === "inactive") {
            bubbleWin.showInactive();
        }
        pendingShow = null;
    });

    ipcMain.on("bubble:submit", (_event, text) => {
        if (typeof text !== "string") return;

        const words = text.trim().split(/\s+/).filter(Boolean).slice(0, GREETING_MAX_WORDS);
        if (words.length === 0) return;

        const petWindow = getPetWindow();

        isBubbleInput = false;
        stopGreeting();

        greeting = { text: words.join(" ").slice(0, 80), intervalTimer: null, hideTimer: null, hovered: false };
        greeting.intervalTimer = setInterval(showGreeting, GREETING_INTERVAL);

        // il pet torna libero e la frase compare subito
        if (petWindow && !petWindow.isDestroyed()) sendPlayEvent(petWindow, { type: "cancel" });
        showGreeting();
    });

    ipcMain.on("bubble:cancel", cancelBubbleInput);

    ipcMain.on("bubble:close", () => {
        stopGreeting();
        hideBubble();
    });

    ipcMain.on("bubble:hover", (_event, hovered) => {
        if (!greeting || isBubbleInput) return;

        greeting.hovered = Boolean(hovered);
        clearTimeout(greeting.hideTimer);

        if (!greeting.hovered) {
            greeting.hideTimer = setTimeout(hideGreeting, GREETING_LEAVE_DELAY);
        }
    });
}
