import { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox, Text, Environment, ContactShadows, OrbitControls } from "@react-three/drei";
import { Physics, useBox, usePlane } from "@react-three/cannon";
import * as THREE from "three";

type DiceState = "idle" | "rolling" | "settled" | "showing-splash";

/*
 * Dice face positions in DiceModel:
 * - Face 1: Front (z+)  position [0, 0, 1.02]
 * - Face 6: Back (z-)   position [0, 0, -1.02]
 * - Face 2: Right (x+)  position [1.02, 0, 0]
 * - Face 5: Left (x-)   position [-1.02, 0, 0]
 * - Face 3: Top (y+)    position [0, 1.02, 0]
 * - Face 4: Bottom (y-) position [0, -1.02, 0]
 * 
 * Rotations to show each face on TOP (euler XYZ order):
 */
const FACE_ROTATIONS: Record<number, [number, number, number]> = {
  1: [Math.PI / 2, 0, 0],     // Rotate X +90° to bring front to top
  2: [0, 0, -Math.PI / 2],    // Rotate Z -90° to bring right to top
  3: [0, 0, 0],               // Already on top
  4: [Math.PI, 0, 0],         // Rotate X 180° to flip
  5: [0, 0, Math.PI / 2],     // Rotate Z +90° to bring left to top
  6: [-Math.PI / 2, 0, 0],    // Rotate X -90° to bring back to top
};

function Floor() {
  const [ref] = usePlane<THREE.Mesh>(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -3, 0],
    type: "Static",
  }));
  return <mesh ref={ref} visible={false} />;
}

interface PhysicsDiceProps {
  targetFace: number;
  onRollComplete: () => void;
}

function PhysicsDice({ targetFace, onRollComplete }: PhysicsDiceProps) {
  const [ref, api] = useBox<THREE.Group>(() => ({
    mass: 1,
    position: [0, 6, 0],
    rotation: [Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2],
    args: [2, 2, 2],
    material: { friction: 0.4, restitution: 0.3 },
  }));

  const [phase, setPhase] = useState<"falling" | "settling" | "done">("falling");
  const hasCompletedRef = useRef(false);

  // Start the roll
  useEffect(() => {
    api.position.set(0, 6, 0);
    api.velocity.set(
      (Math.random() - 0.5) * 12,
      -8,
      (Math.random() - 0.5) * 12
    );
    api.angularVelocity.set(
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 30
    );

    const settleTimeout = setTimeout(() => {
      setPhase("settling");
    }, 2200);

    return () => clearTimeout(settleTimeout);
  }, [api]);

  // Settle to final position
  useEffect(() => {
    if (phase === "settling") {
      const targetRotation = FACE_ROTATIONS[targetFace];
      
      // Stop physics and set final position
      api.velocity.set(0, 0, 0);
      api.angularVelocity.set(0, 0, 0);
      api.position.set(0, 0, 0);
      api.rotation.set(targetRotation[0], targetRotation[1], targetRotation[2]);

      const doneTimeout = setTimeout(() => {
        setPhase("done");
      }, 500);

      return () => clearTimeout(doneTimeout);
    }
  }, [phase, targetFace, api]);

  // Notify completion
  useEffect(() => {
    if (phase === "done" && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onRollComplete();
    }
  }, [phase, onRollComplete]);

  return (
    <group ref={ref}>
      <DiceModel />
    </group>
  );
}

function SettledDice({ targetFace }: { targetFace: number }) {
  const meshRef = useRef<THREE.Group>(null);
  const targetRotation = FACE_ROTATIONS[targetFace];

  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating animation
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.08;
    }
  });

  return (
    <group ref={meshRef} rotation={targetRotation}>
      <DiceModel />
    </group>
  );
}

function DiceModel() {
  return (
    <>
      <RoundedBox args={[2, 2, 2]} radius={0.15} smoothness={4}>
        <meshStandardMaterial color="#0338cd" metalness={0.5} roughness={0.1} envMapIntensity={1.2} />
      </RoundedBox>
      {/* Face 1 - Front (z+) */}
      <Text position={[0, 0, 1.02]} fontSize={0.7} color="white" anchorX="center" anchorY="middle">
        1
      </Text>
      {/* Face 6 - Back (z-) */}
      <Text position={[0, 0, -1.02]} fontSize={0.7} color="white" rotation={[0, Math.PI, 0]} anchorX="center" anchorY="middle">
        6
      </Text>
      {/* Face 2 - Right (x+) */}
      <Text position={[1.02, 0, 0]} fontSize={0.7} color="white" rotation={[0, Math.PI / 2, 0]} anchorX="center" anchorY="middle">
        2
      </Text>
      {/* Face 5 - Left (x-) */}
      <Text position={[-1.02, 0, 0]} fontSize={0.7} color="white" rotation={[0, -Math.PI / 2, 0]} anchorX="center" anchorY="middle">
        5
      </Text>
      {/* Face 3 - Top (y+) */}
      <Text position={[0, 1.02, 0]} fontSize={0.7} color="white" rotation={[-Math.PI / 2, 0, 0]} anchorX="center" anchorY="middle">
        3
      </Text>
      {/* Face 4 - Bottom (y-) */}
      <Text position={[0, -1.02, 0]} fontSize={0.7} color="white" rotation={[Math.PI / 2, 0, 0]} anchorX="center" anchorY="middle">
        4
      </Text>
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
  targetFace: number;
  onRollComplete: () => void;
  isDark?: boolean;
}

export function Dice3D({ diceState, targetFace, onRollComplete, isDark = false }: Dice3DProps) {
  const [rollKey, setRollKey] = useState(0);
  const bgColor = isDark ? "#0a0f1a" : "#f0f4ff";

  // Generate new key only when starting a new roll
  useEffect(() => {
    if (diceState === "rolling") {
      setRollKey(Date.now());
    }
  }, [diceState]);

  const renderDice = () => {
    switch (diceState) {
      case "idle":
        return <IdleDice />;
      case "rolling":
        return (
          <Physics gravity={[0, -25, 0]} key={rollKey}>
            <Floor />
            <PhysicsDice targetFace={targetFace} onRollComplete={onRollComplete} />
          </Physics>
        );
      case "settled":
      case "showing-splash":
        return <SettledDice targetFace={targetFace} />;
      default:
        return <IdleDice />;
    }
  };

  return (
    <div className="absolute inset-0">
      <Canvas 
        camera={{ position: [0, 4, 10], fov: 50 }} 
        shadows
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        style={{ background: `linear-gradient(180deg, ${bgColor} 0%, ${isDark ? '#0f1729' : '#e8efff'} 100%)` }}
      >
        <ambientLight intensity={isDark ? 0.3 : 0.5} />
        <directionalLight 
          position={[5, 15, 5]} 
          intensity={isDark ? 1.8 : 1.5} 
          castShadow
          shadow-mapSize={2048}
        />
        <pointLight position={[-5, 8, -5]} intensity={0.8} color="#0338cd" />
        <pointLight position={[5, 8, 5]} intensity={0.5} color="#ffffff" />
        <spotLight 
          position={[0, 15, 0]} 
          angle={0.4} 
          penumbra={1} 
          intensity={0.5} 
          color="#0338cd"
        />

        <Suspense fallback={<LoadingDice />}>
          {renderDice()}
          <Environment preset="city" />
        </Suspense>

        <ContactShadows 
          position={[0, -2.5, 0]} 
          opacity={isDark ? 0.6 : 0.4} 
          scale={20} 
          blur={3}
          far={6}
        />
        
        <OrbitControls 
          enableZoom={false} 
          enablePan={false} 
          maxPolarAngle={Math.PI / 2}
          minPolarAngle={Math.PI / 4}
          autoRotate={diceState === "idle"}
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
