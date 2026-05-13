import {
  AppRole,
  AppointmentStatus,
  PaymentStatus,
  SaleStatus,
  type AppOption,
  type Appointment,
  type Client,
  type Payment,
  type Professional,
  type Sale,
  type SaleItem,
  type Service,
  type ServiceVariant,
} from "@/types";
import type {
  SupabaseAppOption,
  SupabaseAppSetting,
  SupabaseAppointment,
  SupabaseAppointmentService,
  SupabaseClient,
  SupabasePayment,
  SupabaseProfessional,
  SupabaseSale,
  SupabaseSaleItem,
  SupabaseService,
  SupabaseServiceVariant,
  SupabaseUserRole,
} from "@/types/db";

const now = "2026-05-13T12:00:00.000Z";

export function clientFactory(overrides: Partial<Client> = {}): Client {
  return {
    id: "10",
    name: "Maria Silva",
    email: "maria@example.com",
    phone: "(11) 99999-0000",
    registrationDate: now,
    totalSpent: 0,
    status: "active",
    marketingConsent: false,
    isClient: true,
    ...overrides,
  };
}

export function professionalFactory(
  overrides: Partial<Professional> = {},
): Professional {
  return {
    id: "prof-1",
    name: "Ana Souza",
    email: "ana@example.com",
    functionTitle: "Esteticista",
    role: AppRole.PROFESSIONAL,
    commissionPct: 70,
    created_at: now,
    ...overrides,
  };
}

export function serviceVariantFactory(
  overrides: Partial<ServiceVariant> = {},
): ServiceVariant {
  return {
    id: "55",
    serviceId: "20",
    variantName: "Padrao",
    price: 120,
    duration: 60,
    active: true,
    commissionPct: undefined,
    created_at: now,
    ...overrides,
  };
}

export function serviceFactory(overrides: Partial<Service> = {}): Service {
  const variant = serviceVariantFactory();
  return {
    id: "20",
    name: "Limpeza",
    description: "Limpeza facial",
    category: "Pele",
    active: true,
    variants: [variant],
    created_at: now,
    ...overrides,
  };
}

export function appointmentFactory(
  overrides: Partial<Appointment> = {},
): Appointment {
  return {
    id: "100",
    clientId: "10",
    clientName: "Maria Silva",
    professionalId: "prof-1",
    professionalName: "Ana Souza",
    serviceVariants: [
      {
        serviceVariantId: "55",
        serviceVariantName: "Limpeza - Padrao",
        quantity: 1,
        unitPrice: 120,
      },
    ],
    startTime: "2026-05-13T13:00:00.000Z",
    endTime: "2026-05-13T14:00:00.000Z",
    status: AppointmentStatus.SCHEDULED,
    totalPrice: 120,
    googleEventId: "google-1",
    created_at: now,
    ...overrides,
  };
}

export function saleItemFactory(overrides: Partial<SaleItem> = {}): SaleItem {
  return {
    id: "700",
    serviceVariantId: "55",
    serviceName: "Limpeza",
    serviceVariantName: "Padrao",
    quantity: 1,
    unitPrice: 120,
    subtotal: 120,
    professionalId: "prof-1",
    professionalName: "Ana Souza",
    commissionPct: 70,
    commissionAmount: 84,
    ...overrides,
  };
}

export function paymentFactory(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "800",
    saleId: "900",
    clientName: "Maria Silva",
    amount: 120,
    paymentMethod: "PIX",
    status: PaymentStatus.PAID,
    paidAt: now,
    professionalId: "prof-1",
    professionalName: "Ana Souza",
    created_at: now,
    ...overrides,
  };
}

export function saleFactory(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "900",
    clientId: "10",
    clientName: "Maria Silva",
    appointmentId: "100",
    professionalId: "prof-1",
    professionalName: "Ana Souza",
    items: [saleItemFactory()],
    totalAmount: 120,
    status: SaleStatus.PENDING,
    notes: "",
    payments: [],
    created_at: now,
    ...overrides,
  };
}

export function appOptionFactory(
  overrides: Partial<AppOption> = {},
): AppOption {
  return {
    id: 1,
    optionType: "payment_method",
    label: "PIX",
    value: "pix",
    isActive: true,
    displayOrder: 1,
    ...overrides,
  };
}

export const dbFactories = {
  client(overrides: Partial<SupabaseClient> = {}): SupabaseClient {
    return {
      id: 10,
      full_name: "Maria Silva",
      phone: "(11) 99999-0000",
      email: "maria@example.com",
      notes: null,
      is_active: true,
      created_at: now,
      services: null,
      version: 1,
      idempotency_key: null,
      updated_at: now,
      user_id: null,
      birth_date: null,
      service_location: null,
      preferred_schedule: null,
      referral_source: null,
      marketing_consent: false,
      is_client: true,
      deleted_at: null,
      total_spent: 0,
      ...overrides,
    };
  },
  professional(
    overrides: Partial<SupabaseProfessional> = {},
  ): SupabaseProfessional {
    return {
      user_id: "prof-1",
      role: AppRole.PROFESSIONAL,
      full_name: "Ana Souza",
      email: "ana@example.com",
      function_title: "Esteticista",
      commission_pct: 70,
      created_at: now,
      deleted_at: null,
      ...overrides,
    };
  },
  service(overrides: Partial<SupabaseService> = {}): SupabaseService {
    return {
      id: 20,
      name: "Limpeza",
      description: "Limpeza facial",
      category: "Pele",
      is_active: true,
      created_at: now,
      updated_at: now,
      user_id: null,
      deleted_at: null,
      ...overrides,
    };
  },
  serviceVariant(
    overrides: Partial<SupabaseServiceVariant> = {},
  ): SupabaseServiceVariant {
    return {
      id: 55,
      service_id: 20,
      variant_name: "Padrao",
      price: 120,
      duration_minutes: 60,
      is_active: true,
      commission_pct: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      ...overrides,
    };
  },
  appointment(
    overrides: Partial<SupabaseAppointment> = {},
  ): SupabaseAppointment {
    return {
      id: 100,
      client_id: 10,
      professional_id: "prof-1",
      start_time: "2026-05-13T13:00:00.000Z",
      end_time: "2026-05-13T14:00:00.000Z",
      status: AppointmentStatus.SCHEDULED,
      notes: null,
      google_event_id: "google-1",
      created_at: now,
      updated_at: now,
      created_by: null,
      deleted_at: null,
      ...overrides,
    };
  },
  appointmentService(
    overrides: Partial<SupabaseAppointmentService> = {},
  ): SupabaseAppointmentService {
    return {
      id: 500,
      appointment_id: 100,
      service_variant_id: 55,
      quantity: 1,
      created_at: now,
      deleted_at: null,
      ...overrides,
    };
  },
  sale(overrides: Partial<SupabaseSale> = {}): SupabaseSale {
    return {
      id: 900,
      client_id: 10,
      appointment_id: 100,
      total_amount: 120,
      status: SaleStatus.PENDING,
      notes: null,
      created_at: now,
      updated_at: now,
      created_by: null,
      professional_id: "prof-1",
      deleted_at: null,
      ...overrides,
    };
  },
  saleItem(overrides: Partial<SupabaseSaleItem> = {}): SupabaseSaleItem {
    return {
      id: 700,
      sale_id: 900,
      service_variant_id: 55,
      quantity: 1,
      unit_price: 120,
      subtotal: 120,
      professional_id: "prof-1",
      commission_pct: 70,
      commission_amount: 84,
      created_at: now,
      deleted_at: null,
      ...overrides,
    };
  },
  payment(overrides: Partial<SupabasePayment> = {}): SupabasePayment {
    return {
      id: 800,
      sale_id: 900,
      amount: 120,
      payment_method: "PIX",
      external_transaction_id: "txn-1",
      payment_link_url: null,
      status: PaymentStatus.PAID,
      paid_at: now,
      professional_id: "prof-1",
      created_at: now,
      updated_at: now,
      deleted_at: null,
      ...overrides,
    };
  },
  appOption(overrides: Partial<SupabaseAppOption> = {}): SupabaseAppOption {
    return {
      id: 1,
      option_type: "payment_method",
      label: "PIX",
      value: "pix",
      is_active: true,
      display_order: 1,
      created_at: now,
      deleted_at: null,
      ...overrides,
    };
  },
  appSetting(overrides: Partial<SupabaseAppSetting> = {}): SupabaseAppSetting {
    return {
      key: "default_commission_pct",
      value: "70",
      created_at: now,
      updated_at: now,
      deleted_at: null,
      ...overrides,
    };
  },
  userRole(overrides: Partial<SupabaseUserRole> = {}): SupabaseUserRole {
    return {
      user_id: "user-1",
      role: AppRole.SECRETARY,
      created_at: now,
      deleted_at: null,
      ...overrides,
    };
  },
};
