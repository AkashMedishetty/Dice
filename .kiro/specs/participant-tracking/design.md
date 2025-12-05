# Design Document

## Overview

This design extends the Lucky Dice application with a MongoDB-backed participant tracking system, serverless API routes for Vercel deployment, and enhanced dice animations. The system replaces localStorage with MongoDB for persistence and multi-screen synchronization, implements atomic inventory management to handle 2000+ concurrent users, and adds a camera focus animation to clearly show the winning dice face.

## Architecture

```mermaid
graph TB
    subgraph "Frontend (React + Three.js)"
        UI[Roll Page]
        Admin[Admin Dashboard]
        Dice[Dice3D Component]
        EmailModal[Email Modal]
    end
    
    subgraph "Vercel Serverless Functions"
        API_Roll[/api/roll]
        API_Prizes[/api/prizes]
        API_Entries[/api/entries]
        API_Stats[/api/stats]
    end
    
    subgraph "MongoDB Atlas"
        Prizes[(prizes collection)]
        Entries[(entries collection)]
    end
    
    UI --> EmailModal
    EmailModal --> API_Roll
    API_Roll --> Prizes
    API_Roll --> Entries
    
    Admin --> API_Entries
    Admin --> API_Prizes
    Admin --> API_Stats
    
    API_Entries --> Entries
    API_Prizes --> Prizes
    API_Stats --> Entries
    API_Stats --> Prizes
    
    Dice --> UI
```

## Components and Interfaces

### API Routes

#### POST /api/roll
Initiates a roll, reserves inventory atomically, and returns the winning face.

```typescript
// Request
interface RollRequest {
  email: string;
}

// Response
interface RollResponse {
  success: boolean;
  entryId: string;
  winningFace: number;
  prize: {
    id: number;
    name: string;
    description: string;
    icon: string;
  };
  error?: string;
}
```

#### POST /api/roll/confirm
Confirms a roll after physics simulation completes.

```typescript
// Request
interface ConfirmRequest {
  entryId: string;
}

// Response
interface ConfirmResponse {
  success: boolean;
  error?: string;
}
```

#### GET /api/prizes
Returns current prize inventory.

```typescript
// Response
interface PrizesResponse {
  prizes: Prize[];
  availableFaces: number[];
}
```

#### PUT /api/prizes/:id
Updates a prize configuration.

```typescript
// Request
interface UpdatePrizeRequest {
  name?: string;
  description?: string;
  icon?: string;
  inventory?: number;
}
```

#### GET /api/entries
Returns paginated roll entries with filtering.

```typescript
// Query params: page, limit, status (all|collected|pending), search
// Response
interface EntriesResponse {
  entries: Entry[];
  total: number;
  page: number;
  totalPages: number;
}
```

#### PATCH /api/entries/:id
Updates entry collection status.

```typescript
// Request
interface UpdateEntryRequest {
  collected: boolean;
}
```

#### GET /api/stats
Returns dashboard statistics.

```typescript
// Response
interface StatsResponse {
  totalRolls: number;
  collected: number;
  pending: number;
  prizeDistribution: { prizeId: number; name: string; count: number }[];
}
```

### Frontend Components

#### EmailModal
New modal component for collecting participant email before rolling.

```typescript
interface EmailModalProps {
  isOpen: boolean;
  onSubmit: (email: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}
```

#### Enhanced Dice3D
Modified to support rigged physics and camera focus animation.

```typescript
interface Dice3DProps {
  diceState: DiceState;
  targetFace?: number; // Pre-determined winning face
  onRollComplete: (faceValue: number, position: [...], quaternion: [...]) => void;
  onCameraFocusComplete: () => void; // New callback
  // ... existing props
}
```

#### ParticipantsTable
New component for admin dashboard showing roll entries.

```typescript
interface ParticipantsTableProps {
  entries: Entry[];
  onStatusChange: (entryId: string, collected: boolean) => void;
  isLoading: boolean;
}
```

## Data Models

### Prize (MongoDB Collection: prizes)

```typescript
interface Prize {
  _id: ObjectId;
  id: number;           // Dice face number (1-6)
  name: string;
  description: string;
  icon: string;
  inventory: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Entry (MongoDB Collection: entries)

```typescript
interface Entry {
  _id: ObjectId;
  email: string;
  prizeId: number;
  prizeName: string;
  prizeIcon: string;
  collected: boolean;
  status: 'reserved' | 'confirmed' | 'released';
  createdAt: Date;
  updatedAt: Date;
}
```

### Indexes

```javascript
// prizes collection
{ id: 1 } // unique

// entries collection
{ email: 1 }
{ status: 1 }
{ collected: 1 }
{ createdAt: -1 }
{ email: "text" } // text search
```



## Rigged Dice Physics

The dice must land on a pre-determined face naturally. This is achieved by:

1. **Pre-roll API Call**: Before physics starts, call `/api/roll` to get the winning face
2. **Target Rotation Calculation**: Calculate the quaternion needed for the target face to point up
3. **Guided Physics**: Apply subtle corrective torques during simulation to guide toward target rotation
4. **Natural Landing**: The dice appears to land naturally while always hitting the correct face

```typescript
// Target rotations for each face to point up (Y+)
const FACE_UP_ROTATIONS: Record<number, THREE.Euler> = {
  1: new THREE.Euler(-Math.PI / 2, 0, 0),  // Face 1 (front) rotated to top
  2: new THREE.Euler(0, 0, Math.PI / 2),   // Face 2 (right) rotated to top
  3: new THREE.Euler(0, 0, 0),              // Face 3 (top) already up
  4: new THREE.Euler(Math.PI, 0, 0),        // Face 4 (bottom) rotated to top
  5: new THREE.Euler(0, 0, -Math.PI / 2),  // Face 5 (left) rotated to top
  6: new THREE.Euler(Math.PI / 2, 0, 0),   // Face 6 (back) rotated to top
};
```

### Correction Algorithm

```typescript
function applyCorrectiveTorque(
  currentQuat: THREE.Quaternion,
  targetQuat: THREE.Quaternion,
  api: PublicApi,
  strength: number
) {
  // Calculate rotation difference
  const diff = targetQuat.clone().multiply(currentQuat.clone().invert());
  const axis = new THREE.Vector3(diff.x, diff.y, diff.z).normalize();
  const angle = 2 * Math.acos(Math.abs(diff.w));
  
  // Apply gentle corrective torque
  if (angle > 0.1) {
    api.applyTorque([
      axis.x * angle * strength,
      axis.y * angle * strength,
      axis.z * angle * strength
    ]);
  }
}
```

## Camera Focus Animation

After the dice settles, the camera smoothly transitions to show the winning face from above.

```typescript
// Camera animation sequence
const cameraFocusAnimation = {
  // Starting position (current camera)
  from: { position: [0, 5, 12], lookAt: [0, 0, 0] },
  
  // Ending position (above dice, looking down at winning face)
  to: { 
    position: [diceX, diceY + 4, diceZ + 2], 
    lookAt: [diceX, diceY, diceZ] 
  },
  
  duration: 1.5, // seconds
  easing: 'power2.inOut'
};
```

### Implementation with GSAP

```typescript
function animateCameraToFace(
  camera: THREE.Camera,
  dicePosition: [number, number, number],
  onComplete: () => void
) {
  const timeline = gsap.timeline({ onComplete });
  
  timeline.to(camera.position, {
    x: dicePosition[0],
    y: dicePosition[1] + 4,
    z: dicePosition[2] + 2,
    duration: 1.5,
    ease: "power2.inOut"
  });
  
  // Simultaneously animate lookAt
  const lookAtTarget = { x: 0, y: 0, z: 0 };
  timeline.to(lookAtTarget, {
    x: dicePosition[0],
    y: dicePosition[1],
    z: dicePosition[2],
    duration: 1.5,
    ease: "power2.inOut",
    onUpdate: () => camera.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z)
  }, 0);
}
```

## Error Handling

### API Error Responses

```typescript
interface APIError {
  success: false;
  error: string;
  code: 'INVALID_EMAIL' | 'NO_INVENTORY' | 'DB_ERROR' | 'NOT_FOUND' | 'CONFLICT';
}
```

### Retry Logic

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 100
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(baseDelay * Math.pow(2, i)); // Exponential backoff
    }
  }
  throw new Error('Max retries exceeded');
}
```

### Inventory Conflict Resolution

When two screens attempt to claim the last prize:

1. First request wins via MongoDB's `findOneAndUpdate` with `inventory > 0` condition
2. Second request receives `NO_INVENTORY` error
3. Frontend re-fetches available faces and prompts user to roll again



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Email Validation Correctness
*For any* string input, if the string matches a valid email format (contains @ with valid local and domain parts), the system SHALL accept it; otherwise, the system SHALL reject it with a validation error.
**Validates: Requirements 1.2, 1.3**

### Property 2: Entry Completeness
*For any* successfully completed roll, the created entry SHALL contain all required fields: email (non-empty string), prizeId (1-6), prizeName (non-empty string), prizeIcon (non-empty string), timestamp (valid date), and collected (boolean, initially false).
**Validates: Requirements 2.1**

### Property 3: Entry Uniqueness
*For any* two roll entries in the database, their _id fields SHALL be different.
**Validates: Requirements 2.3**

### Property 4: Inventory Decrement Invariant
*For any* successful roll that awards prize P, the inventory of P in the database SHALL decrease by exactly 1 compared to before the roll.
**Validates: Requirements 2.4**

### Property 5: Filter Correctness
*For any* filter query (status: collected/pending) and search query (email substring), all returned entries SHALL match the filter criteria AND contain the search substring in their email field.
**Validates: Requirements 3.3, 3.4**

### Property 6: Sort Correctness
*For any* list of entries returned by the API, entries SHALL be sorted by createdAt timestamp in descending order (newest first).
**Validates: Requirements 3.5**

### Property 7: Atomic Inventory Constraint
*For any* sequence of N concurrent roll requests for a prize with initial inventory I, the total number of successful rolls SHALL be at most min(N, I), and the final inventory SHALL be max(0, I - successful_rolls).
**Validates: Requirements 5.2, 11.4**

### Property 8: Dice Lands on Target Face
*For any* roll with a pre-determined target face T, after the physics simulation completes, the detected top face of the dice SHALL equal T.
**Validates: Requirements 9.3**

### Property 9: Statistics Consistency
*For any* statistics query, the following invariants SHALL hold:
- totalRolls == collected + pending
- sum(prizeDistribution.count) == totalRolls
- Each prizeDistribution.count == count of entries with that prizeId
**Validates: Requirements 8.1, 8.2, 8.3**

### Property 10: Prize Update Persistence
*For any* prize update operation (name, description, icon, or inventory), immediately querying the prize SHALL return the updated values.
**Validates: Requirements 10.1, 10.2**

### Property 11: Roll Confirmation State
*For any* roll that completes the full flow (email → API → physics → confirm), the entry status SHALL be 'confirmed'.
**Validates: Requirements 11.2**

### Property 12: Failed Roll Recovery
*For any* roll that fails after inventory reservation but before confirmation, the reserved inventory SHALL be released (inventory restored to pre-reservation value).
**Validates: Requirements 11.3**

## Testing Strategy

### Property-Based Testing Library
We will use **fast-check** for property-based testing in TypeScript/JavaScript. It integrates well with Vitest and provides excellent shrinking for counterexamples.

### Test Configuration
- Minimum 100 iterations per property test
- Each property test tagged with: `**Feature: participant-tracking, Property {number}: {property_text}**`

### Unit Tests
Unit tests will cover:
- API route handlers (success and error paths)
- Email validation edge cases
- MongoDB query builders
- Camera animation timing
- Dice physics correction algorithm

### Property-Based Tests

#### Email Validation Properties
```typescript
// Property 1: Email validation
fc.assert(
  fc.property(fc.emailAddress(), (email) => {
    expect(validateEmail(email)).toBe(true);
  }),
  { numRuns: 100 }
);

fc.assert(
  fc.property(fc.string().filter(s => !s.includes('@')), (notEmail) => {
    expect(validateEmail(notEmail)).toBe(false);
  }),
  { numRuns: 100 }
);
```

#### Inventory Atomicity Properties
```typescript
// Property 7: Atomic inventory
fc.assert(
  fc.property(
    fc.integer({ min: 1, max: 100 }), // initial inventory
    fc.integer({ min: 1, max: 50 }),  // concurrent requests
    async (inventory, requests) => {
      await resetPrizeInventory(1, inventory);
      const results = await Promise.all(
        Array(requests).fill(null).map(() => rollForPrize(1))
      );
      const successes = results.filter(r => r.success).length;
      const finalInventory = await getPrizeInventory(1);
      
      expect(successes).toBeLessThanOrEqual(inventory);
      expect(finalInventory).toBe(Math.max(0, inventory - successes));
    }
  ),
  { numRuns: 100 }
);
```

#### Statistics Consistency Properties
```typescript
// Property 9: Statistics consistency
fc.assert(
  fc.property(fc.constant(null), async () => {
    const stats = await getStats();
    
    expect(stats.totalRolls).toBe(stats.collected + stats.pending);
    expect(stats.prizeDistribution.reduce((sum, p) => sum + p.count, 0))
      .toBe(stats.totalRolls);
  }),
  { numRuns: 100 }
);
```

### Integration Tests
- Full roll flow (email → roll → physics → confirm → verify entry)
- Admin dashboard CRUD operations
- Concurrent roll stress test
- Camera animation sequence timing

### Test Database
Tests will use a separate MongoDB database (test environment) that is reset before each test suite.
