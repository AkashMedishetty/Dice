# Requirements Document

## Introduction

This feature extends the Lucky Dice application to track participant information (email) and their winnings using MongoDB as the backend database. The system will support high-concurrency scenarios (2000+ participants across 2-3 screens) with a serverless backend deployable on Vercel. Additionally, the dice animation will be enhanced with a camera motion that focuses on the winning face after landing.

**Current System Analysis:**
- Uses localStorage for gift inventory (not suitable for multi-screen/persistence)
- No email collection or participant tracking
- Dice physics can land on any face, then "redirects" to valid face (looks unnatural)
- No real-time sync between screens
- No camera focus animation after dice lands

## Glossary

- **Participant**: A user who rolls the dice and wins a prize
- **Prize**: A gift item that can be won by rolling the dice (mapped to dice faces 1-6)
- **Roll Entry**: A database record containing participant email, prize won, timestamp, and collection status
- **Admin Dashboard**: A protected page for viewing and managing participant entries and prize inventory
- **Collection Status**: Boolean flag indicating whether a participant has physically collected their prize
- **Serverless Function**: A Vercel API route that handles backend logic without a dedicated server
- **Camera Focus Animation**: A smooth camera transition that zooms/pans to show the top face of the landed dice
- **Rigged Dice**: Physics simulation that guides the dice to land on a pre-determined face
- **Atomic Operation**: Database operation that completes entirely or not at all, preventing race conditions

## Requirements

### Requirement 1

**User Story:** As an event organizer, I want participants to enter their email before rolling, so that I can track who won which prizes.

#### Acceptance Criteria

1. WHEN a user clicks the roll button THEN the System SHALL display an email input modal before allowing the roll
2. WHEN a user submits a valid email format THEN the System SHALL store the email and proceed with the dice roll
3. WHEN a user submits an invalid email format THEN the System SHALL display a validation error and prevent the roll
4. WHEN a user cancels the email modal THEN the System SHALL return to the idle state without rolling

### Requirement 2

**User Story:** As an event organizer, I want roll results stored in MongoDB, so that I have a persistent record of all winners.

#### Acceptance Criteria

1. WHEN a dice roll completes successfully THEN the System SHALL create a roll entry in MongoDB with email, prize ID, prize name, timestamp, and collection status set to false
2. WHEN the database write fails THEN the System SHALL display an error message and allow retry
3. WHEN storing a roll entry THEN the System SHALL include a unique identifier for each entry
4. WHEN a roll entry is created THEN the System SHALL decrement the prize inventory in the database

### Requirement 3

**User Story:** As an event organizer, I want to view all participants and their winnings, so that I can manage prize distribution.

#### Acceptance Criteria

1. WHEN an admin visits the participants page THEN the System SHALL display a paginated list of all roll entries
2. WHEN displaying roll entries THEN the System SHALL show email, prize name, prize icon, timestamp, and collection status
3. WHEN the admin clicks a filter option THEN the System SHALL filter entries by collection status (all, collected, pending)
4. WHEN the admin searches by email THEN the System SHALL display matching entries in real-time
5. WHEN entries are displayed THEN the System SHALL sort by timestamp with newest first by default

### Requirement 4

**User Story:** As an event organizer, I want to mark prizes as collected, so that I can track distribution progress.

#### Acceptance Criteria

1. WHEN an admin clicks the "Mark as Collected" button THEN the System SHALL update the collection status to true in MongoDB
2. WHEN an admin clicks the "Mark as Pending" button THEN the System SHALL update the collection status to false in MongoDB
3. WHEN the collection status changes THEN the System SHALL update the UI immediately without page refresh
4. WHEN a status update fails THEN the System SHALL display an error message and revert the UI state

### Requirement 5

**User Story:** As an event organizer, I want the system to handle high concurrency, so that multiple screens can operate simultaneously without issues.

#### Acceptance Criteria

1. WHEN multiple concurrent roll requests occur THEN the System SHALL process each request independently using connection pooling
2. WHEN inventory reaches zero for a prize THEN the System SHALL use atomic operations to prevent over-allocation
3. WHEN the database connection fails THEN the System SHALL implement retry logic with exponential backoff
4. WHEN API requests are made THEN the System SHALL respond within 500ms under normal load conditions
5. WHEN a prize inventory depletes during concurrent rolls THEN the System SHALL reassign to an available prize atomically

### Requirement 9

**User Story:** As an event organizer, I want depleted prizes excluded from dice outcomes, so that participants only win available prizes.

#### Acceptance Criteria

1. WHEN a prize inventory reaches zero THEN the System SHALL exclude that dice face from possible landing outcomes
2. WHEN the dice roll initiates THEN the System SHALL pre-determine a valid winning face from available inventory
3. WHEN the dice physics simulation runs THEN the System SHALL apply corrective forces to ensure the dice lands on the pre-determined face
4. WHEN fetching available prizes THEN the System SHALL query MongoDB for real-time inventory counts
5. WHEN all prizes are depleted THEN the System SHALL disable the roll button and display an appropriate message
6. WHEN inventory is updated in admin panel THEN the System SHALL sync available faces across all connected screens

### Requirement 6

**User Story:** As a participant, I want to clearly see which face won after the dice lands, so that I understand my prize.

#### Acceptance Criteria

1. WHEN the dice settles after rolling THEN the System SHALL animate the camera to focus on the top face within 1.5 seconds
2. WHEN the camera animation completes THEN the System SHALL display the winning face clearly visible from above
3. WHEN the camera focuses on the winning face THEN the System SHALL maintain smooth 60fps animation performance
4. WHEN the prize splash appears THEN the System SHALL trigger it after the camera focus animation completes

### Requirement 7

**User Story:** As an event organizer, I want the backend to be serverless, so that I can deploy on Vercel with automatic scaling.

#### Acceptance Criteria

1. WHEN deploying to Vercel THEN the System SHALL use API routes in the /api directory structure
2. WHEN connecting to MongoDB THEN the System SHALL use connection string from environment variables
3. WHEN a serverless function executes THEN the System SHALL reuse database connections across invocations
4. WHEN the application builds THEN the System SHALL produce a valid Vercel deployment bundle

### Requirement 8

**User Story:** As an event organizer, I want to see summary statistics, so that I can monitor event progress at a glance.

#### Acceptance Criteria

1. WHEN viewing the admin dashboard THEN the System SHALL display total rolls count
2. WHEN viewing the admin dashboard THEN the System SHALL display collected vs pending counts
3. WHEN viewing the admin dashboard THEN the System SHALL display prize distribution breakdown
4. WHEN data changes THEN the System SHALL update statistics in real-time

### Requirement 10

**User Story:** As an event organizer, I want to manage prize inventory from the admin panel, so that I can adjust availability during the event.

#### Acceptance Criteria

1. WHEN an admin updates prize inventory THEN the System SHALL persist changes to MongoDB immediately
2. WHEN an admin updates prize details (name, description, icon) THEN the System SHALL persist changes to MongoDB
3. WHEN an admin resets inventory THEN the System SHALL restore default values in MongoDB
4. WHEN inventory changes occur THEN the System SHALL broadcast updates to all connected roll screens

### Requirement 11

**User Story:** As an event organizer, I want the roll flow to be atomic, so that concurrent rolls do not cause inventory inconsistencies.

#### Acceptance Criteria

1. WHEN a roll is initiated THEN the System SHALL reserve inventory atomically before physics simulation starts
2. WHEN the physics simulation completes THEN the System SHALL confirm the roll entry in MongoDB
3. WHEN a roll fails mid-process THEN the System SHALL release the reserved inventory
4. WHEN two screens attempt to claim the last prize simultaneously THEN the System SHALL award to exactly one and notify the other to re-roll
