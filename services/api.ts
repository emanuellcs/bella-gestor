import type {
  Client,
  Appointment,
  Service,
  ServiceVariant,
  Sale,
  Payment,
  AppointmentStatus,
  SaleStatus,
  PaymentStatus,
} from "@/lib/types"
import { supabase } from "@/lib/supabaseClient"
import { supabaseClientToClient, clientToSupabaseClient } from "@/lib/utils"
import { parseSupabaseError } from "@/lib/error-handler"

export async function getClients(): Promise<Client[]> {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      const parsedError = parseSupabaseError(error)
      throw new Error(parsedError.description)
    }

    return (data || []).map(supabaseClientToClient)
  } catch (error) {
    console.error('Error in getClients:', error)
    throw error
  }
}

export async function getClientById(id: string): Promise<Client | null> {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', parseInt(id))
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      const parsedError = parseSupabaseError(error)
      throw new Error(parsedError.description)
    }

    return data ? supabaseClientToClient(data) : null
  } catch (error) {
    console.error('Error in getClientById:', error)
    throw error
  }
}

export async function createClient(client: Omit<Client, 'id'>): Promise<Client> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      const errorObj = new Error('Você precisa estar autenticado para criar clientes')
      ;(errorObj as any).title = 'Autenticação necessária'
      ;(errorObj as any).code = 'AUTH_REQUIRED'
      throw errorObj
    }

    const supabaseData = clientToSupabaseClient(client)
    supabaseData.user_id = user.id

    const { data, error } = await supabase
      .from('clients')
      .insert([supabaseData])
      .select()
      .single()

    if (error) {
      const parsedError = parseSupabaseError(error)
      const errorObj = new Error(parsedError.description)
      ;(errorObj as any).title = parsedError.title
      ;(errorObj as any).code = parsedError.code
      throw errorObj
    }

    return supabaseClientToClient(data)
  } catch (error) {
    console.error('Error in createClient:', error)
    throw error
  }
}


export async function updateClient(id: string, updates: Partial<Client>): Promise<Client | null> {
  try {
    const supabaseData = clientToSupabaseClient(updates)
    const { data, error } = await supabase
      .from('clients')
      .update({ ...supabaseData, updated_at: new Date().toISOString() })
      .eq('id', parseInt(id))
      .select()
      .single()

    if (error) {
      const parsedError = parseSupabaseError(error)
      const errorObj = new Error(parsedError.description)
      ;(errorObj as any).title = parsedError.title
      ;(errorObj as any).code = parsedError.code
      throw errorObj
    }

    return data ? supabaseClientToClient(data) : null
  } catch (error) {
    console.error('Error in updateClient:', error)
    throw error
  }
}

export async function deactivateClient(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('clients')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', parseInt(id))

    if (error) {
      const parsedError = parseSupabaseError(error)
      const errorObj = new Error(parsedError.description)
      ;(errorObj as any).title = parsedError.title
      ;(errorObj as any).code = parsedError.code
      throw errorObj
    }

    return true
  } catch (error) {
    console.error('Error in deactivateClient:', error)
    throw error
  }
}

export async function reactivateClient(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('clients')
      .update({
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', parseInt(id))

    if (error) {
      const parsedError = parseSupabaseError(error)
      const errorObj = new Error(parsedError.description)
      ;(errorObj as any).title = parsedError.title
      ;(errorObj as any).code = parsedError.code
      throw errorObj
    }

    return true
  } catch (error) {
    console.error('Error in reactivateClient:', error)
    throw error
  }
}

export async function getActiveClients(): Promise<Client[]> {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('is_active', true)
      .order('full_name', { ascending: true })

    if (error) {
      const parsedError = parseSupabaseError(error)
      throw new Error(parsedError.description)
    }

    return (data || []).map(supabaseClientToClient)
  } catch (error) {
    console.error('Error in getActiveClients:', error)
    throw error
  }
}

export async function getInactiveClients(): Promise<Client[]> {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('is_active', false)
      .order('updated_at', { ascending: false })

    if (error) {
      const parsedError = parseSupabaseError(error)
      throw new Error(parsedError.description)
    }

    return (data || []).map(supabaseClientToClient)
  } catch (error) {
    console.error('Error in getInactiveClients:', error)
    throw error
  }
}

export async function searchClients(query: string): Promise<Client[]> {
  try {
    const lowerQuery = query.toLowerCase()
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .or(`full_name.ilike.%${lowerQuery}%,email.ilike.%${lowerQuery}%,phone.ilike.%${query}%`)
      .order('created_at', { ascending: false })

    if (error) {
      const parsedError = parseSupabaseError(error)
      throw new Error(parsedError.description)
    }

    return (data || []).map(supabaseClientToClient)
  } catch (error) {
    console.error('Error in searchClients:', error)
    throw error
  }
}

export async function getServices(): Promise<Service[]> {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      const parsedError = parseSupabaseError(error)
      throw new Error(parsedError.description)
    }

    return (data || []).map(service => ({
      id: service.id.toString(),
      name: service.name,
      description: service.description || '',
      category: service.category || '',
      active: service.is_active,
      createdAt: service.created_at,
    }))
  } catch (error) {
    console.error('Error in getServices:', error)
    throw error
  }
}

export async function getActiveServices(): Promise<Service[]> {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      const parsedError = parseSupabaseError(error)
      throw new Error(parsedError.description)
    }

    return (data || []).map(service => ({
      id: service.id.toString(),
      name: service.name,
      description: service.description || '',
      category: service.category || '',
      active: service.is_active,
      createdAt: service.created_at,
    }))
  } catch (error) {
    console.error('Error in getActiveServices:', error)
    throw error
  }
}

export async function getServiceById(id: string): Promise<Service | null> {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', parseInt(id))
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      const parsedError = parseSupabaseError(error)
      throw new Error(parsedError.description)
    }

    return {
      id: data.id.toString(),
      name: data.name,
      description: data.description || '',
      category: data.category || '',
      active: data.is_active,
      createdAt: data.created_at,
    }
  } catch (error) {
    console.error('Error in getServiceById:', error)
    throw error
  }
}

export async function createService(service: Omit<Service, 'id' | 'createdAt'>): Promise<Service | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      const errorObj = new Error('Você precisa estar autenticado para criar serviços')
      ;(errorObj as any).title = 'Autenticação necessária'
      ;(errorObj as any).code = 'AUTH_REQUIRED'
      throw errorObj
    }

    const { data, error } = await supabase
      .from('services')
      .insert([{
        name: service.name,
        description: service.description || null,
        category: service.category || null,
        is_active: service.active !== undefined ? service.active : true,
        user_id: user.id,
      }])
      .select()
      .single()

    if (error) {
      const parsedError = parseSupabaseError(error)
      const errorObj = new Error(parsedError.description)
      ;(errorObj as any).title = parsedError.title
      ;(errorObj as any).code = parsedError.code
      throw errorObj
    }

    return {
      id: data.id.toString(),
      name: data.name,
      description: data.description || '',
      category: data.category || '',
      active: data.is_active,
      createdAt: data.created_at,
    }
  } catch (error) {
    console.error('Error in createService:', error)
    throw error
  }
}

export async function updateService(id: string, updates: Partial<Service>): Promise<Service | null> {
  try {
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description || null
    if (updates.category !== undefined) updateData.category = updates.category || null
    if (updates.active !== undefined) updateData.is_active = updates.active

    const { data, error } = await supabase
      .from('services')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single()

    if (error) {
      const parsedError = parseSupabaseError(error)
      const errorObj = new Error(parsedError.description)
      ;(errorObj as any).title = parsedError.title
      ;(errorObj as any).code = parsedError.code
      throw errorObj
    }

    return data ? {
      id: data.id.toString(),
      name: data.name,
      description: data.description || '',
      category: data.category || '',
      active: data.is_active,
      createdAt: data.created_at,
    } : null
  } catch (error) {
    console.error('Error in updateService:', error)
    throw error
  }
}

export async function deleteService(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', parseInt(id))

    if (error) {
      const parsedError = parseSupabaseError(error)
      const errorObj = new Error(parsedError.description)
      ;(errorObj as any).title = parsedError.title
      ;(errorObj as any).code = parsedError.code
      throw errorObj
    }

    return true
  } catch (error) {
    console.error('Error in deleteService:', error)
    throw error
  }
}

export async function getServiceVariants(serviceId?: string): Promise<ServiceVariant[]> {
  try {
    let query = supabase
      .from('service_variants')
      .select('*')
    
    if (serviceId) {
      query = query.eq('service_id', parseInt(serviceId))
    }
    
    query = query.order('variant_name', { ascending: true })
    
    const { data, error } = await query
    
    if (error) {
      const parsedError = parseSupabaseError(error)
      throw new Error(parsedError.description)
    }
    
    return (data || []).map(variant => ({
      id: variant.id.toString(),
      serviceId: variant.service_id.toString(),
      variantName: variant.variant_name,
      price: parseFloat(variant.price),
      duration: variant.duration_minutes,
      active: variant.is_active,
      createdAt: variant.created_at,
      updatedAt: variant.updated_at,
    }))
  } catch (error) {
    console.error('Error in getServiceVariants:', error)
    throw error
  }
}

export async function getServiceVariantById(id: string): Promise<ServiceVariant | null> {
  try {
    const { data, error } = await supabase
      .from('service_variants')
      .select('*')
      .eq('id', parseInt(id))
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      const parsedError = parseSupabaseError(error)
      throw new Error(parsedError.description)
    }
    
    return {
      id: data.id.toString(),
      serviceId: data.service_id.toString(),
      variantName: data.variant_name,
      price: parseFloat(data.price),
      duration: data.duration_minutes,
      active: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (error) {
    console.error('Error in getServiceVariantById:', error)
    throw error
  }
}

export async function createServiceVariant(variant: Omit<ServiceVariant, 'id' | 'createdAt' | 'updatedAt'>): Promise<ServiceVariant | null> {
  try {
    const { data, error } = await supabase
      .from('service_variants')
      .insert([{
        service_id: parseInt(variant.serviceId),
        variant_name: variant.variantName,
        price: variant.price,
        duration_minutes: variant.duration,
        is_active: variant.active !== undefined ? variant.active : true,
      }])
      .select()
      .single()
    
    if (error) {
      const parsedError = parseSupabaseError(error)
      const errorObj = new Error(parsedError.description)
      ;(errorObj as any).title = parsedError.title
      ;(errorObj as any).code = parsedError.code
      throw errorObj
    }
    
    return {
      id: data.id.toString(),
      serviceId: data.service_id.toString(),
      variantName: data.variant_name,
      price: parseFloat(data.price),
      duration: data.duration_minutes,
      active: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (error) {
    console.error('Error in createServiceVariant:', error)
    throw error
  }
}

export async function updateServiceVariant(id: string, updates: Partial<ServiceVariant>): Promise<ServiceVariant | null> {
  try {
    const updateData: any = {
      updated_at: new Date().toISOString()
    }
    
    if (updates.serviceId !== undefined) updateData.service_id = parseInt(updates.serviceId)
    if (updates.variantName !== undefined) updateData.variant_name = updates.variantName
    if (updates.price !== undefined) updateData.price = updates.price
    if (updates.duration !== undefined) updateData.duration_minutes = updates.duration
    if (updates.active !== undefined) updateData.is_active = updates.active
    
    const { data, error } = await supabase
      .from('service_variants')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single()
    
    if (error) {
      const parsedError = parseSupabaseError(error)
      const errorObj = new Error(parsedError.description)
      ;(errorObj as any).title = parsedError.title
      ;(errorObj as any).code = parsedError.code
      throw errorObj
    }
    
    return data ? {
      id: data.id.toString(),
      serviceId: data.service_id.toString(),
      variantName: data.variant_name,
      price: parseFloat(data.price),
      duration: data.duration_minutes,
      active: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    } : null
  } catch (error) {
    console.error('Error in updateServiceVariant:', error)
    throw error
  }
}

export async function deleteServiceVariant(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('service_variants')
      .delete()
      .eq('id', parseInt(id))
    
    if (error) {
      const parsedError = parseSupabaseError(error)
      const errorObj = new Error(parsedError.description)
      ;(errorObj as any).title = parsedError.title
      ;(errorObj as any).code = parsedError.code
      throw errorObj
    }
    
    return true
  } catch (error) {
    console.error('Error in deleteServiceVariant:', error)
    throw error
  }
}

export async function getActiveServiceVariants(serviceId?: string): Promise<ServiceVariant[]> {
  try {
    let query = supabase
      .from('service_variants')
      .select('*')
      .eq('is_active', true)
    
    if (serviceId) {
      query = query.eq('service_id', parseInt(serviceId))
    }
    
    query = query.order('variant_name', { ascending: true })
    
    const { data, error } = await query
    
    if (error) {
      const parsedError = parseSupabaseError(error)
      throw new Error(parsedError.description)
    }
    
    return (data || []).map(variant => ({
      id: variant.id.toString(),
      serviceId: variant.service_id.toString(),
      variantName: variant.variant_name,
      price: parseFloat(variant.price),
      duration: variant.duration_minutes,
      active: variant.is_active,
      createdAt: variant.created_at,
      updatedAt: variant.updated_at,
    }))
  } catch (error) {
    console.error('Error in getActiveServiceVariants:', error)
    throw error
  }
}

export async function getAppointments(): Promise<Appointment[]> {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        clients!inner(full_name, phone, email)
      `)
      .order('start_time', { ascending: true })

    if (error) {
      const parsedError = parseSupabaseError(error)
      throw new Error(parsedError.description)
    }

    return (data || []).map(apt => ({
      id: apt.id.toString(),
      clientId: apt.client_id.toString(),
      clientName: apt.clients?.full_name || 'Cliente desconhecido',
      professionalId: apt.professional_id,
      serviceVariants: [],
      startTime: apt.start_time,
      endTime: apt.end_time,
      status: apt.status,
      notes: apt.notes || '',
      totalPrice: 0,
      googleCalendarEventId: apt.google_calendar_event_id,
      createdAt: apt.created_at,
    }))
  } catch (error) {
    console.error('Error in getAppointments:', error)
    throw error
  }
}

export async function getAppointmentById(id: string): Promise<Appointment | null> {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        clients!inner(full_name, phone, email)
      `)
      .eq('id', parseInt(id))
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      const parsedError = parseSupabaseError(error)
      throw new Error(parsedError.description)
    }

    return {
      id: data.id.toString(),
      clientId: data.client_id.toString(),
      clientName: data.clients?.full_name || 'Cliente desconhecido',
      professionalId: data.professional_id,
      serviceVariants: [],
      startTime: data.start_time,
      endTime: data.end_time,
      status: data.status,
      notes: data.notes || '',
      totalPrice: 0,
      googleCalendarEventId: data.google_calendar_event_id,
      createdAt: data.created_at,
    }
  } catch (error) {
    console.error('Error in getAppointmentById:', error)
    throw error
  }
}

export async function getAppointmentsByClient(clientId: string): Promise<Appointment[]> {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        clients!inner(full_name, phone, email)
      `)
      .eq('client_id', parseInt(clientId))
      .order('start_time', { ascending: true })

    if (error) {
      const parsedError = parseSupabaseError(error)
      throw new Error(parsedError.description)
    }

    return (data || []).map(apt => ({
      id: apt.id.toString(),
      clientId: apt.client_id.toString(),
      clientName: apt.clients?.full_name || 'Cliente desconhecido',
      professionalId: apt.professional_id,
      serviceVariants: [],
      startTime: apt.start_time,
      endTime: apt.end_time,
      status: apt.status,
      notes: apt.notes || '',
      totalPrice: 0,
      googleCalendarEventId: apt.google_calendar_event_id,
      createdAt: apt.created_at,
    }))
  } catch (error) {
    console.error('Error in getAppointmentsByClient:', error)
    throw error
  }
}

export async function getAppointmentsByDateRange(startDate: string, endDate: string): Promise<Appointment[]> {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        clients!inner(full_name, phone, email)
      `)
      .gte('start_time', startDate)
      .lte('start_time', endDate)
      .order('start_time', { ascending: true })

    if (error) {
      const parsedError = parseSupabaseError(error)
      throw new Error(parsedError.description)
    }

    return (data || []).map(apt => ({
      id: apt.id.toString(),
      clientId: apt.client_id.toString(),
      clientName: apt.clients?.full_name || 'Cliente desconhecido',
      professionalId: apt.professional_id,
      serviceVariants: [],
      startTime: apt.start_time,
      endTime: apt.end_time,
      status: apt.status,
      notes: apt.notes || '',
      totalPrice: 0,
      googleCalendarEventId: apt.google_calendar_event_id,
      createdAt: apt.created_at,
    }))
  } catch (error) {
    console.error('Error in getAppointmentsByDateRange:', error)
    throw error
  }
}

export async function createAppointment(appointment: Omit<Appointment, 'id' | 'clientName'>): Promise<Appointment | null> {
  try {
    const appointmentData = {
      client_id: parseInt(appointment.clientId),
      professional_id: appointment.professionalId,
      start_time: appointment.startTime,
      end_time: appointment.endTime,
      status: appointment.status,
      notes: appointment.notes || null,
      google_calendar_event_id: appointment.googleCalendarEventId || null,
      created_at: appointment.createdAt || new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert([appointmentData])
      .select(`
        *,
        clients!inner(full_name, phone, email)
      `)
      .single()

    if (error) {
      const parsedError = parseSupabaseError(error)
      const errorObj = new Error(parsedError.description)
      ;(errorObj as any).title = parsedError.title
      ;(errorObj as any).code = parsedError.code
      throw errorObj
    }

    return {
      id: data.id.toString(),
      clientId: data.client_id.toString(),
      clientName: data.clients?.full_name || 'Cliente desconhecido',
      professionalId: data.professional_id,
      serviceVariants: [],
      startTime: data.start_time,
      endTime: data.end_time,
      status: data.status,
      notes: data.notes || '',
      totalPrice: 0,
      googleCalendarEventId: data.google_calendar_event_id,
      createdAt: data.created_at,
    }
  } catch (error) {
    console.error('Error in createAppointment:', error)
    throw error
  }
}

export async function updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment | null> {
  try {
    const updateData: any = {}

    if (updates.clientId) updateData.client_id = parseInt(updates.clientId)
    if (updates.professionalId) updateData.professional_id = updates.professionalId
    if (updates.startTime) updateData.start_time = updates.startTime
    if (updates.endTime) updateData.end_time = updates.endTime
    if (updates.status) updateData.status = updates.status
    if (updates.notes !== undefined) updateData.notes = updates.notes || null
    if (updates.googleCalendarEventId !== undefined) {
      updateData.google_calendar_event_id = updates.googleCalendarEventId || null
    }

    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', parseInt(id))
      .select(`
        *,
        clients!inner(full_name, phone, email)
      `)
      .single()

    if (error) {
      const parsedError = parseSupabaseError(error)
      const errorObj = new Error(parsedError.description)
      ;(errorObj as any).title = parsedError.title
      ;(errorObj as any).code = parsedError.code
      throw errorObj
    }

    return data ? {
      id: data.id.toString(),
      clientId: data.client_id.toString(),
      clientName: data.clients?.full_name || 'Cliente desconhecido',
      professionalId: data.professional_id,
      serviceVariants: [],
      startTime: data.start_time,
      endTime: data.end_time,
      status: data.status,
      notes: data.notes || '',
      totalPrice: 0,
      googleCalendarEventId: data.google_calendar_event_id,
      createdAt: data.created_at,
    } : null
  } catch (error) {
    console.error('Error in updateAppointment:', error)
    throw error
  }
}

export async function deleteAppointment(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', parseInt(id))

    if (error) {
      const parsedError = parseSupabaseError(error)
      const errorObj = new Error(parsedError.description)
      ;(errorObj as any).title = parsedError.title
      ;(errorObj as any).code = parsedError.code
      throw errorObj
    }

    return true
  } catch (error) {
    console.error('Error in deleteAppointment:', error)
    throw error
  }
}

export async function getSales(): Promise<Sale[]> {
  console.warn("getSales: Not implemented yet")
  return []
}

export async function getSaleById(id: string): Promise<Sale | null> {
  console.warn("getSaleById: Not implemented yet")
  return null
}

export async function getSaleByAppointmentId(appointmentId: string): Promise<Sale | null> {
  console.warn("getSaleByAppointmentId: Not implemented yet")
  return null
}

export async function createSale(sale: Omit<Sale, 'id' | 'createdAt'>): Promise<Sale | null> {
  console.warn("createSale: Not implemented yet")
  return null
}

export async function updateSaleStatus(id: string, status: SaleStatus, updates?: Partial<Sale>): Promise<Sale | null> {
  console.warn("updateSaleStatus: Not implemented yet")
  return null
}

export async function createPayment(payment: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment | null> {
  console.warn("createPayment: Not implemented yet")
  return null
}

export async function updatePaymentStatus(id: string, status: PaymentStatus, paidAt?: string): Promise<Payment | null> {
  console.warn("updatePaymentStatus: Not implemented yet")
  return null
}

export async function generateInfinitePayLink(paymentData: {
  amount: number
  clientName: string
  clientEmail?: string
  description: string
}): Promise<{ link: string; qrCode: string } | null> {
  console.warn("generateInfinitePayLink: Not implemented yet")
  return null
}
