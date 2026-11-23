// Logica della modalità sveglia, senza finestre né Electron: così si può provare con orari finti.
// Una pausa è { time: "HH:MM", kind } e scatta una volta al giorno, all'ora indicata.

// Tipi di pausa: per ora solo il caffè, ma il testo dipende dal tipo così se ne aggiungono altri
export const BREAK_TEXT = {
    coffee: "Coffee break ☕",
};
export const DEFAULT_KIND = "coffee";

// Se il PC era spento o in sospensione, la pausa parte comunque se l'ora è passata da poco
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

// Giorno di oggi nel fuso del PC, per esempio "2026-11-19"
export function todayKey(now = new Date()) {
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${now.getFullYear()}-${month}-${day}`;
}

// Tiene solo le pause valide, senza orari doppi, in ordine di ora
export function normalizeBreaks(input) {
    if (!Array.isArray(input)) return [];

    const byTime = new Map();

    for (const item of input) {
        if (!isValidTime(item?.time) || byTime.has(item.time)) continue;

        const kind = item.kind in BREAK_TEXT ? item.kind : DEFAULT_KIND;
        byTime.set(item.time, { time: item.time, kind });
    }

    return [...byTime.values()].sort((a, b) => minutesOf(a.time) - minutesOf(b.time)).slice(0, MAX_BREAKS);
}

// `fired` ricorda l'ultimo giorno in cui ogni orario è già scattato: { "12:30": "2026-11-19" }
export function normalizeFired(input) {
    const fired = {};

    if (input && typeof input === "object") {
        for (const [time, day] of Object.entries(input)) {
            if (isValidTime(time) && typeof day === "string") fired[time] = day;
        }
    }

    return fired;
}

// La pausa da far scattare adesso, oppure null: l'ora è arrivata, non è passata da più di GRACE_MINUTES
// e oggi non è ancora scattata.
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

// Quando l'utente cambia gli orari: quelli già passati oggi non devono scattare subito,
// e di quelli tolti si dimentica lo stato. Gli orari rimasti uguali tengono il loro.
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
