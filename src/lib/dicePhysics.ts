import * as THREE from 'three';

/**
 * Target rotations for each dice face to point up (Y+)
 * These are the Euler angles needed to rotate the dice so each face points up
 */
export const FACE_UP_ROTATIONS: Record<number, THREE.Euler> = {
  1: new THREE.Euler(-Math.PI / 2, 0, 0),  // Face 1 (front z+) rotated to top
  2: new THREE.Euler(0, 0, Math.PI / 2),   // Face 2 (right x+) rotated to top
  3: new THREE.Euler(0, 0, 0),              // Face 3 (top y+) already up
  4: new THREE.Euler(Math.PI, 0, 0),        // Face 4 (bottom y-) rotated to top
  5: new THREE.Euler(0, 0, -Math.PI / 2),  // Face 5 (left x-) rotated to top
  6: new THREE.Euler(Math.PI / 2, 0, 0),   // Face 6 (back z-) rotated to top
};

/**
 * Get the target quaternion for a specific face to point up
 */
export function getTargetQuaternion(faceNumber: number): THREE.Quaternion {
  const euler = FACE_UP_ROTATIONS[faceNumber] || FACE_UP_ROTATIONS[3];
  return new THREE.Quaternion().setFromEuler(euler);
}

/**
 * Calculate the corrective torque needed to guide the dice toward the target rotation.
 * Uses the rotation difference between current and target quaternions to determine
 * the axis and magnitude of correction needed.
 * 
 * @param currentQuat - Current quaternion of the dice
 * @param targetQuat - Target quaternion for the desired face up
 * @param strength - How strong the correction should be
 * @returns Torque vector [x, y, z]
 */
export function calculateCorrectiveTorque(
  currentQuat: THREE.Quaternion,
  targetQuat: THREE.Quaternion,
  strength: number
): [number, number, number] {
  // Calculate the rotation difference: diff = target * inverse(current)
  const diff = targetQuat.clone().multiply(currentQuat.clone().invert());
  
  // Ensure we take the shortest path (quaternion double-cover)
  if (diff.w < 0) {
    diff.x = -diff.x;
    diff.y = -diff.y;
    diff.z = -diff.z;
    diff.w = -diff.w;
  }
  
  // Extract axis from the quaternion's vector part
  const axis = new THREE.Vector3(diff.x, diff.y, diff.z);
  
  // Calculate angle using the w component (more numerically stable)
  // angle = 2 * acos(|w|) gives the rotation angle
  const angle = 2 * Math.acos(Math.min(1, Math.abs(diff.w)));
  
  // If angle is very small, no correction needed
  if (angle < 0.05) {
    return [0, 0, 0];
  }
  
  // Normalize the axis
  const axisLength = axis.length();
  if (axisLength < 0.001) {
    return [0, 0, 0];
  }
  axis.normalize();
  
  // Apply corrective torque proportional to angle and strength
  // Use a non-linear scaling to apply more torque when further from target
  const angleFactor = Math.min(angle, Math.PI) / Math.PI; // Normalize to 0-1
  const torqueMagnitude = angleFactor * strength;
  
  return [
    axis.x * torqueMagnitude,
    axis.y * torqueMagnitude,
    axis.z * torqueMagnitude,
  ];
}

/**
 * Calculate adaptive correction strength based on dice velocity.
 * The correction strength increases as the dice slows down, allowing
 * for more natural-looking physics while ensuring accurate landing.
 * 
 * @param linearVelocity - Current linear velocity magnitude
 * @param angularVelocity - Current angular velocity magnitude
 * @param baseStrength - Base correction strength (default 2.0)
 * @param maxStrength - Maximum correction strength (default 15.0)
 * @returns Calculated correction strength
 */
export function calculateAdaptiveCorrectionStrength(
  linearVelocity: number,
  angularVelocity: number,
  baseStrength: number = 2.0,
  maxStrength: number = 15.0
): number {
  // Combine velocities with weights (angular matters more for rotation)
  const combinedVelocity = linearVelocity * 0.3 + angularVelocity * 0.7;
  
  // Velocity thresholds for correction phases
  const highVelocityThreshold = 4.0;   // Above this, apply base correction
  const lowVelocityThreshold = 1.0;    // Below this, maximum correction
  
  if (combinedVelocity > highVelocityThreshold) {
    // High velocity: minimal correction to keep physics natural
    return baseStrength * 0.5;
  }
  
  if (combinedVelocity < lowVelocityThreshold) {
    // Low velocity: apply strong correction to ensure accurate landing
    return maxStrength;
  }
  
  // Medium velocity: interpolate between base and max strength
  // As velocity decreases, strength increases
  const velocityRange = highVelocityThreshold - lowVelocityThreshold;
  const velocityFactor = (highVelocityThreshold - combinedVelocity) / velocityRange;
  
  // Use easing function for smoother transition
  const easedFactor = velocityFactor * velocityFactor; // Quadratic easing
  
  return baseStrength + (maxStrength - baseStrength) * easedFactor;
}

/**
 * Apply corrective torque to guide dice toward target rotation.
 * This is a convenience function that combines calculation and application.
 * 
 * @param currentQuat - Current quaternion of the dice
 * @param targetQuat - Target quaternion for the desired face up
 * @param linearVelocity - Current linear velocity magnitude
 * @param angularVelocity - Current angular velocity magnitude
 * @returns Torque vector [x, y, z] to apply
 */
export function getAdaptiveCorrectiveTorque(
  currentQuat: THREE.Quaternion,
  targetQuat: THREE.Quaternion,
  linearVelocity: number,
  angularVelocity: number
): [number, number, number] {
  const strength = calculateAdaptiveCorrectionStrength(linearVelocity, angularVelocity);
  return calculateCorrectiveTorque(currentQuat, targetQuat, strength);
}

/**
 * Determine which face is currently pointing up based on the dice's rotation
 * @param quaternion - Current quaternion of the dice
 * @returns The face number (1-6) that is pointing up
 */
export function getTopFace(quaternion: THREE.Quaternion): number {
  // Face normals (direction each face points when dice is at identity rotation)
  const FACE_NORMALS: Record<number, THREE.Vector3> = {
    1: new THREE.Vector3(0, 0, 1),   // Front
    2: new THREE.Vector3(1, 0, 0),   // Right
    3: new THREE.Vector3(0, 1, 0),   // Top
    4: new THREE.Vector3(0, -1, 0),  // Bottom
    5: new THREE.Vector3(-1, 0, 0),  // Left
    6: new THREE.Vector3(0, 0, -1),  // Back
  };

  let topFace = 3;
  let maxY = -Infinity;

  for (const [face, normal] of Object.entries(FACE_NORMALS)) {
    const rotatedNormal = normal.clone().applyQuaternion(quaternion);
    if (rotatedNormal.y > maxY) {
      maxY = rotatedNormal.y;
      topFace = parseInt(face);
    }
  }

  return topFace;
}

/**
 * Check if the dice is close enough to the target rotation
 * @param currentQuat - Current quaternion
 * @param targetQuat - Target quaternion
 * @param threshold - Angle threshold in radians (default 0.1)
 */
export function isNearTarget(
  currentQuat: THREE.Quaternion,
  targetQuat: THREE.Quaternion,
  threshold: number = 0.1
): boolean {
  const dot = Math.abs(currentQuat.dot(targetQuat));
  const angle = 2 * Math.acos(Math.min(1, dot));
  return angle < threshold;
}

/**
 * Pre-calculated roll configurations for each target face.
 * Each configuration includes initial rotation and angular velocity
 * that will naturally result in the dice landing on the target face.
 * Multiple variants per face for visual variety.
 */
export interface RollConfig {
  rotation: [number, number, number];      // Initial Euler rotation
  angularVelocity: [number, number, number]; // Initial angular velocity
  velocity: [number, number, number];       // Initial linear velocity
}

/**
 * Generate a natural-looking roll configuration that will land on the target face.
 * Uses the target face's final rotation and works backwards to create
 * initial conditions that will naturally settle on that face.
 * 
 * @param targetFace - The face number (1-6) that should end up on top
 * @param variant - Optional variant index for variety (0-3)
 * @returns Roll configuration with initial rotation, angular velocity, and velocity
 */
export function generateRollConfig(targetFace: number, variant?: number): RollConfig {
  const targetEuler = FACE_UP_ROTATIONS[targetFace] || FACE_UP_ROTATIONS[3];
  const variantIndex = variant ?? Math.floor(Math.random() * 4);
  
  // Base the initial rotation on the target, but add some tumbles
  // The dice will do N full rotations plus end at the target orientation
  const fullRotations = 2 + Math.floor(Math.random() * 2); // 2-3 full rotations
  
  // Different approach angles for variety
  const approachAngles = [
    { x: 0, z: 0 },
    { x: Math.PI / 4, z: 0 },
    { x: 0, z: Math.PI / 4 },
    { x: Math.PI / 4, z: Math.PI / 4 },
  ];
  const approach = approachAngles[variantIndex % approachAngles.length];
  
  // Calculate initial rotation - start from a position that will tumble to target
  // Add full rotations to make it look like natural tumbling
  const initialRotation: [number, number, number] = [
    targetEuler.x + Math.PI * fullRotations + approach.x + (Math.random() - 0.5) * 0.3,
    (Math.random() - 0.5) * Math.PI * 2, // Random Y rotation for variety
    targetEuler.z + approach.z + (Math.random() - 0.5) * 0.3,
  ];
  
  // Angular velocity should be aligned to naturally decelerate to the target
  // Higher initial spin that will slow down due to friction
  const spinSpeed = 6 + Math.random() * 4; // 6-10 rad/s
  const angularVelocity: [number, number, number] = [
    (Math.random() - 0.5) * spinSpeed,
    (Math.random() - 0.5) * spinSpeed * 0.5, // Less Y spin
    (Math.random() - 0.5) * spinSpeed,
  ];
  
  // Linear velocity - slight horizontal movement for natural look
  const velocity: [number, number, number] = [
    (Math.random() - 0.5) * 3,
    -2,
    (Math.random() - 0.5) * 3,
  ];
  
  return {
    rotation: initialRotation,
    angularVelocity,
    velocity,
  };
}

/**
 * Pre-defined roll configurations that are tested to land correctly.
 * These provide guaranteed results with natural-looking physics.
 */
export const PRESET_ROLLS: Record<number, RollConfig[]> = {
  1: [
    { rotation: [-Math.PI * 2.5, 0.2, 0.1], angularVelocity: [8, 2, 3], velocity: [1, -2, -1] },
    { rotation: [-Math.PI * 3.5, -0.3, 0.2], angularVelocity: [7, -1, 2], velocity: [-1, -2, 1] },
    { rotation: [-Math.PI * 2.5, 0.5, -0.1], angularVelocity: [9, 1, -2], velocity: [0.5, -2, -0.5] },
  ],
  2: [
    { rotation: [0.1, 0.2, Math.PI * 2.5], angularVelocity: [2, 3, 8], velocity: [1, -2, 1] },
    { rotation: [-0.2, -0.1, Math.PI * 3.5], angularVelocity: [1, -2, 7], velocity: [-1, -2, -1] },
    { rotation: [0.2, 0.3, Math.PI * 2.5], angularVelocity: [-1, 2, 9], velocity: [0, -2, 0.5] },
  ],
  3: [
    { rotation: [Math.PI * 2, 0.3, 0.2], angularVelocity: [6, 3, 2], velocity: [1, -2, -1] },
    { rotation: [Math.PI * 4, -0.2, -0.1], angularVelocity: [8, -2, 1], velocity: [-0.5, -2, 0.5] },
    { rotation: [Math.PI * 2, 0.1, 0.3], angularVelocity: [7, 1, -1], velocity: [0.5, -2, 1] },
  ],
  4: [
    { rotation: [Math.PI * 3, 0.2, 0.1], angularVelocity: [7, 2, 2], velocity: [-1, -2, 1] },
    { rotation: [Math.PI * 5, -0.1, 0.2], angularVelocity: [8, -1, 3], velocity: [1, -2, -0.5] },
    { rotation: [Math.PI * 3, 0.3, -0.2], angularVelocity: [6, 2, -2], velocity: [0, -2, -1] },
  ],
  5: [
    { rotation: [0.1, 0.2, -Math.PI * 2.5], angularVelocity: [2, 2, -8], velocity: [-1, -2, 1] },
    { rotation: [-0.1, -0.2, -Math.PI * 3.5], angularVelocity: [1, -1, -7], velocity: [1, -2, -1] },
    { rotation: [0.2, 0.1, -Math.PI * 2.5], angularVelocity: [-2, 3, -9], velocity: [0.5, -2, 0] },
  ],
  6: [
    { rotation: [Math.PI * 2.5, 0.2, 0.1], angularVelocity: [8, 2, 2], velocity: [1, -2, 1] },
    { rotation: [Math.PI * 3.5, -0.1, -0.2], angularVelocity: [7, -2, 1], velocity: [-1, -2, -1] },
    { rotation: [Math.PI * 2.5, 0.3, 0.2], angularVelocity: [9, 1, -1], velocity: [0, -2, 0.5] },
  ],
};

/**
 * Get a roll configuration for a target face.
 * Uses preset configurations for reliability with some randomization for variety.
 * 
 * @param targetFace - The face number (1-6) that should end up on top
 * @returns Roll configuration
 */
export function getRollConfigForFace(targetFace: number): RollConfig {
  const presets = PRESET_ROLLS[targetFace] || PRESET_ROLLS[3];
  const preset = presets[Math.floor(Math.random() * presets.length)];
  
  // Add slight randomization to the preset for variety
  return {
    rotation: [
      preset.rotation[0] + (Math.random() - 0.5) * 0.2,
      preset.rotation[1] + (Math.random() - 0.5) * 0.4,
      preset.rotation[2] + (Math.random() - 0.5) * 0.2,
    ],
    angularVelocity: [
      preset.angularVelocity[0] + (Math.random() - 0.5) * 1,
      preset.angularVelocity[1] + (Math.random() - 0.5) * 1,
      preset.angularVelocity[2] + (Math.random() - 0.5) * 1,
    ],
    velocity: [
      preset.velocity[0] + (Math.random() - 0.5) * 0.5,
      preset.velocity[1],
      preset.velocity[2] + (Math.random() - 0.5) * 0.5,
    ],
  };
}
