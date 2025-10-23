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
  PAID = "paid",
  FAILED = "failed",
  REFUNDED = "refunded",
}

export interface SupabaseClient {
  id: number
  full_name: string
  phone: string
  email: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  services: string | null
  version: number | null
  idempotency_key: string | null
  updated_at: string | null
  user_id: string | null
  birth_date: string | null
  service_location: string | null
  preferred_schedule: string | null
  referral_source: string | null
  marketing_consent: boolean
  is_client: boolean
}

export interface SupabaseService {
  id: number
  name: string
  description: string | null
  category: string | null
  is_active: boolean
  created_at: string
  updated_at: string | null
  user_id: string | null
}

export interface SupabaseServiceVariant {
  id: number
  service_id: number
  variant_name: string
  price: number
  duration_minutes: number
  is_active: boolean
  created_at: string
  updated_at: string | null
}

export interface SupabaseAppointment {
  id: number
  client_id: number
  professional_id: string
  start_time: string
  end_time: string
  status: AppointmentStatus
  notes: string | null
  google_calendar_event_id: string | null
  created_at: string
  updated_at: string | null
  created_by: string | null
}

export interface SupabaseAppointmentService {
  id: number
  appointment_id: number
  service_variant_id: number
  quantity: number
  created_at: string
}

export interface SupabaseSale {
  id: number
  client_id: number
  appointment_id: number | null
  total_amount: number
  status: SaleStatus
  notes: string | null
  created_at: string
  updated_at: string | null
  created_by: string | null
}

export interface SupabaseSaleItem {
  id: number
  sale_id: number
  service_variant_id: number
  quantity: number
  unit_price: number
  subtotal: number
  created_at: string
}

export interface SupabasePayment {
  id: number
  sale_id: number
  amount: number
  payment_method: string | null
  external_transaction_id: string | null
  payment_link_url: string | null
  status: PaymentStatus
  paid_at: string | null
  created_at: string
  updated_at: string | null
}

export interface SupabaseUserRole {
  user_id: string
  role: AppRole
  created_at: string
}

export interface UserIntegration {
  id: string
  userId: string
  googleCalendarAccessToken: string | null
  googleCalendarRefreshToken: string | null
  googleCalendarConnectedAt: string | null
  created_at: string
  updatedAt: string | null
}

export interface SupabaseUserIntegration {
  id: number
  user_id: string
  google_calendar_access_token: string | null
  google_calendar_refresh_token: string | null
  google_calendar_connected_at: string | null
  created_at: string
  updated_at: string | null
}


export interface Client {
  id: string
  name: string
  email: string
  phone: string
  birthDate?: string
  serviceLocation?: string
  preferredSchedule?: string
  referralSource?: string
  marketingConsent?: boolean
  isClient?: boolean
  registrationDate: string
  lastVisit?: string
  totalSpent: number
  status: "active" | "inactive"
  notes?: string
  services?: string
}

export interface Service {
  id: string
  name: string
  description?: string
  category: string
  active: boolean
  variants?: ServiceVariant[]
  created_at: string
  updatedAt?: string
}

export interface ServiceVariant {
  id: string
  serviceId: string
  variantName: string
  price: number
  duration: number
  active: boolean
  created_at: string
  updatedAt?: string
}

export interface Appointment {
  id: string
  clientId: string
  clientName?: string
  professionalId: string
  professionalName?: string
  serviceVariants: AppointmentService[]
  startTime: string
  endTime: string
  status: AppointmentStatus
  notes?: string
  totalPrice: number
  saleId?: string
  googleCalendarEventId?: string
  created_at: string
  updatedAt?: string
}

export interface AppointmentService {
  serviceVariantId: string
  serviceVariantName?: string
  quantity: number
}

export interface Sale {
  id: string
  clientId: string
  clientName: string
  appointmentId?: string
  items: SaleItem[]
  totalAmount: number
  status: SaleStatus
  notes?: string
  payments: Payment[]
  created_at: string
  updatedAt?: string
}

export interface SaleItem {
  id: string
  serviceVariantId: string
  serviceVariantName?: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export interface Payment {
  id: string
  saleId: string
  amount: number
  paymentMethod?: string
  externalTransactionId?: string
  linkUrl?: string
  status: PaymentStatus
  paidAt?: string
  created_at: string
  updatedAt?: string
}

export interface User {
  id: string
  name: string
  email: string
  role: AppRole
}

export interface CalendarEvent {
  id?: string
  summary: string
  description?: string
  location?: string
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  attendees?: Array<{ email: string }>
  reminders?: {
    useDefault: boolean
    overrides?: Array<{
      method: 'email' | 'popup'
      minutes: number
    }>
  }
}
