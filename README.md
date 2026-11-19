# GoTogether 🚗🛵

**GoTogether** is a full-stack, real-time ride-sharing and carpooling platform built for modern urban commuters. It connects travelers going the same way with verified car and bike hosts, helping reduce commute costs, traffic congestion, and carbon emissions.

---

## 🌟 Key Features

- **7-Dimension Smart Matching Engine**
  - Ranks ride listings based on proximity, departure schedule, budget, commute pace, host reliability, social preferences, and verification status.
- **Dynamic Commute Discovery**
  - Instant search and filtering by ride type (Car / Bike), origin, destination, price budget, departure date, and safety preferences.
- **Real-Time Chat & Notifications (Socket.IO)**
  - Seamless in-app chat drawer connecting travelers and hosts upon match request creation with message history replay.
- **Live Ride Lifecycle & Telemetry Sync**
  - Multi-stage ride state transitions: `OPEN` ➔ `BOARDING` ➔ `IN_TRANSIT` ➔ `COMPLETED` / `CANCELLED`.
  - Real-time GPS coordinate broadcasts and passenger check-in tracking.
- **Role-Based Access Control (RBAC)**
  - Support for **Traveler**, **Host**, **Organizer**, and **Admin** profiles with instant role switching.
- **Trust & Verification System**
  - Organization and college credential verification, safety badges, and community rating/review mechanics.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 6](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons & Animation**: [Lucide React](https://lucide.dev/), [Framer Motion](https://www.framer.com/motion/)
- **Real-Time Client**: [Socket.IO Client](https://socket.io/docs/v4/client-api/)

### Backend
- **Server**: [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/)
- **TypeScript Runner**: [tsx](https://github.com/privatenumber/tsx) (watch mode)
- **Real-Time Engine**: [Socket.IO](https://socket.io/)
- **Authentication**: JWT (`jsonwebtoken`) & password hashing with `bcryptjs`
- **Database & ORM**: [Prisma ORM 5](https://www.prisma.io/)
- **Database Targets**: PostgreSQL ([Supabase](https://supabase.com/), Neon, Railway) or local SQLite (`dev.db`)

---

## 📁 Project Structure

```
Gotogether/
├── prisma/
│   ├── schema.prisma          # PostgreSQL production Prisma schema
│   ├── schema.sqlite.prisma   # SQLite local development schema
│   ├── seed.ts                # Database seeder script
│   └── dev.db                 # Local SQLite database file
├── server/
│   ├── lib/                   # Database client & connection retry utilities
│   ├── middleware/            # Auth JWT & role validation middleware
│   ├── routes/                # API routes (auth, listings, matches, users, conversations)
│   ├── sockets/               # Real-time Socket.IO chat & telemetry handlers
│   └── server.ts              # Express HTTP & Socket.IO server entrypoint
├── src/
│   ├── components/            # UI components (HomePage, MyRidesPage, ChatDrawer, Modals)
│   ├── context/               # React Contexts (AuthContext, RoleContext)
│   ├── hooks/                 # Custom React hooks (useChatRoom, etc.)
│   ├── lib/                   # API clients, socket instance, and validation
│   ├── types/                 # TypeScript interfaces and enum definitions
│   ├── App.tsx                # Main application wrapper
│   └── main.tsx               # React DOM entry point
├── supabase/
│   └── migrations/            # SQL migration scripts for RBAC & Chat
├── .env                       # Environment variables
├── package.json               # NPM scripts and dependencies
└── vite.config.ts             # Vite bundler & reverse proxy configuration
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18.0.0 or later (v20+ / v24+ recommended)
- **NPM**: v9.0.0 or later

### 2. Installation
Navigate to the project root and install all dependencies:
```bash
cd Gotogether
npm install
```

### 3. Environment Configuration
Create or edit your `.env` file in `Gotogether/`:
```env
# Server & Network Configuration
PORT=4000
CLIENT_ORIGIN="http://localhost:5173"

# Authentication Secret
JWT_SECRET="your_strong_jwt_secret_key"

# Database Configuration (PostgreSQL / Supabase)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"

# Alternatively, for local SQLite development:
# DATABASE_URL="file:./dev.db"
```

### 4. Database Setup (Prisma)
Generate the Prisma Client and sync your schema:
```bash
# Generate Prisma Client
npm run db:generate

# Push schema directly to the database
npm run db:push

# (Optional) Seed demo users, rides, and mock reviews
npm run db:seed
```

*For local SQLite development:*
```bash
npm run db:sqlite:generate
npm run db:sqlite:push
```

### 5. Running the Application
Start both the Vite frontend client and Express backend server concurrently:
```bash
npm run dev
```

Once running:
- **Web Application (Frontend)**: [http://localhost:5173/](http://localhost:5173/)
- **API Server & Socket.IO**: [http://localhost:4000/](http://localhost:4000/)

---

## 📜 Available NPM Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts both server (`:4000`) and frontend (`:5173`) concurrently |
| `npm run dev:client` | Runs Vite frontend development server |
| `npm run dev:server` | Runs Express backend with `tsx watch` |
| `npm run build` | Type-checks and creates production build in `dist/` |
| `npm run preview` | Previews the production build locally |
| `npm run type-check` | Runs `tsc --noEmit` to validate TypeScript types |
| `npm run db:generate` | Generates the Prisma Client for PostgreSQL |
| `npm run db:push` | Pushes the PostgreSQL schema to the database |
| `npm run db:seed` | Populates database with sample rides, users, and tags |
| `npm run db:sqlite:push` | Pushes the schema to the local SQLite `dev.db` file |
| `npm run db:sqlite:generate`| Generates Prisma Client for SQLite |

---

## 🔌 API & Socket Endpoints Overview

### HTTP Endpoints (`http://localhost:4000/api`)
- `POST /api/auth/register` - Create a new traveler or host account
- `POST /api/auth/login` - Authenticate and receive JWT token
- `GET /api/auth/me` - Fetch authenticated user profile
- `GET /api/listings/search` - Search and rank rides using 7-dimension heuristic
- `POST /api/listings` - Create a new ride listing
- `POST /api/listings/:id/book` - Book seats on an open ride
- `POST /api/listings/:id/status` - Transition ride state (`BOARDING`, `IN_TRANSIT`, `COMPLETED`)
- `POST /api/match-requests` - Initialize match request & chat room between rider and host
- `GET /api/users/me/hosted-rides` - Fetch rides published by current host
- `GET /api/users/me/joined-rides` - Fetch rides booked by current traveler

### Real-Time Socket Events (`ws://localhost:4000`)
- `join_room` / `leave_room`: Subscribe to match request chat rooms
- `send_message` / `receive_message`: Real-time chat message exchange
- `subscribe:ride` / `unsubscribe:ride`: Subscribe to ride room status updates
- `ride:status_updated`: Broadcast ride state changes
- `ride:telemetry`: Live coordinate and speed pings from host device
- `passenger:checked_in`: Real-time QR / boarding verification

---

## 📄 License
This project is private and proprietary. All rights reserved.

