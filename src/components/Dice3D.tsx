import { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox, Text, Environment, ContactShadows, OrbitControls } from "@react-three/drei";
import { Physics, useBox, usePlane } from "@react-three/cannon";
import * as THREE from "three";
import { getTargetQuaternion, getAdaptiveCorrectiveTorque, getTopFace } from "@/lib/dicePhysics";
import { animateCameraToFace } from "@/lib/cameraAnimation";

type DiceState = "idle" | "rolling" | "settled" | "camera-focus" | "showing-splash";

function Floor() {
  const [ref] = usePlane<THREE.Mesh>(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -2, 0],
    type: "Static",
  }));
  return <mesh ref={ref} visible={false} />;
}

interface PhysicsDiceProps {
  onRollComplete: (faceValue: number, position: [number, number, number], quaternion: [number, number, number, number]) => void;
  targetFace: number;
}

function PhysicsDice({ onRollComplete, targetFace }: PhysicsDiceProps) {
  // Log the target face on mount
  console.log("PhysicsDice mounted with targetFace:", targetFace);
  
  const [ref, api] = useBox<THREE.Group>(() => ({
    mass: 1,
    position: [0, 5, 0],
    rotation: [Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2],
    args: [2, 2, 2],
    material: { friction: 0.6, restitution: 0.3 },
  }));

  const hasCompletedRef = useRef(false);
  const lastPosition = useRef<[number, number, number]>([0, 5, 0]);
  const lastQuaternion = useRef<[number, number, number, number]>([0, 0, 0, 1]);
  const velocity = useRef<[number, number, number]>([0, 0, 0]);
  const angularVelocity = useRef<[number, number, number]>([0, 0, 0]);
  const stableFrames = useRef(0);
  const frameCount = useRef(0);
  // Initialize target quaternion with the target face
  const targetQuaternion = useRef(getTargetQuaternion(targetFace));
  
  // Update target quaternion if targetFace changes (shouldn't happen during a roll, but just in case)
  useEffect(() => {
    targetQuaternion.current = getTargetQuaternion(targetFace);
    console.log("Target quaternion updated for face:", targetFace);
  }, [targetFace]);
  
  // Keep callback ref updated to avoid stale closure issues
  const onRollCompleteRef = useRef(onRollComplete);
  useEffect(() => {
    onRollCompleteRef.current = onRollComplete;
  }, [onRollComplete]);

  // Helper to safely complete the roll
  const completeRoll = () => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    
    api.velocity.set(0, 0, 0);
    api.angularVelocity.set(0, 0, 0);
    
    const quat = new THREE.Quaternion(
      lastQuaternion.current[0],
      lastQuaternion.current[1],
      lastQuaternion.current[2],
      lastQuaternion.current[3]
    );
    const topFace = getTopFace(quat);
    
    console.log("Dice landed! Target face:", targetFace, "Actual top face:", topFace);
    
    // Ensure position Y is reasonable (clamp to floor level)
    const finalPosition: [number, number, number] = [
      lastPosition.current[0],
      Math.max(-1.5, Math.min(lastPosition.current[1], 0.5)),
      lastPosition.current[2]
    ];
    
    // Use setTimeout to ensure the callback runs outside the physics frame
    setTimeout(() => {
      onRollCompleteRef.current(topFace, finalPosition, [...lastQuaternion.current] as [number, number, number, number]);
    }, 0);
  };

  useEffect(() => {
    const unsubPos = api.position.subscribe((pos) => {
      if (!hasCompletedRef.current) {
        lastPosition.current = [pos[0], pos[1], pos[2]];
      }
    });
    const unsubRot = api.quaternion.subscribe((quat) => {
      if (!hasCompletedRef.current) {
        lastQuaternion.current = [quat[0], quat[1], quat[2], quat[3]];
      }
    });
    const unsubVel = api.velocity.subscribe((vel) => {
      velocity.current = [vel[0], vel[1], vel[2]];
    });
    const unsubAngVel = api.angularVelocity.subscribe((angVel) => {
      angularVelocity.current = [angVel[0], angVel[1], angVel[2]];
    });
    return () => {
      unsubPos();
      unsubRot();
      unsubVel();
      unsubAngVel();
    };
  }, [api]);

  useEffect(() => {
    api.position.set(0, 5, 0);
    // Reduced horizontal velocity for more controlled roll
    api.velocity.set(
      (Math.random() - 0.5) * 4,
      -2,
      (Math.random() - 0.5) * 4
    );
    // Reduced angular velocity to make correction easier (was 15, now 8)
    api.angularVelocity.set(
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 8
    );
    
    // Fallback timeout - if dice doesn't settle in 6 seconds, force completion
    const fallbackTimeout = setTimeout(() => {
      completeRoll();
    }, 6000);
    
    return () => clearTimeout(fallbackTimeout);
  }, [api]);

  useFrame(() => {
    if (hasCompletedRef.current) return;
    frameCount.current++;

    const currentY = lastPosition.current[1];
    const vel = velocity.current;
    const angVel = angularVelocity.current;
    
    const velMagnitude = Math.sqrt(vel[0] * vel[0] + vel[1] * vel[1] + vel[2] * vel[2]);
    const angVelMagnitude = Math.sqrt(angVel[0] * angVel[0] + angVel[1] * angVel[1] + angVel[2] * angVel[2]);
    
    // Safety: if dice fell through floor or went out of bounds, force complete
    if (currentY < -3 || Math.abs(lastPosition.current[0]) > 15 || Math.abs(lastPosition.current[2]) > 15) {
      completeRoll();
      return;
    }
    
    // Apply corrective torque starting very early to guide the dice toward target face
    // Start applying after just 5 frames to begin guiding immediately
    if (frameCount.current > 5) {
      const currentQuat = new THREE.Quaternion(
        lastQuaternion.current[0],
        lastQuaternion.current[1],
        lastQuaternion.current[2],
        lastQuaternion.current[3]
      );
      
      // Use adaptive correction that increases strength as dice slows down
      const torque = getAdaptiveCorrectiveTorque(
        currentQuat,
        targetQuaternion.current,
        velMagnitude,
        angVelMagnitude
      );
      
      // Apply torque - always apply to ensure dice lands on target
      api.applyTorque(torque);
      
      // When dice is near the floor and slowing down, apply extra damping to angular velocity
      // This helps the dice settle on the correct face
      if (currentY < 1.5 && angVelMagnitude > 0.5 && angVelMagnitude < 3) {
        // Apply counter-torque to slow down rotation
        const dampingFactor = 0.3;
        api.applyTorque([
          -angVel[0] * dampingFactor,
          -angVel[1] * dampingFactor,
          -angVel[2] * dampingFactor
        ]);
      }
    }
    
    const isNearFloor = currentY < 1.0 && currentY > -2.5;
    const isSlowEnough = velMagnitude < 0.2;
    const isNotSpinning = angVelMagnitude < 0.35;
    
    if (isNearFloor && isSlowEnough && isNotSpinning) {
      stableFrames.current++;
      
      // Complete after 25 stable frames (~0.4 seconds at 60fps)
      if (stableFrames.current > 25) {
        completeRoll();
      }
    } else {
      // Gradual decay instead of full reset for more tolerance
      stableFrames.current = Math.max(0, stableFrames.current - 1);
    }
    
    // Force complete after 5 seconds (300 frames) if dice is at least near the floor
    if (frameCount.current > 300 && currentY < 2 && velMagnitude < 1.0) {
      completeRoll();
    }
  });

  return (
    <group ref={ref}>
      <DiceModel />
    </group>
  );
}

interface CameraControllerProps {
  dicePosition: [number, number, number];
  onAnimationComplete: () => void;
  shouldAnimate: boolean;
}

/**
 * Camera controller component that animates camera to focus on dice
 * Uses the cameraAnimation utility for smooth 60fps GSAP animation
 * Requirements: 6.1, 6.2, 6.3
 */
function CameraController({ dicePosition, onAnimationComplete, shouldAnimate }: CameraControllerProps) {
  const { camera } = useThree();
  const hasAnimated = useRef(false);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const onCompleteRef = useRef(onAnimationComplete);
  
  // Keep callback ref updated
  useEffect(() => {
    onCompleteRef.current = onAnimationComplete;
  }, [onAnimationComplete]);

  useEffect(() => {
    if (shouldAnimate && !hasAnimated.current) {
      hasAnimated.current = true;
      
      // Use the camera animation utility with design-specified config
      // Duration: 1.5 seconds, easeInOut, position above dice
      timelineRef.current = animateCameraToFace(
        camera,
        dicePosition,
        () => onCompleteRef.current(),
        {
          duration: 1.5,
          ease: 'power2.inOut',
          heightOffset: 5,
          depthOffset: 3,
        }
      );
    }

    // Cleanup: kill animation if component unmounts
    return () => {
      if (timelineRef.current) {
        timelineRef.current.kill();
      }
    };
  }, [shouldAnimate, dicePosition, camera]);

  return null;
}

interface CameraResetControllerProps {
  shouldReset: boolean;
}

function CameraResetController({ shouldReset }: CameraResetControllerProps) {
  const { camera } = useThree();
  const hasReset = useRef(false);

  useEffect(() => {
    if (shouldReset && !hasReset.current) {
      hasReset.current = true;
      // Reset camera to default position
      import('@/lib/cameraAnimation').then(({ resetCameraPosition }) => {
        resetCameraPosition(camera, [0, 5, 12], 0.8);
      });
    }
    if (!shouldReset) {
      hasReset.current = false;
    }
  }, [shouldReset, camera]);

  return null;
}

interface SettledDiceProps {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}

function SettledDice({ position, quaternion }: SettledDiceProps) {
  const meshRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.8) * 0.02;
    }
    if (glowRef.current) {
      glowRef.current.intensity = 2 + Math.sin(state.clock.elapsedTime * 1.5) * 0.5;
    }
  });

  const rotation = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion(quaternion[0], quaternion[1], quaternion[2], quaternion[3])
  );

  return (
    <group 
      ref={meshRef} 
      position={[position[0], position[1], position[2]]} 
      rotation={[rotation.x, rotation.y, rotation.z]}
    >
      <pointLight ref={glowRef} color="#0338cd" intensity={2} distance={6} decay={2} />
      <DiceModel settled />
    </group>
  );
}

interface DiceModelProps {
  settled?: boolean;
}

function DiceModel({ settled }: DiceModelProps = {}) {
  return (
    <>
      <RoundedBox args={[2, 2, 2]} radius={0.15} smoothness={4}>
        <meshStandardMaterial 
          color="#0338cd" 
          metalness={0.5} 
          roughness={0.1} 
          envMapIntensity={1.2}
          emissive={settled ? "#0338cd" : "#000000"}
          emissiveIntensity={settled ? 0.15 : 0}
        />
      </RoundedBox>
      <Text position={[0, 0, 1.02]} fontSize={0.7} color="white" anchorX="center" anchorY="middle">1</Text>
      <Text position={[0, 0, -1.02]} fontSize={0.7} color="white" rotation={[0, Math.PI, 0]} anchorX="center" anchorY="middle">6</Text>
      <Text position={[1.02, 0, 0]} fontSize={0.7} color="white" rotation={[0, Math.PI / 2, 0]} anchorX="center" anchorY="middle">2</Text>
      <Text position={[-1.02, 0, 0]} fontSize={0.7} color="white" rotation={[0, -Math.PI / 2, 0]} anchorX="center" anchorY="middle">5</Text>
      <Text position={[0, 1.02, 0]} fontSize={0.7} color="white" rotation={[-Math.PI / 2, 0, 0]} anchorX="center" anchorY="middle">3</Text>
      <Text position={[0, -1.02, 0]} fontSize={0.7} color="white" rotation={[Math.PI / 2, 0, 0]} anchorX="center" anchorY="middle">4</Text>
    </>
  );
}

function IdleDice() {
  const meshRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.2;
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.2;
    }
  });

  return (
    <group ref={meshRef}>
      <DiceModel />
    </group>
  );
}

function LoadingDice() {
  return (
    <mesh>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#0338cd" />
    </mesh>
  );
}

interface Dice3DProps {
  diceState: DiceState;
  onRollComplete: (faceValue: number, position: [number, number, number], quaternion: [number, number, number, number]) => void;
  onCameraFocusComplete?: () => void;
  isDark?: boolean;
  settledFace?: number;
  landedPosition?: [number, number, number];
  landedQuaternion?: [number, number, number, number];
  targetFace?: number;
  validFaces: number[];
}

export function Dice3D({ 
  diceState, 
  onRollComplete, 
  onCameraFocusComplete,
  isDark = false, 
  landedPosition, 
  landedQuaternion, 
  targetFace,
  validFaces 
}: Dice3DProps) {
  const [rollKey, setRollKey] = useState(0);
  // Track the locked target face for the current roll
  const [lockedTargetFace, setLockedTargetFace] = useState<number | null>(null);
  const bgColor = isDark ? "#0a0f1a" : "#f0f4ff";

  // When rolling starts, lock the target face and set the roll key
  useEffect(() => {
    if (diceState === "rolling" && targetFace !== undefined) {
      // Only start the physics when we have a valid targetFace from the API
      console.log("Rolling dice with target face:", targetFace);
      setLockedTargetFace(targetFace);
      setRollKey(Date.now());
    } else if (diceState === "idle") {
      // Reset locked target face when returning to idle
      setLockedTargetFace(null);
    }
  }, [diceState, targetFace]);

  const renderDice = () => {
    switch (diceState) {
      case "idle":
        return <IdleDice />;
      case "rolling":
        // Only render Physics when we have a locked target face
        if (lockedTargetFace === null) {
          // Show loading/idle dice while waiting for target face
          return <IdleDice />;
        }
        return (
          <Physics gravity={[0, -25, 0]} key={rollKey}>
            <Floor />
            <PhysicsDice onRollComplete={onRollComplete} targetFace={lockedTargetFace} />
          </Physics>
        );
      case "settled":
      case "camera-focus":
      case "showing-splash":
        return <SettledDice position={landedPosition || [0, -1, 0]} quaternion={landedQuaternion || [0, 0, 0, 1]} />;
      default:
        return <IdleDice />;
    }
  };

  return (
    <div className="absolute inset-0">
      <Canvas 
        camera={{ position: [0, 5, 12], fov: 45 }} 
        shadows
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        style={{ background: `linear-gradient(180deg, ${bgColor} 0%, ${isDark ? '#0f1729' : '#e8efff'} 100%)` }}
      >
        <ambientLight intensity={isDark ? 0.3 : 0.5} />
        <directionalLight position={[5, 15, 5]} intensity={isDark ? 1.8 : 1.5} castShadow shadow-mapSize={2048} />
        <pointLight position={[-5, 8, -5]} intensity={0.8} color="#0338cd" />
        <pointLight position={[5, 8, 5]} intensity={0.5} color="#ffffff" />
        <spotLight position={[0, 15, 0]} angle={0.4} penumbra={1} intensity={0.5} color="#0338cd" />

        <Suspense fallback={<LoadingDice />}>
          {renderDice()}
          <Environment preset="city" />
        </Suspense>

        <ContactShadows position={[0, -2, 0]} opacity={isDark ? 0.6 : 0.4} scale={25} blur={3} far={6} />
        
        {diceState === "camera-focus" && landedPosition && onCameraFocusComplete && (
          <CameraController 
            dicePosition={landedPosition} 
            onAnimationComplete={onCameraFocusComplete}
            shouldAnimate={true}
          />
        )}
        
        <CameraResetController shouldReset={diceState === "idle"} />
        
        <OrbitControls 
          enableZoom={false} 
          enablePan={false} 
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={Math.PI / 4}
          autoRotate={diceState === "idle"}
          autoRotateSpeed={0.5}
          enabled={diceState === "idle"}
        />
      </Canvas>
    </div>
  );
}
