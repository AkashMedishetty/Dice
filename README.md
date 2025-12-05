# Lucky Dice

A prize wheel application with 3D dice rolling, participant tracking, and admin dashboard.

## Features

- 3D dice rolling with physics simulation
- Email-based participant tracking
- Prize inventory management
- Admin dashboard with statistics
- MongoDB backend for persistence
- Serverless deployment on Vercel

## Prerequisites

- Node.js 18+ and npm
- MongoDB Atlas account (or local MongoDB instance)

## Environment Setup

1. Copy the example environment file:
   ```sh
   cp .env.example .env
   ```

2. Configure your MongoDB connection string in `.env`:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/lucky-dice?retryWrites=true&w=majority
   ```

   To get a MongoDB connection string:
   - Create a free account at [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Create a new cluster
   - Click "Connect" and choose "Connect your application"
   - Copy the connection string and replace `<password>` with your database user password

## Local Development

```sh
# Step 1: Clone the repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory
cd <YOUR_PROJECT_NAME>

# Step 3: Install dependencies
npm install

# Step 4: Set up environment variables (see Environment Setup above)
cp .env.example .env
# Edit .env with your MongoDB connection string

# Step 5: Start the development server
npm run dev
```

## Running Tests

```sh
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Deployment to Vercel

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)

2. Import the project in [Vercel](https://vercel.com)

3. Configure environment variables in Vercel:
   - Go to Project Settings → Environment Variables
   - Add `MONGODB_URI` with your production MongoDB connection string

4. Deploy! Vercel will automatically build and deploy your application

## Project Structure

```
├── api/                    # Vercel serverless functions
│   ├── _lib/              # Shared utilities (MongoDB connection)
│   ├── entries/           # Entry management endpoints
│   ├── prizes/            # Prize management endpoints
│   ├── roll/              # Roll flow endpoints
│   └── stats.ts           # Statistics endpoint
├── src/
│   ├── components/        # React components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities and database operations
│   ├── pages/             # Page components
│   └── types/             # TypeScript type definitions
└── public/                # Static assets
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/prizes` | GET | Get all prizes with inventory |
| `/api/prizes/[id]` | PUT | Update prize details |
| `/api/prizes/reset` | POST | Reset prize inventory |
| `/api/roll` | POST | Initiate a roll (requires email) |
| `/api/roll/confirm` | POST | Confirm a roll after physics |
| `/api/roll/release` | POST | Release reserved inventory |
| `/api/entries` | GET | Get paginated entries |
| `/api/entries/[id]` | PATCH | Update entry status |
| `/api/stats` | GET | Get dashboard statistics |

## Technologies

- React 18 with TypeScript
- Three.js / React Three Fiber for 3D graphics
- Tailwind CSS with shadcn/ui components
- MongoDB for data persistence
- Vercel for serverless deployment
- Vitest for testing

## Project info

**URL**: https://lovable.dev/projects/397786be-8c4b-4bfe-b7ec-4387eb97b3ba

## License

MIT
