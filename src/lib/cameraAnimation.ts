import * as THREE from 'three';
import { gsap } from 'gsap';

/**
 * Camera animation configuration
 * Based on design document specifications for camera focus animation
 */
export interface CameraAnimationConfig {
  /** Duration of the animation in seconds (default: 1.5) */
  duration?: number;
  /** GSAP easing function (default: 'power2.inOut') */
  ease?: string;
  /** Vertical offset above the dice (default: 4) */
  heightOffset?: number;
  /** Z offset from the dice (default: 2) */
  depthOffset?: number;
}

const DEFAULT_CONFIG: Required<CameraAnimationConfig> = {
  duration: 1.5,
  ease: 'power2.inOut',
  heightOffset: 4,
  depthOffset: 2,
};

/**
 * Animate camera to focus on the dice's winning face from above.
 * Uses GSAP for smooth 60fps animation performance.
 * 
 * Requirements: 6.1, 6.2
 * - Smooth transition to position above dice
 * - Duration 1.5 seconds with easeInOut
 * - Display winning face clearly visible from above
 * 
 * @param camera - Three.js camera to animate
 * @param dicePosition - Final position of the dice [x, y, z]
 * @param onComplete - Callback when animation completes
 * @param config - Optional animation configuration
 * @returns GSAP timeline for potential control/cancellation
 */
export function animateCameraToFace(
  camera: THREE.Camera,
  dicePosition: [number, number, number],
  onComplete?: () => void,
  config: CameraAnimationConfig = {}
): gsap.core.Timeline {
  const { duration, ease, heightOffset, depthOffset } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // Target position: above and slightly in front of the dice
  // Position camera at a fixed angle for consistent viewing
  const targetPosition = {
    x: dicePosition[0],
    y: dicePosition[1] + heightOffset,
    z: dicePosition[2] + depthOffset,
  };

  // Create timeline for coordinated animation
  const timeline = gsap.timeline({ onComplete });

  // Reset camera up vector to ensure correct orientation
  camera.up.set(0, 1, 0);

  // Animate camera position
  timeline.to(camera.position, {
    x: targetPosition.x,
    y: targetPosition.y,
    z: targetPosition.z,
    duration,
    ease,
    onUpdate: () => {
      // Ensure up vector stays correct during animation
      camera.up.set(0, 1, 0);
      // Keep camera looking at the dice during animation
      camera.lookAt(dicePosition[0], dicePosition[1], dicePosition[2]);
    },
  });

  return timeline;
}

/**
 * Calculate the target camera position for focusing on dice
 * 
 * @param dicePosition - Position of the dice
 * @param config - Animation configuration
 * @returns Target camera position
 */
export function calculateCameraTargetPosition(
  dicePosition: [number, number, number],
  config: CameraAnimationConfig = {}
): { x: number; y: number; z: number } {
  const { heightOffset, depthOffset } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  return {
    x: dicePosition[0],
    y: dicePosition[1] + heightOffset,
    z: dicePosition[2] + depthOffset,
  };
}

/**
 * Reset camera to default position
 * 
 * @param camera - Three.js camera to reset
 * @param defaultPosition - Default camera position (default: [0, 5, 12])
 * @param duration - Animation duration in seconds (default: 1.0)
 * @returns GSAP timeline
 */
export function resetCameraPosition(
  camera: THREE.Camera,
  defaultPosition: [number, number, number] = [0, 5, 12],
  duration: number = 1.0
): gsap.core.Timeline {
  const timeline = gsap.timeline();

  // Reset up vector before animation
  camera.up.set(0, 1, 0);

  timeline.to(camera.position, {
    x: defaultPosition[0],
    y: defaultPosition[1],
    z: defaultPosition[2],
    duration,
    ease: 'power2.out',
    onUpdate: () => {
      // Ensure up vector stays correct
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
    },
  });

  return timeline;
}
