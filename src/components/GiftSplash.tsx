import { useEffect, useRef, useMemo } from "react";
import { gsap } from "gsap";
import { GiftConfig } from "@/lib/giftStore";
import { Button } from "@/components/ui/button";
import { Gift } from "lucide-react";

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
  const contentRef = useRef<HTMLDivElement>(null);
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
    gsap.set(contentRef.current, { opacity: 0, scale: 0.9 });

    // Slow, smooth expanding animation
    tl.to(expandRef.current, { 
      scale: 6, 
      duration: 2.5, 
      ease: "power2.out",
    })
    .to(contentRef.current, { 
      opacity: 1, 
      scale: 1,
      duration: 1.2, 
      ease: "power2.out" 
    }, "-=0.5");

    return () => {
      tl.kill();
    };
  }, [originPosition]);

  const handleClose = () => {
    const tl = gsap.timeline({
      onComplete: onClose,
    });

    tl.to(contentRef.current, { 
      scale: 0.9, 
      opacity: 0, 
      duration: 0.4, 
      ease: "power2.in" 
    })
    .to(expandRef.current, { 
      scale: 0, 
      duration: 0.5, 
      ease: "power3.in" 
    }, "-=0.2");
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
      <div
        ref={contentRef}
        className="relative z-10 mx-6 w-full max-w-lg text-center"
      >
        {/* Congratulations text */}
        <div className="mb-6">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-4 py-2 backdrop-blur-sm">
            <Gift className="h-4 w-4 text-primary-foreground" />
            <span className="text-sm font-bold uppercase tracking-[0.25em] text-primary-foreground">
              Winner
            </span>
          </div>
          <h2 className="text-4xl font-black text-primary-foreground md:text-5xl">
            Congratulations!
          </h2>
        </div>

        {/* Gift icon */}
        <div className="mx-auto mb-8 flex h-44 w-44 items-center justify-center rounded-full bg-primary-foreground/15 text-8xl shadow-2xl ring-4 ring-primary-foreground/20 backdrop-blur-sm">
          {gift.icon}
        </div>

        {/* Gift details */}
        <div className="mb-10">
          <h3 className="mb-2 text-4xl font-black text-primary-foreground md:text-5xl">
            {gift.name}
          </h3>
          <p className="text-xl text-primary-foreground/70">
            {gift.description}
          </p>
        </div>

        {/* Collect button */}
        <Button
          onClick={handleClose}
          size="lg"
          className="group relative w-full max-w-sm overflow-hidden rounded-full bg-primary-foreground py-8 text-xl font-black text-primary shadow-2xl transition-all duration-300 hover:scale-105"
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            <Gift className="h-6 w-6" />
            Collect Your Gift
          </span>
        </Button>

        <p className="mt-6 text-sm font-medium text-primary-foreground/50">
          Present this screen at the registration desk
        </p>
      </div>
    </div>
  );
}
