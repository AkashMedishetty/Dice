import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { Dice3D } from "@/components/Dice3D";
import { RollButton } from "@/components/RollButton";
import { GiftSplash } from "@/components/GiftSplash";
import { ThemeToggle } from "@/components/ThemeToggle";
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

    const randomIndex = Math.floor(Math.random() * activeIds.length);
    const selectedGiftId = activeIds[randomIndex];

    setTargetFace(selectedGiftId);
    setRolling(true);
  }, []);

  const handleRollComplete = useCallback(() => {
    const gift = getGiftById(targetFace);
    if (gift) {
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
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Full-screen 3D Canvas */}
      <Dice3D
        rolling={rolling}
        targetFace={targetFace}
        onRollComplete={handleRollComplete}
        isDark={theme === "dark"}
      />

      {/* Header Overlay */}
      <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground drop-shadow-sm">Gift Dice</h1>
          <p className="text-sm text-muted-foreground">Roll to win!</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <Link to="/admin">
            <Button variant="ghost" size="icon" className="rounded-full bg-background/50 backdrop-blur-sm">
              <Settings className="h-5 w-5" />
              <span className="sr-only">Admin Settings</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center gap-4 p-8 pb-12">
        <RollButton
          onClick={handleRoll}
          disabled={!canRoll}
          rolling={rolling}
        />

        {!canRoll && (
          <p className="rounded-full bg-destructive/90 px-6 py-2 text-center text-sm font-medium text-destructive-foreground backdrop-blur-sm">
            All gifts have been claimed!
          </p>
        )}
      </div>

      {/* Gift Splash Screen */}
      {wonGift && <GiftSplash gift={wonGift} onClose={handleSplashClose} />}
    </div>
  );
}
