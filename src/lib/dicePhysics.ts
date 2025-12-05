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
 * @param baseStrength - Base correction strength (default 5.0)
 * @param maxStrength - Maximum correction strength (default 40.0)
 * @returns Calculated correction strength
 */
export function calculateAdaptiveCorrectionStrength(
  linearVelocity: number,
  angularVelocity: number,
  baseStrength: number = 5.0,
  maxStrength: number = 40.0
): number {
  // Combine velocities with weights (angular matters more for rotation)
  const combinedVelocity = linearVelocity * 0.3 + angularVelocity * 0.7;
  
  // Velocity thresholds for correction phases
  const highVelocityThreshold = 8.0;   // Above this, apply base correction
  const lowVelocityThreshold = 2.0;    // Below this, maximum correction
  
  if (combinedVelocity > highVelocityThreshold) {
    // High velocity: still apply decent correction to start guiding early
    return baseStrength;
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
