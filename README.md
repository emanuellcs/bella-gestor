# Bella Gestor

Bella Gestor is a comprehensive Customer Relationship Management (CRM) and Enterprise Resource Planning (ERP) platform built specifically for Spaço Bellas. It is designed to be the central nervous system for a salon or spa, handling everything from daily scheduling and client retention to complex financial operations like split payments and staff commissions. 

By bringing together scheduling, a Point-of-Sale (POS) system, and detailed financial tracking into one unified platform, Bella Gestor helps business owners maintain control over their operations while providing a seamless experience for both staff and clients.

## System Overview

The application is broken down into intuitive, user-facing modules that handle specific areas of the business.

### Agenda & Scheduling
The Agenda is the heart of daily operations. It provides a robust calendar interface where staff can create, modify, and manage appointments. When booking an appointment, the system automatically pulls in the specific service variants selected, calculating the total duration and base pricing on the fly. 

The Agenda is also deeply connected to the financial system. When an appointment is marked as completed, a dedicated checkout flow smoothly transitions the scheduled event into a finalized financial transaction.

### Client Management
This module handles the complete lifecycle of the consumer base. Beyond just storing contact details and personal notes, the system actively helps with client retention. It includes specialized views that identify clients who haven't visited in a while, allowing the business to run targeted re-engagement campaigns. To prevent duplicate records during fast-paced data entry or external imports, the system uses idempotency keys and versioning behind the scenes.

### Financials & POS
The Finance module acts as the central ledger and POS backend. It manages the entire lifecycle of a sale. One of its most powerful features is handling split payments, allowing a single checkout to be paid across multiple methods. 

Additionally, the system tracks commissions with absolute precision. When a sale is made, the exact commission percentage and amount for each item are locked into an immutable historical ledger. This means that if a professional's commission rate changes next month, past financial records remain completely accurate and unchanged.

### Staff & Services
The Professionals module manages the team. It handles role assignments (such as Admin, Secretary, or Professional) and tracks base commission rates for each staff member.

The Services module maintains the catalog of offerings. Services are organized hierarchically, with broad categories (like "Haircut") branching into specific variants (like "Men's Haircut - Senior Stylist"). These variants hold the crucial details: price, duration, and even specific commission rates that can override a professional's default rate. Services can also be toggled active or inactive without deleting them, preserving the integrity of past sales data.

### Reports
Data is only useful if you can understand it. The Reports and Dashboard modules take the vast amount of transactional data and turn it into actionable business intelligence. It calculates key performance indicators like revenue, commissions, and retention rates, comparing current metrics against historical trends to provide clear visibility into the business's health.

## Architecture & Security

Bella Gestor is built on a modern, fast, and secure technology stack utilizing Next.js and Supabase.

To keep data secure and the frontend incredibly fast, Bella Gestor handles all database changes directly on the server using Next.js Server Actions. By keeping the business logic on the server, we ensure that database interactions are secure and immune to client-side manipulation. Critical operations, like booking an appointment and generating a pending sale, are wrapped in PostgreSQL Remote Procedure Calls (RPCs) to guarantee they happen together instantly and reliably.

Security and data privacy are paramount. We use a Role-Based Access Control (RBAC) system combined with Supabase Row Level Security (RLS). This means that at the database level, a Professional can only query and see their own financial performance and appointments, while an Admin has the global oversight needed to run the business.

Finally, to protect the integrity of financial history, the system employs a strict soft-delete approach. Instead of permanently erasing records, deleted items are simply marked with a timestamp. This ensures that past sales tied to a deleted client or service variant are never corrupted.

## Integrations

Bella Gestor connects seamlessly with external services to expand its capabilities.

### Google Calendar
To ensure schedule parity, the system features a bidirectional sync with Google Calendar. To keep the frontend architecture clean and avoid direct OAuth complexities, we use a Google Apps Script proxy. The Next.js backend talks to this proxy, which in turn handles the native Google Calendar API. 

When events are created directly in Google Calendar and pulled into Bella Gestor, they come in without the necessary financial and client context. The system smartly flags these as needing completion, prompting the staff to link a registered client and service before the event can generate a financial record.

### InfinitePay Payments
For processing external asynchronous payments, such as credit cards and PIX via payment links, we integrate with InfinitePay. Bella Gestor listens for payment updates through a secure webhook endpoint. When a payment is successfully captured, the system uses NSU-based idempotency to ensure we never record a duplicate payment. Once the incoming payments cover the total balance of a sale, the system automatically finalizes the sale and marks the parent appointment as completed, requiring zero manual work from the staff.

## Running the Project Locally

Getting the project up and running on your local machine is straightforward.

1. Ensure you have Node.js v20 and `pnpm` installed.
2. Clone the repository and install the dependencies exactly as specified in the lockfile:
   `pnpm install --frozen-lockfile`
3. Duplicate the `.env.example` file and rename it to `.env.local`. Fill in the required variables, including your Supabase connection details, the Google Apps Script proxy URL, and the InfinitePay webhook secret.
4. Start the development server:
   `pnpm run dev`
5. The application will be available at `http://localhost:3000`.

If you prefer isolated environments, the project also fully supports Dev Containers via the provided configuration.

## Testing & CI/CD

To keep the platform stable for all contributors, we rely on a rigorous automated quality assurance pipeline powered by GitHub Actions.

Every push and pull request goes through a fail-fast pipeline that checks code quality in increasing order of complexity. It starts by verifying Prettier formatting, runs ESLint for static analysis, checks TypeScript strictness, executes the test suite, and finally builds the production bundle. If any early step fails, the pipeline stops immediately to save time.

Our testing infrastructure is built for speed and reliability. We use Vitest as our test runner and Mock Service Worker (MSW) to intercept and mock outbound network calls. Most importantly, tests run against a sophisticated in-memory Supabase mock rather than a live database. This mock replicates the Supabase client API and even simulates Row Level Security rules, allowing us to validate our security policies and run the entire test suite locally in seconds.

## License

See [`LICENSE`](./LICENSE).