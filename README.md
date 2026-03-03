# Bella Gestor

Bella Gestor is a high-performance, professional CRM and management solution tailored for beauty salons and wellness centers. Built with a modern tech stack, it streamlines appointment scheduling, client relationship management, financial tracking, and service optimization.

Specifically designed for **Spaço Bellas**, this platform bridges the gap between administrative efficiency and exceptional customer service.

## 🚀 Features

### 📊 Intelligent Dashboard

- **Real-time Analytics:** Track active clients, daily appointments, and total revenue at a glance.
- **Revenue Insights:** Visual growth charts showing monthly performance over the last 6 months.
- **Service Popularity:** Data-driven ranking of the most requested services in the last 30 days.
- **Upcoming Agenda:** Integrated view of the next 7 days of appointments.

### 📅 Advanced Scheduling

- **Google Calendar Sync:** Full integration with Google Calendar for seamless scheduling and reminders.
- **Flexible Appointments:** Support for multiple services, specific professionals, and custom durations.
- **Status Tracking:** Manage life-cycles of appointments (Scheduled → Confirmed → Completed/Cancelled).

### 👥 Client Relationship Management (CRM)

- **Comprehensive Profiles:** Track contact info, birth dates, referral sources, and notes.
- **Visit History:** Monitor last visits and lifetime value (total spent) for every client.
- **Status Management:** Distinguish between active and inactive clients for targeted marketing.

### 💰 Financial & Sales Management

- **Sales Workflow:** Create sales directly from appointments or as standalone transactions.
- **Multi-payment Support:** Handle various payment methods with dedicated status tracking.
- **InfinitePay Integration:** Built-in support for modern payment gateway processing.
- **Top Clients Ranking:** Automatically identify and reward your most loyal customers.

### 🛠 Service Portfolio

- **Modular Services:** Organize services by categories.
- **Variant Support:** Define multiple variants (e.g., "Short Hair" vs "Long Hair") with different prices and durations for the same service.

## 🛠 Tech Stack

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
- **Library:** [React 19](https://react.dev/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Database & Auth:** [Supabase](https://supabase.com/) (PostgreSQL)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/)
- **UI Components:** [shadcn/ui](https://ui.shadcn.com/) & [Lucide Icons](https://lucide.dev/)
- **State Management:** React Context API (Auth & Data Layers)
- **Forms:** [React Hook Form](https://react-hook-form.com/) with [Zod](https://zod.dev/) validation
- **Charts:** [Recharts](https://recharts.org/)
- **Integrations:** Google Calendar API, InfinitePay

## 📂 Project Structure

The project follows a clean, layered architecture for maximum maintainability:

```text
├── actions/          # Next.js Server Actions for data mutations
├── app/              # Next.js App Router (Routes and Pages)
├── components/       # UI Library and Feature-specific components
│   ├── features/     # Complex business logic components
│   └── ui/           # Atomic, reusable Radix-based components
├── hooks/            # Custom React hooks (Data fetching & Logic)
├── lib/              # Core configurations (Supabase, Contexts)
├── services/         # External API integrations (Google, Payments)
├── types/            # Domain-driven TypeScript interfaces
└── public/           # Static assets
```

## 🏁 Getting Started

### Prerequisites

- Node.js (Latest LTS)
- pnpm (Recommended)
- Supabase Project
- Google Cloud Console credentials (for Calendar integration)

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/emanuellcs/bella-gestor.git
   cd bella-gestor
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Environment Setup:**
   Create a `.env` file based on `.env.example` and fill in your credentials:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SECRET_KEY=sb_secret_...
   # Add other integration keys as needed
   ```

4. **Run the development server:**

   ```bash
   pnpm dev
   ```

5. **Build for production:**
   ```bash
   pnpm build
   pnpm start
   ```

## 🔐 Security & Roles

Bella Gestor implements a RBAC (Role-Based Access Control) system:

- **Admin:** Full access to financial reports, professional management, and settings.
- **Professional:** Access to personal agenda and client details.
- **Secretary:** Focused on scheduling and client reception.

_Developed with ❤️ for Spaço Bellas._
