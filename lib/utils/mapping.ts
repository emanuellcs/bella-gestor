import {
  Client,
  SupabaseClient,
  Appointment,
  SupabaseAppointment,
  Service,
  SupabaseService,
  ServiceVariant,
  SupabaseServiceVariant,
  Sale,
  SupabaseSale,
  Payment,
  SupabasePayment,
  SupabaseSaleItem,
  Professional,
  SupabaseProfessional,
  AppOption,
  SupabaseAppOption,
} from "@/types";

/**
 * Mappers to transform Database types (Snake Case) to Domain types (Camel Case).
 */

// CLIENTS
export function supabaseClientToClient(
  supabaseClient: SupabaseClient & { total_spent?: number },
): Client {
  return {
    id: supabaseClient.id.toString(),
    name: supabaseClient.full_name,
    email: supabaseClient.email || "",
    phone: supabaseClient.phone,
    birthDate: supabaseClient.birth_date || undefined,
    serviceLocation: supabaseClient.service_location || undefined,
    preferredSchedule: supabaseClient.preferred_schedule || undefined,
    referral_source: supabaseClient.referral_source || undefined,

    marketingConsent: supabaseClient.marketing_consent,
    isClient: supabaseClient.is_client,
    registrationDate: supabaseClient.created_at,
    lastVisit: supabaseClient.updated_at || undefined,
    status: supabaseClient.is_active ? "active" : "inactive",
    totalSpent: supabaseClient.total_spent || 0,
    notes: supabaseClient.notes || undefined,
    services: supabaseClient.services || undefined,
  };
}

export function clientToSupabaseClient(
  client: Partial<Client>,
): Partial<Omit<SupabaseClient, "id" | "created_at">> {
  const data: Partial<Omit<SupabaseClient, "id" | "created_at">> = {};

  if (client.name !== undefined) data.full_name = client.name;
  if (client.email !== undefined) data.email = client.email || null;
  if (client.phone !== undefined) data.phone = client.phone;
  if (client.notes !== undefined) data.notes = client.notes || null;
  if (client.services !== undefined) data.services = client.services || null;
  if (client.status !== undefined) data.is_active = client.status === "active";
  if (client.birthDate !== undefined)
    data.birth_date = client.birthDate || null;
  if (client.serviceLocation !== undefined)
    data.service_location = client.serviceLocation || null;
  if (client.preferredSchedule !== undefined)
    data.preferred_schedule = client.preferredSchedule || null;
  if (client.referral_source !== undefined)
    data.referral_source = client.referral_source || null;
  if (client.marketingConsent !== undefined)
    data.marketing_consent = client.marketingConsent;
  if (client.isClient !== undefined) data.is_client = client.isClient;

  return data;
}

// SERVICES
export function supabaseServiceToService(
  supabaseService: SupabaseService & {
    service_variants?: SupabaseServiceVariant[];
  },
): Service {
  return {
    id: supabaseService.id.toString(),
    name: supabaseService.name,
    description: supabaseService.description || "",
    category: supabaseService.category || "",
    active: !!supabaseService.is_active,
    created_at: supabaseService.created_at,
    updatedAt: supabaseService.updated_at || undefined,
    variants: supabaseService.service_variants?.map(supabaseVariantToVariant),
  };
}

export function supabaseVariantToVariant(
  v: SupabaseServiceVariant,
): ServiceVariant {
  return {
    id: v.id.toString(),
    serviceId: v.service_id.toString(),
    variantName: v.variant_name,
    price: typeof v.price === "string" ? parseFloat(v.price) : v.price,
    duration: v.duration_minutes,
    active: !!v.is_active,
    commissionPct:
      v.commission_pct !== null ? Number(v.commission_pct) : undefined,
    created_at: v.created_at,
    updatedAt: v.updated_at || undefined,
  };
}

// APPOINTMENTS
export function supabaseAppointmentToAppointment(
  apt: SupabaseAppointment & { clients?: { full_name: string } },
): Appointment {
  return {
    id: apt.id.toString(),
    clientId: apt.client_id.toString(),
    clientName: apt.clients?.full_name || "",
    professionalId: apt.professional_id,
    serviceVariants: [], // Should be populated if needed
    startTime: apt.start_time,
    endTime: apt.end_time,
    status: apt.status,
    notes: apt.notes || "",
    totalPrice: 0,
    created_at: apt.created_at,
    updatedAt: apt.updated_at || undefined,
  };
}

// SALES & PAYMENTS
export function supabaseSaleToSale(
  s: SupabaseSale & {
    clients?: { full_name: string } | { full_name: string }[];
    client?: { full_name: string } | { full_name: string }[];
    professionals?: { full_name: string } | { full_name: string }[];
    professional?: { full_name: string } | { full_name: string }[];
    sale_items?: (SupabaseSaleItem & {
      professionals?: { full_name: string } | { full_name: string }[];
      professional?: { full_name: string } | { full_name: string }[];
      service_variants?:
        | {
            variant_name: string;
            services?: { name: string } | { name: string }[];
            service?: { name: string } | { name: string }[];
          }
        | {
            variant_name: string;
            services?: { name: string } | { name: string }[];
            service?: { name: string } | { name: string }[];
          }[];
      variant?:
        | {
            variant_name: string;
            services?: { name: string } | { name: string }[];
            service?: { name: string } | { name: string }[];
          }
        | {
            variant_name: string;
            services?: { name: string } | { name: string }[];
            service?: { name: string } | { name: string }[];
          }[];
    })[];
    items?: (SupabaseSaleItem & {
      professionals?: { full_name: string } | { full_name: string }[];
      professional?: { full_name: string } | { full_name: string }[];
      variant?:
        | {
            variant_name: string;
            services?: { name: string } | { name: string }[];
            service?: { name: string } | { name: string }[];
          }
        | {
            variant_name: string;
            services?: { name: string } | { name: string }[];
            service?: { name: string } | { name: string }[];
          }[];
      service_variants?:
        | {
            variant_name: string;
            services?: { name: string } | { name: string }[];
            service?: { name: string } | { name: string }[];
          }
        | {
            variant_name: string;
            services?: { name: string } | { name: string }[];
            service?: { name: string } | { name: string }[];
          }[];
    })[];
    payments?: SupabasePayment[];
  },
): Sale {
  const rawClient = s.client || s.clients;
  const client = Array.isArray(rawClient) ? rawClient[0] : rawClient;

  const rawProf = s.professional || s.professionals;
  const saleProf = Array.isArray(rawProf) ? rawProf[0] : rawProf;

  const rawItems = s.items || s.sale_items || [];

  return {
    id: s.id.toString(),
    clientId: s.client_id.toString(),
    clientName: client?.full_name || "",
    appointmentId: s.appointment_id ? s.appointment_id.toString() : undefined,
    professionalId: s.professional_id || undefined,
    professionalName: saleProf?.full_name || "",
    items: rawItems.map((it) => {
      const rawItemProf = it.professional || it.professionals;
      const itemProf = Array.isArray(rawItemProf)
        ? rawItemProf[0]
        : rawItemProf;

      const rawVariant = it.variant || it.service_variants;
      const variant = Array.isArray(rawVariant) ? rawVariant[0] : rawVariant;

      const rawService = variant?.service || variant?.services;
      const svc = Array.isArray(rawService) ? rawService[0] : rawService;

      return {
        id: it.id.toString(),
        serviceVariantId: it.service_variant_id.toString(),
        serviceName: svc?.name || "",
        serviceVariantName: variant?.variant_name || "",
        quantity: it.quantity,
        unitPrice:
          typeof it.unit_price === "string"
            ? parseFloat(it.unit_price)
            : it.unit_price,
        subtotal:
          typeof it.subtotal === "string"
            ? parseFloat(it.subtotal)
            : it.subtotal,
        professionalId: it.professional_id || undefined,
        professionalName: itemProf?.full_name || "",
        commissionPct:
          it.commission_pct !== null ? Number(it.commission_pct) : undefined,
        commissionAmount:
          it.commission_amount !== null
            ? Number(it.commission_amount)
            : undefined,
      };
    }),
    totalAmount:
      typeof s.total_amount === "string"
        ? parseFloat(s.total_amount)
        : s.total_amount,
    status: s.status,
    notes: s.notes || "",
    payments: (s.payments || []).map(supabasePaymentToPayment),
    created_at: s.created_at,
    updatedAt: s.updated_at || undefined,
  };
}

export function supabasePaymentToPayment(
  p: SupabasePayment & {
    professional?: { full_name: string } | { full_name: string }[];
    professionals?: { full_name: string } | { full_name: string }[];
    sale?:
      | (SupabaseSale & {
          client?: { full_name: string } | { full_name: string }[];
          clients?: { full_name: string } | { full_name: string }[];
          items?: (SupabaseSaleItem & {
            variant?:
              | {
                  variant_name: string;
                  service?: { name: string } | { name: string }[];
                  services?: { name: string } | { name: string }[];
                }
              | {
                  variant_name: string;
                  service?: { name: string } | { name: string }[];
                  services?: { name: string } | { name: string }[];
                }[];
            service_variants?:
              | {
                  variant_name: string;
                  service?: { name: string } | { name: string }[];
                  services?: { name: string } | { name: string }[];
                }
              | {
                  variant_name: string;
                  service?: { name: string } | { name: string }[];
                  services?: { name: string } | { name: string }[];
                }[];
          })[];
          sale_items?: (SupabaseSaleItem & {
            variant?:
              | {
                  variant_name: string;
                  service?: { name: string } | { name: string }[];
                  services?: { name: string } | { name: string }[];
                }
              | {
                  variant_name: string;
                  service?: { name: string } | { name: string }[];
                  services?: { name: string } | { name: string }[];
                }[];
            service_variants?:
              | {
                  variant_name: string;
                  service?: { name: string } | { name: string }[];
                  services?: { name: string } | { name: string }[];
                }
              | {
                  variant_name: string;
                  service?: { name: string } | { name: string }[];
                  services?: { name: string } | { name: string }[];
                }[];
          })[];
        })
      | (SupabaseSale & {
          client?: { full_name: string } | { full_name: string }[];
          clients?: { full_name: string } | { full_name: string }[];
          items?: (SupabaseSaleItem & {
            variant?:
              | {
                  variant_name: string;
                  service?: { name: string } | { name: string }[];
                  services?: { name: string } | { name: string }[];
                }
              | {
                  variant_name: string;
                  service?: { name: string } | { name: string }[];
                  services?: { name: string } | { name: string }[];
                }[];
            service_variants?:
              | {
                  variant_name: string;
                  service?: { name: string } | { name: string }[];
                  services?: { name: string } | { name: string }[];
                }
              | {
                  variant_name: string;
                  service?: { name: string } | { name: string }[];
                  services?: { name: string } | { name: string }[];
                }[];
          })[];
          sale_items?: (SupabaseSaleItem & {
            variant?:
              | {
                  variant_name: string;
                  service?: { name: string } | { name: string }[];
                  services?: { name: string } | { name: string }[];
                }
              | {
                  variant_name: string;
                  service?: { name: string } | { name: string }[];
                  services?: { name: string } | { name: string }[];
                }[];
            service_variants?:
              | {
                  variant_name: string;
                  service?: { name: string } | { name: string }[];
                  services?: { name: string } | { name: string }[];
                }
              | {
                  variant_name: string;
                  service?: { name: string } | { name: string }[];
                  services?: { name: string } | { name: string }[];
                }[];
          })[];
        })[];
  },
): Payment {
  const rawProf = p.professional || p.professionals;
  const professional = Array.isArray(rawProf) ? rawProf[0] : rawProf;

  const rawSale = p.sale;
  const sale = Array.isArray(rawSale) ? rawSale[0] : rawSale;

  const rawClient = sale?.client || sale?.clients;
  const client = Array.isArray(rawClient) ? rawClient[0] : rawClient;

  const saleItem = (sale?.items || sale?.sale_items || [])[0];

  const rawVariant = saleItem?.variant || saleItem?.service_variants;
  const variant = Array.isArray(rawVariant) ? rawVariant[0] : rawVariant;

  const rawService = variant?.service || variant?.services;
  const service = Array.isArray(rawService) ? rawService[0] : rawService;

  return {
    id: p.id.toString(),
    saleId: p.sale_id.toString(),
    clientName: client?.full_name || "",
    serviceName: service?.name || "",
    serviceVariantName: variant?.variant_name || "",
    amount: typeof p.amount === "string" ? parseFloat(p.amount) : p.amount,
    paymentMethod: p.payment_method || undefined,
    externalTransactionId: p.external_transaction_id || undefined,
    linkUrl: p.payment_link_url || undefined,
    status: p.status,
    paidAt: p.paid_at || undefined,
    professionalId: p.professional_id || undefined,
    professionalName: professional?.full_name || "",
    created_at: p.created_at,
    updatedAt: p.updated_at || undefined,
  };
}

// PROFESSIONALS
export function supabaseProfessionalToProfessional(
  p: SupabaseProfessional,
): Professional {
  return {
    id: p.user_id,
    name: p.full_name || "",
    email: p.email || undefined,
    functionTitle: p.function_title || undefined,
    role: p.role,
    commissionPct:
      p.commission_pct !== null ? Number(p.commission_pct) : undefined,
    created_at: p.created_at,
  };
}

// APP OPTIONS
export function supabaseAppOptionToAppOption(o: SupabaseAppOption): AppOption {
  return {
    id: Number(o.id),
    optionType: o.option_type,
    label: o.label,
    value: o.value,
    isActive:
      o.is_active === true || o.is_active === null || o.is_active === undefined,
    displayOrder: o.display_order || 0,
  };
}
