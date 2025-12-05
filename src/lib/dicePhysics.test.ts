import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getTargetQuaternion, getTopFace, isNearTarget, calculateCorrectiveTorque } from './dicePhysics';
import * as THREE from 'three';

/**
 * **Feature: participant-tracking, Property 8: Dice Lands on Target Face**
 * 
 * *For any* roll with a pre-determined target face T, after the physics simulation
 * completes, the detected top face of the dice SHALL equal T.
 * 
 * **Validates: Requirements 9.3**
 * 
 * This test verifies that the target quaternion calculations are correct:
 * when the dice is at the target rotation for face T, getTopFace() returns T.
 */
describe('Property 8: Dice Lands on Target Face', () => {
  it('target quaternion for any face T results in getTopFace returning T', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        (targetFace) => {
          // Get the target quaternion for this face
          const targetQuat = getTargetQuaternion(targetFace);
          
          // When dice is at target rotation, getTopFace should return the target face
          const detectedFace = getTopFace(targetQuat);
          
          expect(detectedFace).toBe(targetFace);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('dice near target rotation detects correct face', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        // Small random perturbation angles (within ~5 degrees)
        fc.float({ min: Math.fround(-0.08), max: Math.fround(0.08), noNaN: true }),
        fc.float({ min: Math.fround(-0.08), max: Math.fround(0.08), noNaN: true }),
        fc.float({ min: Math.fround(-0.08), max: Math.fround(0.08), noNaN: true }),
        (targetFace, perturbX, perturbY, perturbZ) => {
          // Get the target quaternion for this face
          const targetQuat = getTargetQuaternion(targetFace);
          
          // Apply small perturbation (simulating dice settling near target)
          const perturbation = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(perturbX, perturbY, perturbZ)
          );
          const perturbedQuat = targetQuat.clone().multiply(perturbation);
          
          // Even with small perturbation, should still detect correct face
          const detectedFace = getTopFace(perturbedQuat);
          
          expect(detectedFace).toBe(targetFace);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isNearTarget returns true when dice is at target rotation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        (targetFace) => {
          const targetQuat = getTargetQuaternion(targetFace);
          
          // Dice at exact target should be "near" target
          expect(isNearTarget(targetQuat, targetQuat)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('corrective torque is zero when dice is at target rotation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        fc.float({ min: Math.fround(0.1), max: Math.fround(5), noNaN: true }),
        (targetFace, strength) => {
          const targetQuat = getTargetQuaternion(targetFace);
          
          // When at target, corrective torque should be zero (or near zero)
          const torque = calculateCorrectiveTorque(targetQuat, targetQuat, strength);
          
          const torqueMagnitude = Math.sqrt(
            torque[0] * torque[0] + torque[1] * torque[1] + torque[2] * torque[2]
          );
          
          expect(torqueMagnitude).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });
});
