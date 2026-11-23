import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { log } from "./log.js";
import { normalizeBreaks, normalizeFired } from "./alarm/schedule.js";

// Impostazioni dell'utente, salvate in %APPDATA%\Pixel Pet\settings.json
// alarm: modalità sveglia (acceso/spento, pause "HH:MM" e giorno in cui ognuna è già scattata)
const DEFAULTS = { alwaysOnTop: true, alarm: { enabled: false, breaks: [], fired: {} } };

let cache = null;

function settingsPath() {
    return path.join(app.getPath("userData"), "settings.json");
}

export function getSettings() {
    if (cache) return cache;

    cache = { ...DEFAULTS, alarm: { ...DEFAULTS.alarm } };

    try {
        const saved = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));

        // si accetta solo ciò che ha il tipo giusto: un file rovinato non deve rompere l'avvio
        if (typeof saved.alwaysOnTop === "boolean") cache.alwaysOnTop = saved.alwaysOnTop;

        if (saved.alarm && typeof saved.alarm === "object") {
            cache.alarm = {
                enabled: saved.alarm.enabled === true,
                breaks: normalizeBreaks(saved.alarm.breaks),
                fired: normalizeFired(saved.alarm.fired),
            };
        }
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
