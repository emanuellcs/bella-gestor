"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import { useData } from "@/lib/data-context"
import {
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  CalendarX,
  Clock,
  User,
  MapPin,
  Award,
} from "lucide-react"
import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import { listCalendarEvents } from "@/services/googleCalendarAppsScript"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface CalendarEvent {
  id: string
  summary: string
  description?: string
  location?: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  htmlLink?: string
  attendees?: Array<{ email: string }>
}

interface ServiceStats {
  serviceName: string
  count: number
  percentage: number
}

export default function DashboardPage() {
  const user = useAuth()
  const { clients, appointments, payments } = useData()

  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [popularServices, setPopularServices] = useState<ServiceStats[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    loadUpcomingAppointments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadUpcomingAppointments() {
    setLoadingEvents(true)
    setEventsError(null)
    try {
      const now = new Date()
      const endOfWeek = new Date()
      endOfWeek.setDate(endOfWeek.getDate() + 7)

      // Busca próximos eventos
      const result = await listCalendarEvents(now.toISOString(), endOfWeek.toISOString())
      if (result.success) {
        const futureEvents = (result.events as CalendarEvent[])
          .filter((event: CalendarEvent) => new Date(event.start.dateTime) >= now)
          .sort(
            (a: CalendarEvent, b: CalendarEvent) =>
              new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime()
          )
          .slice(0, 5)
        setUpcomingEvents(futureEvents)
      } else {
        console.error("Erro ao carregar eventos:", result.error)
        setEventsError(result.error || "Erro ao carregar próximos agendamentos")
      }

      // Busca eventos dos últimos 30 dias para calcular serviços populares
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const pastResult = await listCalendarEvents(thirtyDaysAgo.toISOString(), now.toISOString())
      if (pastResult.success) {
        calculatePopularServices(pastResult.events as CalendarEvent[])
      }
    } catch (error) {
      console.error("Erro ao carregar próximos agendamentos:", error)
      setEventsError("Erro ao carregar próximos agendamentos")
    } finally {
      setLoadingEvents(false)
    }
  }

  function calculatePopularServices(events: CalendarEvent[]) {
    const serviceCounts: Record<string, number> = {}

    // Conta quantas vezes cada serviço aparece
    events.forEach((event) => {
      const serviceName = extractService(event.description)
      if (serviceName && serviceName !== "Não especificado") {
        serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1
      }
    })

    // Calcula total e percentuais
    const totalServices = Object.values(serviceCounts).reduce((sum, count) => sum + count, 0)

    // Converte para array e ordena
    const servicesArray: ServiceStats[] = Object.entries(serviceCounts)
      .map(([serviceName, count]) => ({
        serviceName,
        count,
        percentage: totalServices === 0 ? 0 : (count / totalServices) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5) // Top 5 serviços

    setPopularServices(servicesArray)
  }

  // Métricas (mantidas)
  const activeClients = clients.filter((c) => c.status === "active").length

  const todayAppointments = appointments.filter((a) => {
    const today = new Date().toISOString().split("T")[0]
    const appointmentDate = new Date(a.startTime).toISOString().split("T")[0]
    return appointmentDate === today
  }).length

  const totalRevenue = clients.reduce((sum, client) => sum + client.totalSpent, 0)

  // Receita mensal REAL (últimos 6 meses) a partir de payments com status 'paid' e paidAt
  const now = new Date()
  const sixMonths = Array.from({ length: 6 }, (_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1)
    return d
  })

  const revenueData = sixMonths.map((d) => {
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
    const value = (payments || [])
      .filter(
        (p) =>
          p.status === "paid" &&
          p.paidAt &&
          new Date(p.paidAt) >= start &&
          new Date(p.paidAt) <= end
      )
      .reduce((sum, p) => sum + p.amount, 0)

    const monthLabel = start
      .toLocaleDateString("pt-BR", { month: "short" })
      .replace(".", "")
      .replace(/^\w/, (c) => c.toUpperCase())

    return { month: monthLabel, revenue: value }
  })

  const current = revenueData[revenueData.length - 1]?.revenue ?? 0
  const previous = revenueData[revenueData.length - 2]?.revenue ?? 0
  const growthPercent = previous > 0 ? ((current - previous) / previous) * 100 : 0
  const growthValue = Number(growthPercent.toFixed(1))

  const stats = [
    {
      title: "Clientes Ativos",
      value: activeClients,
      icon: Users,
      description: `${clients.length} clientes no total`,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Agendamentos Hoje",
      value: todayAppointments,
      icon: Calendar,
      description: `${appointments.length} agendamentos totais`,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Receita Total",
      value: `R$ ${totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      description: "Receita acumulada",
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Crescimento",
      value: growthValue,
      icon: TrendingUp,
      description: "vs. mês anterior",
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
  ]

  function extractClientName(description?: string): string {
    if (!description) return "Cliente não identificado"
    const clientLine = description.split("\n").find((line) => line.startsWith("Cliente:"))
    return clientLine?.replace("Cliente:", "").trim() || "Cliente não identificado"
  }

  function extractPhone(description?: string): string | null {
    if (!description) return null
    const phoneLine = description.split("\n").find((line) => line.startsWith("Telefone:"))
    return phoneLine?.replace("Telefone:", "").trim() || null
  }

  function extractService(description?: string): string | null {
    if (!description) return null
    const serviceLine = description.split("\n").find((line) => line.startsWith("Serviço:"))
    return serviceLine?.replace("Serviço:", "").trim() || "Não especificado"
  }

  function formatEventDate(dateTime: string): string {
    const date = new Date(dateTime)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const isToday = date.toDateString() === today.toDateString()
    const isTomorrow = date.toDateString() === tomorrow.toDateString()

    if (isToday) {
      return `Hoje • ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    } else if (isTomorrow) {
      return `Amanhã • ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    } else {
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    }
  }

  function CustomTooltip({ active, payload }: any) {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-semibold text-gray-900">{payload[0].payload.month}</p>
          <p className="text-sm text-primary font-bold mt-1">
            R$ {payload[0].value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Aqui está um resumo do seu negócio hoje.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">{stat.title}</CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Próximos Agendamentos */}
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Próximos Agendamentos</CardTitle>
              <p className="text-sm text-gray-500 mt-1">Agendamentos da próxima semana</p>
            </div>
            <Link href="/dashboard/agenda">
              <Button variant="outline" size="sm">Ver todos</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loadingEvents ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : eventsError ? (
              <Alert variant="destructive">
                <AlertDescription>{eventsError}</AlertDescription>
              </Alert>
            ) : upcomingEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarX className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">Nenhum agendamento próximo</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => {
                  const clientName = extractClientName(event.description)
                  const phone = extractPhone(event.description)
                  const service = extractService(event.description)
                  const eventDate = formatEventDate(event.start.dateTime)

                  return (
                    <div
                      key={event.id}
                      className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 hover:border-primary/30 hover:bg-primary/5 transition-all"
                    >
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {clientName}
                          {service && (
                            <span className="text-xs text-gray-600 ml-2">{service}</span>
                          )}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{eventDate}</span>
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span>{event.location}</span>
                            </div>
                          )}
                          {phone && <span>{phone}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receita Mensal */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Receita Mensal</CardTitle>
            <p className="text-sm text-gray-500 mt-1">Evolução da receita nos últimos 6 meses</p>
          </CardHeader>
          <CardContent>
            {!mounted ? (
              <div className="flex items-center justify-center" style={{ height: 250 }}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" style={{ fontSize: "12px" }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: "12px" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#8c0082"
                    strokeWidth={2}
                    dot={{ fill: "#8c0082", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Seção de atividade recente */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Serviços mais populares */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Serviços Mais Populares</CardTitle>
              <p className="text-sm text-gray-500 mt-1">Últimos 30 dias</p>
            </div>
            <div className="p-2 rounded-lg bg-orange-100">
              <Award className="h-5 w-5 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingEvents ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : popularServices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Award className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">Nenhum serviço registrado no período</p>
              </div>
            ) : (
              <div className="space-y-3">
                {popularServices.map((service, index) => (
                  <div
                    key={service.serviceName}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {service.serviceName}
                        </p>
                        <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-purple-600 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${service.percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-sm font-semibold text-gray-900">{service.count}x</p>
                      <p className="text-xs text-gray-500">
                        {service.percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Melhores clientes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Melhores Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">Nenhum cliente cadastrado ainda.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clients
                  .sort((a, b) => b.totalSpent - a.totalSpent)
                  .slice(0, 5)
                  .map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{client.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{client.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-green-600">
                          R$ {client.totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(client.registrationDate).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
