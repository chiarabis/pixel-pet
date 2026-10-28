import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

// Registro di Pixel Pet: un piccolo file di testo sul PC (%APPDATA%\Pixel Pet\logs\pixel-pet.log).
// Serve solo a capire cosa è successo se qualcosa non va, per esempio un pet che non compare.
// Non viene inviato da nessuna parte.
const MAX_BYTES = 200 * 1024;

export function logFilePath() {
    return path.join(app.getPath("logs"), "pixel-pet.log");
}

export function log(...parts) {
    try {
        const file = logFilePath();
        fs.mkdirSync(path.dirname(file), { recursive: true });

        // il registro resta piccolo: quando è troppo grande, il vecchio diventa .old e si riparte da zero
        try {
            if (fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, `${file}.old`);
        } catch {
            // il file non esiste ancora
        }

        const line = `${new Date().toISOString()}  ${parts.map(String).join(" ")}\n`;
        fs.appendFileSync(file, line);
    } catch {
        // il registro non deve mai far fallire l'app
    }
}
