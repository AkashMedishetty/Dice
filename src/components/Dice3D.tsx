import { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox, Text, Environment, ContactShadows, OrbitControls } from "@react-three/drei";
import { Physics, useBox, usePlane } from "@react-three/cannon";
import * as THREE from "three";

type DiceState = "idle" | "rolling" | "settled" | "showing-splash";

// Face normals (direction each face points when dice is at identity rotation)
const FACE_NORMALS: Record<number, THREE.Vector3> = {
  1: new THREE.Vector3(0, 0, 1),   // Front
  2: new THREE.Vector3(1, 0, 0),   // Right
  3: new THREE.Vector3(0, 1, 0),   // Top
  4: new THREE.Vector3(0, -1, 0),  // Bottom
  5: new THREE.Vector3(-1, 0, 0),  // Left
  6: new THREE.Vector3(0, 0, -1),  // Back
};

function Floor() {
  const [ref] = usePlane<THREE.Mesh>(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -2, 0],
    type: "Static",
  }));
  return <mesh ref={ref} visible={false} />;
}

interface PhysicsDiceProps {
  onRollComplete: (faceValue: number, position: [number, number, number]) => void;
  validFaces: number[];
}

function PhysicsDice({ onRollComplete, validFaces }: PhysicsDiceProps) {
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
  const stableFrames = useRef(0);
  const lastY = useRef(5);

  // Subscribe to position and rotation
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
    return () => {
      unsubPos();
      unsubRot();
    };
  }, [api]);

  // Start the roll
  useEffect(() => {
    api.position.set(0, 5, 0);
    api.velocity.set(
      (Math.random() - 0.5) * 6,
      -2,
      (Math.random() - 0.5) * 6
    );
    api.angularVelocity.set(
      (Math.random() - 0.5) * 15,
      (Math.random() - 0.5) * 15,
      (Math.random() - 0.5) * 15
    );
  }, [api]);

  // Detect when dice has stopped moving
  useFrame(() => {
    if (hasCompletedRef.current) return;

    const currentY = lastPosition.current[1];
    const yDiff = Math.abs(currentY - lastY.current);
    
    // Check if dice has settled (Y position stable and near floor)
    if (yDiff < 0.01 && currentY < 0) {
      stableFrames.current++;
      
      // Wait for 60 stable frames (~1 second at 60fps)
      if (stableFrames.current > 60) {
        hasCompletedRef.current = true;
        
        // Stop the dice completely
        api.velocity.set(0, 0, 0);
        api.angularVelocity.set(0, 0, 0);
        
        // Capture the EXACT quaternion NOW
        const quat = new THREE.Quaternion(
          lastQuaternion.current[0],
          lastQuaternion.current[1],
          lastQuaternion.current[2],
          lastQuaternion.current[3]
        );

        // Find which face is pointing up
        let topFace = 3;
        let maxY = -Infinity;

        for (const [face, normal] of Object.entries(FACE_NORMALS)) {
          const rotatedNormal = normal.clone().applyQuaternion(quat);
          if (rotatedNormal.y > maxY) {
            maxY = rotatedNormal.y;
            topFace = parseInt(face);
          }
        }

        // Check if this face has inventory
        let finalFace = topFace;
        if (!validFaces.includes(topFace)) {
          finalFace = validFaces[Math.floor(Math.random() * validFaces.length)] || 1;
        }

        // Immediately call onRollComplete with captured values
        onRollComplete(finalFace, [...lastPosition.current] as [number, number, number]);
      }
    } else {
      stableFrames.current = 0;
    }
    
    lastY.current = currentY;
  });

  return (
    <group ref={ref}>
      <DiceModel />
    </group>
  );
}

interface SettledDiceProps {
  faceValue: number;
  position: [number, number, number];
}

// Rotations to show each face on TOP
const FACE_ROTATIONS: Record<number, [number, number, number]> = {
  1: [Math.PI / 2, 0, 0],
  2: [0, 0, -Math.PI / 2],
  3: [0, 0, 0],
  4: [Math.PI, 0, 0],
  5: [0, 0, Math.PI / 2],
  6: [-Math.PI / 2, 0, 0],
};

function SettledDice({ faceValue, position }: SettledDiceProps) {
  const meshRef = useRef<THREE.Group>(null);
  const targetRotation = FACE_ROTATIONS[faceValue] || [0, 0, 0];

  useFrame((state) => {
    if (meshRef.current) {
      // Very subtle floating
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.8) * 0.02;
    }
  });

  return (
    <group ref={meshRef} position={[position[0], position[1], position[2]]} rotation={targetRotation}>
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
  onRollComplete: (faceValue: number, position: [number, number, number]) => void;
  isDark?: boolean;
  settledFace?: number;
  landedPosition?: [number, number, number];
  validFaces: number[];
}

export function Dice3D({ diceState, onRollComplete, isDark = false, settledFace, landedPosition, validFaces }: Dice3DProps) {
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
            <PhysicsDice onRollComplete={onRollComplete} validFaces={validFaces} />
          </Physics>
        );
      case "settled":
      case "showing-splash":
        return <SettledDice faceValue={settledFace || 1} position={landedPosition || [0, -1, 0]} />;
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
          position={[0, -2, 0]} 
          opacity={isDark ? 0.6 : 0.4} 
          scale={25} 
          blur={3}
          far={6}
        />
        
        <OrbitControls 
          enableZoom={false} 
          enablePan={false} 
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={Math.PI / 4}
          autoRotate={diceState === "idle"}
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
