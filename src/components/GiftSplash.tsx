import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { GiftConfig } from "@/lib/giftStore";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface GiftSplashProps {
  gift: GiftConfig;
  onClose: () => void;
}

export function GiftSplash({ gift, onClose }: GiftSplashProps) {
  const [showContent, setShowContent] = useState(false);
  const expandRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const tl = gsap.timeline();

    // Initial states
    gsap.set(expandRef.current, { 
      scale: 0, 
      opacity: 1,
      borderRadius: "50%"
    });

    // Expanding circle animation
    tl.to(expandRef.current, { 
      scale: 3, 
      duration: 0.8, 
      ease: "power2.out",
      onComplete: () => setShowContent(true)
    });

    return () => {
      tl.kill();
    };
  }, []);

  useEffect(() => {
    if (!showContent) return;

    const tl = gsap.timeline();

    // Set initial states for content
    gsap.set(contentRef.current, { opacity: 0, y: 30 });
    gsap.set(iconRef.current, { scale: 0, rotation: -180 });
    gsap.set(textRef.current, { y: 30, opacity: 0 });
    gsap.set(buttonRef.current, { y: 20, opacity: 0 });

    // Animate content in
    tl.to(contentRef.current, { 
      opacity: 1, 
      y: 0, 
      duration: 0.5, 
      ease: "power2.out" 
    })
    .to(iconRef.current, { 
      scale: 1, 
      rotation: 0, 
      duration: 0.7, 
      ease: "elastic.out(1, 0.5)" 
    }, "-=0.2")
    .to(textRef.current, { 
      y: 0, 
      opacity: 1, 
      duration: 0.5, 
      ease: "power2.out" 
    }, "-=0.4")
    .to(buttonRef.current, { 
      y: 0, 
      opacity: 1, 
      duration: 0.5, 
      ease: "power2.out" 
    }, "-=0.3");

    // Floating animation for icon
    gsap.to(iconRef.current, {
      y: -15,
      duration: 2,
      ease: "power1.inOut",
      yoyo: true,
      repeat: -1,
    });

    return () => {
      tl.kill();
    };
  }, [showContent]);

  const handleClose = () => {
    const tl = gsap.timeline({
      onComplete: onClose,
    });

    tl.to(contentRef.current, { 
      scale: 0.95, 
      opacity: 0, 
      duration: 0.3, 
      ease: "power2.in" 
    })
    .to(expandRef.current, { 
      scale: 0, 
      duration: 0.5, 
      ease: "power2.in" 
    }, "-=0.1");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Expanding background */}
      <div
        ref={expandRef}
        className="absolute h-[200vmax] w-[200vmax] bg-primary"
        style={{ 
          transformOrigin: "center center",
        }}
      />

      {/* Content */}
      {showContent && (
        <div
          ref={contentRef}
          className="relative z-10 mx-4 w-full max-w-md text-center"
        >
          {/* Decorative sparkles */}
          <div className="absolute -left-8 -top-8 animate-pulse">
            <Sparkles className="h-10 w-10 text-primary-foreground/50" />
          </div>
          <div className="absolute -right-8 -top-8 animate-pulse" style={{ animationDelay: "0.5s" }}>
            <Sparkles className="h-10 w-10 text-primary-foreground/50" />
          </div>

          <div className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-primary-foreground/70">
            Congratulations!
          </div>

          <h2 className="mb-8 text-3xl font-bold text-primary-foreground">
            You Won
          </h2>

          <div
            ref={iconRef}
            className="mx-auto mb-8 flex h-40 w-40 items-center justify-center rounded-full bg-primary-foreground/20 text-7xl shadow-2xl backdrop-blur-sm"
          >
            {gift.icon}
          </div>

          <div ref={textRef}>
            <h3 className="mb-3 text-4xl font-bold text-primary-foreground">
              {gift.name}
            </h3>
            <p className="mb-10 text-xl text-primary-foreground/80">
              {gift.description}
            </p>
          </div>

          <Button
            ref={buttonRef}
            onClick={handleClose}
            size="lg"
            className="w-full max-w-xs rounded-full bg-primary-foreground py-7 text-lg font-bold text-primary shadow-xl transition-all hover:scale-105 hover:bg-primary-foreground/90"
          >
            Collect Your Gift
          </Button>

          <p className="mt-6 text-sm text-primary-foreground/60">
            Show this screen at the registration desk
          </p>
        </div>
      )}
    </div>
  );
}
