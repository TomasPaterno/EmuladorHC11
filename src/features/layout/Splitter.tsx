import { useEffect, useRef, useState } from "react";

interface SplitterProps {
  onResize: (newPercent: number) => void;
  onReset?: () => void;
}

export function Splitter({ onResize, onReset }: SplitterProps) {
  const [isDragging, setIsDragging] = useState(false);
  const splitterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    function handlePointerMove(e: PointerEvent) {
      const parent = splitterRef.current?.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const rawPercent = (relativeX / rect.width) * 100;
      // Clamp between 20% and 65%
      const clampedPercent = Math.min(65, Math.max(20, rawPercent));
      onResize(clampedPercent);
    }

    function handlePointerUp() {
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging, onResize]);

  return (
    <div
      ref={splitterRef}
      role="separator"
      aria-orientation="vertical"
      aria-label="Ajustar ancho del visor de archivo"
      tabIndex={0}
      onPointerDown={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDoubleClick={() => onReset?.()}
      className={`relative hidden lg:flex w-2 shrink-0 items-center justify-center cursor-col-resize group transition-colors select-none ${
        isDragging ? "bg-amber-400/80" : "hover:bg-amber-400/40"
      }`}
      title="Arrastre para ajustar ancho. Doble clic para restablecer."
    >
      <div
        className={`h-8 w-1 rounded-full transition-colors ${
          isDragging ? "bg-slate-950" : "bg-slate-700 group-hover:bg-amber-300"
        }`}
      />
    </div>
  );
}
