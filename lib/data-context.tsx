"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
  useCallback,
} from "react";
import type {
  Client,
  Appointment,
  Service,
  ServiceVariant,
  Sale,
  Payment,
  Professional,
  AppOption,
} from "@/types";
import { SaleStatus, PaymentStatus } from "@/types";
import * as clientsApi from "@/services/clients";
import * as servicesApi from "@/services/services";
import * as appointmentsApi from "@/services/appointments";
import * as financeApi from "@/services/finance";
import * as professionalsApi from "@/services/professionals";

import {
  createClientAction,
  updateClientAction,
  deactivateClientAction,
  reactivateClientAction,
} from "@/actions/clients";
import {
  createAppointmentAction,
  updateAppointmentAction,
  deleteAppointmentAction,
} from "@/actions/appointments";
import {
  createServiceAction,
  updateServiceAction,
  deleteServiceAction,
  createServiceVariantAction,
  updateServiceVariantAction,
  deleteServiceVariantAction,
} from "@/actions/services";
import {
  createSaleAction,
  updateSaleStatusAction,
  createPaymentAction,
  updatePaymentStatusAction,
  NewSale,
} from "@/actions/finance";
import {
  createProfessionalAction,
  updateProfessionalAction,
  deleteProfessionalAction,
} from "@/actions/professionals";
import {
  getAppOptionsAction,
  upsertAppOptionAction,
  deleteAppOptionAction,
  updateAppOptionsOrderAction,
  getAppSettingsAction,
  updateAppSettingAction,
} from "@/actions/options";

const apiApp = {
  ...clientsApi,
  ...servicesApi,
  ...appointmentsApi,
  ...financeApi,
  ...professionalsApi,
};
import * as apiPublic from "@/services/api-public";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

type Mode = "app" | "public";
type ApiModule = typeof apiApp;

interface DataContextType {
  // State
  clients: Client[];
  appointments: Appointment[];
  services: Service[];
  serviceVariants: ServiceVariant[];
  sales: Sale[];
  payments: Payment[];
  professionals: Professional[];
  appOptions: AppOption[];
  appSettings: Record<string, string>;
  isLoading: boolean;
  error: string | null;

  // Utilities
  refreshData: () => Promise<void>;

  // Clients
  addClient: (
    client: Omit<Client, "id" | "totalSpent" | "registrationDate" | "status">,
  ) => Promise<Client | null>;
  updateClient: (id: string, client: Partial<Client>) => Promise<Client | null>;
  deactivateClient: (id: string) => Promise<boolean>;
  reactivateClient: (id: string) => Promise<boolean>;
  getInactiveClients: () => Promise<Client[]>;
  searchClients: (query: string) => Promise<Client[]>;

  // Appointments
  addAppointment: (
    appointment: Omit<Appointment, "id" | "created_at">,
  ) => Promise<Appointment | null>;
  updateAppointment: (
    id: string,
    appointment: Partial<Appointment>,
  ) => Promise<Appointment | null>;
  deleteAppointment: (id: string) => Promise<boolean>;

  // Services
  addService: (
    service: Omit<Service, "id" | "created_at" | "updatedAt"> & {
      variants?: Omit<
        ServiceVariant,
        "id" | "serviceId" | "created_at" | "updatedAt"
      >[];
    },
  ) => Promise<Service | null>;
  updateService: (
    id: string,
    service: Partial<Service> & { variants?: ServiceVariant[] },
  ) => Promise<Service | null>;
  deleteService: (id: string) => Promise<boolean>;
  getServiceVariantsByServiceId: (
    serviceId: string,
  ) => Promise<ServiceVariant[]>;
  addServiceVariant: (
    variant: Omit<ServiceVariant, "id" | "created_at" | "updatedAt">,
  ) => Promise<ServiceVariant | null>;
  updateServiceVariant: (
    id: string,
    variant: Partial<ServiceVariant>,
  ) => Promise<ServiceVariant | null>;
  deleteServiceVariant: (id: string) => Promise<boolean>;

  // Finance
  getSales: () => Promise<Sale[]>;
  getPayments: () => Promise<Payment[]>;
  createPayment: (payment: Omit<Payment, "id">) => Promise<Payment | null>;
  cancelPayment: (id: string) => Promise<boolean>;
  updateSaleStatus: (
    id: string,
    status: SaleStatus,
    updates?: Partial<Sale>,
  ) => Promise<Sale | null>;
  createSale: (sale: NewSale) => Promise<Sale | null>;

  // Professionals
  addProfessional: (
    professional: Omit<Professional, "id" | "created_at">,
  ) => Promise<Professional | null>;
  updateProfessional: (
    id: string,
    professional: Partial<Professional>,
  ) => Promise<Professional | null>;
  deleteProfessional: (id: string) => Promise<boolean>;

  // App Options & Settings
  upsertAppOption: (option: {
    id?: number;
    option_type: string;
    label: string;
    value: string;
    is_active?: boolean;
    display_order?: number;
  }) => Promise<boolean>;
  deleteAppOption: (id: number) => Promise<boolean>;
  updateAppOptionsOrder: (
    options: { id: number; display_order: number }[],
  ) => Promise<boolean>;
  updateAppSetting: (key: string, value: string) => Promise<boolean>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({
  children,
  mode = "app",
}: {
  children: ReactNode;
  mode?: Mode;
}) {
  const { isAuthenticated } = useAuth();
  const api: ApiModule = mode === "public" ? (apiPublic as ApiModule) : apiApp;

  const { toast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceVariants, setServiceVariants] = useState<ServiceVariant[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [appOptions, setAppOptions] = useState<AppOption[]>([]);
  const [appSettings, setAppSettings] = useState<Record<string, string>>({});

  // Loads all necessary application data, including financial records
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        activeClients,
        inactiveClients,
        servicesData,
        variantsData,
        salesData,
        paymentsData,
        appointmentsData,
        professionalsData,
        optionsRes,
        settingsRes,
      ] = await Promise.all([
        api.getActiveClients?.(),
        api.getInactiveClients?.(),
        api.getServices?.(),
        api.getServiceVariants?.(),
        (api as unknown as Record<string, () => Promise<Sale[]>>).getSales?.(),
        (
          api as unknown as Record<string, () => Promise<Payment[]>>
        ).getPayments?.(),
        (
          api as unknown as Record<string, () => Promise<Appointment[]>>
        ).getAppointments?.(),
        api.getProfessionals(),
        getAppOptionsAction(),
        getAppSettingsAction(),
      ]);

      // Combines active and inactive clients into a single array
      const allClients = [...(activeClients || []), ...(inactiveClients || [])];
      setClients(allClients);

      if (servicesData) setServices(servicesData);
      if (variantsData) setServiceVariants(variantsData);
      if (salesData) setSales(salesData);
      if (paymentsData) setPayments(paymentsData);
      if (appointmentsData) setAppointments(appointmentsData);
      if (professionalsData) setProfessionals(professionalsData);

      if (optionsRes.success && optionsRes.data) {
        setAppOptions(optionsRes.data as AppOption[]);
      } else if (optionsRes.error) {
        console.error("Options loading error:", optionsRes.error);
      }

      if (settingsRes.success && settingsRes.data) {
        setAppSettings(settingsRes.data);
      }

      setError(null);
    } catch (err) {
      console.error("refreshData caught error:", err);
      const msg =
        err instanceof Error ? err.message : "Falha ao carregar dados";
      setError(msg);
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [api, toast]);

  // Financial wrappers

  const getSales = async (): Promise<Sale[]> => {
    try {
      const data = await (
        api as unknown as Record<string, () => Promise<Sale[]>>
      ).getSales?.();
      if (data) setSales(data);
      return data || [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao listar vendas";
      setError(msg);
      toast({
        title: "Erro ao listar vendas",
        description: msg,
        variant: "destructive",
      });
      return [];
    }
  };

  const getPayments = async (): Promise<Payment[]> => {
    try {
      const data = await (
        api as unknown as Record<string, () => Promise<Payment[]>>
      ).getPayments?.();
      if (data) setPayments(data);
      return data || [];
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Falha ao listar pagamentos";
      setError(msg);
      toast({
        title: "Erro ao listar pagamentos",
        description: msg,
        variant: "destructive",
      });
      return [];
    }
  };

  const createSale = async (sale: NewSale): Promise<Sale | null> => {
    try {
      const res = await createSaleAction(sale);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      toast({
        title: "Venda criada",
        description: "A venda foi criada com sucesso.",
      });
      return res.data as unknown as Sale;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Não foi possível criar a venda.";
      setError(msg);
      toast({ title: "Erro", description: msg, variant: "destructive" });
      return null;
    }
  };

  // Payment creation: accepts externalTransactionId (order_nsu) and paymentLinkUrl for link generation
  const createPayment = async (
    payment: Omit<Payment, "id">,
  ): Promise<Payment | null> => {
    try {
      const res = await createPaymentAction(payment);
      if (!res.success) throw new Error(res.error);
      // Refresh to update paid/balance aggregates
      await refreshData();
      toast({
        title: "Pagamento registrado",
        description: "O pagamento foi registrado com sucesso.",
      });
      return res.data as unknown as Payment;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível registrar o pagamento.";
      setError(msg);
      toast({ title: "Erro", description: msg, variant: "destructive" });
      return null;
    }
  };

  const cancelPayment = async (id: string): Promise<boolean> => {
    try {
      const res = await updatePaymentStatusAction(id, PaymentStatus.CANCELLED);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      toast({
        title: "Pagamento cancelado",
        description: "O pagamento foi cancelado com sucesso.",
      });
      return true;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível cancelar o pagamento.";
      setError(msg);
      toast({ title: "Erro", description: msg, variant: "destructive" });
      return false;
    }
  };

  const updateSaleStatus = async (
    id: string,
    status: SaleStatus,
    updates?: Partial<Sale>,
  ): Promise<Sale | null> => {
    try {
      const res = await updateSaleStatusAction(id, status, updates);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      toast({
        title: "Status atualizado",
        description: "O status da venda foi atualizado.",
      });
      return res.data as unknown as Sale;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível atualizar o status da venda.";
      setError(msg);
      toast({ title: "Erro", description: msg, variant: "destructive" });
      return null;
    }
  };

  // Existing methods for clients, services, and agenda, maintaining the same pattern

  const addClient = async (
    client: Omit<Client, "id" | "totalSpent" | "registrationDate" | "status">,
  ): Promise<Client | null> => {
    try {
      const res = await createClientAction(client);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      toast({
        title: "Cliente criado",
        description: "O cliente foi adicionado com sucesso.",
      });
      return res.data as unknown as Client;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível criar o cliente.";
      setError(msg);
      toast({
        title: "Erro ao criar cliente",
        description: msg,
        variant: "destructive",
      });
      return null;
    }
  };

  const updateClient = async (
    id: string,
    client: Partial<Client>,
  ): Promise<Client | null> => {
    try {
      const res = await updateClientAction(id, client);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      toast({
        title: "Cliente atualizado",
        description: "Os dados do cliente foram atualizados.",
      });
      return res.data as unknown as Client;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível atualizar le cliente.";
      setError(msg);
      toast({
        title: "Erro ao atualizar cliente",
        description: msg,
        variant: "destructive",
      });
      return null;
    }
  };

  const deactivateClient = async (id: string): Promise<boolean> => {
    try {
      const res = await deactivateClientAction(id);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      toast({
        title: "Cliente desativado",
        description: "O cliente foi desativado com sucesso.",
      });
      return true;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível desativar le cliente.";
      setError(msg);
      toast({
        title: "Erro ao desativar cliente",
        description: msg,
        variant: "destructive",
      });
      return false;
    }
  };

  const reactivateClient = async (id: string): Promise<boolean> => {
    try {
      const res = await reactivateClientAction(id);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      toast({
        title: "Cliente reativado",
        description: "O cliente foi reativado com sucesso.",
      });
      return true;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível reativar le cliente.";
      setError(msg);
      toast({
        title: "Erro ao reativar cliente",
        description: msg,
        variant: "destructive",
      });
      return false;
    }
  };

  const getInactiveClients = async (): Promise<Client[]> => {
    try {
      const list = await api.getInactiveClients?.();
      return list || [];
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível listar clientes inativos.";
      setError(msg);
      toast({
        title: "Erro ao listar inativos",
        description: msg,
        variant: "destructive",
      });
      return [];
    }
  };

  const searchClients = async (query: string): Promise<Client[]> => {
    try {
      const results = await api.searchClients?.(query);
      return results || [];
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível buscar clientes.";
      setError(msg);
      toast({
        title: "Erro na busca",
        description: msg,
        variant: "destructive",
      });
      return [];
    }
  };

  const addAppointment = async (
    appointment: Omit<Appointment, "id" | "created_at">,
  ): Promise<Appointment | null> => {
    try {
      const res = await createAppointmentAction(appointment);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      toast({
        title: "Agendamento criado",
        description: "O agendamento foi adicionado com sucesso.",
      });
      return res.data as unknown as Appointment;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível criar o agendamento.";
      setError(msg);
      toast({
        title: "Erro ao criar agendamento",
        description: msg,
        variant: "destructive",
      });
      return null;
    }
  };

  const updateAppointment = async (
    id: string,
    appointment: Partial<Appointment>,
  ): Promise<Appointment | null> => {
    try {
      const res = await updateAppointmentAction(id, appointment);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      toast({
        title: "Agendamento atualizado",
        description: "Os dados do agendamento foram atualizados.",
      });
      return res.data as unknown as Appointment;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível atualizar o agendamento.";
      setError(msg);
      toast({
        title: "Erro ao atualizar agendamento",
        description: msg,
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteAppointment = async (id: string): Promise<boolean> => {
    try {
      const res = await deleteAppointmentAction(id);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      toast({
        title: "Agendamento removido",
        description: "O agendamento foi removido com sucesso.",
      });
      return true;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível remover o agendamento.";
      setError(msg);
      toast({
        title: "Erro ao remover agendamento",
        description: msg,
        variant: "destructive",
      });
      return false;
    }
  };

  const addService = async (
    service: Omit<Service, "id" | "created_at" | "updatedAt"> & {
      variants?: Omit<
        ServiceVariant,
        "id" | "serviceId" | "created_at" | "updatedAt"
      >[];
    },
  ): Promise<Service | null> => {
    try {
      const res = await createServiceAction(service);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      toast({
        title: "Serviço criado",
        description: "O serviço foi adicionado com sucesso.",
      });
      return res.data as unknown as Service;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível criar o serviço.";
      setError(msg);
      toast({
        title: "Erro ao criar serviço",
        description: msg,
        variant: "destructive",
      });
      return null;
    }
  };

  const updateService = async (
    id: string,
    service: Partial<Service> & { variants?: ServiceVariant[] },
  ): Promise<Service | null> => {
    try {
      const res = await updateServiceAction(id, service);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      toast({
        title: "Serviço atualizado",
        description: "Os dados do serviço foram atualizados.",
      });
      return res.data as unknown as Service;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível atualizar le serviço.";
      setError(msg);
      toast({
        title: "Erro ao atualizar serviço",
        description: msg,
        variant: "destructive",
      });
      return null;
    }
  };

  const getServiceVariantsByServiceId = async (
    serviceId: string,
  ): Promise<ServiceVariant[]> => {
    try {
      const variants = await api.getServiceVariantsByServiceId?.(serviceId);
      return variants || [];
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível buscar os tipos do serviço.";
      setError(msg);
      toast({
        title: "Erro ao buscar tipos",
        description: msg,
        variant: "destructive",
      });
      return [];
    }
  };

  const deleteService = async (id: string): Promise<boolean> => {
    try {
      const res = await deleteServiceAction(id);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      toast({
        title: "Serviço removido",
        description: "O serviço foi removido com sucesso.",
      });
      return true;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível remover o serviço.";
      setError(msg);
      toast({
        title: "Erro ao remover serviço",
        description: msg,
        variant: "destructive",
      });
      return false;
    }
  };

  const addServiceVariant = async (
    variant: Omit<ServiceVariant, "id" | "created_at" | "updatedAt">,
  ): Promise<ServiceVariant | null> => {
    try {
      const res = await createServiceVariantAction(variant);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      toast({
        title: "Tipo criado",
        description: "O tipo foi adicionado com sucesso.",
      });
      return res.data as unknown as ServiceVariant;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Não foi possível criar le tipo.";
      setError(msg);
      toast({
        title: "Erro ao criar tipo",
        description: msg,
        variant: "destructive",
      });
      return null;
    }
  };

  const updateServiceVariant = async (
    id: string,
    variant: Partial<ServiceVariant>,
  ): Promise<ServiceVariant | null> => {
    try {
      const res = await updateServiceVariantAction(id, variant);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      toast({
        title: "Tipo atualizado",
        description: "Os dados do tipo foram atualizados.",
      });
      return res.data as unknown as ServiceVariant;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível atualizar le tipo.";
      setError(msg);
      toast({
        title: "Erro ao atualizar tipo",
        description: msg,
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteServiceVariant = async (id: string): Promise<boolean> => {
    try {
      const res = await deleteServiceVariantAction(id);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      toast({
        title: "Tipo removido",
        description: "O tipo foi removido com sucesso.",
      });
      return true;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível remover le tipo.";
      setError(msg);
      toast({
        title: "Erro ao remover tipo",
        description: msg,
        variant: "destructive",
      });
      return false;
    }
  };

  // Professional methods
  const addProfessional = async (
    professional: Omit<Professional, "id" | "created_at">,
  ): Promise<Professional | null> => {
    try {
      const res = await createProfessionalAction(professional);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      toast({
        title: "Profissional criado",
        description: "O profissional foi adicionado com sucesso.",
      });
      return res.data;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível criar o profissional.";
      setError(msg);
      toast({ title: "Erro", description: msg, variant: "destructive" });
      return null;
    }
  };

  const updateProfessional = async (
    id: string,
    professional: Partial<Professional>,
  ): Promise<Professional | null> => {
    try {
      const res = await updateProfessionalAction(id, professional);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      toast({
        title: "Profissional atualizado",
        description: "Os dados do profissional foram atualizados.",
      });
      return res.data;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível atualizar o profissional.";
      setError(msg);
      toast({ title: "Erro", description: msg, variant: "destructive" });
      return null;
    }
  };

  const deleteProfessional = async (id: string): Promise<boolean> => {
    try {
      const res = await deleteProfessionalAction(id);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      toast({
        title: "Profissional removido",
        description: "O profissional foi removido com sucesso.",
      });
      return true;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível remover o profissional.";
      setError(msg);
      toast({ title: "Erro", description: msg, variant: "destructive" });
      return false;
    }
  };

  // App Options & Settings methods
  const upsertAppOption = async (option: {
    id?: number;
    option_type: string;
    label: string;
    value: string;
    is_active?: boolean;
    display_order?: number;
  }): Promise<boolean> => {
    try {
      const res = await upsertAppOptionAction(option);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar opção.";
      setError(msg);
      toast({ title: "Erro", description: msg, variant: "destructive" });
      return false;
    }
  };

  const deleteAppOption = async (id: number): Promise<boolean> => {
    try {
      const res = await deleteAppOptionAction(id);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir opção.";
      setError(msg);
      toast({ title: "Erro", description: msg, variant: "destructive" });
      return false;
    }
  };

  const updateAppOptionsOrder = async (
    options: { id: number; display_order: number }[],
  ): Promise<boolean> => {
    try {
      const res = await updateAppOptionsOrderAction(options);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      toast({
        title: "Ordem atualizada",
        description: "A ordem das opções foi salva com sucesso.",
      });
      return true;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Erro ao atualizar ordem.";
      setError(msg);
      toast({ title: "Erro", description: msg, variant: "destructive" });
      return false;
    }
  };

  const updateAppSetting = async (
    key: string,
    value: string,
  ): Promise<boolean> => {
    try {
      const res = await updateAppSettingAction(key, value);
      if (!res.success) throw new Error(res.error);
      await refreshData();
      return true;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Erro ao atualizar configuração.";
      setError(msg);
      toast({ title: "Erro", description: msg, variant: "destructive" });
      return false;
    }
  };

  const value: DataContextType = {
    // state
    clients,
    appointments,
    services,
    serviceVariants,
    sales,
    payments,
    professionals,
    appOptions,
    appSettings,
    isLoading,
    error,

    // utilities
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
    getServiceVariantsByServiceId,
    addServiceVariant,
    updateServiceVariant,
    deleteServiceVariant,

    // finance
    getSales,
    getPayments,
    createPayment,
    cancelPayment,
    updateSaleStatus,
    createSale,

    // professionals
    addProfessional,
    updateProfessional,
    deleteProfessional,

    // app options
    upsertAppOption,
    deleteAppOption,
    updateAppOptionsOrder,
    updateAppSetting,
  };

  useEffect(() => {
    if (mode === "public" || isAuthenticated) void refreshData();
  }, [mode, isAuthenticated, refreshData]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextType {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useData deve ser usado dentro de DataProvider");
  }
  return ctx;
}
