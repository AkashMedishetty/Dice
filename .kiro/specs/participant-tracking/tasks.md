# Implementation Plan

- [x] 1. Set up MongoDB and serverless infrastructure



  - [x] 1.1 Install MongoDB dependencies and configure connection

    - Install mongodb package
    - Create lib/mongodb.ts with connection pooling for serverless
    - Add MONGODB_URI to environment variables
    - _Requirements: 7.2, 7.3_

  - [x] 1.2 Create database schema and seed data

    - Create types/database.ts with Prize and Entry interfaces
    - Create lib/db/prizes.ts with CRUD operations
    - Create lib/db/entries.ts with CRUD operations
    - Add seed script for default prizes (faces 1-6)
    - _Requirements: 2.1, 2.3_
  - [x] 1.3 Write property test for entry uniqueness


    - **Property 3: Entry Uniqueness**
    - **Validates: Requirements 2.3**

- [x] 2. Implement core API routes



  - [x] 2.1 Create GET /api/prizes endpoint

    - Return all prizes with inventory counts
    - Return availableFaces array (faces with inventory > 0)
    - _Requirements: 9.4_

  - [x] 2.2 Create PUT /api/prizes/[id] endpoint

    - Update prize name, description, icon, or inventory
    - Validate prize ID exists
    - _Requirements: 10.1, 10.2_
  - [x] 2.3 Write property test for prize update persistence


    - **Property 10: Prize Update Persistence**
    - **Validates: Requirements 10.1, 10.2**
  - [x] 2.4 Create POST /api/roll endpoint with atomic inventory


    - Validate email format
    - Select random available face
    - Atomically decrement inventory and create entry with status 'reserved'
    - Return winning face and entry ID
    - _Requirements: 1.2, 1.3, 2.1, 5.2, 9.2, 11.1_

  - [x] 2.5 Write property test for email validation

    - **Property 1: Email Validation Correctness**
    - **Validates: Requirements 1.2, 1.3**

  - [x] 2.6 Write property test for atomic inventory constraint

    - **Property 7: Atomic Inventory Constraint**
    - **Validates: Requirements 5.2, 11.4**
  - [x] 2.7 Create POST /api/roll/confirm endpoint


    - Update entry status from 'reserved' to 'confirmed'
    - _Requirements: 11.2_

  - [x] 2.8 Write property test for roll confirmation state

    - **Property 11: Roll Confirmation State**
    - **Validates: Requirements 11.2**

  - [x] 2.9 Create POST /api/roll/release endpoint

    - Release reserved inventory on failed rolls
    - Update entry status to 'released' and restore inventory
    - _Requirements: 11.3_
  - [x] 2.10 Write property test for failed roll recovery


    - **Property 12: Failed Roll Recovery**
    - **Validates: Requirements 11.3**

- [x] 3. Checkpoint - Ensure all tests pass


  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement entries and stats API routes



  - [x] 4.1 Create GET /api/entries endpoint
    - Support pagination (page, limit query params)
    - Support filtering by status (all, collected, pending)
    - Support search by email
    - Sort by createdAt descending

    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 4.2 Write property test for filter correctness
    - **Property 5: Filter Correctness**
    - **Validates: Requirements 3.3, 3.4**

  - [x] 4.3 Write property test for sort correctness
    - **Property 6: Sort Correctness**
    - **Validates: Requirements 3.5**
  - [x] 4.4 Create PATCH /api/entries/[id] endpoint

    - Update collected status
    - _Requirements: 4.1, 4.2_

  - [x] 4.5 Create GET /api/stats endpoint
    - Return totalRolls, collected, pending counts
    - Return prize distribution breakdown

    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 4.6 Write property test for statistics consistency
    - **Property 9: Statistics Consistency**
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [-] 5. Implement rigged dice physics


  - [x] 5.1 Create target rotation calculations

    - Define FACE_UP_ROTATIONS for each face (1-6)
    - Create function to calculate target quaternion
    - _Requirements: 9.3_

  - [x] 5.2 Implement corrective torque algorithm





    - Calculate rotation difference between current and target
    - Apply gentle corrective torques during physics simulation
    - Increase correction strength as dice slows down
    - _Requirements: 9.3_

  - [x] 5.3 Update PhysicsDice component to accept targetFace prop





    - Integrate corrective torque into useFrame loop
    - Ensure dice lands on exact target face
    - _Requirements: 9.2, 9.3_
  - [x] 5.4 Write property test for dice landing accuracy



    - **Property 8: Dice Lands on Target Face**
    - **Validates: Requirements 9.3**


- [x] 6. Implement camera focus animation





  - [x] 6.1 Create camera animation utility


    - Use GSAP to animate camera position and lookAt
    - Smooth transition to position above dice
    - Duration 1.5 seconds with easeInOut

    - _Requirements: 6.1, 6.2_

  - [x] 6.2 Integrate camera animation into Dice3D component

    - Trigger animation when dice settles
    - Add onCameraFocusComplete callback

    - Maintain 60fps performance
    - _Requirements: 6.1, 6.3_


  - [x] 6.3 Update roll flow to sequence animations





    - Dice settles → Camera focuses → Splash appears
    - _Requirements: 6.4_

- [x] 7. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement email modal and roll flow





  - [x] 8.1 Create EmailModal component

    - Email input with validation

    - Submit and cancel buttons
    - Loading state during API call
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 8.2 Update Index page roll flow
    - Show EmailModal on roll button click
    - Call /api/roll with email
    - Pass targetFace to Dice3D
    - Call /api/roll/confirm after physics completes
    - Handle errors and retry
    - _Requirements: 1.1, 2.2, 11.2_
  - [x] 8.3 Write property test for entry completeness


    - **Property 2: Entry Completeness**
    - **Validates: Requirements 2.1**
  - [x] 8.4 Write property test for inventory decrement


    - **Property 4: Inventory Decrement Invariant**
    - **Validates: Requirements 2.4**

- [x] 9. Implement admin participants page

  - [x] 9.1 Create ParticipantsTable component





    - Display email, prize, timestamp, status columns
    - Mark as Collected/Pending buttons
    - Pagination controls

    - _Requirements: 3.1, 3.2, 4.1, 4.2_
  - [x] 9.2 Create filter and search controls


    - Status filter dropdown (All, Collected, Pending)

    - Email search input with debounce
    - _Requirements: 3.3, 3.4_
  - [x] 9.3 Create StatsCards component

    - Total rolls, collected, pending cards
    - Prize distribution chart
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 9.4 Update Admin page with new components



    - Add Participants tab alongside existing Prizes tab

    - Integrate stats, filters, and table
    - _Requirements: 3.1, 8.1_


- [x] 10. Update prize management to use MongoDB





  - [x] 10.1 Update AdminDashboard to use API


    - Fetch prizes from /api/prizes
    - Update prizes via PUT /api/prizes/[id]
    - _Requirements: 10.1, 10.2_

  - [x] 10.2 Implement reset functionality

    - Create POST /api/prizes/reset endpoint
    - Restore default inventory values
    - _Requirements: 10.3_
  - [x] 10.3 Remove localStorage dependencies


    - Delete lib/giftStore.ts
    - Update all imports to use API
    - _Requirements: 7.4_


- [x] 11. Final integration and deployment prep





  - [x] 11.1 Add environment variable documentation


    - Create .env.example with MONGODB_URI
    - Update README with setup instructions
    - _Requirements: 7.2_

  - [x] 11.2 Verify Vercel deployment configuration

    - Ensure vercel.json is correct

    - Test build process
    - _Requirements: 7.1, 7.4_

  - [x] 11.3 Handle all prizes depleted state

    - Disable roll button when no inventory
    - Display appropriate message
    - _Requirements: 9.5_

- [x] 12. Final Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
