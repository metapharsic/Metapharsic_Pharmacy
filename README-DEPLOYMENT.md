# Metapharsic — Complete Pharmacy Management System

A high-performance enterprise pharmacy operations platform and dispensary system with Next.js 14 (App Router), TypeScript, Tailwind CSS, PostgreSQL, and Prisma ORM.

---

## 📦 What is Included in this Complete Archive

1. **Frontend & UI**:
   - Modern dispensary & POS interface (`/pos`, `/pos2` with split matrix, keyboard-first inline grid, and AI strip counter).
   - Real-time inventory, batch tracking, expiry monitoring, supplier management, and customer ledgers.
   - Financial management, GST statutory reports, receipt vouchers (F6), and Double-Entry accounting.
   - Clean, professional **Metapharsic Lifesciences** branding and updated **Ledger & Accounts Sync** navigation.

2. **Backend & APIs**:
   - Next.js Server Components, Server Actions, and REST API routes under `/api/` (auth, billing, products, inventory, vouchers, reports, doctors, sync).
   - NextAuth session handling and role-based access control (Admin, Manager, Pharmacist, Cashier).
   - Real-time voucher auto-sync engine and standard accounting ledger export builders.

3. **Database (Full Schema & Data)**:
   - **`database/pharmacare_dump.sql`**: Complete PostgreSQL SQL dump containing all tables, constraints, sequences, and seeded data.
   - **`prisma/schema.prisma`**: Complete multi-module Prisma data schema (1380+ lines).
   - **`prisma/migrations/`**: All database migration scripts.
   - **`prisma/seeds/` & `prisma/seed.ts`**: Complete seed scripts for users, roles, permissions, branches, suppliers, categories, and test products.

---

## 🚀 Quick Setup & Running

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (`.env`)
The `.env` file is included in this archive with default local settings:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pharmacare_dev?schema=public"
NEXTAUTH_SECRET="pharmacare-super-secret-key-32chars-minimum!"
NEXTAUTH_URL="http://localhost:5888"
```

### 3. Restore / Initialize the Database
You can set up the database using either of the following two options:

#### Option A: Direct PostgreSQL Restore (Fastest, exact snapshot)
```bash
# Create the database in PostgreSQL if it doesn't exist
createdb -U postgres pharmacare_dev

# Restore the complete database dump
psql -U postgres -d pharmacare_dev < database/pharmacare_dump.sql
```

#### Option B: Prisma Push & Seed
```bash
npx prisma db push
npm run db:seed
```

### 4. Start the Development Server
```bash
npm run dev
```
Open **[http://localhost:5888](http://localhost:5888)** in your browser.

---

## 🔑 Default Login Credentials

| Role | Email | Password |
|---|---|---|
| **Admin (Full Access)** | `admin@pharmacare.local` | `Admin@123` |
| **Store Manager** | `manager@pharmacare.local` | `Manager@123` |
| **Pharmacist** | `pharmacare@pharmacare.local` | `Pharma@123` |
| **Cashier (POS)** | `cashier@pharmacare.local` | `Cashier@123` |
