"use client"

import { useEffect, useMemo, useState } from "react"

// Backend existente (mantido)
import { getActiveClients, getActiveServices } from "@/services/api"
import {
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/services/googleCalendarAppsScript"

// Tipos (mantidos)
import type { Client, Service } from "@/lib/types"

// UI (shadcn)
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Trash2,
  RefreshCw,
  Edit,
  MapPin,
  Phone,
  ChevronsUpDown,
  Check,
  Search,
  Filter,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

type ViewMode = "week" // fixo

interface CalendarEvent {
  id: string
  summary: string
  description?: string
  location?: string
  start: { dateTime: string; timeZone?: string }
  end: { dateTime: string; timeZone?: string }
  htmlLink?: string
  attendees?: Array<{ email: string }>
}

interface AppointmentFormData {
  clientId: string
  serviceId: string
  startTime: string
  endTime: string
  notes: string
}

/* Combobox com busca */
function Combobox({
  placeholder,
  items,
  value,
  onChange,
  emptyText = "Nenhum item encontrado",
  disabled,
}: {
  placeholder: string
  items: { value: string; label: string; hint?: string }[]
  value: string
  onChange: (v: string) => void
  emptyText?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = items.find((i) => i.value === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between h-10"
          disabled={disabled}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((it, i) => (
                <CommandItem
                  key={`${it.value}-${i}`}
                  value={`${it.label} ${it.hint || ""}`}
                  onSelect={() => {
                    onChange(it.value)
                    setOpen(false)
                  }}
                  className="flex items-center justify-between"
                >
                  <span className="truncate">{it.label}</span>
                  {value === it.value ? <Check className="h-4 w-4" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default function AgendaPage() {
  // Estado
  const [clients, setClients] = useState<Client[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [appointments, setAppointments] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [searchQuery, setSearchQuery] = useState("")
  const [filterClientId, setFilterClientId] = useState("")
  const [filterServiceId, setFilterServiceId] = useState("")

  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null)

  const [formData, setFormData] = useState<AppointmentFormData>({
    clientId: "",
    serviceId: "",
    startTime: "",
    endTime: "",
    notes: "",
  })
  const [saving, setSaving] = useState(false)

  // Carregar dados base
  useEffect(() => {
    ;(async () => {
      try {
        const [c, s] = await Promise.all([getActiveClients(), getActiveServices()])
        setClients(c || [])
        setServices(s || [])
      } catch (e) {
        console.error(e)
        setError("Erro ao carregar clientes e serviços")
      }
    })()
  }, [])

  // Período fixo semanal
  function getWeekRange(date: Date): { start: Date; end: Date } {
    const start = new Date(date)
    const end = new Date(date)
    const dow = (start.getDay() + 7) % 7 // 0..6
    const diff = start.getDate() - dow
    start.setDate(diff)
    start.setHours(0, 0, 0, 0)
    end.setDate(diff + 6)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  // Carregar eventos da semana ao navegar
  useEffect(() => {
    ;(async () => {
      try {
        setIsLoading(true)
        setError(null)
        const { start, end } = getWeekRange(currentDate)
        const resp = await listCalendarEvents(start.toISOString(), end.toISOString())
        if (resp?.success && Array.isArray(resp?.events)) {
          setAppointments(resp.events as CalendarEvent[])
        } else {
          setAppointments([])
          setError(resp?.error || "Erro ao carregar agendamentos")
        }
      } catch (e) {
        console.error(e)
        setAppointments([])
        setError("Erro ao carregar agendamentos")
      } finally {
        setIsLoading(false)
      }
    })()
  }, [currentDate])

  // Mini calendário — mês inteiro
  function getMonthGrid(date: Date): Date[] {
    const days: Date[] = []
    const first = new Date(date)
    first.setDate(1)
    const start = new Date(first)
    const dow = (start.getDay() + 7) % 7
    start.setDate(start.getDate() - dow) // começa no domingo
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      days.push(d)
    }
    return days
  }

  function formatWeekLabel(date: Date): string {
    const { start, end } = getWeekRange(date)
    const monthYear = end.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    return `${String(start.getDate()).padStart(2, "0")}–${String(end.getDate()).padStart(2, "0")} ${monthYear}`
  }

  function isSameDate(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  }
  function isSameMonth(d: Date) {
    return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear()
  }

  function weekDays(date: Date): Date[] {
    const { start } = getWeekRange(date)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }

  function goPrevWeek() {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - 7)
    setCurrentDate(d)
  }
  function goNextWeek() {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + 7)
    setCurrentDate(d)
  }
  function goPrevMonth() {
    const d = new Date(currentDate)
    d.setMonth(d.getMonth() - 1)
    setCurrentDate(d)
  }
  function goNextMonth() {
    const d = new Date(currentDate)
    d.setMonth(d.getMonth() + 1)
    setCurrentDate(d)
  }
  function goToday() {
    setCurrentDate(new Date())
  }

  // Helpers de descrição do evento
  function parseField(desc: string | undefined, label: string) {
    const line = (desc || "").split("\n").find((p) => p.startsWith(label))
    return line ? line.replace(label, "").trim() : ""
  }
  function getClientNameFromEvent(ev: CalendarEvent) {
    return parseField(ev.description, "Cliente: ")
  }
  function getPhoneFromEvent(ev: CalendarEvent) {
    return parseField(ev.description, "Telefone: ")
  }
  function getServiceNameFromEvent(ev: CalendarEvent) {
    return parseField(ev.description, "Serviço: ")
  }

  // Filtros dos eventos exibidos na semana
  const weekEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return appointments.filter((ev) => {
      const clientName = getClientNameFromEvent(ev).toLowerCase()
      const serviceName = getServiceNameFromEvent(ev).toLowerCase()
      const inClient =
        !filterClientId || clients.find((c) => c.id === filterClientId)?.name?.toLowerCase() === clientName
      const inService =
        !filterServiceId || services.find((s) => s.id === filterServiceId)?.name?.toLowerCase() === serviceName
      const inSearch =
        !q ||
        ev.summary.toLowerCase().includes(q) ||
        clientName.includes(q) ||
        serviceName.includes(q) ||
        (ev.location || "").toLowerCase().includes(q)
      return inClient && inService && inSearch
    })
  }, [appointments, searchQuery, filterClientId, filterServiceId, clients, services])

  function eventsForDay(date: Date): CalendarEvent[] {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)
    return weekEvents.filter((ev) => {
      const d = new Date(ev.start.dateTime)
      return d >= start && d <= end
    })
  }

  // Ações
  function openCreate() {
    setSelectedEvent(null)
    setFormData({ clientId: "", serviceId: "", startTime: "", endTime: "", notes: "" })
    setFormOpen(true)
  }
  function openEdit(ev: CalendarEvent) {
    setSelectedEvent(ev)
    const st = new Date(ev.start.dateTime)
    const et = new Date(ev.end.dateTime)
    const clientName = getClientNameFromEvent(ev)
    const serviceName = getServiceNameFromEvent(ev)
    const notes = parseField(ev.description, "Observações: ")
    const c = clients.find((x) => x.name === clientName)
    const s = services.find((x) => x.name === serviceName)
    const toLocal = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(
        d.getHours()
      ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    setFormData({
      clientId: c?.id || "",
      serviceId: s?.id || "",
      startTime: toLocal(st),
      endTime: toLocal(et),
      notes,
    })
    setFormOpen(true)
  }
  function openDelete(ev: CalendarEvent) {
    setEventToDelete(ev)
    setDeleteOpen(true)
  }

  async function onSave() {
    if (!formData.clientId || !formData.serviceId || !formData.startTime || !formData.endTime) {
      setError("Preencha todos os campos obrigatórios")
      return
    }
    const c = clients.find((x) => x.id === formData.clientId)
    const s = services.find((x) => x.id === formData.serviceId)
    if (!c || !s) {
      setError("Cliente ou serviço inválido")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        summary: `${c.name} - ${s.name}`,
        description: `Cliente: ${c.name}\nTelefone: ${c.phone || ""}\nServiço: ${s.name}\nObservações: ${formData.notes || ""}`,
        location: "Spaço Bellas",
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        attendees: c.email ? [{ email: c.email }] : [],
      }
      if (selectedEvent) {
        const r = await updateCalendarEvent(selectedEvent.id, payload)
        if (!r?.success) throw new Error(r?.error || "Erro ao atualizar agendamento")
      } else {
        const r = await createCalendarEvent(payload)
        if (!r?.success) throw new Error(r?.error || "Erro ao criar agendamento")
      }
      setFormOpen(false)
      // Reload semana atual
      const { start, end } = getWeekRange(currentDate)
      const resp = await listCalendarEvents(start.toISOString(), end.toISOString())
      setAppointments(resp?.success ? (resp.events as CalendarEvent[]) : [])
    } catch (e) {
      console.error(e)
      setError("Falha ao salvar agendamento")
    } finally {
      setSaving(false)
    }
  }

  async function onConfirmDelete() {
    if (!eventToDelete) return
    setSaving(true)
    setError(null)
    try {
      const r = await deleteCalendarEvent(eventToDelete.id)
      if (!r?.success) throw new Error(r?.error || "Erro ao excluir agendamento")
      setDeleteOpen(false)
      setEventToDelete(null)
      const { start, end } = getWeekRange(currentDate)
      const resp = await listCalendarEvents(start.toISOString(), end.toISOString())
      setAppointments(resp?.success ? (resp.events as CalendarEvent[]) : [])
    } catch (e) {
      console.error(e)
      setError("Falha ao excluir agendamento")
    } finally {
      setSaving(false)
    }
  }

  // Opções dos selects
  const clientItems = useMemo(
    () =>
      (clients || []).map((c) => ({
        value: c.id,
        label: c.name || "(Sem nome)",
        hint: c.phone || "",
      })),
    [clients]
  )
  const serviceItems = useMemo(
    () =>
      (services || []).map((s) => ({
        value: s.id,
        label: s.name || "(Sem nome)",
      })),
    [services]
  )

  const monthDays = getMonthGrid(currentDate)
  const weekDaysArr = weekDays(currentDate)

  return (
    <div className="space-y-4 p-4">
      {/* Título */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
        <p className="text-sm text-muted-foreground">Gerencie seus agendamentos</p>
      </div>

      {/* Card de filtros com controles responsivos (preenchem o retângulo) */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Campo de busca ocupa 2 colunas em desktop para ficar confortável */}
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, serviço ou local..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10"
              />
            </div>

            <Combobox
              placeholder="Filtrar por cliente"
              items={[{ value: "", label: "Todos" }, ...clientItems]}
              value={filterClientId}
              onChange={setFilterClientId}
            />

            <Combobox
              placeholder="Filtrar por serviço"
              items={[{ value: "", label: "Todos" }, ...serviceItems]}
              value={filterServiceId}
              onChange={setFilterServiceId}
            />

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="w-full h-10"
                onClick={() => {
                  setSearchQuery("")
                  setFilterClientId("")
                  setFilterServiceId("")
                  goToday()
                }}
              >
                <Filter className="h-4 w-4 mr-2" />
                Limpar filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* Sidebar: mini calendário do mês inteiro */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Mini Calendário</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between mb-3">
                <Button variant="outline" size="icon" className="h-9" onClick={goPrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-medium">
                  {currentDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </div>
                <Button variant="outline" size="icon" className="h-9" onClick={goNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Cabeçalho dos dias */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
                {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                  <div key={`mini-h-${i}`}>{d}</div>
                ))}
              </div>

              {/* Grade 6x7 do mês */}
              <div className="grid grid-cols-7 gap-1">
                {monthDays.map((date, i) => {
                  const today = isSameDate(date, new Date())
                  const currentMonth = isSameMonth(date)
                  const count = appointments.filter((ev) => {
                    const d = new Date(ev.start.dateTime)
                    return isSameDate(d, date)
                  }).length
                  return (
                    <button
                      key={`monthcell-${date.getTime()}-${i}`}
                      onClick={() => setCurrentDate(date)}
                      className={[
                        "aspect-square rounded-md text-xs transition border",
                        !currentMonth ? "text-gray-300" : "text-gray-700",
                        today ? "bg-primary text-white font-semibold" : "bg-card hover:bg-muted",
                      ].join(" ")}
                      title={`${date.toLocaleDateString("pt-BR")} • ${count} agendamento(s)`}
                    >
                      <div className="flex h-full w-full items-center justify-center relative">
                        <span>{date.getDate()}</span>
                        {count > 0 ? (
                          <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-primary-foreground/90" />
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="mt-3 grid gap-2">
                <Button variant="outline" className="h-9 w-full sm:w-auto" onClick={goToday}>
                  Hoje
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Conteúdo principal: SEMANA ÚNICA */}
        <div className="flex flex-col gap-4">
          {/* Navegação semanal */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-9" onClick={goPrevWeek}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" className="h-9" onClick={goToday}>
                    Hoje
                  </Button>
                  <Button variant="outline" size="icon" className="h-9" onClick={goNextWeek}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-base sm:text-lg font-semibold">{formatWeekLabel(currentDate)}</div>
                <div className="w-[1px] h-9 hidden sm:block bg-border" />
                <Button onClick={openCreate} className="h-9">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo agendamento
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista da semana */}
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Carregando agendamentos da semana...
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {weekDaysArr.map((date, i) => {
                    const dayEvents = eventsForDay(date)
                    const today = isSameDate(date, new Date())
                    return (
                      <div key={`weekline-${date.getTime()}-${i}`} className="border rounded-md">
                        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
                          <div className="flex items-center gap-2">
                            <Badge variant={today ? "default" : "secondary"}>
                              {date.toLocaleDateString("pt-BR", { weekday: "short" }).toUpperCase()}
                            </Badge>
                            <div className="font-semibold">{date.toLocaleDateString("pt-BR")}</div>
                          </div>
                          {today ? <span className="text-xs text-primary font-medium">Hoje</span> : null}
                        </div>

                        {dayEvents.length === 0 ? (
                          <div className="px-3 py-6 text-sm text-muted-foreground">Nenhum agendamento</div>
                        ) : (
                          <ul className="divide-y">
                            {dayEvents.map((ev) => {
                              const clientName = getClientNameFromEvent(ev)
                              const phone = getPhoneFromEvent(ev)
                              const serviceName = getServiceNameFromEvent(ev)
                              return (
                                <li key={ev.id} className="px-3 py-3 hover:bg-muted/30 transition">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <div className="flex items-start gap-3 min-w-0">
                                      <div className="rounded bg-primary/10 p-2">
                                        <Clock className="h-4 w-4 text-primary" />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-sm font-medium truncate">
                                          {new Date(ev.start.dateTime).toLocaleTimeString("pt-BR", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}{" "}
                                          –{" "}
                                          {new Date(ev.end.dateTime).toLocaleTimeString("pt-BR", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate">{ev.summary}</div>
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                          {clientName ? (
                                            <span className="inline-flex items-center gap-1">
                                              <User className="h-3 w-3" />
                                              {clientName}
                                            </span>
                                          ) : null}
                                          {phone ? (
                                            <span className="inline-flex items-center gap-1">
                                              <Phone className="h-3 w-3" />
                                              {phone}
                                            </span>
                                          ) : null}
                                          {serviceName ? <Badge variant="outline">{serviceName}</Badge> : null}
                                          {ev.location ? (
                                            <span className="inline-flex items-center gap-1">
                                              <MapPin className="h-3 w-3" />
                                              {ev.location}
                                            </span>
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>

                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="h-9">
                                          Ações
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-44">
                                        <DropdownMenuItem onClick={() => openEdit(ev)}>
                                          <Edit className="h-4 w-4 mr-2" />
                                          Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            window.open(ev.htmlLink || "#", "_blank", "noopener,noreferrer")
                                          }
                                        >
                                          <CalendarIcon className="h-4 w-4 mr-2" />
                                          Ver no Google
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive" onClick={() => openDelete(ev)}>
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Excluir
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </div>

      {/* Modal: criar/editar */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedEvent ? "Editar agendamento" : "Novo agendamento"}</DialogTitle>
            <DialogDescription>
              {selectedEvent ? "Atualize os dados do agendamento" : "Preencha os dados para criar um agendamento"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Cliente</label>
                <Combobox
                  placeholder="Selecione o cliente"
                  items={clientItems}
                  value={formData.clientId}
                  onChange={(v) => setFormData((p) => ({ ...p, clientId: v }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Serviço</label>
                <Combobox
                  placeholder="Selecione o serviço"
                  items={serviceItems}
                  value={formData.serviceId}
                  onChange={(v) => setFormData((p) => ({ ...p, serviceId: v }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Início</label>
                <Input
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => setFormData((p) => ({ ...p, startTime: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Término</label>
                <Input
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) => setFormData((p) => ({ ...p, endTime: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">Observações</label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Notas internas"
              />
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            {selectedEvent ? (
              <Button
                variant="destructive"
                className="mr-auto"
                onClick={() => {
                  setFormOpen(false)
                  openDelete(selectedEvent)
                }}
                disabled={saving}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={onSave}
              disabled={saving || !formData.clientId || !formData.serviceId || !formData.startTime || !formData.endTime}
            >
              {saving ? "Salvando..." : selectedEvent ? "Salvar alterações" : "Criar agendamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: excluir */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>

          {eventToDelete ? (
            <div className="space-y-2 text-sm">
              <div className="font-medium">{eventToDelete.summary}</div>
              <div className="text-muted-foreground">
                {new Date(eventToDelete.start.dateTime).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onConfirmDelete} disabled={saving || !eventToDelete}>
              {saving ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
