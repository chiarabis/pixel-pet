// Logica della modalità sveglia, senza finestre né Electron: così si può provare con orari finti.
// Una pausa è { time: "HH:MM", kind } e scatta una volta al giorno, all'ora indicata.

export const KINDS = [
    { kind: "coffee", label: "Caffè ☕", text: "Coffee break ☕" },
    { kind: "cig", label: "Sigaretta 🚬", text: "Cig break 🚬" },
    { kind: "lunch", label: "Pranzo 🍝", text: "Lunch break 🍝" },
    { kind: "custom", label: "Inserisci pausa ✏️", text: null },
];
export const DEFAULT_KIND = "coffee";
export const MAX_CUSTOM_TEXT = 24;
const CUSTOM_FALLBACK = "Break ⏰";

export const GRACE_MINUTES = 15;
export const MAX_BREAKS = 12;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value) {
    return typeof value === "string" && TIME_PATTERN.test(value);
}

export function minutesOf(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}

export function todayKey(now = new Date()) {
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${now.getFullYear()}-${month}-${day}`;
}

export function breakText(item) {
    if (item.kind === "custom") return item.text || CUSTOM_FALLBACK;

    return KINDS.find((entry) => entry.kind === item.kind)?.text ?? KINDS[0].text;
}

export function normalizeBreaks(input) {
    if (!Array.isArray(input)) return [];

    const byTime = new Map();

    for (const item of input) {
        if (!isValidTime(item?.time) || byTime.has(item.time)) continue;

        const kind = KINDS.some((entry) => entry.kind === item.kind) ? item.kind : DEFAULT_KIND;
        const normalized = { time: item.time, kind };

        if (kind === "custom") {
            const text = typeof item.text === "string" ? item.text.replace(/\s+/g, " ").trim() : "";
            normalized.text = [...text].slice(0, MAX_CUSTOM_TEXT).join("");
        }

        byTime.set(item.time, normalized);
    }

    return [...byTime.values()].sort((a, b) => minutesOf(a.time) - minutesOf(b.time)).slice(0, MAX_BREAKS);
}

export function normalizeFired(input) {
    const fired = {};

    if (input && typeof input === "object") {
        for (const [time, day] of Object.entries(input)) {
            if (isValidTime(time) && typeof day === "string") fired[time] = day;
        }
    }

    return fired;
}

export function dueBreak(now, breaks, fired) {
    const today = todayKey(now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    return (
        breaks.find((item) => {
            const late = nowMinutes - minutesOf(item.time);

            return late >= 0 && late <= GRACE_MINUTES && fired[item.time] !== today;
        }) ?? null
    );
}

export function firedAfterEdit(now, oldBreaks, oldFired, newBreaks) {
    const today = todayKey(now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const oldTimes = new Set(oldBreaks.map((item) => item.time));
    const fired = {};

    for (const item of newBreaks) {
        if (oldTimes.has(item.time) && oldFired[item.time]) {
            fired[item.time] = oldFired[item.time];
        } else if (minutesOf(item.time) <= nowMinutes) {
            fired[item.time] = today;
        }
    }

    return fired;
}
