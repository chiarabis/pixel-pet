import { BrowserWindow, ipcMain, screen } from "electron";
import { WINDOW_SIZE } from "../shared.js";

// Camminata automatica
const WALK_SPEED = 150;
const WALL_SCRATCH_CHANCE = 0.35; // probabilità di graffiare ogni volta che arriva a un bordo
const WALL_SCRATCH_MS = 1000;     // quanto dura la pausa con il graffio
let currentWalk = null;
let pausedRoute = null;

// Aspetta `ms` millisecondi, ma si sblocca subito se la camminata viene annullata
function waitUnlessCancelled(walk, ms) {
    return new Promise((resolve) => {
        const startedAt = Date.now();

        const timer = setInterval(() => {
            if (walk.cancelled || Date.now() - startedAt >= ms) {
                clearInterval(timer);
                resolve();
            }
        }, 50);
    });
}

// discard = true: la camminata è finita per sempre; false: può essere ripresa
export function cancelWalk(discard = false) {
    if (!currentWalk) return;
    currentWalk.cancelled = true;
    currentWalk.discard = discard;
}

// Sposta la finestra da `fromX` a `toX` (y fissa); risolve con la x raggiunta
function walkTo(win, walk, fromX, toX, y) {
    return new Promise((resolve) => {
        const direction = toX > fromX ? 1 : -1;
        let x = fromX;
        let last = Date.now();

        const timer = setInterval(() => {
            if (walk.cancelled || win.isDestroyed()) {
                clearInterval(timer);
                return resolve(x);
            }

            const now = Date.now();
            x += direction * WALK_SPEED * ((now - last) / 1000);
            last = now;

            const arrived = direction > 0 ? x >= toX : x <= toX;
            if (arrived) x = toX;

            win.setBounds({
                x: Math.round(x),
                y,
                width: WINDOW_SIZE,
                height: WINDOW_SIZE,
            });

            if (arrived) {
                clearInterval(timer);
                resolve(x);
            }
        }, 16);
    });
}

export function registerWalk() {
    // resume = true: riparte dalle tappe rimaste di una camminata in pausa, dalla posizione attuale
    ipcMain.handle("pet:walk", async (event, options) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win || win.isDestroyed()) return "cancelled";

        cancelWalk(true);

        const walk = { cancelled: false, discard: false };
        currentWalk = walk;

        const bounds = win.getBounds();
        let remaining;

        if (options?.resume && pausedRoute) {
            remaining = pausedRoute;
        } else {
            const area = screen.getDisplayMatching(bounds).workArea;
            const minX = area.x;
            const maxX = area.x + area.width - WINDOW_SIZE;

            // due attraversamenti dello schermo (destra→sinistra→destra), poi ritorno al punto di partenza
            remaining = [maxX, minX, maxX, bounds.x];
        }
        pausedRoute = null;

        let x = bounds.x;
        while (remaining.length > 0) {
            const target = remaining[0];

            if (target !== x) {
                event.sender.send("pet:walk-direction", target > x ? "right" : "left");
                x = await walkTo(win, walk, x, target, bounds.y);

                if (walk.cancelled || win.isDestroyed()) break;

                // ogni tanto, arrivato a un bordo da cui tornerà indietro, si ferma a graffiare il "muro".
                // L'ultima tappa (il ritorno al punto di partenza) non è un bordo.
                if (remaining.length > 1 && Math.random() < WALL_SCRATCH_CHANCE) {
                    event.sender.send("pet:walk-scratch", { active: true });
                    await waitUnlessCancelled(walk, WALL_SCRATCH_MS);
                    if (!event.sender.isDestroyed()) event.sender.send("pet:walk-scratch", { active: false });

                    if (walk.cancelled || win.isDestroyed()) break;
                }
            }

            remaining.shift();
        }

        const done = !walk.cancelled && !win.isDestroyed();

        if (currentWalk === walk) {
            currentWalk = null;
            if (!done && !walk.discard) pausedRoute = remaining;
        }

        return done ? "done" : "cancelled";
    });

    ipcMain.on("pet:walk-cancel", (_event, discard) => cancelWalk(Boolean(discard)));
}
