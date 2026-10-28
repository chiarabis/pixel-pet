import { useEffect, useRef, useState } from "react";
import { sprites, FRAME_SIZE, SCALE, NATIVE_FACING } from "./spriteConfig";
import heart from "./assets/sprites/cuore.png";

const DRAG_THRESHOLD = 4;      // px prima di considerarlo un trascinamento
const AUTO_WALK_DELAY = 10000; // ms senza eventi del mouse prima della camminata
const RESUME_WALK_DELAY = 4000; // ms dopo la fine dell'hover prima di riprendere la camminata
const HOVER_SCRATCH_DELAY = 6000; // ms di hover senza click dopo cui il pet graffia
const SCRATCH_CLICKS = 6;         // click di fila dopo cui il pet graffia
const CLICK_STREAK_GAP = 2000;    // ms massimi tra un click e il successivo perché contino "di fila"

export default function App() {
    // idle | drag | jump | walk | wallScratch | run | scratch
    const [action, setAction] = useState("idle");
    const [isHovered, setIsHovered] = useState(false);
    const [facing, setFacing] = useState(NATIVE_FACING);
    const [onRightHalf, setOnRightHalf] = useState(false);

    const actionRef = useRef("idle");
    const hoverRef = useRef(false);
    const pressStart = useRef({ x: 0, y: 0 });
    const isPressed = useRef(false);
    const isDragActive = useRef(false);
    const hasDragged = useRef(false);
    const jumpTimeout = useRef(null);
    const walkTimeout = useRef(null);
    const resumeTimeout = useRef(null);
    const hoverScratchTimeout = useRef(null);
    const clickStreak = useRef(0);
    const lastClickAt = useRef(0);
    const isWalkPaused = useRef(false); // camminata fermata dall'hover, da riprendere
    const isPlaySelecting = useRef(false); // "Giochiamo": si aspetta il click sullo schermo

    function changeAction(next) {
        actionRef.current = next;
        setAction(next);
    }

    // la pausa col graffio contro il bordo fa parte della camminata
    function isWalking() {
        return actionRef.current === "walk" || actionRef.current === "wallScratch";
    }

    // Camminata automatica: parte dopo AUTO_WALK_DELAY ms senza eventi del mouse.
    // Ogni evento (e ogni fine di azione) fa ripartire il conto alla rovescia.
    function scheduleWalk() {
        clearTimeout(walkTimeout.current);

        walkTimeout.current = setTimeout(startWalk, AUTO_WALK_DELAY);
    }

    function startWalk() {
        // con il mouse fermo sopra il pet non si muove
        if (actionRef.current !== "idle" || hoverRef.current || isPlaySelecting.current) {
            scheduleWalk();
            return;
        }

        const resume = isWalkPaused.current;
        isWalkPaused.current = false;
        clearTimeout(resumeTimeout.current);

        changeAction("walk");

        window.petAPI?.walk({ resume }).then((result) => {
            if (result !== "done" || actionRef.current !== "walk") return;

            setFacing(NATIVE_FACING);
            changeAction("idle");
            scheduleWalk();
        });
    }

    // Troppe carezze: il pet si stufa e graffia. Succede con il mouse fermo sopra di lui per HOVER_SCRATCH_DELAY ms senza click, oppure dopo SCRATCH_CLICKS click di fila.
    function armHoverScratch() {
        clearTimeout(hoverScratchTimeout.current);

        if (!hoverRef.current) return;

        hoverScratchTimeout.current = setTimeout(() => {
            if (hoverRef.current && actionRef.current === "idle") startScratch();
        }, HOVER_SCRATCH_DELAY);
    }

    function startScratch() {
        const { frames, fps } = sprites.scratch;

        clearTimeout(jumpTimeout.current); // usato anche come timer di fine azione per il graffio
        clearTimeout(hoverScratchTimeout.current);
        clickStreak.current = 0;

        window.petAPI?.cancelJump?.();
        changeAction("scratch");

        jumpTimeout.current = setTimeout(() => {
            changeAction("idle");
            scheduleWalk();
            armHoverScratch();
        }, (frames / fps) * 1000);
    }

    // Trascinamento e inattività si seguono a livello di window, non sul bottone:
    // la finestra si muove sotto il cursore e il pointer capture da solo non è affidabile.
    useEffect(() => {
        function endPress() {
            isPressed.current = false;

            if (!isDragActive.current) return;

            isDragActive.current = false;
            window.petAPI?.stopDrag();
            changeAction("idle");
            scheduleWalk();
            armHoverScratch();
        }

        function handleMove(event) {
            scheduleWalk();

            if (!isPressed.current) return;

            // tasto già rilasciato ma evento di rilascio perso
            if (event.buttons === 0) {
                endPress();
                return;
            }

            if (isDragActive.current) return;

            const dx = event.screenX - pressStart.current.x;
            const dy = event.screenY - pressStart.current.y;

            // il drag parte solo dopo qualche pixel di movimento
            if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

            isDragActive.current = true;
            hasDragged.current = true;
            clearTimeout(jumpTimeout.current);
            changeAction("drag");
            window.petAPI?.startDrag();
        }

        const offWalkDirection = window.petAPI?.onWalkDirection?.(setFacing);

        // il main ferma la camminata a un bordo per graffiare (a volte), poi la fa ripartire
        const offWalkScratch = window.petAPI?.onWalkScratch?.(({ active }) => {
            if (active && actionRef.current === "walk") changeAction("wallScratch");
            else if (!active && actionRef.current === "wallScratch") changeAction("walk");
        });

        // "Giochiamo" dal menu: il main avvisa quando aspetta il click, quando il pet corre e quando arriva
        const offPlay = window.petAPI?.onPlay?.((event) => {
            if (event.type === "select") {
                isPlaySelecting.current = true;
                isWalkPaused.current = false;
                clearTimeout(resumeTimeout.current);
                clearTimeout(jumpTimeout.current);
                if (actionRef.current !== "idle") changeAction("idle");
            } else if (event.type === "run") {
                isPlaySelecting.current = false;
                clearTimeout(walkTimeout.current);
                clearTimeout(jumpTimeout.current);
                setFacing(event.direction > 0 ? "right" : "left");
                changeAction("run");
            } else {
                // "end" a corsa finita, "cancel" se l'overlay è stato chiuso senza scegliere
                isPlaySelecting.current = false;
                setFacing(NATIVE_FACING);
                changeAction("idle");
                scheduleWalk();
            }
        });

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", endPress);
        window.addEventListener("pointercancel", endPress);
        window.addEventListener("mouseup", endPress);
        window.addEventListener("blur", endPress);

        scheduleWalk();

        return () => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", endPress);
            window.removeEventListener("pointercancel", endPress);
            window.removeEventListener("mouseup", endPress);
            window.removeEventListener("blur", endPress);
            offWalkDirection?.();
            offWalkScratch?.();
            offPlay?.();
            clearTimeout(walkTimeout.current);
            clearTimeout(jumpTimeout.current);
            clearTimeout(resumeTimeout.current);
            clearTimeout(hoverScratchTimeout.current);
            window.petAPI?.cancelWalk(true);
            window.petAPI?.stopDrag();
        };
    }, []);

    // Metà schermo in cui si trova il pet: a destra gli sprite sono specchiati.
    // window.screenX segue la finestra anche durante drag e camminata.
    useEffect(() => {
        function updateHalf() {
            const { availLeft = 0, availWidth } = window.screen;
            const centerX = window.screenX + window.innerWidth / 2;

            setOnRightHalf(centerX - availLeft > availWidth / 2);
        }

        updateHalf();
        const interval = setInterval(updateHalf, 100);

        return () => clearInterval(interval);
    }, []);

    // Hover durante la camminata: il pet si ferma dov'è e passa a idle (col cuoricino).
    // Dopo RESUME_WALK_DELAY ms dalla fine dell'hover riprende da lì.
    function handleHoverStart() {
        hoverRef.current = true;
        setIsHovered(true);
        clearTimeout(resumeTimeout.current);

        if (isWalking()) {
            window.petAPI?.cancelWalk(false);
            isWalkPaused.current = true;
            changeAction("idle");
        }

        armHoverScratch();
    }

    function handleHoverEnd() {
        hoverRef.current = false;
        setIsHovered(false);
        clearTimeout(hoverScratchTimeout.current);

        if (isWalkPaused.current) {
            clearTimeout(resumeTimeout.current);
            resumeTimeout.current = setTimeout(startWalk, RESUME_WALK_DELAY);
        }
    }

    function handlePointerDown(event) {
        if (event.button !== 0) return;

        event.preventDefault();

        // con un click o un drag la camminata in pausa non riprende più
        isWalkPaused.current = false;
        clearTimeout(resumeTimeout.current);

        // se stava camminando o correndo, si ferma dov'è
        if (isWalking()) {
            window.petAPI?.cancelWalk(true);
            setFacing(NATIVE_FACING);
            changeAction("idle");
        } else if (actionRef.current === "run") {
            window.petAPI?.cancelRun();
            setFacing(NATIVE_FACING);
            changeAction("idle");
        }

        pressStart.current = {
            x: event.screenX,
            y: event.screenY,
        };

        isPressed.current = true;
        hasDragged.current = false;
    }

    // tasto destro: apre il menu nativo (costruito nel main)
    function handleContextMenu(event) {
        event.preventDefault();

        isWalkPaused.current = false;
        clearTimeout(resumeTimeout.current);

        // se stava camminando, si ferma dov'è
        if (isWalking()) {
            window.petAPI?.cancelWalk(true);
            changeAction("idle");
        } else if (actionRef.current === "run") {
            window.petAPI?.cancelRun();
            setFacing(NATIVE_FACING);
            changeAction("idle");
        }

        window.petAPI?.showMenu?.();
    }

    // click senza trascinamento: salto in avanti
    function handleClick() {
        // il click che segue un trascinamento non è un salto
        if (hasDragged.current) {
            hasDragged.current = false;
            return;
        }
        // mentre graffia i click non contano
        if (actionRef.current === "scratch") return;

        // ogni click riparte il conto dell'hover; molti click di fila fanno graffiare il pet
        armHoverScratch();

        const now = Date.now();
        clickStreak.current = now - lastClickAt.current <= CLICK_STREAK_GAP ? clickStreak.current + 1 : 1;
        lastClickAt.current = now;

        if (clickStreak.current >= SCRATCH_CLICKS) {
            startScratch();
            return;
        }

        if (actionRef.current !== "idle") return;

        const { frames, fps } = sprites.jump;
        const duration = (frames / fps) * 1000;

        // salta in avanti, cioè nel verso in cui guarda lo sprite (specchiato nella metà destra)
        const forward = NATIVE_FACING === "right" ? 1 : -1;
        const direction = onRightHalf ? -forward : forward;

        changeAction("jump");
        window.petAPI?.jump?.({ direction, duration });

        jumpTimeout.current = setTimeout(() => {
            changeAction("idle");
            scheduleWalk();
        }, duration);
    }


    const sprite = sprites[action];
    const size = FRAME_SIZE * SCALE;
    // in camminata guarda dove va; negli altri stati dipende dalla metà dello schermo
    // (contro il muro guarda il muro, cioè dove stava andando)
    const isTravelling = action === "walk" || action === "wallScratch" || action === "run";
    const flipped = isTravelling ? facing !== NATIVE_FACING : onRightHalf;
    const showHeart = isHovered && action === "idle";

    // Comunica al main dove sta lo sprite nella finestra e se è specchiato (il fumetto ci allinea la punta).
    // Si rimisura a ogni cambio di stato o di specchio, perché lo sprite viene ricreato.
    useEffect(() => {
        const element = document.querySelector(".sprite");
        if (!element) return;

        const rect = element.getBoundingClientRect();

        window.petAPI?.setSpriteLayout?.({
            left: rect.left,
            top: rect.top,
            size: rect.width,
            flipped,
        });
    }, [action, flipped]);

    return (
        <main className="pet-stage">
        <button
            type="button"
            className={`pet ${action}`}
            aria-label="Your Pixel Pet"
            title="Miao!"
            style={{ "--duration": `${sprite.frames / sprite.fps}s` }}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            onPointerDown={handlePointerDown}
            onPointerEnter={handleHoverStart}
            onPointerMove={() => {
                if (!hoverRef.current) handleHoverStart();
            }}
            onPointerLeave={handleHoverEnd}>

            <span
                key={action}
                className={`sprite${flipped ? " flip" : ""}${sprite.once ? " once" : ""}`}
                aria-hidden="true"
                style={{
                    "--src": `url(${sprite.src})`,
                    "--frames": sprite.frames,
                    "--duration": `${sprite.frames / sprite.fps}s`,
                    "--size": `${size}px`,
                    "--sheet": `${size * sprite.frames}px`,
                }}
            />
            {showHeart && (
                <img
                    src={heart}
                    className={`pet-heart${onRightHalf ? " left" : ""}`}
                    alt="Heart"
                    aria-hidden="true"
                    draggable={false}
                />
            )}
        </button>
        </main>
    );
}
