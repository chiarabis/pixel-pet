import { BrowserWindow, ipcMain, screen } from "electron";
import { WINDOW_SIZE } from "../shared.js";

// Salto: la finestra scorre in orizzontale per `duration` ms, in sincronia con i frame
const JUMP_DISTANCE = 40;
let jumpTimer = null;

export function stopJump() {
    clearInterval(jumpTimer);
    jumpTimer = null;
}

export function registerJump() {
    ipcMain.on("pet:jump-cancel", stopJump);

    ipcMain.on("pet:jump", (event, options) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win || win.isDestroyed()) return;

        const direction = options?.direction < 0 ? -1 : 1;
        const duration = Number(options?.duration);
        if (!Number.isFinite(duration) || duration <= 0) return;

        stopJump();

        const bounds = win.getBounds();
        const area = screen.getDisplayMatching(bounds).workArea;
        const minX = area.x;
        const maxX = area.x + area.width - WINDOW_SIZE;
        const targetX = Math.min(maxX, Math.max(minX, bounds.x + direction * JUMP_DISTANCE));

        const startedAt = Date.now();

        jumpTimer = setInterval(() => {
            if (win.isDestroyed()) return stopJump();

            const progress = Math.min(1, (Date.now() - startedAt) / duration);

            win.setBounds({
                x: Math.round(bounds.x + (targetX - bounds.x) * progress),
                y: bounds.y,
                width: WINDOW_SIZE,
                height: WINDOW_SIZE,
            });

            if (progress >= 1) stopJump();
        }, 16);
    });
}
