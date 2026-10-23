import { cancelWalk } from "./walk.js";
import { stopJump } from "./jump.js";
import { cancelRun } from "./run.js";

// Ferma ogni movimento automatico del pet (camminata, salto, corsa).
// Il trascinamento ha il suo stop in drag.js.
export function haltPet() {
    cancelWalk(true);
    stopJump();
    cancelRun();
}
