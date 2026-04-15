# WarrantyVault

A full-stack warranty tracking web application to manage product warranties, receive expiration alerts, and keep all your warranty documents in one place.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS + custom shadcn-style components |
| Backend | Node.js + Express + TypeScript |
| Database | SQLite (via better-sqlite3) — schema-ready for PostgreSQL |
| Auth | JWT in httpOnly cookies + bcrypt password hashing |
| Notifications | node-cron + Nodemailer (email alerts) |
| File Storage | Local disk (`server/uploads/`) |

---

## Prerequisites

- **Node.js** v18+ (tested on v22)
- **npm** v8+
- Windows Build Tools (for `better-sqlite3` native module — already handled if you're on Node 22+)

---

## Quick Start

### 1. Clone / Download

```bash
cd "d:/Project/Warrenty Tracker"
```

### 2. Install all dependencies

```bash
npm run install:all
```

This installs root, server, and client dependencies in one command.

### 3. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example server/.env
```

Open `server/.env` and update:

```env
# Required — change this to a strong random string
JWT_SECRET=your-super-secret-jwt-key

# Optional — only needed if you want email notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
EMAIL_FROM_ADDRESS=your-email@gmail.com
```

> **Gmail tip:** Use an [App Password](https://myaccount.google.com/apppasswords) (not your regular password). Enable 2FA first, then generate an App Password under "Security → 2-Step Verification → App passwords".

### 4. Seed the demo data (optional but recommended)

```bash
npm run seed
```

Creates a demo account with 6 sample products across different warranty states:

| Credential | Value |
|-----------|-------|
| Email | `demo@example.com` |
| Password | `demo1234` |

### 5. Start the development server

```bash
npm run dev
```

This starts both the backend (port 3001) and frontend (port 5173) concurrently.

Open **http://localhost:5173** in your browser.

---

## Project Structure

```
warrantyvault/
├── package.json          # Root — runs both servers with concurrently
├── .env.example          # Template for environment variables
├── README.md
│
├── client/               # React + Vite frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/   # Reusable UI components
│   │   ├── hooks/        # useAuth, useProducts, useDarkMode
│   │   ├── lib/          # API client (axios), utility functions
│   │   ├── pages/        # Dashboard, Login, Register, ProductDetail, Profile
│   │   └── types/        # TypeScript interfaces
│   └── ...
│
└── server/               # Express API
    ├── src/
    │   ├── index.ts       # App entry point
    │   ├── db/            # SQLite database + schema
    │   ├── middleware/    # JWT auth, multer file upload
    │   ├── routes/        # /auth, /products, /profile
    │   ├── services/      # Email service, cron notification job
    │   └── seed.ts        # Demo data seeder
    └── uploads/           # Uploaded warranty documents (gitignored)
```

---

## API Endpoints

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login (sets httpOnly cookie) |
| POST | `/api/auth/logout` | Logout (clears cookie) |
| GET | `/api/auth/me` | Get current user |

### Products
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List all products (supports filters) |
| POST | `/api/products` | Create product (multipart/form-data) |
| GET | `/api/products/:id` | Get single product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |

**GET /api/products query params:**
- `search` — filter by name or brand
- `category` — filter by category name
- `status` — `active` | `expiring` | `expired`
- `sort` — `expiring_soonest` | `recently_added` | `alphabetical`

### Profile
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/profile` | Get user profile |
| PUT | `/api/profile` | Update name, email, notification settings |

---

## Features

### Dashboard
- **4 stat cards** — Total, Active, Expiring Soon (≤30 days), Expired
- **Alert banner** — amber bar listing all products expiring within 30 days
- **Product card grid** — color-coded by category, with status indicator and warranty progress bar
- **Filter pills** — All / Active / Expiring / Expired
- **Sort** — Expiring Soonest / Recently Added / Alphabetical
- **Sidebar** — category filter with counts, "Add Product" button
- **Search** — search by product name or brand via the navbar

### Product Management
- Add / Edit / Delete products
- Upload warranty documents or receipt images (PDF or image, max 5 MB)
- Auto-calculate expiry date from purchase date + warranty duration
- View full product detail page with document preview and warranty timeline

### Email Notifications
- Daily cron job at 8:00 AM checks for expiring/expired warranties
- Email sent when warranty is **exactly 30 days away**
- Email sent on the **day of expiry**
- Duplicate sends are prevented via `notification_log` table
- Users can toggle notifications on/off in their Profile settings

### UI/UX
- **Dark mode** — toggle in navbar, persisted to localStorage
- **Fully responsive** — 1/2/3 column grid based on screen size
- **Loading skeletons** — shown while data fetches
- **Empty state** — illustrated prompt when no products added yet
- **Smooth transitions** — card hover, modal open/close

---

## Email Notification Setup

1. Set SMTP variables in `server/.env`
2. Make sure users have `notifications_enabled = true` and a valid `notification_email` in their profile
3. The cron job runs automatically at 8:00 AM UTC when the server starts
4. To test email manually, you can temporarily trigger the job logic from the REPL or add a test endpoint

---

## Database

SQLite database is stored at `server/warrantyvault.db`. The schema is compatible with PostgreSQL — to migrate:

1. Replace `better-sqlite3` with `pg` or `postgres`
2. Change `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
3. Change `datetime('now')` → `NOW()`
4. Update the DB connection in `src/db/database.ts`

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3001) |
| `NODE_ENV` | No | `development` or `production` |
| `JWT_SECRET` | **Yes** | Secret key for signing JWTs |
| `DB_PATH` | No | SQLite file path (default: `./warrantyvault.db`) |
| `SMTP_HOST` | For emails | SMTP server hostname |
| `SMTP_PORT` | For emails | SMTP port (587 for TLS) |
| `SMTP_SECURE` | For emails | `true` for port 465, `false` for 587 |
| `SMTP_USER` | For emails | SMTP username / email |
| `SMTP_PASS` | For emails | SMTP password or app password |
| `EMAIL_FROM_NAME` | No | Sender display name |
| `EMAIL_FROM_ADDRESS` | For emails | Sender email address |
| `CLIENT_URL` | No | Frontend URL for CORS (default: `http://localhost:5173`) |
| `MAX_FILE_SIZE_MB` | No | Max upload size in MB (default: 5) |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both client and server in dev mode |
| `npm run dev:server` | Start server only |
| `npm run dev:client` | Start client only |
| `npm run install:all` | Install all dependencies (root + server + client) |
| `npm run seed` | Seed demo data into the database |
| `npm run build` | Build the client for production |
