import { useRef, useState, useEffect, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox, Text, Environment, ContactShadows, OrbitControls } from "@react-three/drei";
import { Physics, useBox, usePlane } from "@react-three/cannon";
import * as THREE from "three";

interface DiceProps {
  rolling: boolean;
  targetFace: number;
  onRollComplete: () => void;
}

// Face rotations to show each number on top
const FACE_ROTATIONS: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [0, 0, Math.PI / 2],
  3: [Math.PI / 2, 0, 0],
  4: [-Math.PI / 2, 0, 0],
  5: [0, 0, -Math.PI / 2],
  6: [Math.PI, 0, 0],
};

function Floor() {
  const [ref] = usePlane<THREE.Mesh>(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -3, 0],
    type: "Static",
  }));
  return <mesh ref={ref} visible={false} />;
}

function PhysicsDice({ rolling, targetFace, onRollComplete }: DiceProps) {
  const [ref, api] = useBox<THREE.Group>(() => ({
    mass: 1,
    position: [0, 5, 0],
    rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
    args: [2, 2, 2],
    material: { friction: 0.3, restitution: 0.2 },
  }));

  const [isSettling, setIsSettling] = useState(false);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    if (rolling && !hasCompletedRef.current) {
      setIsSettling(false);
      api.position.set(0, 6, 0);
      api.velocity.set(
        (Math.random() - 0.5) * 10,
        -5,
        (Math.random() - 0.5) * 10
      );
      api.angularVelocity.set(
        (Math.random() - 0.5) * 25,
        (Math.random() - 0.5) * 25,
        (Math.random() - 0.5) * 25
      );

      if (settleTimeoutRef.current) {
        clearTimeout(settleTimeoutRef.current);
      }

      settleTimeoutRef.current = setTimeout(() => {
        setIsSettling(true);
      }, 2000);
    }
  }, [rolling, api]);

  useEffect(() => {
    if (isSettling && !hasCompletedRef.current) {
      const targetRotation = FACE_ROTATIONS[targetFace];
      
      api.velocity.set(0, 0, 0);
      api.angularVelocity.set(0, 0, 0);
      api.position.set(0, 0, 0);
      api.rotation.set(...targetRotation);

      setTimeout(() => {
        if (!hasCompletedRef.current) {
          hasCompletedRef.current = true;
          onRollComplete();
        }
      }, 500);
    }
  }, [isSettling, targetFace, api, onRollComplete]);

  useEffect(() => {
    if (!rolling) {
      hasCompletedRef.current = false;
    }
  }, [rolling]);

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
      // Gentle floating while settled
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
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
      {/* Face 1 - Front */}
      <Text position={[0, 0, 1.02]} fontSize={0.7} color="white" anchorX="center" anchorY="middle">
        1
      </Text>
      {/* Face 6 - Back */}
      <Text position={[0, 0, -1.02]} fontSize={0.7} color="white" rotation={[0, Math.PI, 0]} anchorX="center" anchorY="middle">
        6
      </Text>
      {/* Face 2 - Right */}
      <Text position={[1.02, 0, 0]} fontSize={0.7} color="white" rotation={[0, Math.PI / 2, 0]} anchorX="center" anchorY="middle">
        2
      </Text>
      {/* Face 5 - Left */}
      <Text position={[-1.02, 0, 0]} fontSize={0.7} color="white" rotation={[0, -Math.PI / 2, 0]} anchorX="center" anchorY="middle">
        5
      </Text>
      {/* Face 3 - Top */}
      <Text position={[0, 1.02, 0]} fontSize={0.7} color="white" rotation={[-Math.PI / 2, 0, 0]} anchorX="center" anchorY="middle">
        3
      </Text>
      {/* Face 4 - Bottom */}
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
  rolling: boolean;
  targetFace: number;
  onRollComplete: () => void;
  isDark?: boolean;
  keepPosition?: boolean;
}

export function Dice3D({ rolling, targetFace, onRollComplete, isDark = false, keepPosition = false }: Dice3DProps) {
  const key = useMemo(() => (rolling && !keepPosition ? Date.now() : "stable"), [rolling, keepPosition]);
  const bgColor = isDark ? "#0a0f1a" : "#f0f4ff";

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
          {keepPosition ? (
            // Show settled dice in final position
            <SettledDice targetFace={targetFace} />
          ) : rolling ? (
            <Physics gravity={[0, -25, 0]} key={key}>
              <Floor />
              <PhysicsDice rolling={rolling} targetFace={targetFace} onRollComplete={onRollComplete} />
            </Physics>
          ) : (
            <IdleDice />
          )}
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
          autoRotate={!rolling && !keepPosition}
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
