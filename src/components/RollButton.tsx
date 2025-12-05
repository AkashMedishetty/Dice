import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { Dice6 } from "lucide-react";

interface RollButtonProps {
  onClick: () => void;
  disabled: boolean;
  rolling: boolean;
  showingResult?: boolean;
}

export function RollButton({ onClick, disabled, rolling, showingResult }: RollButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!buttonRef.current) return;

    if (!disabled && !rolling) {
      // Subtle pulse animation when ready
      gsap.to(buttonRef.current, {
        scale: 1.02,
        duration: 1,
        ease: "power1.inOut",
        yoyo: true,
        repeat: -1,
      });
    } else {
      gsap.killTweensOf(buttonRef.current);
      gsap.to(buttonRef.current, { scale: 1, duration: 0.3 });
    }

    return () => {
      gsap.killTweensOf(buttonRef.current);
    };
  }, [disabled, rolling]);

  useEffect(() => {
    if (rolling && iconRef.current) {
      gsap.to(iconRef.current, {
        rotation: 360,
        duration: 0.5,
        ease: "linear",
        repeat: -1,
      });
    } else if (iconRef.current) {
      gsap.killTweensOf(iconRef.current);
      gsap.to(iconRef.current, { rotation: 0, duration: 0.3 });
    }
  }, [rolling]);

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      disabled={disabled || rolling}
      className="group relative overflow-hidden rounded-full bg-primary px-12 py-6 text-xl font-bold text-primary-foreground shadow-glow transition-all duration-300 hover:shadow-elevated disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
    >
      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary-foreground/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

      <span className="relative flex items-center justify-center gap-3">
        <div ref={iconRef}>
          <Dice6 className="h-7 w-7" />
        </div>
        {rolling ? "Rolling..." : showingResult ? "Winner!" : disabled ? "No Prizes Available" : "Roll the Dice!"}
      </span>
    </button>
  );
}
