import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { Dice3D } from "@/components/Dice3D";
import { RollButton } from "@/components/RollButton";
import { GiftSplash } from "@/components/GiftSplash";
import { InventoryStatus } from "@/components/InventoryStatus";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ParticleBackground } from "@/components/ParticleBackground";
import { useTheme } from "@/hooks/useTheme";
import {
  GiftConfig,
  getGifts,
  getActiveGiftIds,
  getGiftById,
  decrementGiftInventory,
  hasAnyInventory,
} from "@/lib/giftStore";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Index() {
  const { theme, toggleTheme } = useTheme();
  const [gifts, setGifts] = useState<GiftConfig[]>(getGifts());
  const [rolling, setRolling] = useState(false);
  const [targetFace, setTargetFace] = useState(1);
  const [wonGift, setWonGift] = useState<GiftConfig | null>(null);
  const [canRoll, setCanRoll] = useState(hasAnyInventory());

  useEffect(() => {
    setGifts(getGifts());
    setCanRoll(hasAnyInventory());
  }, []);

  const handleRoll = useCallback(() => {
    const activeIds = getActiveGiftIds();
    if (activeIds.length === 0) {
      setCanRoll(false);
      return;
    }

    // Pick a random active gift
    const randomIndex = Math.floor(Math.random() * activeIds.length);
    const selectedGiftId = activeIds[randomIndex];

    setTargetFace(selectedGiftId);
    setRolling(true);
  }, []);

  const handleRollComplete = useCallback(() => {
    const gift = getGiftById(targetFace);
    if (gift) {
      // Decrement inventory
      const updatedGifts = decrementGiftInventory(targetFace);
      setGifts(updatedGifts);
      setWonGift(gift);
      setCanRoll(hasAnyInventory());
    }
    setRolling(false);
  }, [targetFace]);

  const handleSplashClose = () => {
    setWonGift(null);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <ParticleBackground />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gift Dice</h1>
          <p className="text-sm text-muted-foreground">Roll to win!</p>
        </div>
        <div className="flex items-center gap-2">
          <InventoryStatus gifts={gifts} />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <Link to="/admin">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Settings className="h-5 w-5" />
              <span className="sr-only">Admin Settings</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 py-12">
        <div className="mb-6 text-center">
          <h2 className="mb-2 text-4xl font-bold text-primary md:text-5xl lg:text-6xl">
            Roll Your Luck
          </h2>
          <p className="text-lg text-muted-foreground md:text-xl">
            Tap the button below to discover your prize
          </p>
        </div>

        {/* 3D Dice */}
        <div className="mb-8 w-full max-w-lg">
          <Dice3D
            rolling={rolling}
            targetFace={targetFace}
            onRollComplete={handleRollComplete}
            isDark={theme === "dark"}
          />
        </div>

        {/* Roll Button */}
        <RollButton
          onClick={handleRoll}
          disabled={!canRoll}
          rolling={rolling}
        />

        {!canRoll && (
          <p className="mt-6 rounded-full bg-destructive/10 px-6 py-2 text-center text-sm font-medium text-destructive">
            All gifts have been claimed! Check back later or contact an administrator.
          </p>
        )}
      </main>

      {/* Gift Cards Preview */}
      <section className="relative z-10 px-6 pb-12">
        <div className="mx-auto max-w-4xl">
          <h3 className="mb-6 text-center text-xl font-semibold text-foreground">
            Available Prizes
          </h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {gifts.map((gift) => (
              <div
                key={gift.id}
                className={`rounded-2xl border border-border/50 bg-card/50 p-4 text-center backdrop-blur-sm transition-all hover:shadow-card ${
                  gift.inventory === 0 ? "opacity-40" : ""
                }`}
              >
                <div className="mb-2 text-3xl">{gift.icon}</div>
                <p className="text-sm font-medium text-foreground">{gift.name}</p>
                <p className="text-xs text-muted-foreground">
                  {gift.inventory} left
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gift Splash Screen */}
      {wonGift && <GiftSplash gift={wonGift} onClose={handleSplashClose} />}
    </div>
  );
}
