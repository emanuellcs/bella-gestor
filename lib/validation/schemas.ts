import { z } from "zod";

import { AppRole, AppointmentStatus, PaymentStatus, SaleStatus } from "@/types";

export const idStringSchema = z.string().min(1);
export const numericIdStringSchema = z
  .string()
  .min(1)
  .refine((value) => Number.isFinite(Number(value)), "ID inválido.");

export const nullableStringSchema = z.string().nullable().optional();

export const clientInputSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().optional(),
  phone: z.string().min(1).optional(),
  birthDate: z.string().optional(),
  serviceLocation: z.string().optional(),
  preferredSchedule: z.string().optional(),
  referral_source: z.string().optional(),
  marketingConsent: z.boolean().optional(),
  isClient: z.boolean().optional(),
  notes: z.string().optional(),
  services: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const serviceVariantInputSchema = z.object({
  id: z.string().optional(),
  serviceId: z.string().optional(),
  variantName: z.string().min(1).optional(),
  price: z.coerce.number().min(0).optional(),
  duration: z.coerce.number().int().positive().optional(),
  active: z.boolean().optional(),
  commissionPct: z.coerce.number().min(0).max(100).optional(),
});

export const serviceInputSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  active: z.boolean().optional(),
  variants: z.array(serviceVariantInputSchema).optional(),
});

export const professionalInputSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().optional(),
  functionTitle: z.string().optional(),
  role: z.nativeEnum(AppRole).optional(),
  commissionPct: z.coerce.number().min(0).max(100).optional(),
});

export const saleItemInputSchema = z.object({
  serviceVariantId: z.string().min(1),
  serviceName: z.string().optional(),
  serviceVariantName: z.string().optional(),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().min(0),
  professionalId: z.string().optional(),
  professionalName: z.string().optional(),
  commissionPct: z.coerce.number().min(0).max(100).optional(),
  commissionAmount: z.coerce.number().min(0).optional(),
  subtotal: z.coerce.number().min(0).optional(),
});

export const newSaleSchema = z.object({
  clientId: z.string().min(1),
  appointmentId: z.string().optional(),
  professionalId: z.string().optional(),
  professionalName: z.string().optional(),
  status: z.nativeEnum(SaleStatus).optional(),
  notes: z.string().optional(),
  items: z.array(saleItemInputSchema).min(1),
  totalAmount: z.coerce.number().min(0).optional(),
  createdAt: z.string().optional(),
});

export const paymentInputSchema = z.object({
  saleId: z.string().min(1),
  clientName: z.string().optional(),
  serviceName: z.string().optional(),
  serviceVariantName: z.string().optional(),
  amount: z.coerce.number().positive(),
  paymentMethod: z.string().optional(),
  externalTransactionId: z.string().optional(),
  linkUrl: z.string().optional(),
  status: z.nativeEnum(PaymentStatus),
  paidAt: z.string().optional(),
  professionalId: z.string().optional(),
  professionalName: z.string().optional(),
  created_at: z.string(),
  updatedAt: z.string().optional(),
});

export const appOptionInputSchema = z.object({
  id: z.number().int().positive().optional(),
  option_type: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
  is_active: z.boolean().optional(),
  display_order: z.number().int().optional(),
});

export const appSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export const appointmentServiceInputSchema = z.object({
  serviceVariantId: z.string().min(1),
  serviceVariantName: z.string().optional(),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().min(0).optional(),
});

export const appointmentInputSchema = z.object({
  clientId: z.string().min(1).optional(),
  clientName: z.string().optional(),
  professionalId: z.string().min(1).optional(),
  professionalName: z.string().optional(),
  serviceVariants: z.array(appointmentServiceInputSchema).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  notes: z.string().optional(),
  totalPrice: z.coerce.number().min(0).optional(),
  hasSale: z.boolean().optional(),
  saleId: z.string().optional(),
  googleEventId: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const googleCalendarEventSchema = z.object({
  id: z.string().optional(),
  summary: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  start: z
    .object({
      dateTime: z.string(),
      timeZone: z.string().optional(),
    })
    .optional(),
  end: z
    .object({
      dateTime: z.string(),
      timeZone: z.string().optional(),
    })
    .optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  attendees: z.array(z.object({ email: z.string().email() })).optional(),
});

export const listedGoogleCalendarEventSchema = z.object({
  id: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  start: z.object({ dateTime: z.string() }),
  end: z.object({ dateTime: z.string() }),
  attendees: z.array(z.object({ email: z.string() })).optional(),
  htmlLink: z.string().optional(),
});

export const googleAppsScriptResponseSchema = z
  .object({
    success: z.boolean().optional(),
    eventId: z.string().optional(),
    event: z.object({ id: z.string().optional() }).passthrough().optional(),
    events: z.array(listedGoogleCalendarEventSchema).optional(),
    error: z.string().optional(),
  })
  .passthrough();

const infinitePayItemSchema = z.object({
  quantity: z.coerce.number().int().positive(),
  price: z.coerce.number().int().nonnegative(),
  description: z.string().min(1),
});

export const infinitePayCheckoutRequestSchema = z.object({
  saleId: z.union([z.string(), z.number()]),
  amount: z.coerce.number().positive(),
  items: z.array(infinitePayItemSchema).optional(),
  customer: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone_number: z.string().optional(),
    })
    .optional(),
  address: z
    .object({
      cep: z.string(),
      number: z.string(),
      street: z.string().optional(),
      neighborhood: z.string().optional(),
      complement: z.string().optional(),
    })
    .optional(),
});

export const infinitePayCheckoutResponseSchema = z
  .object({
    url: z.string().min(1),
    message: z.string().optional(),
  })
  .passthrough();

export const infinitePayWebhookSchema = z.object({
  invoice_slug: z.string().optional(),
  amount: z.coerce.number().optional(),
  paid_amount: z.coerce.number().optional(),
  installments: z.coerce.number().optional(),
  capture_method: z.enum(["credit_card", "pix"]).optional(),
  transaction_nsu: z.string().optional(),
  order_nsu: z.string().optional(),
  receipt_url: z.string().optional(),
  items: z.array(z.unknown()).optional(),
});

export const infinitePayPaymentCheckSchema = z.object({
  order_nsu: z.string().optional(),
  transaction_nsu: z.string().optional(),
  slug: z.string().optional(),
});

export const cancelPaymentRequestSchema = z.object({
  externalTransactionId: z.string().min(1),
});

export const proAccessRequestSchema = z.object({
  keyword: z.coerce.string(),
});

export function zodErrorMessage(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join(" ");
}
