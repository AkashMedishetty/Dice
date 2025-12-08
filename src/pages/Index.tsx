import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Dice3D } from "@/components/Dice3D";
import { GiftSplash } from "@/components/GiftSplash";
import { EmailModal } from "@/components/EmailModal";
import { fetchPrizes, initiateRoll, confirmRoll, Prize } from "@/lib/api";
import { toast } from "sonner";

// Generate random dots for background
function generateDots(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 85, // Keep dots in upper 85% to avoid bottom white area
    size: Math.random() * 10 + 6, // Bigger dots: 6-16px
    delay: Math.random() * 5,
    duration: Math.random() * 4 + 6,
  }));
}

type DiceState = "idle" | "rolling" | "settled" | "camera-focus" | "showing-splash";

export default function Index() {
  const [diceState, setDiceState] = useState<DiceState>("idle");
  const dots = useMemo(() => generateDots(50), []); // More dots for better effect
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

  // Email modal is always shown on idle state now
  useEffect(() => {
    if (diceState === "idle" && canRoll) {
      setShowEmailModal(true);
    }
  }, [diceState, canRoll]);

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
    <div className="relative h-screen w-screen overflow-hidden sf-gradient-bg">
      {/* Random dots overlay */}
      <div className="sf-dots-overlay">
        {dots.map((dot) => (
          <div
            key={dot.id}
            className="sf-dot"
            style={{
              left: `${dot.left}%`,
              top: `${dot.top}%`,
              width: `${dot.size}px`,
              height: `${dot.size}px`,
              animationDelay: `${dot.delay}s`,
              animationDuration: `${dot.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Logo in top-left corner */}
      <header className="absolute left-0 top-0 z-30 p-4 sm:p-6">
        <img 
          src="/logfo.png" 
          alt="Peace & Joy" 
          className="h-24 sm:h-32 md:h-36 w-auto"
        />
      </header>

      {/* 3D Dice - full screen but dice positioned in upper area */}
      <div className="absolute inset-0 z-10">
        <Dice3D
          diceState={diceState}
          onRollComplete={handleRollComplete}
          onCameraFocusComplete={handleCameraFocusComplete}
          isDark={true}
          settledFace={settledFace}
          landedPosition={landedPosition}
          landedQuaternion={landedQuaternion}
          targetFace={targetFace}
          validFaces={validFaces}
        />
      </div>

      {/* Main content - Email form below dice */}
      {diceState === "idle" && (
        <div className="absolute inset-x-0 bottom-[20%] z-20 flex flex-col items-center justify-center px-4">
          {/* Email form */}
          <EmailModal
            isOpen={showEmailModal}
            onSubmit={handleEmailSubmit}
            onCancel={handleEmailCancel}
            isLoading={isRolling}
            error={rollError}
          />

          {!canRoll && (
            <div className="flex flex-col items-center gap-2 mt-4">
              <p className="rounded-full bg-red-500/90 px-6 py-2 text-center text-sm font-medium text-white backdrop-blur-sm">
                All prizes have been claimed!
              </p>
              <p className="text-xs text-white/70">
                Thank you for participating. Check back later for more prizes.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Mascot in bottom-right corner */}
      <div className="absolute bottom-0 right-0 z-20 pointer-events-none">
        <img 
          src="/bottom right.png" 
          alt="Mascot" 
          className="h-32 sm:h-48 md:h-56 w-auto"
        />
      </div>

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
