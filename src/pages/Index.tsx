import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Dice3D } from "@/components/Dice3D";
import { RollButton } from "@/components/RollButton";
import { GiftSplash } from "@/components/GiftSplash";
import { EmailModal } from "@/components/EmailModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/hooks/useTheme";
import { fetchPrizes, initiateRoll, confirmRoll, releaseRoll, Prize } from "@/lib/api";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type DiceState = "idle" | "rolling" | "settled" | "camera-focus" | "showing-splash";

export default function Index() {
  const { theme, toggleTheme } = useTheme();
  const [diceState, setDiceState] = useState<DiceState>("idle");
  const [settledFace, setSettledFace] = useState<number>(1);
  const [landedPosition, setLandedPosition] = useState<[number, number, number]>([0, -1, 0]);
  const [landedQuaternion, setLandedQuaternion] = useState<[number, number, number, number]>([0, 0, 0, 1]);
  const [wonPrize, setWonPrize] = useState<Prize | null>(null);
  const [canRoll, setCanRoll] = useState(true);
  const [validFaces, setValidFaces] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [targetFace, setTargetFace] = useState<number | undefined>();
  
  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [rollError, setRollError] = useState<string | undefined>();
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  
  const splashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch prizes on mount
  useEffect(() => {
    const loadPrizes = async () => {
      try {
        const data = await fetchPrizes();
        setValidFaces(data.availableFaces);
        setCanRoll(data.availableFaces.length > 0);
      } catch (error) {
        console.error('Failed to load prizes:', error);
        toast.error('Failed to load prizes');
      }
    };
    loadPrizes();
  }, []);

  useEffect(() => {
    return () => {
      if (splashTimeoutRef.current) {
        clearTimeout(splashTimeoutRef.current);
      }
    };
  }, []);

  const handleRollClick = useCallback(() => {
    if (!canRoll || diceState !== "idle") return;
    setShowEmailModal(true);
    setRollError(undefined);
  }, [canRoll, diceState]);

  const handleEmailSubmit = useCallback(async (email: string) => {
    setIsRolling(true);
    setRollError(undefined);
    
    try {
      const result = await initiateRoll(email);
      
      if (!result.success) {
        // Handle depleted inventory specifically
        if (result.code === 'NO_INVENTORY') {
          setShowEmailModal(false);
          setCanRoll(false);
          setValidFaces([]);
          toast.error('All prizes have been claimed!');
        } else {
          setRollError(result.error || 'Failed to initiate roll');
        }
        setIsRolling(false);
        return;
      }
      
      // Store entry ID for confirmation
      setCurrentEntryId(result.entryId || null);
      setTargetFace(result.winningFace);
      setWonPrize(result.prize || null);
      
      // Log API response for debugging
      console.log("=== API RESPONSE ===");
      console.log("Winning Face (target):", result.winningFace);
      console.log("Prize:", result.prize?.name, `(ID: ${result.prize?.id})`);
      console.log("Entry ID:", result.entryId);
      console.log("====================");
      
      // Close modal and start rolling
      setShowEmailModal(false);
      setIsRolling(false);
      rollCompletedRef.current = false; // Reset for new roll
      setDiceState("rolling");
    } catch (error) {
      console.error('Roll error:', error);
      setRollError('Network error. Please try again.');
      setIsRolling(false);
    }
  }, []);

  const handleEmailCancel = useCallback(() => {
    setShowEmailModal(false);
    setRollError(undefined);
  }, []);

  // Use a ref to track if roll completion has been handled to prevent double-calls
  const rollCompletedRef = useRef(false);
  const rollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Use a ref to track targetFace for the callback (avoids stale closure)
  const targetFaceRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    targetFaceRef.current = targetFace;
  }, [targetFace]);

  // Safety timeout: if dice doesn't complete within 10 seconds, force transition
  useEffect(() => {
    if (diceState === "rolling") {
      rollTimeoutRef.current = setTimeout(() => {
        if (diceState === "rolling" && !rollCompletedRef.current) {
          console.warn("Roll timeout - forcing completion");
          rollCompletedRef.current = true;
          setDiceState("settled");
          // Continue to camera focus after a short delay
          splashTimeoutRef.current = setTimeout(() => {
            setDiceState("camera-focus");
          }, 500);
        }
      }, 10000);
    }
    
    return () => {
      if (rollTimeoutRef.current) {
        clearTimeout(rollTimeoutRef.current);
        rollTimeoutRef.current = null;
      }
    };
  }, [diceState]);

  const handleRollComplete = useCallback((
    faceValue: number, 
    position: [number, number, number], 
    quaternion: [number, number, number, number]
  ) => {
    // Prevent double-calls
    if (rollCompletedRef.current) {
      console.log("Roll complete already handled, skipping");
      return;
    }
    rollCompletedRef.current = true;
    
    // Clear the safety timeout since we completed normally
    if (rollTimeoutRef.current) {
      clearTimeout(rollTimeoutRef.current);
      rollTimeoutRef.current = null;
    }
    
    // Use ref to get current targetFace value (avoids stale closure)
    const expectedFace = targetFaceRef.current;
    
    // Log landed face for debugging
    console.log("=== DICE LANDED ===");
    console.log("Landed Face (actual):", faceValue);
    console.log("Target Face (expected):", expectedFace);
    console.log("Match:", faceValue === expectedFace ? "✅ YES" : "❌ NO");
    console.log("Position:", position);
    console.log("===================");
    
    setSettledFace(faceValue);
    setLandedPosition(position);
    setLandedQuaternion(quaternion);
    setDiceState("settled");
    
    // Short delay then start camera focus
    splashTimeoutRef.current = setTimeout(() => {
      setDiceState("camera-focus");
    }, 500);
  }, []);

  // Use a ref to track the current entry ID for the callback
  const currentEntryIdRef = useRef<string | null>(null);
  
  // Keep the ref in sync with state
  useEffect(() => {
    currentEntryIdRef.current = currentEntryId;
  }, [currentEntryId]);

  const handleCameraFocusComplete = useCallback(async () => {
    // Confirm the roll in the database
    const entryId = currentEntryIdRef.current;
    if (entryId) {
      try {
        await confirmRoll(entryId);
      } catch (error) {
        console.error('Failed to confirm roll:', error);
        // Still show the prize even if confirmation fails
      }
    }
    
    // Show splash after camera animation
    splashTimeoutRef.current = setTimeout(() => {
      setDiceState("showing-splash");
    }, 300);
  }, []);

  const handleSplashClose = useCallback(async () => {
    // Immediately reset to idle state first to trigger camera reset
    setDiceState("idle");
    setWonPrize(null);
    setCurrentEntryId(null);
    setTargetFace(undefined);
    setSettledFace(1);
    setLandedPosition([0, -1, 0]);
    setLandedQuaternion([0, 0, 0, 1]);
    rollCompletedRef.current = false; // Reset for next roll
    
    // Refresh prizes to get updated inventory
    try {
      const data = await fetchPrizes();
      setValidFaces(data.availableFaces);
      setCanRoll(data.availableFaces.length > 0);
    } catch (error) {
      console.error('Failed to refresh prizes:', error);
    }
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Dice3D
        diceState={diceState}
        onRollComplete={handleRollComplete}
        onCameraFocusComplete={handleCameraFocusComplete}
        isDark={theme === "dark"}
        settledFace={settledFace}
        landedPosition={landedPosition}
        landedQuaternion={landedQuaternion}
        targetFace={targetFace}
        validFaces={validFaces}
      />

      <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-4 sm:p-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground drop-shadow-sm">Lucky Dice</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Roll to win!</p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <Link to="/admin">
            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-background/50 backdrop-blur-sm">
              <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="sr-only">Admin Settings</span>
            </Button>
          </Link>
        </div>
      </header>

      <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center gap-3 sm:gap-4 p-4 sm:p-8 pb-6 sm:pb-12">
        <RollButton
          onClick={handleRollClick}
          disabled={!canRoll || diceState !== "idle"}
          rolling={diceState === "rolling"}
          showingResult={diceState === "settled" || diceState === "camera-focus" || diceState === "showing-splash"}
        />

        {!canRoll && diceState === "idle" && (
          <div className="flex flex-col items-center gap-2">
            <p className="rounded-full bg-destructive/90 px-6 py-2 text-center text-sm font-medium text-destructive-foreground backdrop-blur-sm">
              All prizes have been claimed!
            </p>
            <p className="text-xs text-muted-foreground">
              Thank you for participating. Check back later for more prizes.
            </p>
          </div>
        )}
      </div>

      <EmailModal
        isOpen={showEmailModal}
        onSubmit={handleEmailSubmit}
        onCancel={handleEmailCancel}
        isLoading={isRolling}
        error={rollError}
      />

      {wonPrize && diceState === "showing-splash" && (
        <GiftSplash 
          gift={{
            id: wonPrize.id,
            name: wonPrize.name,
            description: wonPrize.description,
            icon: wonPrize.icon,
            inventory: wonPrize.inventory,
          }} 
          onClose={handleSplashClose} 
          dicePosition={landedPosition} 
        />
      )}
    </div>
  );
}
