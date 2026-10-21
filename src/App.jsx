import { useEffect, useRef, useState } from "react";
import { sprites, FRAME_SIZE, SCALE, NATIVE_FACING } from "./spriteConfig";

const DRAG_THRESHOLD = 4;      // px prima di considerarlo un trascinamento
const AUTO_WALK_DELAY = 10000; // ms senza eventi del mouse prima della camminata
const RESUME_WALK_DELAY = 4000; // ms dopo la fine dell'hover prima di riprendere la camminata

export default function App() {
    // idle | drag | jump | walk
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
    const isWalkPaused = useRef(false); // camminata fermata dall'hover, da riprendere

    function changeAction(next) {
        actionRef.current = next;
        setAction(next);
    }

    // Camminata automatica: parte dopo AUTO_WALK_DELAY ms senza eventi del mouse.
    // Ogni evento (e ogni fine di azione) fa ripartire il conto alla rovescia.
    function scheduleWalk() {
        clearTimeout(walkTimeout.current);

        walkTimeout.current = setTimeout(startWalk, AUTO_WALK_DELAY);
    }

    function startWalk() {
        // con il mouse fermo sopra il pet non si muove
        if (actionRef.current !== "idle" || hoverRef.current) {
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
            clearTimeout(walkTimeout.current);
            clearTimeout(jumpTimeout.current);
            clearTimeout(resumeTimeout.current);
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

        if (actionRef.current === "walk") {
            window.petAPI?.cancelWalk(false);
            isWalkPaused.current = true;
            changeAction("idle");
        }
    }

    function handleHoverEnd() {
        hoverRef.current = false;
        setIsHovered(false);

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

        // se stava camminando, si ferma dov'è
        if (actionRef.current === "walk") {
            window.petAPI?.cancelWalk(true);
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

    // click senza trascinamento: salto sul posto
    function handleClick() {
        // il click che segue un trascinamento non è un salto
        if (hasDragged.current) {
            hasDragged.current = false;
            return;
        }
        if (actionRef.current !== "idle") return;

        const { frames, fps } = sprites.jump;

        changeAction("jump");

        jumpTimeout.current = setTimeout(() => {
            changeAction("idle");
            scheduleWalk();
        }, (frames / fps) * 1000);
    }

    const sprite = sprites[action];
    const size = FRAME_SIZE * SCALE;
    // in camminata guarda dove va; negli altri stati dipende dalla metà dello schermo
    const flipped = action === "walk" ? facing !== NATIVE_FACING : onRightHalf;
    const showHeart = isHovered && action === "idle";

    return (
        <main className="pet-stage">
        <button
            type="button"
            className={`pet ${action}`}
            aria-label="Your Pixel Pet"
            title="Miao!"
            style={{ "--duration": `${sprite.frames / sprite.fps}s` }}
            onClick={handleClick}
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
            <span className={`pet-heart${onRightHalf ? " left" : ""}`} aria-hidden="true">
                ♥
            </span>
            )}
        </button>
        </main>
    );
}
