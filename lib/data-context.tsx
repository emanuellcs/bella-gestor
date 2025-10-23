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
import { SaleStatus, PaymentStatus } from "@/lib/types"
import * as api from "@/services/api"
import { useToast } from "@/hooks/use-toast"
type NewSale = Omit<Sale, "id" | "payments" | "createdat" | "updatedAt" | "clientName"> & { totalAmount?: number };

interface DataContextType {
  // Estado
  clients: Client[]
  appointments: Appointment[]
  services: Service[]
  serviceVariants: ServiceVariant[]
  sales: Sale[]
  payments: Payment[]
  isLoading: boolean
  error: string | null

  // Utils
  refreshData: () => Promise<void>

  // Clients
  addClient: (client: Omit<Client, "id" | "totalSpent" | "registrationDate" | "status">) => Promise<Client | null>
  updateClient: (id: string, client: Partial<Client>) => Promise<Client | null>
  deactivateClient: (id: string) => Promise<boolean>
  reactivateClient: (id: string) => Promise<boolean>
  getInactiveClients: () => Promise<Client[]>
  searchClients: (query: string) => Promise<Client[]>

  // Appointments
  addAppointment: (appointment: Omit<Appointment, "id" | "created_at">) => Promise<Appointment | null>
  updateAppointment: (id: string, appointment: Partial<Appointment>) => Promise<Appointment | null>
  deleteAppointment: (id: string) => Promise<boolean>

  // Services
  addService: (service: Omit<Service, "id" | "created_at" | "updatedAt">) => Promise<Service | null>
  updateService: (id: string, service: Partial<Service>) => Promise<Service | null>
  deleteService: (id: string) => Promise<boolean>
  addServiceVariant: (variant: Omit<ServiceVariant, "id" | "created_at" | "updatedAt">) => Promise<ServiceVariant | null>
  updateServiceVariant: (id: string, variant: Partial<ServiceVariant>) => Promise<ServiceVariant | null>
  deleteServiceVariant: (id: string) => Promise<boolean>

  // Financeiro
  getSales: () => Promise<Sale[]>
  getPayments: () => Promise<Payment[]>
  createPayment: (payment: Omit<Payment, "id">) => Promise<Payment | null>
  updateSaleStatus: (id: string, status: SaleStatus, updates?: Partial<Sale>) => Promise<Sale | null>
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
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Carrega tudo que a aplicação precisa (inclui financeiro)
  const refreshData = async () => {
    setIsLoading(true)
    try {
      const [
        clientsData,
        servicesData,
        variantsData,
        salesData,
        paymentsData,
        appointmentsData,
      ] = await Promise.all([
        // Ajuste estas chamadas para as funções reais que você já usa no projeto
        api.getActiveClients?.() ?? api.getClients?.(),
        api.getServices?.(),
        api.getServiceVariants?.(),
        (api as any).getSales?.(),
        (api as any).getPayments?.(),
        (api as any).getAppointments?.(),
      ])

      if (clientsData) setClients(clientsData)
      if (servicesData) setServices(servicesData)
      if (variantsData) setServiceVariants(variantsData)
      if (salesData) setSales(salesData)
      if (paymentsData) setPayments(paymentsData)
      if (appointmentsData) setAppointments(appointmentsData)
      setError(null)
    } catch (err: any) {
      const msg = err?.message || "Falha ao carregar dados"
      setError(msg)
      toast({ title: "Erro", description: msg, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refreshData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Wrappers financeiros

  const getSales = async (): Promise<Sale[]> => {
    try {
      const data = await (api as any).getSales?.()
      if (data) setSales(data)
      return data || []
    } catch (err: any) {
      const msg = err?.message || "Falha ao listar vendas"
      setError(msg)
      toast({ title: "Erro ao listar vendas", description: msg, variant: "destructive" })
      return []
    }
  }

  const getPayments = async (): Promise<Payment[]> => {
    try {
      const data = await (api as any).getPayments?.()
      if (data) setPayments(data)
      return data || []
    } catch (err: any) {
      const msg = err?.message || "Falha ao listar pagamentos"
      setError(msg)
      toast({ title: "Erro ao listar pagamentos", description: msg, variant: "destructive" })
      return []
    }
  }

  // Criação de pagamento: aceita externalTransactionId=order_nsu e paymentlinkUrl quando gerar link
  const createPayment = async (payment: Omit<Payment, "id">): Promise<Payment | null> => {
    try {
      const created = await (api as any).createPayment?.(payment)
      // Recarrega para refletir agregados de pago/saldo
      await refreshData()
      toast({ title: "Pagamento registrado", description: "O pagamento foi registrado com sucesso." })
      return created || null
    } catch (err: any) {
      const title = err?.title || "Erro ao registrar pagamento"
      const msg = err?.message || "Não foi possível registrar o pagamento."
      setError(msg)
      toast({ title, description: msg, variant: "destructive" })
      return null
    }
  }

  async function generatePaymentLink(args: {
    saleId: string | number
    amount: number
    items?: { quantity: number; price: number; description: string }[]
    customer?: { name?: string; email?: string; phone_number?: string }
    address?: { cep?: string; number?: string; complement?: string }
  }) {
    try {
      const out = await (api as any).createPaymentLink?.(args)
      await refreshData()
      return out as { url: string; order_nsu: string }
    } catch (err: any) {
      throw err
    }
  }

  const updateSaleStatus = async (id: string, status: SaleStatus, updates?: Partial<Sale>): Promise<Sale | null> => {
    try {
      const updated = await (api as any).updateSaleStatus?.(id, status, updates)
      await refreshData()
      toast({ title: "Status atualizado", description: "O status da venda foi atualizado." })
      return updated || null
    } catch (err: any) {
      const title = err?.title || "Erro ao atualizar status"
      const msg = err?.message || "Não foi possível atualizar o status da venda."
      setError(msg)
      toast({ title, description: msg, variant: "destructive" })
      return null
    }
  }

  // Abaixo: métodos já existentes (clientes, serviços, agenda) — mantidos com o mesmo padrão

  const addClient = async (
    client: Omit<Client, "id" | "totalSpent" | "registrationDate" | "status">
  ): Promise<Client | null> => {
    try {
      const created = await api.createClient?.(client as any)
      await refreshData()
      toast({ title: "Cliente criado", description: "O cliente foi adicionado com sucesso." })
      return created || null
    } catch (err: any) {
      const msg = err?.message || "Não foi possível criar o cliente."
      setError(msg)
      toast({ title: "Erro ao criar cliente", description: msg, variant: "destructive" })
      return null
    }
  }

  const updateClient = async (id: string, client: Partial<Client>): Promise<Client | null> => {
    try {
      const updated = await api.updateClient?.(id, client)
      await refreshData()
      toast({ title: "Cliente atualizado", description: "Os dados do cliente foram atualizados." })
      return updated || null
    } catch (err: any) {
      const msg = err?.message || "Não foi possível atualizar o cliente."
      setError(msg)
      toast({ title: "Erro ao atualizar cliente", description: msg, variant: "destructive" })
      return null
    }
  }

  const deactivateClient = async (id: string): Promise<boolean> => {
    try {
      await api.deactivateClient?.(id)
      await refreshData()
      toast({ title: "Cliente desativado", description: "O cliente foi desativado com sucesso." })
      return true
    } catch (err: any) {
      const msg = err?.message || "Não foi possível desativar o cliente."
      setError(msg)
      toast({ title: "Erro ao desativar cliente", description: msg, variant: "destructive" })
      return false
    }
  }

  const reactivateClient = async (id: string): Promise<boolean> => {
    try {
      await api.reactivateClient?.(id)
      await refreshData()
      toast({ title: "Cliente reativado", description: "O cliente foi reativado com sucesso." })
      return true
    } catch (err: any) {
      const msg = err?.message || "Não foi possível reativar o cliente."
      setError(msg)
      toast({ title: "Erro ao reativar cliente", description: msg, variant: "destructive" })
      return false
    }
  }

  const getInactiveClients = async (): Promise<Client[]> => {
    try {
      const list = await api.getInactiveClients?.()
      return list || []
    } catch (err: any) {
      const msg = err?.message || "Não foi possível listar clientes inativos."
      setError(msg)
      toast({ title: "Erro ao listar inativos", description: msg, variant: "destructive" })
      return []
    }
  }

  const searchClients = async (query: string): Promise<Client[]> => {
    try {
      const results = await api.searchClients?.(query)
      return results || []
    } catch (err: any) {
      const msg = err?.message || "Não foi possível buscar clientes."
      setError(msg)
      toast({ title: "Erro na busca", description: msg, variant: "destructive" })
      return []
    }
  }

  const addAppointment = async (
    appointment: Omit<Appointment, "id" | "created_at">
  ): Promise<Appointment | null> => {
    try {
      const created = await api.createAppointment?.(appointment as any)
      await refreshData()
      toast({ title: "Agendamento criado", description: "O agendamento foi adicionado com sucesso." })
      return created || null
    } catch (err: any) {
      const msg = err?.message || "Não foi possível criar o agendamento."
      setError(msg)
      toast({ title: "Erro ao criar agendamento", description: msg, variant: "destructive" })
      return null
    }
  }

  const updateAppointment = async (id: string, appointment: Partial<Appointment>): Promise<Appointment | null> => {
    try {
      const updated = await api.updateAppointment?.(id, appointment)
      await refreshData()
      toast({ title: "Agendamento atualizado", description: "Os dados do agendamento foram atualizados." })
      return updated || null
    } catch (err: any) {
      const msg = err?.message || "Não foi possível atualizar o agendamento."
      setError(msg)
      toast({ title: "Erro ao atualizar agendamento", description: msg, variant: "destructive" })
      return null
    }
  }

  const deleteAppointment = async (id: string): Promise<boolean> => {
    try {
      await api.deleteAppointment?.(id)
      await refreshData()
      toast({ title: "Agendamento removido", description: "O agendamento foi removido com sucesso." })
      return true
    } catch (err: any) {
      const msg = err?.message || "Não foi possível remover o agendamento."
      setError(msg)
      toast({ title: "Erro ao remover agendamento", description: msg, variant: "destructive" })
      return false
    }
  }

  const addService = async (service: Omit<Service, "id" | "created_at" | "updatedAt">): Promise<Service | null> => {
    try {
      const created = await api.createService?.(service as any)
      await refreshData()
      toast({ title: "Serviço criado", description: "O serviço foi adicionado com sucesso." })
      return created || null
    } catch (err: any) {
      const msg = err?.message || "Não foi possível criar o serviço."
      setError(msg)
      toast({ title: "Erro ao criar serviço", description: msg, variant: "destructive" })
      return null
    }
  }

  const updateService = async (id: string, service: Partial<Service>): Promise<Service | null> => {
    try {
      const updated = await api.updateService?.(id, service)
      await refreshData()
      toast({ title: "Serviço atualizado", description: "Os dados do serviço foram atualizados." })
      return updated || null
    } catch (err: any) {
      const msg = err?.message || "Não foi possível atualizar o serviço."
      setError(msg)
      toast({ title: "Erro ao atualizar serviço", description: msg, variant: "destructive" })
      return null
    }
  }

  const deleteService = async (id: string): Promise<boolean> => {
    try {
      await api.deleteService?.(id)
      await refreshData()
      toast({ title: "Serviço removido", description: "O serviço foi removido com sucesso." })
      return true
    } catch (err: any) {
      const msg = err?.message || "Não foi possível remover o serviço."
      setError(msg)
      toast({ title: "Erro ao remover serviço", description: msg, variant: "destructive" })
      return false
    }
  }

  const addServiceVariant = async (
    variant: Omit<ServiceVariant, "id" | "created_at" | "updatedAt">
  ): Promise<ServiceVariant | null> => {
    try {
      const created = await api.createServiceVariant?.(variant as any)
      await refreshData()
      toast({ title: "Variante criada", description: "A variante foi adicionada com sucesso." })
      return created || null
    } catch (err: any) {
      const msg = err?.message || "Não foi possível criar a variante."
      setError(msg)
      toast({ title: "Erro ao criar variante", description: msg, variant: "destructive" })
      return null
    }
  }

  const updateServiceVariant = async (id: string, variant: Partial<ServiceVariant>): Promise<ServiceVariant | null> => {
    try {
      const updated = await api.updateServiceVariant?.(id, variant)
      await refreshData()
      toast({ title: "Variante atualizada", description: "Os dados da variante foram atualizados." })
      return updated || null
    } catch (err: any) {
      const msg = err?.message || "Não foi possível atualizar a variante."
      setError(msg)
      toast({ title: "Erro ao atualizar variante", description: msg, variant: "destructive" })
      return null
    }
  }

  const deleteServiceVariant = async (id: string): Promise<boolean> => {
    try {
      await (api as any).deleteServiceVariant?.(id)
      await refreshData()
      toast({ title: "Variante removida", description: "A variante foi removida com sucesso." })
      return true
    } catch (err: any) {
      const msg = err?.message || "Não foi possível remover a variante."
      setError(msg)
      toast({ title: "Erro ao remover variante", description: msg, variant: "destructive" })
      return false
    }
  }

  const value: DataContextType = {
    // estado
    clients,
    appointments,
    services,
    serviceVariants,
    sales,
    payments,
    isLoading,
    error,

    // utils
    refreshData,

    // clients
    addClient,
    updateClient,
    deactivateClient,
    reactivateClient,
    getInactiveClients,
    searchClients,

    // appointments
    addAppointment,
    updateAppointment,
    deleteAppointment,

    // services
    addService,
    updateService,
    deleteService,
    addServiceVariant,
    updateServiceVariant,
    deleteServiceVariant,

    // financeiro
    getSales,
    getPayments,
    createPayment,
    updateSaleStatus,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextType {
  const ctx = useContext(DataContext)
  if (!ctx) {
    throw new Error("useData deve ser usado dentro de DataProvider")
  }
  return ctx
}
