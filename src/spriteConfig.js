import idle from "./assets/sprites/catgray/32x32/idle.png";
import walk from "./assets/sprites/catgray/32x32/walk.png";
import run from "./assets/sprites/catgray/32x32/run.png";
import jump from "./assets/sprites/catgray/32x32/jump.png";
import attack from "./assets/sprites/catgray/32x32/attack.png";

export const FRAME_SIZE = 32; // px del frame originale
export const SCALE = 4;       // 32 * 4 = 128px a schermo

// Verso in cui guarda lo sprite nei PNG: se cammina dall'altra parte viene rispecchiato
export const NATIVE_FACING = "right";

// Ogni PNG è una striscia orizzontale di `frames` frame da FRAME_SIZE px
// once = l'animazione gira una sola volta invece che in loop
export const sprites = {
  idle:   { src: idle,   frames: 7, fps: 6 },
  drag:   { src: idle,   frames: 7, fps: 6 },
  jump:   { src: jump,   frames: 7, fps: 12, once: true },
  walk:   { src: walk,   frames: 7, fps: 10 },
  // non ancora usati nei comportamenti
  run:    { src: run,    frames: 7, fps: 14 },
  attack: { src: attack, frames: 3, fps: 8 },
};
