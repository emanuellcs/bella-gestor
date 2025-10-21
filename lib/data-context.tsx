"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type {
  Client,
  Appointment,
  Service,
  ServiceVariant,
  Sale,
  Payment,
} from "@/lib/types"
import * as api from "@/services/api"
import { useToast } from "@/hooks/use-toast"

interface DataContextType {
  clients: Client[]
  appointments: Appointment[]
  services: Service[]
  serviceVariants: ServiceVariant[]
  sales: Sale[]
  payments: Payment[]
  isLoading: boolean
  error: string | null
  addClient: (client: Omit<Client, "id">) => Promise<Client | null>
  updateClient: (id: string, client: Partial<Client>) => Promise<Client | null>
  deactivateClient: (id: string) => Promise<boolean>
  reactivateClient: (id: string) => Promise<boolean>
  getInactiveClients: () => Promise<Client[]>
  searchClients: (query: string) => Promise<Client[]>
  addAppointment: (appointment: Omit<Appointment, "id">) => Promise<Appointment | null>
  updateAppointment: (id: string, appointment: Partial<Appointment>) => Promise<Appointment | null>
  deleteAppointment: (id: string) => Promise<boolean>
  addService: (service: Omit<Service, "id">) => Promise<Service | null>
  updateService: (id: string, service: Partial<Service>) => Promise<Service | null>
  deleteService: (id: string) => Promise<boolean>
  addServiceVariant: (variant: Omit<ServiceVariant, "id">) => Promise<ServiceVariant | null>
  updateServiceVariant: (id: string, updates: Partial<ServiceVariant>) => Promise<ServiceVariant | null>
  deleteServiceVariant: (id: string) => Promise<boolean>
  getServiceVariants: (serviceId?: string) => Promise<ServiceVariant[]>
  createSale: (sale: Omit<Sale, "id">) => Promise<Sale | null>
  updateSaleStatus: (id: string, status: Sale['status'], updates?: Partial<Sale>) => Promise<Sale | null>
  getSaleByAppointmentId: (appointmentId: string) => Sale | undefined
  createPayment: (payment: Omit<Payment, "id">) => Promise<Payment | null>
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
        const errorMessage = err instanceof Error ? err.message : 'Failed to load data'
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
      const [clientsData, servicesData, serviceVariantsData] = await Promise.all([
        api.getActiveClients(),
        api.getServices(),
        api.getServiceVariants(),
      ])
      setClients(clientsData)
      setServices(servicesData)
      setServiceVariants(serviceVariantsData)
      setAppointments([])
      setSales([])
      setPayments([])
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh data'
      setError(errorMessage)
      throw err
    }
  }

  const addClient = async (client: Omit<Client, "id">): Promise<Client | null> => {
    try {
      const newClient = await api.createClient(client as Omit<Client, "id" | "createdAt">)
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

  const updateClient = async (id: string, updates: Partial<Client>): Promise<Client | null> => {
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

  const deactivateClient = async (id: string): Promise<boolean> => {
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

  const reactivateClient = async (id: string): Promise<boolean> => {
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

  const getInactiveClients = async (): Promise<Client[]> => {
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

  const searchClients = async (query: string): Promise<Client[]> => {
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

  const addAppointment = async (appointment: Omit<Appointment, "id">): Promise<Appointment | null> => {
    toast({
      title: "Funcionalidade em desenvolvimento",
      description: "O módulo de agendamentos ainda não está disponível.",
      variant: "destructive",
    })
    return null
  }

  const updateAppointment = async (id: string, updates: Partial<Appointment>): Promise<Appointment | null> => {
    toast({
      title: "Funcionalidade em desenvolvimento",
      description: "O módulo de agendamentos ainda não está disponível.",
      variant: "destructive",
    })
    return null
  }

  const deleteAppointment = async (id: string): Promise<boolean> => {
    toast({
      title: "Funcionalidade em desenvolvimento",
      description: "O módulo de agendamentos ainda não está disponível.",
      variant: "destructive",
    })
    return false
  }

  const addService = async (service: Omit<Service, "id">): Promise<Service | null> => {
    try {
      const newService = await api.createService(service)
      await refreshData()
      toast({
        title: "Serviço criado",
        description: "O serviço foi cadastrado com sucesso.",
      })
      return newService
    } catch (err: any) {
      const errorTitle = err?.title || "Erro ao criar serviço"
      const errorMessage = err?.message || "Não foi possível criar o serviço."
      setError(errorMessage)
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      })
      return null
    }
  }

  const updateService = async (id: string, updates: Partial<Service>): Promise<Service | null> => {
    try {
      const updated = await api.updateService(id, updates)
      await refreshData()
      toast({
        title: "Serviço atualizado",
        description: "As informações do serviço foram atualizadas.",
      })
      return updated
    } catch (err: any) {
      const errorTitle = err?.title || "Erro ao atualizar serviço"
      const errorMessage = err?.message || "Não foi possível atualizar o serviço."
      setError(errorMessage)
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      })
      return null
    }
  }

  const deleteService = async (id: string): Promise<boolean> => {
    try {
      setServices(prevServices => prevServices.filter(service => service.id !== id))
      setServiceVariants(prevVariants => prevVariants.filter(variant => variant.serviceId !== id))
      
      const success = await api.deleteService(id)
      
      if (success) {
        toast({
          title: "Serviço excluído",
          description: "O serviço e suas variantes foram removidos.",
        })
        
        setTimeout(() => {
          refreshData().catch(console.error)
        }, 100)
      } else {
        await refreshData()
      }
      
      return success
    } catch (err: any) {
      await refreshData()
      
      const errorTitle = err?.title || "Erro ao excluir serviço"
      const errorMessage = err?.message || "Não foi possível excluir o serviço."
      setError(errorMessage)
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      })
      return false
    }
  }

  const addServiceVariant = async (variant: Omit<ServiceVariant, "id">): Promise<ServiceVariant | null> => {
    try {
      const newVariant = await api.createServiceVariant(variant as Omit<ServiceVariant, "id" | "createdAt" | "updatedAt">)
      await refreshData()
      toast({
        title: "Variante criada",
        description: "A variante do serviço foi cadastrada com sucesso.",
      })
      return newVariant
    } catch (err: any) {
      const errorTitle = err?.title || "Erro ao criar variante"
      const errorMessage = err?.message || "Não foi possível criar a variante."
      setError(errorMessage)
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      })
      return null
    }
  }

  const updateServiceVariant = async (id: string, updates: Partial<ServiceVariant>): Promise<ServiceVariant | null> => {
    try {
      const updated = await api.updateServiceVariant(id, updates)
      await refreshData()
      toast({
        title: "Variante atualizada",
        description: "As informações da variante foram atualizadas.",
      })
      return updated
    } catch (err: any) {
      const errorTitle = err?.title || "Erro ao atualizar variante"
      const errorMessage = err?.message || "Não foi possível atualizar a variante."
      setError(errorMessage)
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      })
      return null
    }
  }

  const deleteServiceVariant = async (id: string): Promise<boolean> => {
    try {
      setServiceVariants(prevVariants => prevVariants.filter(variant => variant.id !== id))
      
      const success = await api.deleteServiceVariant(id)
      
      if (success) {
        toast({
          title: "Variante excluída",
          description: "A variante foi removida com sucesso.",
        })
        
        setTimeout(() => {
          refreshData().catch(console.error)
        }, 100)
      } else {
        await refreshData()
      }
      
      return success
    } catch (err: any) {
      await refreshData()
      
      const errorTitle = err?.title || "Erro ao excluir variante"
      const errorMessage = err?.message || "Não foi possível excluir a variante."
      setError(errorMessage)
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      })
      return false
    }
  }

  const getServiceVariants = async (serviceId?: string): Promise<ServiceVariant[]> => {
    try {
      return await api.getServiceVariants(serviceId)
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to get service variants"
      setError(errorMessage)
      toast({
        title: "Erro ao buscar variantes",
        description: errorMessage,
        variant: "destructive",
      })
      return []
    }
  }

  const createSale = async (sale: Omit<Sale, "id">): Promise<Sale | null> => {
    toast({
      title: "Funcionalidade em desenvolvimento",
      description: "O módulo de vendas ainda não está disponível.",
      variant: "destructive",
    })
    return null
  }

  const updateSaleStatus = async (id: string, status: Sale['status'], updates?: Partial<Sale>): Promise<Sale | null> => {
    toast({
      title: "Funcionalidade em desenvolvimento",
      description: "O módulo de vendas ainda não está disponível.",
      variant: "destructive",
    })
    return null
  }

  const getSaleByAppointmentId = (appointmentId: string): Sale | undefined => {
    return undefined
  }

  const createPayment = async (payment: Omit<Payment, "id">): Promise<Payment | null> => {
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
        updateServiceVariant,
        deleteServiceVariant,
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
