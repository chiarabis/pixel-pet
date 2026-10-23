import { ipcMain, screen } from "electron";
import { WINDOW_SIZE, sendPlayEvent } from "../shared.js";

// Corsa verso un punto dello schermo (usata da "Giochiamo")
const RUN_SPEED = 500; // px al secondo
let currentRun = null;

export function cancelRun() {
    if (currentRun) currentRun.cancelled = true;
    currentRun = null;
}

export function runTo(win, point) {
    // il centro della finestra (e quindi del pet) arriva sul punto cliccato
    const area = screen.getDisplayNearestPoint(point).workArea;
    const targetX = Math.min(area.x + area.width - WINDOW_SIZE, Math.max(area.x, Math.round(point.x - WINDOW_SIZE / 2)));
    const targetY = Math.min(area.y + area.height - WINDOW_SIZE, Math.max(area.y, Math.round(point.y - WINDOW_SIZE / 2)));

    const start = win.getBounds();
    const dx = targetX - start.x;
    const dy = targetY - start.y;
    const distance = Math.hypot(dx, dy);

    if (distance < 2) return sendPlayEvent(win, { type: "cancel" });

    const run = { cancelled: false };
    currentRun = run;

    sendPlayEvent(win, { type: "run", direction: dx < 0 ? -1 : 1 });

    const duration = (distance / RUN_SPEED) * 1000;
    const startedAt = Date.now();

    const timer = setInterval(() => {
        if (run.cancelled || win.isDestroyed()) return clearInterval(timer);

        const progress = Math.min(1, (Date.now() - startedAt) / duration);

        win.setBounds({
            x: Math.round(start.x + dx * progress),
            y: Math.round(start.y + dy * progress),
            width: WINDOW_SIZE,
            height: WINDOW_SIZE,
        });

        if (progress >= 1) {
            clearInterval(timer);
            if (currentRun === run) currentRun = null;
            sendPlayEvent(win, { type: "end" });
        }
    }, 16);
}

export function registerRun() {
    ipcMain.on("pet:run-cancel", cancelRun);
}
