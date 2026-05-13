import {
  AppRole,
  AppointmentStatus,
  SaleStatus,
  PaymentStatus,
} from "./domain";

/**
 * Raw Supabase schema interfaces (Snake Case)
 * Strictly mirroring the database structure.
 */

export type SupabaseNumeric = number | string;

export interface SupabaseClient {
  id: number;
  full_name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  services: string | null;
  version: number | null;
  idempotency_key: string | null;
  updated_at: string | null;
  user_id: string | null;
  birth_date: string | null;
  service_location: string | null;
  preferred_schedule: string | null;
  referral_source: string | null;
  marketing_consent: boolean;
  is_client: boolean;
  deleted_at: string | null;
  total_spent?: number;
}

export interface SupabaseService {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  user_id: string | null;
  deleted_at: string | null;
}

export interface SupabaseServiceVariant {
  id: number;
  service_id: number;
  variant_name: string;
  price: SupabaseNumeric;
  duration_minutes: number;
  is_active: boolean;
  commission_pct: SupabaseNumeric | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface SupabaseAppointment {
  id: number;
  client_id: number;
  professional_id: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  notes: string | null;
  google_event_id: string | null;
  created_at: string;
  updated_at: string | null;
  created_by: string | null;
  deleted_at: string | null;
}

export interface SupabaseAppointmentService {
  id: number;
  appointment_id: number;
  service_variant_id: number;
  quantity: number;
  created_at: string;
  deleted_at: string | null;
}

export interface SupabaseSale {
  id: number;
  client_id: number;
  appointment_id: number | null;
  total_amount: SupabaseNumeric;
  status: SaleStatus;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  created_by: string | null;
  professional_id: string | null;
  deleted_at: string | null;
}

export interface SupabaseSaleItem {
  id: number;
  sale_id: number;
  service_variant_id: number;
  quantity: number;
  unit_price: SupabaseNumeric;
  subtotal: SupabaseNumeric;
  professional_id: string | null;
  commission_pct: SupabaseNumeric | null;
  commission_amount: SupabaseNumeric | null;
  created_at: string;
  deleted_at: string | null;
}

export interface SupabasePayment {
  id: number;
  sale_id: number;
  amount: SupabaseNumeric;
  payment_method: string | null;
  external_transaction_id: string | null;
  payment_link_url: string | null;
  status: PaymentStatus;
  paid_at: string | null;
  professional_id: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface SupabaseUserRole {
  user_id: string;
  role: AppRole;
  created_at: string;
  deleted_at: string | null;
}

export interface SupabaseProfessional {
  user_id: string;
  role: AppRole;
  full_name: string | null;
  email: string | null;
  function_title: string | null;
  commission_pct: SupabaseNumeric | null;
  created_at: string;
  deleted_at: string | null;
}

export interface SupabaseAppOption {
  id: number;
  option_type: string;
  label: string;
  value: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  deleted_at: string | null;
}

export interface SupabaseAppSetting {
  key: string;
  value: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface SupabaseUserIntegration {
  id: number;
  user_id: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface SupabasePing {
  id: number;
  created_at: string;
}

export type SupabaseTableMap = {
  app_options: SupabaseAppOption;
  app_settings: SupabaseAppSetting;
  appointment_services: SupabaseAppointmentService;
  appointments: SupabaseAppointment;
  clients: SupabaseClient;
  payments: SupabasePayment;
  ping: SupabasePing;
  professionals: SupabaseProfessional;
  sale_items: SupabaseSaleItem;
  sales: SupabaseSale;
  service_variants: SupabaseServiceVariant;
  services: SupabaseService;
  user_roles: SupabaseUserRole;
};

export type SupabaseTableName = keyof SupabaseTableMap;
export type SupabaseRow<TTable extends SupabaseTableName> =
  SupabaseTableMap[TTable];
export type SupabaseInsert<TTable extends SupabaseTableName> = Partial<
  SupabaseRow<TTable>
>;
export type SupabaseUpdate<TTable extends SupabaseTableName> = Partial<
  SupabaseRow<TTable>
>;
