import { useEffect, useRef, useMemo } from "react";
import { gsap } from "gsap";
import { Button } from "@/components/ui/button";
import { Dice6 } from "lucide-react";

interface GiftConfig {
  id: number;
  name: string;
  description: string;
  icon: string;
  inventory: number;
}

interface GiftSplashProps {
  gift: GiftConfig;
  onClose: () => void;
  dicePosition?: [number, number, number];
}

// Convert 3D position to screen position (approximate)
function get3DToScreenPosition(pos3D: [number, number, number]): { x: number; y: number } {
  // Camera is at [0, 5, 12] with fov 45
  const cameraZ = 12;
  const cameraY = 5;
  const fov = 45;
  
  // Project 3D to 2D (simplified projection)
  const scale = cameraZ / (cameraZ - pos3D[2]);
  const screenX = (window.innerWidth / 2) + (pos3D[0] * scale * 50);
  const screenY = (window.innerHeight / 2) - ((pos3D[1] - cameraY + 5) * scale * 50);
  
  return { x: screenX, y: screenY };
}

export function GiftSplash({ gift, onClose, dicePosition }: GiftSplashProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const expandRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const hasAnimatedRef = useRef(false);

  // Calculate origin point from dice position
  const originPosition = useMemo(() => {
    if (dicePosition) {
      return get3DToScreenPosition(dicePosition);
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }, [dicePosition]);

  useEffect(() => {
    if (hasAnimatedRef.current) return;
    hasAnimatedRef.current = true;

    const tl = gsap.timeline();

    // Set initial states
    gsap.set(expandRef.current, { 
      scale: 0, 
      opacity: 1,
      left: originPosition.x,
      top: originPosition.y,
      xPercent: -50,
      yPercent: -50,
    });
    gsap.set([headerRef.current, iconRef.current, detailsRef.current, buttonRef.current], { 
      opacity: 0, 
      y: 30 
    });

    // Very slow, dramatic expanding circle
    tl.to(expandRef.current, { 
      scale: 6, 
      duration: 3.5, 
      ease: "power1.out",
    })
    // Sequential content reveal with longer delays
    .to(headerRef.current, { 
      opacity: 1, 
      y: 0,
      duration: 1, 
      ease: "power2.out" 
    }, "-=1.2")
    .to(iconRef.current, { 
      opacity: 1, 
      y: 0,
      duration: 1.2, 
      ease: "back.out(1.2)" 
    }, "-=0.4")
    .to(detailsRef.current, { 
      opacity: 1, 
      y: 0,
      duration: 0.8, 
      ease: "power2.out" 
    }, "-=0.3")
    .to(buttonRef.current, { 
      opacity: 1, 
      y: 0,
      duration: 0.8, 
      ease: "power2.out" 
    }, "-=0.2");

    return () => {
      tl.kill();
    };
  }, [originPosition]);

  const handleClose = () => {
    const tl = gsap.timeline({
      onComplete: onClose,
    });

    tl.to([buttonRef.current, detailsRef.current, iconRef.current, headerRef.current], { 
      opacity: 0, 
      y: -20,
      duration: 0.3, 
      ease: "power2.in",
      stagger: 0.05
    })
    .to(expandRef.current, { 
      scale: 0, 
      duration: 0.5, 
      ease: "power3.in" 
    }, "-=0.1");
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
    >
      {/* Expanding background circle - starts from dice */}
      <div
        ref={expandRef}
        className="absolute h-[150vmax] w-[150vmax] rounded-full bg-primary"
        style={{ transformOrigin: "center center", position: "absolute" }}
      />

      {/* Main content */}
      <div className="relative z-10 mx-6 w-full max-w-lg text-center">
        {/* Congratulations text */}
        <div ref={headerRef} className="mb-4 sm:mb-6">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1.5 sm:px-4 sm:py-2 backdrop-blur-sm">
            <Dice6 className="h-3 w-3 sm:h-4 sm:w-4 text-primary-foreground" />
            <span className="text-xs sm:text-sm font-bold uppercase tracking-[0.2em] sm:tracking-[0.25em] text-primary-foreground">
              Winner
            </span>
          </div>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-primary-foreground">
            Congratulations!
          </h2>
        </div>

        {/* Gift icon */}
        <div ref={iconRef} className="mx-auto mb-4 sm:mb-8 flex h-28 w-28 sm:h-36 sm:w-36 md:h-44 md:w-44 items-center justify-center rounded-full bg-primary-foreground/15 text-5xl sm:text-7xl md:text-8xl shadow-2xl ring-2 sm:ring-4 ring-primary-foreground/20 backdrop-blur-sm">
          {gift.icon}
        </div>

        {/* Gift details */}
        <div ref={detailsRef} className="mb-6 sm:mb-10">
          <h3 className="mb-1 sm:mb-2 text-2xl sm:text-4xl md:text-5xl font-black text-primary-foreground">
            {gift.name}
          </h3>
          <p className="text-sm sm:text-xl text-primary-foreground/70 px-4">
            {gift.description}
          </p>
        </div>

        {/* Collect button */}
        <div ref={buttonRef}>
          <Button
            onClick={handleClose}
            size="lg"
            className="group relative w-full max-w-xs sm:max-w-sm overflow-hidden rounded-full bg-primary-foreground py-5 sm:py-8 text-base sm:text-xl font-black text-primary shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 touch-manipulation"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <Dice6 className="h-5 w-5 sm:h-6 sm:w-6" />
              Claim Your Prize
            </span>
          </Button>

          <p className="mt-4 sm:mt-6 text-xs sm:text-sm font-medium text-primary-foreground/50 px-4">
            Present this screen at the registration desk
          </p>
        </div>
      </div>
    </div>
  );
}
