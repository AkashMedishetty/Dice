import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { GiftConfig } from "@/lib/giftStore";
import { Button } from "@/components/ui/button";
import { Sparkles, PartyPopper } from "lucide-react";

interface GiftSplashProps {
  gift: GiftConfig;
  onClose: () => void;
}

export function GiftSplash({ gift, onClose }: GiftSplashProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const tl = gsap.timeline();

    // Initial states
    gsap.set(containerRef.current, { opacity: 0 });
    gsap.set(contentRef.current, { scale: 0.8, opacity: 0 });
    gsap.set(iconRef.current, { scale: 0, rotation: -180 });
    gsap.set(textRef.current, { y: 30, opacity: 0 });
    gsap.set(buttonRef.current, { y: 20, opacity: 0 });

    // Animation sequence
    tl.to(containerRef.current, { opacity: 1, duration: 0.3, ease: "power2.out" })
      .to(contentRef.current, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.7)" })
      .to(iconRef.current, { scale: 1, rotation: 0, duration: 0.6, ease: "elastic.out(1, 0.5)" }, "-=0.3")
      .to(textRef.current, { y: 0, opacity: 1, duration: 0.4, ease: "power2.out" }, "-=0.3")
      .to(buttonRef.current, { y: 0, opacity: 1, duration: 0.4, ease: "power2.out" }, "-=0.2");

    // Continuous subtle animations
    gsap.to(iconRef.current, {
      y: -10,
      duration: 1.5,
      ease: "power1.inOut",
      yoyo: true,
      repeat: -1,
    });

    return () => {
      tl.kill();
    };
  }, []);

  const handleClose = () => {
    const tl = gsap.timeline({
      onComplete: onClose,
    });

    tl.to(contentRef.current, { scale: 0.9, opacity: 0, duration: 0.3, ease: "power2.in" })
      .to(containerRef.current, { opacity: 0, duration: 0.2 }, "-=0.1");
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 backdrop-blur-md"
    >
      <div
        ref={contentRef}
        className="relative mx-4 w-full max-w-md rounded-3xl bg-card p-8 text-center shadow-elevated"
      >
        {/* Decorative elements */}
        <div className="absolute -left-4 -top-4 text-primary opacity-50">
          <Sparkles className="h-8 w-8" />
        </div>
        <div className="absolute -right-4 -top-4 text-primary opacity-50">
          <PartyPopper className="h-8 w-8" />
        </div>

        {/* Glow effect */}
        <div className="absolute inset-0 -z-10 rounded-3xl gradient-glow opacity-50" />

        <div className="mb-2 text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Congratulations!
        </div>

        <h2 className="mb-6 text-2xl font-bold text-foreground">You Won</h2>

        <div
          ref={iconRef}
          className="mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-primary text-6xl shadow-glow"
        >
          {gift.icon}
        </div>

        <div ref={textRef}>
          <h3 className="mb-2 text-3xl font-bold text-foreground">{gift.name}</h3>
          <p className="mb-8 text-lg text-muted-foreground">{gift.description}</p>
        </div>

        <Button
          ref={buttonRef}
          onClick={handleClose}
          size="lg"
          className="w-full rounded-full bg-primary py-6 text-lg font-semibold text-primary-foreground transition-all hover:scale-105 hover:shadow-glow"
        >
          Collect Your Gift
        </Button>

        <p className="mt-4 text-xs text-muted-foreground">
          Show this screen at the registration desk
        </p>
      </div>
    </div>
  );
}
