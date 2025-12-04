import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { GiftConfig } from "@/lib/giftStore";
import { Button } from "@/components/ui/button";
import { Sparkles, Gift, Star } from "lucide-react";

interface GiftSplashProps {
  gift: GiftConfig;
  onClose: () => void;
}

export function GiftSplash({ gift, onClose }: GiftSplashProps) {
  const [phase, setPhase] = useState<"expanding" | "content" | "ready">("expanding");
  const containerRef = useRef<HTMLDivElement>(null);
  const expandRef = useRef<HTMLDivElement>(null);
  const ringsRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const giftNameRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const tl = gsap.timeline();

    // Set initial states
    gsap.set(expandRef.current, { 
      scale: 0, 
      opacity: 1,
    });
    gsap.set(ringsRef.current, { opacity: 0, scale: 0.5 });

    // Dramatic expanding animation
    tl.to(expandRef.current, { 
      scale: 4, 
      duration: 1.2, 
      ease: "power3.out",
    })
    .to(ringsRef.current, {
      opacity: 1,
      scale: 1,
      duration: 0.8,
      ease: "power2.out"
    }, "-=0.6")
    .call(() => setPhase("content"));

    return () => {
      tl.kill();
    };
  }, []);

  useEffect(() => {
    if (phase !== "content") return;

    const tl = gsap.timeline({
      onComplete: () => setPhase("ready")
    });

    // Set initial states for content
    gsap.set(contentRef.current, { opacity: 0 });
    gsap.set(iconRef.current, { scale: 0, rotation: -360, y: 50 });
    gsap.set(titleRef.current, { y: 40, opacity: 0 });
    gsap.set(giftNameRef.current, { y: 30, opacity: 0, scale: 0.9 });
    gsap.set(buttonRef.current, { y: 30, opacity: 0 });

    // Dramatic content reveal
    tl.to(contentRef.current, { 
      opacity: 1, 
      duration: 0.4, 
      ease: "power2.out" 
    })
    .to(iconRef.current, { 
      scale: 1, 
      rotation: 0,
      y: 0,
      duration: 1, 
      ease: "elastic.out(1, 0.6)" 
    }, "-=0.2")
    .to(titleRef.current, { 
      y: 0, 
      opacity: 1, 
      duration: 0.6, 
      ease: "power3.out" 
    }, "-=0.6")
    .to(giftNameRef.current, { 
      y: 0, 
      opacity: 1, 
      scale: 1,
      duration: 0.6, 
      ease: "back.out(1.5)" 
    }, "-=0.4")
    .to(buttonRef.current, { 
      y: 0, 
      opacity: 1, 
      duration: 0.5, 
      ease: "power2.out" 
    }, "-=0.2");

    // Continuous floating for icon
    gsap.to(iconRef.current, {
      y: -20,
      duration: 2.5,
      ease: "power1.inOut",
      yoyo: true,
      repeat: -1,
      delay: 1
    });

    return () => {
      tl.kill();
    };
  }, [phase]);

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
    .to(ringsRef.current, {
      scale: 0.5,
      opacity: 0,
      duration: 0.3
    }, "-=0.2")
    .to(expandRef.current, { 
      scale: 0, 
      duration: 0.6, 
      ease: "power3.in" 
    }, "-=0.2");
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
    >
      {/* Expanding background circle */}
      <div
        ref={expandRef}
        className="absolute h-[150vmax] w-[150vmax] rounded-full bg-primary"
        style={{ transformOrigin: "center center" }}
      />

      {/* Animated rings */}
      <div ref={ringsRef} className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="absolute h-[300px] w-[300px] rounded-full border-2 border-primary-foreground/10 animate-ping" style={{ animationDuration: "3s" }} />
        <div className="absolute h-[450px] w-[450px] rounded-full border border-primary-foreground/5 animate-ping" style={{ animationDuration: "4s", animationDelay: "0.5s" }} />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-pulse"
            style={{
              left: `${10 + Math.random() * 80}%`,
              top: `${10 + Math.random() * 80}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
          >
            {i % 3 === 0 ? (
              <Star className="h-4 w-4 text-primary-foreground/30" fill="currentColor" />
            ) : i % 3 === 1 ? (
              <Sparkles className="h-5 w-5 text-primary-foreground/20" />
            ) : (
              <div className="h-2 w-2 rounded-full bg-primary-foreground/20" />
            )}
          </div>
        ))}
      </div>

      {/* Main content */}
      <div
        ref={contentRef}
        className="relative z-10 mx-6 w-full max-w-lg text-center"
      >
        {/* Congratulations text */}
        <div 
          ref={titleRef}
          className="mb-6"
        >
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
        <div
          ref={iconRef}
          className="mx-auto mb-8 flex h-44 w-44 items-center justify-center rounded-full bg-primary-foreground/15 text-8xl shadow-2xl ring-4 ring-primary-foreground/20 backdrop-blur-sm"
        >
          {gift.icon}
        </div>

        {/* Gift details */}
        <div ref={giftNameRef} className="mb-10">
          <h3 className="mb-2 text-4xl font-black text-primary-foreground md:text-5xl">
            {gift.name}
          </h3>
          <p className="text-xl text-primary-foreground/70">
            {gift.description}
          </p>
        </div>

        {/* Collect button */}
        <Button
          ref={buttonRef}
          onClick={handleClose}
          size="lg"
          className="group relative w-full max-w-sm overflow-hidden rounded-full bg-primary-foreground py-8 text-xl font-black text-primary shadow-2xl transition-all duration-300 hover:scale-105"
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            <Gift className="h-6 w-6" />
            Collect Your Gift
          </span>
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        </Button>

        <p className="mt-6 text-sm font-medium text-primary-foreground/50">
          Present this screen at the registration desk
        </p>
      </div>
    </div>
  );
}
