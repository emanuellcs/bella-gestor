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

export async function createClient(client: Omit<Client, "id" | "registrationDate" | "totalSpent">): Promise<Client> {
    try {
        const supabaseData = clientToSupabaseClient(client)

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
            .order('created_at', { ascending: false })

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





export async function getAppointments(): Promise<Appointment[]> {
    console.warn("getAppointments: Not connected to Supabase yet")
    return []
}

export async function getAppointmentById(id: string): Promise<Appointment | null> {
    console.warn("getAppointmentById: Not connected to Supabase yet")
    return null
}

export async function getAppointmentsByClient(clientId: string): Promise<Appointment[]> {
    console.warn("getAppointmentsByClient: Not connected to Supabase yet")
    return []
}

export async function getAppointmentsByDateRange(startDate: string, endDate: string): Promise<Appointment[]> {
    console.warn("getAppointmentsByDateRange: Not connected to Supabase yet")
    return []
}

export async function createAppointment(appointment: Omit<Appointment, "id" | "createdAt">): Promise<Appointment | null> {
    console.warn("createAppointment: Not connected to Supabase yet")
    return null
}

export async function updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment | null> {
    console.warn("updateAppointment: Not connected to Supabase yet")
    return null
}

export async function deleteAppointment(id: string): Promise<boolean> {
    console.warn("deleteAppointment: Not connected to Supabase yet")
    return false
}





export async function getServices(): Promise<Service[]> {
    console.warn("getServices: Not connected to Supabase yet")
    return []
}

export async function getActiveServices(): Promise<Service[]> {
    console.warn("getActiveServices: Not connected to Supabase yet")
    return []
}

export async function getServiceById(id: string): Promise<Service | null> {
    console.warn("getServiceById: Not connected to Supabase yet")
    return null
}

export async function createService(service: Omit<Service, "id" | "createdAt">): Promise<Service | null> {
    console.warn("createService: Not connected to Supabase yet")
    return null
}

export async function updateService(id: string, updates: Partial<Service>): Promise<Service | null> {
    console.warn("updateService: Not connected to Supabase yet")
    return null
}

export async function deleteService(id: string): Promise<boolean> {
    console.warn("deleteService: Not connected to Supabase yet")
    return false
}


export async function getServiceVariants(serviceId?: string): Promise<ServiceVariant[]> {
    console.warn("getServiceVariants: Not connected to Supabase yet")
    return []
}

export async function createServiceVariant(variant: Omit<ServiceVariant, "id" | "createdAt">): Promise<ServiceVariant | null> {
    console.warn("createServiceVariant: Not connected to Supabase yet")
    return null
}





export async function getSales(): Promise<Sale[]> {
    console.warn("getSales: Not connected to Supabase yet")
    return []
}

export async function getSaleById(id: string): Promise<Sale | null> {
    console.warn("getSaleById: Not connected to Supabase yet")
    return null
}

export async function getSaleByAppointmentId(appointmentId: string): Promise<Sale | null> {
    console.warn("getSaleByAppointmentId: Not connected to Supabase yet")
    return null
}

export async function createSale(sale: Omit<Sale, "id" | "createdAt">): Promise<Sale | null> {
    console.warn("createSale: Not connected to Supabase yet")
    return null
}

export async function updateSaleStatus(
    id: string,
    status: SaleStatus,
    updates?: Partial<Sale>
): Promise<Sale | null> {
    console.warn("updateSaleStatus: Not connected to Supabase yet")
    return null
}





export async function createPayment(payment: Omit<Payment, "id" | "createdAt">): Promise<Payment | null> {
    console.warn("createPayment: Not connected to Supabase yet")
    return null
}

export async function updatePaymentStatus(
    id: string,
    status: PaymentStatus,
    paidAt?: string
): Promise<Payment | null> {
    console.warn("updatePaymentStatus: Not connected to Supabase yet")
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
