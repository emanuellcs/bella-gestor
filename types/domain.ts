/**
 * Domain-driven application interfaces (Camel Case)
 * These are used throughout the UI and Business Logic.
 */

export enum AppRole {
  ADMIN = "Admin",
  PROFESSIONAL = "Professional",
  SECRETARY = "Secretary",
}

export enum AppointmentStatus {
  SCHEDULED = "scheduled",
  CONFIRMED = "confirmed",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum SaleStatus {
  PENDING = "pending",
  PAID = "paid",
  CANCELLED = "cancelled",
}

export enum PaymentStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  PAID = "paid",
  FAILED = "failed",
  REFUNDED = "refunded",
  CANCELLED = "cancelled",
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  birthDate?: string;
  serviceLocation?: string;
  preferredSchedule?: string;
  referral_source?: string;
  marketingConsent?: boolean;
  isClient?: boolean;
  registrationDate: string;
  lastVisit?: string;
  totalSpent: number;
  status: "active" | "inactive";
  notes?: string;
  services?: string;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  category: string;
  active: boolean;
  variants?: ServiceVariant[];
  created_at: string;
  updatedAt?: string;
}

export interface ServiceVariant {
  id: string;
  serviceId: string;
  variantName: string;
  price: number;
  duration: number;
  active: boolean;
  commissionPct?: number; // optional override for this specific variant
  created_at: string;
  updatedAt?: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName?: string;
  professionalId: string;
  professionalName?: string;
  serviceVariants: AppointmentService[];
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  notes?: string;
  totalPrice: number;
  saleId?: string;
  created_at: string;
  updatedAt?: string;
}

export interface AppointmentService {
  serviceVariantId: string;
  serviceVariantName?: string;
  quantity: number;
}

export interface Sale {
  id: string;
  clientId: string;
  clientName: string;
  appointmentId?: string;
  professionalId?: string;
  professionalName?: string;
  items: SaleItem[];
  totalAmount: number;
  status: SaleStatus;
  notes?: string;
  payments: Payment[];
  created_at: string;
  updatedAt?: string;
}

export interface SaleItem {
  id: string;
  serviceVariantId: string;
  serviceName?: string;
  serviceVariantName?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  professionalId?: string; // assigned professional for this item
  professionalName?: string;
  commissionPct?: number; // % at the time of sale
  commissionAmount?: number; // calculated amount
}

export interface Payment {
  id: string;
  saleId: string;
  clientName?: string;
  serviceName?: string;
  serviceVariantName?: string;
  amount: number;
  paymentMethod?: string;
  externalTransactionId?: string;
  linkUrl?: string;
  status: PaymentStatus;
  paidAt?: string;
  professionalId?: string;
  professionalName?: string;
  created_at: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: AppRole;
}

export interface Professional {
  id: string; // user_id
  name: string;
  email?: string;
  functionTitle?: string;
  role: AppRole;
  commissionPct?: number; // % commission for this professional
  created_at: string;
}

export interface AppOption {
  id: number;
  optionType: string;
  label: string;
  value: string;
  isActive: boolean;
  displayOrder: number;
}

export interface AppSetting {
  key: string;
  value: string;
}

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: Array<{ email: string }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: "email" | "popup";
      minutes: number;
    }>;
  };
}

export interface UserIntegration {
  id: string;
  userId: string;
  created_at: string;
  updatedAt: string | null;
}
