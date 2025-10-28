// services/api.ts
import type {
  Client,
  Appointment,
  Service,
  ServiceVariant,
  Sale,
  Payment,
  SaleStatus,
} from "@/lib/types"
import { PaymentStatus } from "@/lib/types"
import { supabase } from "@/lib/supabaseClient"
import { supabaseClientToClient, clientToSupabaseClient } from "@/lib/utils"
import { parseSupabaseError } from "@/lib/error-handler"

/* =========================
   CLIENTES
   ========================= */

export async function getClients(
  searchTerm: string = "",
  pageNumber: number = 1,
  pageSize: number = 10,
  isActive: boolean = true
): Promise<Client[]> {
  try {
    const { data, error } = await supabase.rpc("get_clients_with_total_spent", {
      search_term: searchTerm,
      page_number: pageNumber,
      page_size: pageSize,
      filter_is_active: isActive,
    })
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    return (data || []).map(supabaseClientToClient)
  } catch (error) {
    console.error("Error in getClients:", error)
    throw error
  }
}

export async function getActiveClients(): Promise<Client[]> {
  try {
    const { data, error } = await supabase.from("clients").select("*").eq("is_active", true).order("created_at", { ascending: false })
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    return (data || []).map(supabaseClientToClient)
  } catch (error) {
    console.error("Error in getActiveClients:", error)
    throw error
  }
}

export async function getClientById(id: string): Promise<Client | null> {
  try {
    const { data, error } = await supabase.from("clients").select("*").eq("id", parseInt(id)).single()
    if (error) {
      if ((error as any)?.code === "PGRST116") return null
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    if (!data) return null
    return supabaseClientToClient(data)
  } catch (error) {
    console.error("Error in getClientById:", error)
    throw error
  }
}

export async function createClient(client: Omit<Client, "id" | "registrationDate" | "status">): Promise<Client> {
  try {
    const payload = clientToSupabaseClient(client)
    const { data, error } = await supabase.from("clients").insert([payload]).select("*").single()
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    return supabaseClientToClient(data)
  } catch (error) {
    console.error("Error in createClient:", error)
    throw error
  }
}

export async function updateClient(id: string, client: Partial<Client>): Promise<Client> {
  try {
    const payload = clientToSupabaseClient(client as any)
    const { data, error } = await supabase.from("clients").update(payload).eq("id", parseInt(id)).select("*").single()
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    return supabaseClientToClient(data)
  } catch (error) {
    console.error("Error in updateClient:", error)
    throw error
  }
}

export async function deactivateClient(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("clients").update({ is_active: false }).eq("id", parseInt(id))
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    return true
  } catch (error) {
    console.error("Error in deactivateClient:", error)
    throw error
  }
}

export async function reactivateClient(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("clients").update({ is_active: true }).eq("id", parseInt(id))
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    return true
  } catch (error) {
    console.error("Error in reactivateClient:", error)
    throw error
  }
}

export async function getInactiveClients(): Promise<Client[]> {
  try {
    const { data, error } = await supabase.from("clients").select("*").eq("is_active", false).order("created_at", { ascending: false })
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    return (data || []).map(supabaseClientToClient)
  } catch (error) {
    console.error("Error in getInactiveClients:", error)
    throw error
  }
}

export async function searchClients(query: string): Promise<Client[]> {
  try {
    const q = `%${query}%`
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .or(`full_name.ilike.${q},phone.ilike.${q},email.ilike.${q}`)
      .order("created_at", { ascending: false })
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    return (data || []).map(supabaseClientToClient)
  } catch (error) {
    console.error("Error in searchClients:", error)
    throw error
  }
}

/* =========================
   SERVIÇOS E VARIANTES
   ========================= */

export async function getServices(): Promise<Service[]> {
  try {
    const { data, error } = await supabase.from("services").select("*").order("created_at", { ascending: false })
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    return (data || []).map((s: any): Service => ({
      id: s.id.toString(),
      name: s.name,
      description: s.description || "",
      category: s.category || "",
      active: !!s.is_active,
      created_at: s.created_at,
      updatedAt: s.updated_at || undefined,
    }))
  } catch (error) {
    console.error("Error in getServices:", error)
    throw error
  }
}

export async function createService(service: Omit<Service, "id" | "created_at" | "updatedAt">): Promise<Service> {
  try {
    const payload: any = {
      name: service.name,
      description: service.description || null,
      category: service.category || null,
      is_active: service.active ?? true,
    }
    const { data, error } = await supabase.from("services").insert([payload]).select("*").single()
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    return {
      id: data.id.toString(),
      name: data.name,
      description: data.description || "",
      category: data.category || "",
      active: !!data.is_active,
      created_at: data.created_at,
      updatedAt: data.updated_at || undefined,
    }
  } catch (error) {
    console.error("Error in createService:", error)
    throw error
  }
}

export async function updateService(id: string, service: Partial<Service>): Promise<Service> {
  try {
    const payload: any = {
      ...(service.name !== undefined ? { name: service.name } : {}),
      ...(service.description !== undefined ? { description: service.description } : {}),
      ...(service.category !== undefined ? { category: service.category } : {}),
      ...(service.active !== undefined ? { is_active: service.active } : {}),
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from("services").update(payload).eq("id", parseInt(id)).select("*").single()
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    return {
      id: data.id.toString(),
      name: data.name,
      description: data.description || "",
      category: data.category || "",
      active: !!data.is_active,
      created_at: data.created_at,
      updatedAt: data.updated_at || undefined,
    }
  } catch (error) {
    console.error("Error in updateService:", error)
    throw error
  }
}

export async function deleteService(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("services").delete().eq("id", parseInt(id))
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    return true
  } catch (error) {
    console.error("Error in deleteService:", error)
    throw error
  }
}

export async function getServiceVariants(): Promise<ServiceVariant[]> {
  try {
    const { data, error } = await supabase.from("service_variants").select("*").order("created_at", { ascending: false })
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    return (data || []).map((v: any): ServiceVariant => ({
      id: v.id.toString(),
      serviceId: v.service_id.toString(),
      variantName: v.variant_name,
      price: parseFloat(v.price),
      duration: v.duration_minutes, // mapeia para duration do domínio
      active: !!v.is_active,
      created_at: v.created_at,
      updatedAt: v.updated_at || undefined,
    }))
  } catch (error) {
    console.error("Error in getServiceVariants:", error)
    throw error
  }
}

export async function createServiceVariant(variant: Omit<ServiceVariant, "id" | "created_at" | "updatedAt">): Promise<ServiceVariant> {
  try {
    const payload: any = {
      service_id: parseInt(variant.serviceId),
      variant_name: variant.variantName,
      price: variant.price,
      duration_minutes: variant.duration, // recebe duration no domínio
      is_active: variant.active ?? true,
    }
    const { data, error } = await supabase.from("service_variants").insert([payload]).select("*").single()
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    return {
      id: data.id.toString(),
      serviceId: data.service_id.toString(),
      variantName: data.variant_name,
      price: parseFloat(data.price),
      duration: data.duration_minutes,
      active: !!data.is_active,
      created_at: data.created_at,
      updatedAt: data.updated_at || undefined,
    }
  } catch (error) {
    console.error("Error in createServiceVariant:", error)
    throw error
  }
}

export async function updateServiceVariant(id: string, variant: Partial<ServiceVariant>): Promise<ServiceVariant> {
  try {
    const payload: any = {
      ...(variant.serviceId !== undefined ? { service_id: parseInt(variant.serviceId) } : {}),
      ...(variant.variantName !== undefined ? { variant_name: variant.variantName } : {}),
      ...(variant.price !== undefined ? { price: variant.price } : {}),
      ...(variant.duration !== undefined ? { duration_minutes: variant.duration } : {}),
      ...(variant.active !== undefined ? { is_active: variant.active } : {}),
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from("service_variants").update(payload).eq("id", parseInt(id)).select("*").single()
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    return {
      id: data.id.toString(),
      serviceId: data.service_id.toString(),
      variantName: data.variant_name,
      price: parseFloat(data.price),
      duration: data.duration_minutes,
      active: !!data.is_active,
      created_at: data.created_at,
      updatedAt: data.updated_at || undefined,
    }
  } catch (error) {
    console.error("Error in updateServiceVariant:", error)
    throw error
  }
}

export async function deleteServiceVariant(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("service_variants").delete().eq("id", parseInt(id))
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    return true
  } catch (error) {
    console.error("Error in deleteServiceVariant:", error)
    throw error
  }
}

/* =========================
   AGENDAMENTOS
   ========================= */

export async function getAppointments(): Promise<Appointment[]> {
  try {
    const { data, error } = await supabase.from("appointments").select("*").order("start_time", { ascending: true })
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    return (data || []).map((apt: any): Appointment => ({
      id: apt.id.toString(),
      clientId: apt.client_id.toString(),
      clientName: "",
      professionalId: apt.professional_id,
      serviceVariants: [],
      startTime: apt.start_time,
      endTime: apt.end_time,
      status: apt.status,
      notes: apt.notes || "",
      totalPrice: 0,
      created_at: apt.created_at,
    }))
  } catch (error) {
    console.error("Error in getAppointments:", error)
    throw error
  }
}

export async function getAppointmentsByDateRange(startDate: string, endDate: string): Promise<Appointment[]> {
  try {
    const { data, error } = await supabase
      .from("appointments")
      .select(`*, clients!inner(full_name, phone, email)`)
      .gte("start_time", startDate)
      .lte("start_time", endDate)
      .order("start_time", { ascending: true })
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    return (data || []).map((apt: any): Appointment => ({
      id: apt.id.toString(),
      clientId: apt.client_id.toString(),
      clientName: apt.clients?.full_name || "Cliente desconhecido",
      professionalId: apt.professional_id,
      serviceVariants: [],
      startTime: apt.start_time,
      endTime: apt.end_time,
      status: apt.status,
      notes: apt.notes || "",
      totalPrice: 0,
      created_at: apt.created_at,
    }))
  } catch (error) {
    console.error("Error in getAppointmentsByDateRange:", error)
    throw error
  }
}

export async function createAppointment(appointment: Omit<Appointment, "id" | "created_at">): Promise<Appointment> {
  try {
    const payload: any = {
      client_id: parseInt(appointment.clientId),
      professional_id: appointment.professionalId,
      start_time: appointment.startTime,
      end_time: appointment.endTime,
      status: appointment.status,
      notes: appointment.notes || null,
    }
    const { data, error } = await supabase.from("appointments").insert([payload]).select("*").single()
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    return {
      id: data.id.toString(),
      clientId: data.client_id.toString(),
      clientName: "",
      professionalId: data.professional_id,
      serviceVariants: [],
      startTime: data.start_time,
      endTime: data.end_time,
      status: data.status,
      notes: data.notes || "",
      totalPrice: 0,
      created_at: data.created_at,
    }
  } catch (error) {
    console.error("Error in createAppointment:", error)
    throw error
  }
}

export async function updateAppointment(id: string, appointment: Partial<Appointment>): Promise<Appointment> {
  try {
    const payload: any = {
      ...(appointment.clientId !== undefined ? { client_id: parseInt(appointment.clientId) } : {}),
      ...(appointment.professionalId !== undefined ? { professional_id: appointment.professionalId } : {}),
      ...(appointment.startTime !== undefined ? { start_time: appointment.startTime } : {}),
      ...(appointment.endTime !== undefined ? { end_time: appointment.endTime } : {}),
      ...(appointment.status !== undefined ? { status: appointment.status } : {}),
      ...(appointment.notes !== undefined ? { notes: appointment.notes } : {}),
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from("appointments").update(payload).eq("id", parseInt(id)).select("*").single()
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    return {
      id: data.id.toString(),
      clientId: data.client_id.toString(),
      clientName: "",
      professionalId: data.professional_id,
      serviceVariants: [],
      startTime: data.start_time,
      endTime: data.end_time,
      status: data.status,
      notes: data.notes || "",
      totalPrice: 0,
      created_at: data.created_at,
    }
  } catch (error) {
    console.error("Error in updateAppointment:", error)
    throw error
  }
}

export async function deleteAppointment(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("appointments").delete().eq("id", parseInt(id))
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    return true
  } catch (error) {
    console.error("Error in deleteAppointment:", error)
    throw error
  }
}

/* =========================
   VENDAS E PAGAMENTOS
   ========================= */

export async function getSales(): Promise<Sale[]> {
  try {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const { data, error } = await supabase
      .from("sales")
      .select(
        `
        *,
        clients (full_name),
        sale_items (
          *,
          service_variants (
            variant_name,
            services (name)
          )
        ),
        payments (*)
      `
      )
      .gte("created_at", sixMonthsAgo.toISOString())
      .order("created_at", { ascending: false })

    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }

    return (data || []).map((s: any) => ({
      id: s.id.toString(),
      clientId: s.client_id.toString(),
      clientName: s.clients?.full_name || "",
      appointmentId: s.appointment_id ? s.appointment_id.toString() : undefined,
      items: (s.sale_items || []).map((it: any) => ({
        id: it.id.toString(),
        serviceVariantId: it.service_variant_id.toString(),
        serviceName: it.service_variants?.services?.name || "",
        serviceVariantName: it.service_variants?.variant_name || "",
        quantity: it.quantity,
        unitPrice: parseFloat(it.unit_price),
        subtotal: parseFloat(it.subtotal),
      })),
      totalAmount: parseFloat(s.total_amount),
      status: s.status,
      notes: s.notes || "",
      payments: (s.payments || []).map((p: any) => ({
        id: p.id.toString(),
        saleId: p.sale_id.toString(),
        amount: parseFloat(p.amount),
        paymentMethod: p.payment_method || undefined,
        externalTransactionId: p.external_transaction_id || undefined,
        linkUrl: p.payment_link_url || undefined,
        status: p.status,
        paidAt: p.paid_at || undefined,
        created_at: p.created_at,
        updatedAt: p.updated_at || undefined,
      })),
      created_at: s.created_at,
      updatedAt: s.updated_at || undefined,
    }))
  } catch (error) {
    console.error("Error in getSales:", error)
    throw error
  }
}

export async function getPayments(
  startDate?: string,
  endDate?: string
): Promise<Payment[]> {
  try {
    let query = supabase
      .from("payments")
      .select(
        `
        *,
        sales (
          client_id,
          clients (full_name),
          sale_items (
            service_variant_id,
            service_variants (
              variant_name,
              services (name)
            )
          )
        )
      `
      )
      .order("created_at", { ascending: false })

    if (startDate) {
      query = query.gte("created_at", startDate)
    }
    if (endDate) {
      query = query.lte("created_at", endDate)
    }

    const { data, error } = await query

    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }

    return (data || []).map((p: any) => {
      const sale: any = p.sales
      const variant = sale?.sale_items?.[0]?.service_variants
      const serviceName = variant?.services?.name
      const clientName = sale?.clients?.full_name

      return {
        id: p.id.toString(),
        saleId: p.sale_id.toString(),
        clientName: clientName || "",
        serviceName: serviceName || "",
        serviceVariantName: variant?.variant_name || "",
        amount: parseFloat(p.amount),
        paymentMethod: p.payment_method || undefined,
        externalTransactionId: p.external_transaction_id || undefined,
        linkUrl: p.payment_link_url || undefined,
        status: p.status,
        paidAt: p.paid_at || undefined,
        created_at: p.created_at,
        updatedAt: p.updated_at || undefined,
      }
    })
  } catch (error) {
    console.error("Error in getPayments:", error)
    throw error
  }
}

type NewSale = Omit<Sale, "id" | "payments" | "created_at" | "updatedAt" | "clientName" | "totalAmount"> & {
  totalAmount?: number
}

export async function createSale(sale: NewSale): Promise<Sale> {
  try {
    const computedTotal = sale.totalAmount ?? sale.items.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0)
    const { data: saleRow, error: saleErr } = await supabase
      .from("sales")
      .insert([{
        client_id: parseInt(sale.clientId),
        appointment_id: sale.appointmentId ? parseInt(sale.appointmentId) : null,
        total_amount: computedTotal,
        status: sale.status || "pending",
        notes: sale.notes || null,
      }])
      .select("*")
      .single()
    if (saleErr) {
      const parsed = parseSupabaseError(saleErr)
      throw new Error(parsed.description)
    }

    // services/api.ts (createSale) — ajuste no payload de sale_items
    if (sale.items.length) {
      const itemsPayload = sale.items.map(it => ({
        sale_id: saleRow.id,
        service_variant_id: parseInt(it.serviceVariantId),
        quantity: it.quantity,
        unit_price: it.unitPrice,
        // subtotal: REMOVIDO para evitar "cannot insert non-DEFAULT" em coluna gerada
      }))
      const { error: itemsErr } = await supabase.from("sale_items").insert(itemsPayload)
      if (itemsErr) { /* tratar erro */ }
    }

    const full = await getSales()
    const created = full.find(s => s.id === saleRow.id.toString())
    if (!created) throw new Error("Falha ao carregar a venda recém-criada")
    return created
  } catch (error) {
    console.error("Error in createSale:", error)
    throw error
  }
}

export async function updateSaleStatus(id: string, status: SaleStatus, updates?: Partial<Sale>): Promise<Sale | null> {
  try {
    const updateData: any = { status, updated_at: new Date().toISOString() }
    if (updates?.notes !== undefined) updateData.notes = updates.notes || null

    const { data, error } = await supabase.from("sales").update(updateData).eq("id", parseInt(id)).select("*").single()
    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }
    if (!data) return null

    const full = await getSales()
    return full.find(s => s.id === id) || null
  } catch (error) {
    console.error("Error in updateSaleStatus:", error)
    throw error
  }
}

export async function createPaymentLink(input: {
  saleId: string | number;
  amount: number; // REAIS
  items?: { quantity: number; price: number; description: string }[]; // price em CENTAVOS
  customer?: { name?: string; email?: string; phone_number?: string }; // phone_number já formatado com +55
  address?: {
    cep?: string;           // só números
    street?: string;        // NOVO
    number?: string;
    neighborhood?: string;  // NOVO
    complement?: string;
  };
}) {
  const resp = await fetch("/api/infinitepay/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!resp.ok) {
    const out = await resp.json();
    throw new Error(out?.error || "Falha ao gerar link");
  }

  const out = await resp.json();
  return out;
}

export async function createPayment(payment: Omit<Payment, "id">): Promise<Payment> {
  try {
    const payload: any = {
      sale_id: parseInt(String(payment.saleId), 10),
      amount: Number(payment.amount),
      // Em pending, não force um método "link": deixe null e o webhook definirá o método real
      payment_method: payment.status === PaymentStatus.PENDING
        ? null
        : (payment.paymentMethod ?? null),
      external_transaction_id: payment.externalTransactionId ?? null,
      payment_link_url: payment.linkUrl ?? null,
      status: payment.status as PaymentStatus,
      paid_at: payment.status === PaymentStatus.PAID
        ? (payment.paidAt ?? new Date().toISOString())
        : null,
    }

    const { data, error } = await supabase
      .from("payments")
      .insert([payload])
      .select("*")
      .single()

    if (error) {
      const parsed = parseSupabaseError(error)
      throw new Error(parsed.description)
    }

    return {
      id: String(data.id),
      saleId: String(data.sale_id),
      amount: Number(data.amount),
      paymentMethod: data.payment_method ?? undefined,
      externalTransactionId: data.external_transaction_id ?? undefined,
      linkUrl: data.payment_link_url ?? undefined,
      status: data.status,
      paidAt: data.paid_at ?? undefined,
      created_at: data.created_at,
      updatedAt: data.updated_at ?? undefined,
    } as Payment
  } catch (e) {
    console.error("Error in createPayment:", e)
    throw e
  }
}

export async function updatePaymentStatus(id: string, status: PaymentStatus): Promise<Payment | null> {
  try {
    const patch: any = { status, updated_at: new Date().toISOString() };
    if (status === PaymentStatus.CANCELLED) {
      patch.payment_link_url = null;
    }
    const { data, error } = await supabase
      .from("payments")
      .update(patch)
      .eq("id", parseInt(id))
      .select("*")
      .single();

    if (error) {
      const parsed = parseSupabaseError(error);
      throw new Error(parsed.description);
    }
    if (!data) return null;

    return {
      id: String(data.id),
      saleId: String(data.sale_id),
      amount: Number(data.amount),
      paymentMethod: data.payment_method ?? undefined,
      externalTransactionId: data.external_transaction_id ?? undefined,
      linkUrl: data.payment_link_url ?? undefined,
      status: data.status,
      paidAt: data.paid_at ?? undefined,
      created_at: data.created_at,
      updatedAt: data.updated_at ?? undefined,
    } as Payment;
  } catch (e) {
    console.error("Error in updatePaymentStatus:", e);
    throw e;
  }
}

export async function cancelInfinitePayPayment(externalTransactionId: string): Promise<void> {
  try {
    const response = await fetch("/api/infinitepay/cancel-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ externalTransactionId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Falha ao cancelar pagamento");
    }

    const data = await response.json();
    console.log("Pagamento cancelado:", data);
  } catch (error) {
    console.error("Error in cancelInfinitePayPayment:", error);
    throw error; // IMPORTANTE: re-lançar o erro para o handler pegar
  }
}

// Lista apenas serviços ativos (Service.active === true)
export async function getActiveServices(): Promise<Service[]> {
  const all = await getServices()
  return all.filter(s => s.active)
}

// Opcional: variantes ativas (se a Agenda usar)
export async function getActiveServiceVariants(): Promise<ServiceVariant[]> {
  const all = await getServiceVariants()
  return all.filter(v => v.active)
}
