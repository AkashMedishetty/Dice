import { useRef, useState, useEffect, Suspense, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox, Text, Environment, ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { getTargetQuaternion } from "@/lib/dicePhysics";
import { animateCameraToFace } from "@/lib/cameraAnimation";

type DiceState = "idle" | "rolling" | "settled" | "camera-focus" | "showing-splash";

interface AnimatedDiceProps {
  onRollComplete: (faceValue: number, position: [number, number, number], quaternion: [number, number, number, number]) => void;
  targetFace: number;
}

/**
 * Animated dice that guarantees landing on the target face.
 * Uses keyframe animation with easing for natural-looking movement.
 */
function AnimatedDice({ onRollComplete, targetFace }: AnimatedDiceProps) {
  const meshRef = useRef<THREE.Group>(null);
  const startTime = useRef(Date.now());
  const hasCompleted = useRef(false);
  const onRollCompleteRef = useRef(onRollComplete);
  
  // Animation parameters
  const duration = 2.5; // Total animation duration in seconds
  const bounceCount = 3; // Number of bounces
  const startY = 4;
  const endY = -1;
  
  // Random but consistent values for this roll
  const rollParams = useMemo(() => ({
    // Random horizontal movement
    startX: (Math.random() - 0.5) * 2,
    endX: (Math.random() - 0.5) * 3,
    startZ: (Math.random() - 0.5) * 2,
    endZ: (Math.random() - 0.5) * 3,
    // Random spin amounts (full rotations)
    spinX: (2 + Math.random() * 2) * Math.PI * 2 * (Math.random() > 0.5 ? 1 : -1),
    spinY: (1 + Math.random() * 2) * Math.PI * 2 * (Math.random() > 0.5 ? 1 : -1),
    spinZ: (2 + Math.random() * 2) * Math.PI * 2 * (Math.random() > 0.5 ? 1 : -1),
  }), []);
  
  // Get the target rotation for the face
  const targetQuat = useMemo(() => getTargetQuaternion(targetFace), [targetFace]);
  const targetEuler = useMemo(() => {
    const euler = new THREE.Euler();
    euler.setFromQuaternion(targetQuat);
    return euler;
  }, [targetQuat]);
  
  // Keep callback ref updated
  useEffect(() => {
    onRollCompleteRef.current = onRollComplete;
  }, [onRollComplete]);
  
  console.log("AnimatedDice mounted with targetFace:", targetFace);
  
  useFrame(() => {
    if (!meshRef.current || hasCompleted.current) return;
    
    const elapsed = (Date.now() - startTime.current) / 1000;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function for smooth deceleration
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
    const easeOutBounce = (t: number) => {
      const n1 = 7.5625;
      const d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    };
    
    const easedProgress = easeOutQuart(progress);
    
    // Position animation with bounce
    const bounceProgress = easeOutBounce(progress);
    const x = rollParams.startX + (rollParams.endX - rollParams.startX) * easedProgress;
    const z = rollParams.startZ + (rollParams.endZ - rollParams.startZ) * easedProgress;
    
    // Y position with bouncing effect
    let y: number;
    if (progress < 0.4) {
      // Initial drop
      const dropProgress = progress / 0.4;
      y = startY - (startY - endY) * easeOutQuart(dropProgress);
    } else if (progress < 0.6) {
      // First bounce up
      const bounceProgress = (progress - 0.4) / 0.2;
      const bounceHeight = 1.5;
      y = endY + bounceHeight * Math.sin(bounceProgress * Math.PI);
    } else if (progress < 0.75) {
      // Second bounce
      const bounceProgress = (progress - 0.6) / 0.15;
      const bounceHeight = 0.6;
      y = endY + bounceHeight * Math.sin(bounceProgress * Math.PI);
    } else if (progress < 0.9) {
      // Third small bounce
      const bounceProgress = (progress - 0.75) / 0.15;
      const bounceHeight = 0.2;
      y = endY + bounceHeight * Math.sin(bounceProgress * Math.PI);
    } else {
      // Settled
      y = endY;
    }
    
    meshRef.current.position.set(x, y, z);
    
    // Rotation animation - spin then settle to target
    const spinEase = easeOutQuart(progress);
    
    // Calculate rotation: spin amount that decelerates, ending at target rotation
    const rotX = rollParams.spinX * (1 - spinEase) + targetEuler.x;
    const rotY = rollParams.spinY * (1 - spinEase) + targetEuler.y;
    const rotZ = rollParams.spinZ * (1 - spinEase) + targetEuler.z;
    
    meshRef.current.rotation.set(rotX, rotY, rotZ);
    
    // Complete when animation is done
    if (progress >= 1 && !hasCompleted.current) {
      hasCompleted.current = true;
      
      const finalPosition: [number, number, number] = [x, endY, z];
      const finalQuat = new THREE.Quaternion();
      finalQuat.setFromEuler(new THREE.Euler(targetEuler.x, targetEuler.y, targetEuler.z));
      
      console.log("Dice landed! Target face:", targetFace, "Actual top face:", targetFace);
      
      setTimeout(() => {
        onRollCompleteRef.current(
          targetFace, 
          finalPosition, 
          [finalQuat.x, finalQuat.y, finalQuat.z, finalQuat.w]
        );
      }, 0);
    }
  });
  
  return (
    <group ref={meshRef} position={[rollParams.startX, startY, rollParams.startZ]}>
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
      
      // Reset camera up vector before animation to ensure correct orientation
      camera.up.set(0, 1, 0);
      
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
        resetCameraPosition(camera, [0, 3, 8], 0.8);
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
  const baseY = 0.6; // Slight upward position

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.2;
      meshRef.current.position.y = baseY + Math.sin(state.clock.elapsedTime * 0.6) * 0.2;
    }
  });

  return (
    <group ref={meshRef} position={[0, baseY, 0]}>
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
        // Only render AnimatedDice when we have a locked target face
        if (lockedTargetFace === null) {
          // Show loading/idle dice while waiting for target face
          return <IdleDice />;
        }
        return (
          <AnimatedDice 
            key={rollKey}
            onRollComplete={onRollComplete} 
            targetFace={lockedTargetFace} 
          />
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
        camera={{ position: [0, 3, 8], fov: 50 }} 
        shadows
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        style={{ background: 'transparent' }}
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
