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
    position: [0, -2, 0],
    type: "Static",
  }));
  return <mesh ref={ref} visible={false} />;
}

function PhysicsDice({ rolling, targetFace, onRollComplete }: DiceProps) {
  const [ref, api] = useBox<THREE.Group>(() => ({
    mass: 1,
    position: [0, 3, 0],
    rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
    args: [1.5, 1.5, 1.5],
    material: { friction: 0.4, restitution: 0.3 },
  }));

  const [isSettling, setIsSettling] = useState(false);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    if (rolling && !hasCompletedRef.current) {
      setIsSettling(false);
      api.position.set(0, 4, 0);
      api.velocity.set(
        (Math.random() - 0.5) * 8,
        -2,
        (Math.random() - 0.5) * 8
      );
      api.angularVelocity.set(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20
      );

      if (settleTimeoutRef.current) {
        clearTimeout(settleTimeoutRef.current);
      }

      settleTimeoutRef.current = setTimeout(() => {
        setIsSettling(true);
      }, 1500);
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
      }, 300);
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

function DiceModel() {
  return (
    <>
      <RoundedBox args={[1.5, 1.5, 1.5]} radius={0.12} smoothness={4}>
        <meshStandardMaterial color="#0338cd" metalness={0.4} roughness={0.15} envMapIntensity={1} />
      </RoundedBox>
      {/* Face 1 - Front */}
      <Text position={[0, 0, 0.78]} fontSize={0.5} color="white" anchorX="center" anchorY="middle">
        1
      </Text>
      {/* Face 6 - Back */}
      <Text position={[0, 0, -0.78]} fontSize={0.5} color="white" rotation={[0, Math.PI, 0]} anchorX="center" anchorY="middle">
        6
      </Text>
      {/* Face 2 - Right */}
      <Text position={[0.78, 0, 0]} fontSize={0.5} color="white" rotation={[0, Math.PI / 2, 0]} anchorX="center" anchorY="middle">
        2
      </Text>
      {/* Face 5 - Left */}
      <Text position={[-0.78, 0, 0]} fontSize={0.5} color="white" rotation={[0, -Math.PI / 2, 0]} anchorX="center" anchorY="middle">
        5
      </Text>
      {/* Face 3 - Top */}
      <Text position={[0, 0.78, 0]} fontSize={0.5} color="white" rotation={[-Math.PI / 2, 0, 0]} anchorX="center" anchorY="middle">
        3
      </Text>
      {/* Face 4 - Bottom */}
      <Text position={[0, -0.78, 0]} fontSize={0.5} color="white" rotation={[Math.PI / 2, 0, 0]} anchorX="center" anchorY="middle">
        4
      </Text>
    </>
  );
}

function IdleDice() {
  const meshRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.3;
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.15;
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
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial color="#0338cd" />
    </mesh>
  );
}

interface Dice3DProps {
  rolling: boolean;
  targetFace: number;
  onRollComplete: () => void;
  isDark?: boolean;
}

export function Dice3D({ rolling, targetFace, onRollComplete, isDark = false }: Dice3DProps) {
  const key = useMemo(() => (rolling ? Date.now() : "idle"), [rolling]);
  const bgColor = isDark ? "#0f1729" : "#f8fafc";

  return (
    <div className="h-[350px] w-full rounded-3xl overflow-hidden bg-secondary/30">
      <Canvas 
        camera={{ position: [0, 3, 7], fov: 40 }} 
        shadows
        gl={{ antialias: true }}
        dpr={[1, 2]}
      >
        <color attach="background" args={[bgColor]} />
        <fog attach="fog" args={[bgColor, 10, 25]} />
        
        <ambientLight intensity={isDark ? 0.4 : 0.6} />
        <directionalLight 
          position={[5, 10, 5]} 
          intensity={isDark ? 1.5 : 1.2} 
          castShadow
          shadow-mapSize={1024}
        />
        <pointLight position={[-5, 5, -5]} intensity={0.6} color="#0338cd" />
        <pointLight position={[5, 5, 5]} intensity={0.4} color="#ffffff" />

        <Suspense fallback={<LoadingDice />}>
          {rolling ? (
            <Physics gravity={[0, -20, 0]} key={key}>
              <Floor />
              <PhysicsDice rolling={rolling} targetFace={targetFace} onRollComplete={onRollComplete} />
            </Physics>
          ) : (
            <IdleDice />
          )}
          <Environment preset="city" />
        </Suspense>

        <ContactShadows 
          position={[0, -1.5, 0]} 
          opacity={isDark ? 0.8 : 0.5} 
          scale={15} 
          blur={2.5}
          far={4}
        />
        
        <OrbitControls 
          enableZoom={false} 
          enablePan={false} 
          maxPolarAngle={Math.PI / 2}
          minPolarAngle={Math.PI / 4}
        />
      </Canvas>
    </div>
  );
}
