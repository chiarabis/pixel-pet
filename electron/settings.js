import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { log } from "./log.js";

// Impostazioni dell'utente, salvate in %APPDATA%\Pixel Pet\settings.json
const DEFAULTS = { alwaysOnTop: true };

let cache = null;

function settingsPath() {
    return path.join(app.getPath("userData"), "settings.json");
}

export function getSettings() {
    if (cache) return cache;

    cache = { ...DEFAULTS };

    try {
        const saved = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));

        // si accetta solo ciò che ha il tipo giusto: un file rovinato non deve rompere l'avvio
        if (typeof saved.alwaysOnTop === "boolean") cache.alwaysOnTop = saved.alwaysOnTop;
    } catch {
        // nessun file (primo avvio) o file illeggibile: valgono i valori predefiniti
    }

    return cache;
}

export function updateSettings(patch) {
    cache = { ...getSettings(), ...patch };

    try {
        fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
        fs.writeFileSync(settingsPath(), JSON.stringify(cache, null, 2));
    } catch (error) {
        log("impostazioni non salvate:", error.message);
    }

    return cache;
}
