"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { Client, Appointment, Service, ServiceVariant, Sale, Payment } from "./types"
import * as api from "@/services/api"
import { useToast } from "@/hooks/use-toast"

interface DataContextType {
    // Data
    clients: Client[]
    appointments: Appointment[]
    services: Service[]
    serviceVariants: ServiceVariant[]
    sales: Sale[]
    payments: Payment[]

    // Loading states
    isLoading: boolean
    error: string | null

    // Client operations
    addClient: (client: Omit<Client, "id" | "registrationDate" | "totalSpent">) => Promise<Client | null>
    updateClient: (id: string, client: Partial<Client>) => Promise<Client | null>
    deactivateClient: (id: string) => Promise<boolean>
    reactivateClient: (id: string) => Promise<boolean>
    getInactiveClients: () => Promise<Client[]>
    searchClients: (query: string) => Promise<Client[]>

    // Appointment operations
    addAppointment: (appointment: Omit<Appointment, "id" | "createdAt">) => Promise<Appointment | null>
    updateAppointment: (id: string, appointment: Partial<Appointment>) => Promise<Appointment | null>
    deleteAppointment: (id: string) => Promise<boolean>

    // Service operations
    addService: (service: Omit<Service, "id" | "createdAt">) => Promise<Service | null>
    updateService: (id: string, service: Partial<Service>) => Promise<Service | null>
    deleteService: (id: string) => Promise<boolean>

    // Service Variant operations
    addServiceVariant: (variant: Omit<ServiceVariant, "id" | "createdAt">) => Promise<ServiceVariant | null>
    getServiceVariants: (serviceId?: string) => Promise<ServiceVariant[]>

    // Sale operations
    createSale: (sale: Omit<Sale, "id" | "createdAt">) => Promise<Sale | null>
    updateSaleStatus: (id: string, status: Sale["status"], updates?: Partial<Sale>) => Promise<Sale | null>
    getSaleByAppointmentId: (appointmentId: string) => Sale | undefined

    // Payment operations
    createPayment: (payment: Omit<Payment, "id" | "createdAt">) => Promise<Payment | null>

    // Refresh data
    refreshData: () => Promise<void>
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
    const { toast } = useToast()
    const [clients, setClients] = useState<Client[]>([])
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [services, setServices] = useState<Service[]>([])
    const [serviceVariants, setServiceVariants] = useState<ServiceVariant[]>([])
    const [sales, setSales] = useState<Sale[]>([])
    const [payments, setPayments] = useState<Payment[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const initializeData = async () => {
            try {
                setIsLoading(true)
                await refreshData()
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Failed to load data"
                setError(errorMessage)
                toast({
                    title: "Erro ao carregar dados",
                    description: errorMessage,
                    variant: "destructive",
                })
            } finally {
                setIsLoading(false)
            }
        }
        initializeData()
    }, [])

    const refreshData = async () => {
        try {
            const clientsData = await api.getActiveClients()
            setClients(clientsData)

            setAppointments([])
            setServices([])
            setServiceVariants([])
            setSales([])
            setPayments([])

            setError(null)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to refresh data"
            setError(errorMessage)
            throw err
        }
    }

    // Client operations - com toast automático
    const addClient = async (client: Omit<Client, "id" | "registrationDate" | "totalSpent">) => {
        try {
            const newClient = await api.createClient(client)
            await refreshData()
            toast({
                title: "Cliente criado",
                description: "O cliente foi cadastrado com sucesso.",
            })
            return newClient
        } catch (err: any) {
            const errorTitle = err?.title || "Erro ao criar cliente"
            const errorMessage = err?.message || "Não foi possível criar o cliente."
            setError(errorMessage)
            toast({
                title: errorTitle,
                description: errorMessage,
                variant: "destructive",
            })
            return null
        }
    }

    const updateClient = async (id: string, updates: Partial<Client>) => {
        try {
            const updated = await api.updateClient(id, updates)
            await refreshData()
            toast({
                title: "Cliente atualizado",
                description: "As informações do cliente foram atualizadas.",
            })
            return updated
        } catch (err: any) {
            const errorTitle = err?.title || "Erro ao atualizar cliente"
            const errorMessage = err?.message || "Não foi possível atualizar o cliente."
            setError(errorMessage)
            toast({
                title: errorTitle,
                description: errorMessage,
                variant: "destructive",
            })
            return null
        }
    }

    const deactivateClient = async (id: string) => {
        try {
            const success = await api.deactivateClient(id)
            if (success) {
                await refreshData()
                toast({
                    title: "Cliente desativado",
                    description: "O cliente foi desativado e pode ser reativado a qualquer momento.",
                })
            }
            return success
        } catch (err: any) {
            const errorTitle = err?.title || "Erro ao desativar cliente"
            const errorMessage = err?.message || "Não foi possível desativar o cliente."
            setError(errorMessage)
            toast({
                title: errorTitle,
                description: errorMessage,
                variant: "destructive",
            })
            return false
        }
    }

    const reactivateClient = async (id: string) => {
        try {
            const success = await api.reactivateClient(id)
            if (success) {
                await refreshData()
                toast({
                    title: "Cliente reativado",
                    description: "O cliente foi reativado e voltará a aparecer na lista de ativos.",
                })
            }
            return success
        } catch (err: any) {
            const errorTitle = err?.title || "Erro ao reativar cliente"
            const errorMessage = err?.message || "Não foi possível reativar o cliente."
            setError(errorMessage)
            toast({
                title: errorTitle,
                description: errorMessage,
                variant: "destructive",
            })
            return false
        }
    }

    const getInactiveClients = async () => {
        try {
            return await api.getInactiveClients()
        } catch (err: any) {
            const errorMessage = err?.message || "Failed to get inactive clients"
            setError(errorMessage)
            toast({
                title: "Erro ao buscar clientes inativos",
                description: errorMessage,
                variant: "destructive",
            })
            return []
        }
    }

    const searchClients = async (query: string) => {
        try {
            return await api.searchClients(query)
        } catch (err: any) {
            const errorMessage = err?.message || "Failed to search clients"
            setError(errorMessage)
            toast({
                title: "Erro na busca",
                description: errorMessage,
                variant: "destructive",
            })
            return []
        }
    }

    // Appointment operations - Stub
    const addAppointment = async (appointment: Omit<Appointment, "id" | "createdAt">) => {
        toast({
            title: "Funcionalidade em desenvolvimento",
            description: "O módulo de agendamentos ainda não está disponível.",
            variant: "destructive",
        })
        return null
    }

    const updateAppointment = async (id: string, updates: Partial<Appointment>) => {
        toast({
            title: "Funcionalidade em desenvolvimento",
            description: "O módulo de agendamentos ainda não está disponível.",
            variant: "destructive",
        })
        return null
    }

    const deleteAppointment = async (id: string) => {
        toast({
            title: "Funcionalidade em desenvolvimento",
            description: "O módulo de agendamentos ainda não está disponível.",
            variant: "destructive",
        })
        return false
    }

    // Service operations - Stub
    const addService = async (service: Omit<Service, "id" | "createdAt">) => {
        toast({
            title: "Funcionalidade em desenvolvimento",
            description: "O módulo de serviços ainda não está disponível.",
            variant: "destructive",
        })
        return null
    }

    const updateService = async (id: string, updates: Partial<Service>) => {
        toast({
            title: "Funcionalidade em desenvolvimento",
            description: "O módulo de serviços ainda não está disponível.",
            variant: "destructive",
        })
        return null
    }

    const deleteService = async (id: string) => {
        toast({
            title: "Funcionalidade em desenvolvimento",
            description: "O módulo de serviços ainda não está disponível.",
            variant: "destructive",
        })
        return false
    }

    // Service Variant operations - Stub
    const addServiceVariant = async (variant: Omit<ServiceVariant, "id" | "createdAt">) => {
        toast({
            title: "Funcionalidade em desenvolvimento",
            description: "O módulo de variantes ainda não está disponível.",
            variant: "destructive",
        })
        return null
    }

    const getServiceVariants = async (serviceId?: string) => {
        return []
    }

    // Sale operations - Stub
    const createSale = async (sale: Omit<Sale, "id" | "createdAt">) => {
        toast({
            title: "Funcionalidade em desenvolvimento",
            description: "O módulo de vendas ainda não está disponível.",
            variant: "destructive",
        })
        return null
    }

    const updateSaleStatus = async (id: string, status: Sale["status"], updates?: Partial<Sale>) => {
        toast({
            title: "Funcionalidade em desenvolvimento",
            description: "O módulo de vendas ainda não está disponível.",
            variant: "destructive",
        })
        return null
    }

    const getSaleByAppointmentId = (appointmentId: string) => {
        return undefined
    }

    // Payment operations - Stub
    const createPayment = async (payment: Omit<Payment, "id" | "createdAt">) => {
        toast({
            title: "Funcionalidade em desenvolvimento",
            description: "O módulo de pagamentos ainda não está disponível.",
            variant: "destructive",
        })
        return null
    }

    return (
        <DataContext.Provider
            value={{
                clients,
                appointments,
                services,
                serviceVariants,
                sales,
                payments,
                isLoading,
                error,
                addClient,
                updateClient,
                deactivateClient,
                reactivateClient,
                getInactiveClients,
                searchClients,
                addAppointment,
                updateAppointment,
                deleteAppointment,
                addService,
                updateService,
                deleteService,
                addServiceVariant,
                getServiceVariants,
                createSale,
                updateSaleStatus,
                getSaleByAppointmentId,
                createPayment,
                refreshData,
            }}
        >
            {children}
        </DataContext.Provider>
    )
}

export function useData() {
    const context = useContext(DataContext)
    if (context === undefined) {
        throw new Error("useData must be used within a DataProvider")
    }
    return context
}
