# MisterWheels CRM - Architecture Documentation

## Overview
This document describes the architecture and folder structure for the MisterWheels Rental Management CRM built with Next.js 14 (App Router), TypeScript, Tailwind CSS, MongoDB with Mongoose, and next-auth.

## Technology Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: next-auth (Credentials provider)
- **UI Design**: Dark sidebar, light grey background, white rounded cards, yellow/gold accents

## Folder Structure

```
CRM/
├── app/                          # Next.js App Router directory
│   ├── (auth)/                   # Route group for authentication pages
│   │   └── login/
│   │       └── page.tsx          # Login page
│   │
│   ├── (protected)/              # Route group for protected pages
│   │   ├── layout.tsx            # Protected layout with sidebar + topbar
│   │   ├── dashboard/
│   │   │   └── page.tsx          # Dashboard page
│   │   ├── bookings/
│   │   │   └── page.tsx          # Bookings management page
│   │   ├── units/
│   │   │   └── page.tsx          # Fleet/Units management page
│   │   ├── clients/
│   │   │   └── page.tsx          # Clients management page
│   │   ├── financials/
│   │   │   └── page.tsx          # Financials page
│   │   ├── users/
│   │   │   └── page.tsx          # User management page
│   │   ├── roles/
│   │   │   └── page.tsx          # Roles management page
│   │   ├── settings/
│   │   │   └── page.tsx          # Settings page
│   │   └── support/
│   │       └── page.tsx          # Support page
│   │
│   ├── api/                      # API routes
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts      # NextAuth API route handler
│   │   ├── bookings/
│   │   │   └── route.ts          # Bookings API endpoints
│   │   ├── units/
│   │   │   └── route.ts          # Units/Fleet API endpoints
│   │   ├── clients/
│   │   │   └── route.ts          # Clients API endpoints
│   │   ├── financials/
│   │   │   └── route.ts          # Financials API endpoints
│   │   ├── users/
│   │   │   └── route.ts          # Users API endpoints
│   │   ├── roles/
│   │   │   └── route.ts          # Roles API endpoints
│   │   ├── settings/
│   │   │   └── route.ts          # Settings API endpoints
│   │   └── support/
│   │       └── route.ts          # Support API endpoints
│   │
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Root page (redirects to login or dashboard)
│   └── globals.css               # Global styles
│
├── components/                   # React components
│   ├── ui/                       # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Table.tsx
│   │   ├── Modal.tsx
│   │   ├── Select.tsx
│   │   └── ...                   # Other shared UI components
│   │
│   └── layout/                   # Layout components
│       ├── Sidebar.tsx           # Dark vertical sidebar
│       ├── Topbar.tsx            # Top navigation bar
│       ├── ProtectedLayout.tsx   # Wrapper for protected routes
│       └── AuthLayout.tsx        # Wrapper for auth pages
│
├── lib/                          # Utility libraries and configurations
│   ├── db.ts                     # MongoDB connection setup
│   ├── auth.ts                   # NextAuth configuration
│   │
│   ├── models/                   # Mongoose models
│   │   ├── User.ts               # User model with roles
│   │   ├── Booking.ts            # Booking model
│   │   ├── Unit.ts               # Fleet/Unit model
│   │   ├── Client.ts             # Client model
│   │   ├── Financial.ts          # Financial transaction model
│   │   ├── Role.ts               # Role model (if needed)
│   │   └── index.ts              # Export all models
│   │
│   └── utils/                    # Utility functions
│       ├── permissions.ts        # Role-based permission checks
│       ├── validations.ts        # Form validation schemas
│       └── helpers.ts            # General helper functions
│
├── types/                        # TypeScript type definitions
│   ├── auth.ts                   # Authentication types
│   ├── models.ts                 # Database model types
│   └── api.ts                    # API request/response types
│
├── hooks/                        # Custom React hooks
│   ├── useAuth.ts                # Authentication hook
│   ├── usePermissions.ts         # Permission checking hook
│   └── ...                       # Other custom hooks
│
├── middleware.ts                 # Next.js middleware for route protection
│
├── public/                       # Static assets
│   └── ...                       # Images, icons, etc.
│
├── .env.local                    # Environment variables
├── .env.example                  # Example environment variables
├── next.config.js                # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
├── package.json                  # Dependencies
└── ARCHITECTURE.md               # This file
```

## Pages / Routes

### Authentication Routes
- **`/login`** - Login page for all users (public route)

### Protected Routes (require authentication)
All protected routes are wrapped in the `(protected)` route group layout which includes:
- Dark vertical sidebar navigation
- Top navigation bar
- Authentication check via middleware

- **`/dashboard`** - Main dashboard with overview metrics and charts
- **`/bookings`** - Booking management (create, view, edit, cancel bookings)
- **`/units`** - Fleet/Units management (vehicle inventory, availability, maintenance)
- **`/clients`** - Client management (customer profiles, history, communication)
- **`/financials`** - Financial management (transactions, reports, invoices, payments)
- **`/users`** - User management (only accessible to SUPER_ADMIN, ADMIN)
- **`/roles`** - Role management and permissions (only accessible to SUPER_ADMIN)
- **`/settings`** - Application settings and preferences
- **`/support`** - Support tickets and help center

## API Routes Structure

All API routes are located under `/app/api/` and follow RESTful conventions:

### Authentication
- **`/api/auth/[...nextauth]`** - NextAuth handler for authentication (login, logout, session)

### Resource APIs
Each module has its own API route file handling CRUD operations:

- **`/api/bookings`** - `GET`, `POST`, `PUT`, `DELETE` for bookings
- **`/api/units`** - `GET`, `POST`, `PUT`, `DELETE` for fleet units
- **`/api/clients`** - `GET`, `POST`, `PUT`, `DELETE` for clients
- **`/api/financials`** - `GET`, `POST` for financial transactions and reports
- **`/api/users`** - `GET`, `POST`, `PUT`, `DELETE` for user management
- **`/api/roles`** - `GET`, `POST`, `PUT`, `DELETE` for role management
- **`/api/settings`** - `GET`, `PUT` for application settings
- **`/api/support`** - `GET`, `POST`, `PUT` for support tickets

All API routes include:
- Authentication middleware
- Role-based authorization checks
- Request validation
- Error handling
- MongoDB operations via Mongoose models

## Database Models

Models are defined in `/lib/models/` using Mongoose schemas:

### Core Models
1. **User** (`/lib/models/User.ts`)
   - Fields: email, password (hashed), name, role, permissions, createdAt, updatedAt
   - Roles: SUPER_ADMIN, ADMIN, MANAGER, SALES_AGENT, FINANCE, INVESTOR, CUSTOMER

2. **Booking** (`/lib/models/Booking.ts`)
   - Fields: client, unit, startDate, endDate, status, totalAmount, notes, etc.

3. **Unit** (`/lib/models/Unit.ts`)
   - Fields: name, type, make, model, year, status, dailyRate, location, etc.

4. **Client** (`/lib/models/Client.ts`)
   - Fields: name, email, phone, address, documents, bookingHistory, etc.

5. **Financial** (`/lib/models/Financial.ts`)
   - Fields: type, amount, booking, client, date, status, paymentMethod, etc.

6. **Role** (`/lib/models/Role.ts`) - Optional, if roles need dynamic configuration
   - Fields: name, permissions, description, etc.

### Database Connection
- **`/lib/db.ts`** - MongoDB connection setup using Mongoose
  - Handles connection pooling
  - Environment-based connection string
  - Connection state management

## Shared UI Components

Components are organized in `/components/`:

### Layout Components (`/components/layout/`)
- **Sidebar.tsx** - Dark vertical sidebar with navigation menu
- **Topbar.tsx** - Top navigation bar with user menu and notifications
- **ProtectedLayout.tsx** - Layout wrapper for protected routes
- **AuthLayout.tsx** - Layout wrapper for authentication pages

### UI Components (`/components/ui/`)
Reusable, styled components following the design system:
- **Button.tsx** - Button component with variants
- **Input.tsx** - Form input component
- **Card.tsx** - White rounded card with shadow
- **Table.tsx** - Data table component
- **Modal.tsx** - Modal/dialog component
- **Select.tsx** - Dropdown select component
- **Badge.tsx** - Status badge component
- **Loading.tsx** - Loading spinner component
- Additional components as needed

All UI components use Tailwind CSS with the design system:
- Dark sidebar background
- Light grey page background
- White rounded cards with subtle shadows
- Yellow/gold accents for active states

## Authentication & Authorization

### Authentication Setup
- **`/lib/auth.ts`** - NextAuth configuration
  - Credentials provider for email/password login
  - Session strategy: JWT
  - User lookup from MongoDB
  - Password verification

### Middleware
- **`middleware.ts`** - Next.js middleware
  - Protects routes in `(protected)` group
  - Redirects unauthenticated users to `/login`
  - Validates session tokens

### Permission System
- **`/lib/utils/permissions.ts`** - Role-based permission checks
  - Defines permissions for each role
  - Helper functions for checking access
  - Used in API routes and components

### Roles & Permissions
- **SUPER_ADMIN**: Full access to all modules
- **ADMIN**: Access to most modules except role management
- **MANAGER**: Access to bookings, units, clients, financials (read/write)
- **SALES_AGENT**: Access to bookings, units, clients (create/read)
- **FINANCE**: Access to financials, bookings (read), clients (read)
- **INVESTOR**: Read-only access to financials and reports
- **CUSTOMER**: Access to own bookings and profile

## Environment Variables

Required environment variables (`.env.local`):
```
MONGODB_URI=mongodb://localhost:27017/misterwheels
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
```

## Design System

### Colors
- **Sidebar**: Dark background (#1F2937 or similar)
- **Page Background**: Light grey (#F3F4F6 or similar)
- **Cards**: White with rounded corners and subtle shadow
- **Accents**: Yellow/Gold (#FBBF24, #F59E0B, or similar) for:
  - Active navigation items
  - Primary buttons
  - Important highlights
  - Status indicators

### Typography
- Clean, modern sans-serif font (Inter, system-ui, or similar)
- Clear hierarchy with appropriate font sizes and weights

### Spacing & Layout
- Consistent padding and margins
- Responsive design for mobile and desktop
- Sidebar: Fixed width (~250px)
- Content area: Flexible width with max-width constraints

## Development Guidelines

1. **Type Safety**: All components and functions should be fully typed with TypeScript
2. **Error Handling**: All API routes should include proper error handling and validation
3. **Security**: 
   - Passwords must be hashed (bcrypt)
   - API routes must check authentication and authorization
   - Input validation on all user inputs
4. **Code Organization**: 
   - Keep components small and focused
   - Extract reusable logic into hooks or utilities
   - Use consistent naming conventions
5. **Database**: 
   - Use Mongoose schemas for all models
   - Implement proper indexing for performance
   - Use transactions where needed

