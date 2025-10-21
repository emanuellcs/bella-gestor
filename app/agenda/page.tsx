'use client'

import { useState, useEffect } from 'react'
import { getActiveClients, getActiveServices } from '@/services/api'
import { listCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '@/services/googleCalendarAppsScript'
import { Client, Service } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Calendar, Plus, ChevronLeft, ChevronRight, Clock, User, Trash2, CalendarX, RefreshCw, Edit, MapPin, Phone } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

type ViewMode = 'day' | 'week' | 'month'

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

interface AppointmentFormData {
  clientId: string
  serviceId: string
  startTime: string
  endTime: string
  notes: string
}

interface FormContentProps {
  formData: AppointmentFormData
  setFormData: React.Dispatch<React.SetStateAction<AppointmentFormData>>
  clients: Client[]
  services: Service[]
}

function FormContent({ formData, setFormData, clients, services }: FormContentProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="client" className="text-sm font-medium">
          Cliente *
        </Label>
        <Select
          value={formData.clientId}
          onValueChange={(value) => setFormData(prev => ({ ...prev, clientId: value }))}
        >
          <SelectTrigger id="client" className="w-full">
            <SelectValue placeholder="Selecione um cliente" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name} - {client.phone}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="service" className="text-sm font-medium">
          Serviço *
        </Label>
        <Select
          value={formData.serviceId}
          onValueChange={(value) => setFormData(prev => ({ ...prev, serviceId: value }))}
        >
          <SelectTrigger id="service" className="w-full">
            <SelectValue placeholder="Selecione um serviço" />
          </SelectTrigger>
          <SelectContent>
            {services.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startTime" className="text-sm font-medium">
            Início *
          </Label>
          <Input
            id="startTime"
            type="datetime-local"
            value={formData.startTime}
            onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endTime" className="text-sm font-medium">
            Término *
          </Label>
          <Input
            id="endTime"
            type="datetime-local"
            value={formData.endTime}
            onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
            className="w-full"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes" className="text-sm font-medium">
          Observações
        </Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          rows={3}
          placeholder="Observações sobre o agendamento..."
          className="w-full resize-none"
        />
      </div>
    </div>
  )
}

export default function AgendaPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [appointments, setAppointments] = useState<CalendarEvent[]>([])
  const [showFormModal, setShowFormModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarEvent | null>(null)
  const [appointmentToDelete, setAppointmentToDelete] = useState<CalendarEvent | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<AppointmentFormData>({
    clientId: '',
    serviceId: '',
    startTime: '',
    endTime: '',
    notes: '',
  })

  useEffect(() => {
    loadClientsAndServices()
  }, [])

  useEffect(() => {
    loadAppointments()
  }, [currentDate, viewMode])

  async function loadClientsAndServices() {
    try {
      const [clientsData, servicesData] = await Promise.all([
        getActiveClients(),
        getActiveServices()
      ])
      setClients(clientsData)
      setServices(servicesData)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      setError('Erro ao carregar clientes e serviços')
    }
  }

  function getDateRange(): { start: Date; end: Date } {
    const start = new Date(currentDate)
    const end = new Date(currentDate)

    switch (viewMode) {
      case 'day':
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
      case 'week':
        const day = start.getDay()
        const diff = start.getDate() - day
        start.setDate(diff)
        start.setHours(0, 0, 0, 0)
        end.setDate(diff + 6)
        end.setHours(23, 59, 59, 999)
        break
      case 'month':
        start.setDate(1)
        start.setHours(0, 0, 0, 0)
        end.setMonth(end.getMonth() + 1)
        end.setDate(0)
        end.setHours(23, 59, 59, 999)
        break
    }

    return { start, end }
  }

  function getDisplayDates(): Date[] {
    const dates: Date[] = []
    const { start, end } = getDateRange()

    switch (viewMode) {
      case 'day':
        dates.push(new Date(currentDate))
        break
      case 'week':
        for (let i = 0; i < 7; i++) {
          const date = new Date(start)
          date.setDate(start.getDate() + i)
          dates.push(date)
        }
        break
      case 'month':
        const firstDay = start.getDay()
        const startDate = new Date(start)
        startDate.setDate(startDate.getDate() - firstDay)

        for (let i = 0; i < 35; i++) {
          const date = new Date(startDate)
          date.setDate(startDate.getDate() + i)
          dates.push(date)
        }
        break
    }

    return dates
  }

  function formatDateRange(): string {
    const { start, end } = getDateRange()

    switch (viewMode) {
      case 'day':
        return start.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        })
      case 'week':
        return `${start.getDate()} - ${end.getDate()} de ${end.toLocaleDateString('pt-BR', {
          month: 'long',
          year: 'numeric'
        })}`
      case 'month':
        return start.toLocaleDateString('pt-BR', {
          month: 'long',
          year: 'numeric'
        })
    }
  }

  function getDayName(date: Date, short: boolean = false): string {
    return date.toLocaleDateString('pt-BR', { 
      weekday: short ? 'short' : 'long' 
    }).toUpperCase()
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  async function loadAppointments() {
    setLoading(true)
    setError(null)
    try {
      const { start, end } = getDateRange()
      const result = await listCalendarEvents(start.toISOString(), end.toISOString())

      if (result.success && result.events) {
        setAppointments(result.events)
      } else {
        console.error('Erro ao carregar eventos:', result.error)
        setAppointments([])
        setError(result.error || 'Erro ao carregar agendamentos')
      }
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error)
      setAppointments([])
      setError('Erro ao carregar agendamentos')
    } finally {
      setLoading(false)
    }
  }

  function handlePrevious() {
    const newDate = new Date(currentDate)

    switch (viewMode) {
      case 'day':
        newDate.setDate(newDate.getDate() - 1)
        break
      case 'week':
        newDate.setDate(newDate.getDate() - 7)
        break
      case 'month':
        newDate.setMonth(newDate.getMonth() - 1)
        break
    }

    setCurrentDate(newDate)
  }

  function handleNext() {
    const newDate = new Date(currentDate)

    switch (viewMode) {
      case 'day':
        newDate.setDate(newDate.getDate() + 1)
        break
      case 'week':
        newDate.setDate(newDate.getDate() + 7)
        break
      case 'month':
        newDate.setMonth(newDate.getMonth() + 1)
        break
    }

    setCurrentDate(newDate)
  }

  function handleToday() {
    setCurrentDate(new Date())
  }

  function openNewAppointmentModal() {
    setSelectedAppointment(null)
    setFormData({
      clientId: '',
      serviceId: '',
      startTime: '',
      endTime: '',
      notes: '',
    })
    setShowFormModal(true)
  }

  function openEditAppointmentModal(appointment: CalendarEvent) {
    setSelectedAppointment(appointment)

    const startTime = new Date(appointment.start.dateTime)
    const endTime = new Date(appointment.end.dateTime)

    const descriptionParts = appointment.description?.split('\n') || []
    const clientInfo = descriptionParts.find(p => p.startsWith('Cliente:'))?.replace('Cliente: ', '') || ''
    const serviceInfo = descriptionParts.find(p => p.startsWith('Serviço:'))?.replace('Serviço: ', '') || ''
    const notes = descriptionParts.find(p => p.startsWith('Observações:'))?.replace('Observações: ', '') || ''

    const client = clients.find(c => c.name === clientInfo)
    const service = services.find(s => s.name === serviceInfo)

    setFormData({
      clientId: client?.id || '',
      serviceId: service?.id || '',
      startTime: `${startTime.getFullYear()}-${String(startTime.getMonth() + 1).padStart(2, '0')}-${String(startTime.getDate()).padStart(2, '0')}T${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`,
      endTime: `${endTime.getFullYear()}-${String(endTime.getMonth() + 1).padStart(2, '0')}-${String(endTime.getDate()).padStart(2, '0')}T${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`,
      notes,
    })

    setShowFormModal(true)
  }

  function openDeleteModal(appointment: CalendarEvent) {
    setAppointmentToDelete(appointment)
    setShowDeleteModal(true)
  }

  async function handleSaveAppointment() {
    if (!formData.clientId || !formData.serviceId || !formData.startTime || !formData.endTime) {
      setError('Preencha todos os campos obrigatórios')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const client = clients.find(c => c.id === formData.clientId)
      const service = services.find(s => s.id === formData.serviceId)

      if (!client || !service) {
        setError('Cliente ou serviço não encontrado')
        return
      }

      const startTime = new Date(formData.startTime).toISOString()
      const endTime = new Date(formData.endTime).toISOString()

      const eventData = {
        summary: `${client.name} - ${service.name}`,
        description: `Cliente: ${client.name}\nTelefone: ${client.phone}\nServiço: ${service.name}\nObservações: ${formData.notes}`,
        location: 'Spaço Bellas',
        startTime: startTime,
        endTime: endTime,
        attendees: client.email ? [{ email: client.email }] : []
      }

      if (selectedAppointment) {
        const result = await updateCalendarEvent(selectedAppointment.id, eventData)
        if (!result.success) {
          throw new Error(result.error || 'Erro ao atualizar evento')
        }
      } else {
        const result = await createCalendarEvent(eventData)
        if (!result.success) {
          throw new Error(result.error || 'Erro ao criar evento')
        }
      }

      setShowFormModal(false)
      await loadAppointments()
    } catch (error) {
      console.error('Erro ao salvar agendamento:', error)
      setError('Erro ao salvar agendamento. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function confirmDeleteAppointment() {
    if (!appointmentToDelete) return

    setLoading(true)
    setError(null)

    try {
      const result = await deleteCalendarEvent(appointmentToDelete.id)
      if (!result.success) {
        throw new Error(result.error || 'Erro ao deletar evento')
      }

      setShowDeleteModal(false)
      setAppointmentToDelete(null)
      await loadAppointments()
    } catch (error) {
      console.error('Erro ao excluir agendamento:', error)
      setError('Erro ao excluir agendamento. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  function getAppointmentsForDay(date: Date): CalendarEvent[] {
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)

    return appointments.filter(apt => {
      const aptDate = new Date(apt.start.dateTime)
      return aptDate >= dayStart && aptDate <= dayEnd
    })
  }

  function getViewModeLabel(mode: ViewMode): string {
    const labels = {
      day: 'Dia',
      week: 'Semana',
      month: 'Mês',
    }
    return labels[mode]
  }

  function isToday(date: Date): boolean {
    const today = new Date()
    return formatDate(date) === formatDate(today)
  }

  function isCurrentMonth(date: Date): boolean {
    return date.getMonth() === currentDate.getMonth()
  }

  const displayDates = getDisplayDates()

  return (
    <div className="min-h-screen w-full">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
                Agenda
              </h1>
              <p className="text-sm text-gray-600 mt-2">
                Gerencie seus agendamentos
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={loadAppointments}
                disabled={loading}
                variant="outline"
                size="default"
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>

              <Button
                onClick={openNewAppointmentModal}
                size="default"
                className="gap-2 bg-primary hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Novo Agendamento
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Sidebar - Desktop Only */}
          <div className="hidden lg:block space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Visualização</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
                  <Button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    variant={viewMode === mode ? 'default' : 'ghost'}
                    className={`w-full justify-start ${
                      viewMode === mode 
                        ? 'bg-primary hover:bg-primary/90 text-white' 
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    {getViewModeLabel(mode)}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Mini Calendário</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-3">
                    <Button
                      onClick={handlePrevious}
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">
                      {currentDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                    </span>
                    <Button
                      onClick={handleNext}
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
                      <div key={i} className="text-xs font-medium text-gray-500 py-1">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {getDisplayDates().slice(0, 35).map((date, index) => {
                      const today = isToday(date)
                      const currentMonth = isCurrentMonth(date)
                      const hasAppointments = getAppointmentsForDay(date).length > 0

                      return (
                        <button
                          key={index}
                          onClick={() => {
                            setCurrentDate(date)
                            setViewMode('day')
                          }}
                          className={`
                            aspect-square text-xs rounded-md transition-all
                            ${!currentMonth ? 'text-gray-300' : 'text-gray-700'}
                            ${today ? 'bg-purple-600 text-white font-bold' : ''}
                            ${hasAppointments && !today ? 'bg-primary/10 font-semibold' : ''}
                            ${!today && !hasAppointments ? 'hover:bg-gray-100' : ''}
                          `}
                        >
                          {date.getDate()}
                        </button>
                      )
                    })}
                  </div>

                  <Button
                    onClick={handleToday}
                    variant="outline"
                    size="sm"
                    className="w-full mt-3"
                  >
                    Hoje
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="space-y-4">
            {/* Mobile Controls */}
            <Card className="lg:hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <Button
                    onClick={handlePrevious}
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleToday}
                      variant="outline"
                      size="sm"
                      className="text-sm"
                    >
                      Hoje
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          {getViewModeLabel(viewMode)}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setViewMode('day')}>
                          Dia
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setViewMode('week')}>
                          Semana
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setViewMode('month')}>
                          Mês
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <Button
                    onClick={handleNext}
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="text-center">
                  <h2 className="text-lg font-semibold text-gray-900 capitalize">
                    {formatDateRange()}
                  </h2>
                </div>
              </CardContent>
            </Card>

            {/* Desktop Header */}
            <Card className="hidden lg:block">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handlePrevious}
                        variant="outline"
                        size="sm"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={handleNext}
                        variant="outline"
                        size="sm"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>

                    <h2 className="text-xl font-semibold text-gray-900 capitalize">
                      {formatDateRange()}
                    </h2>
                  </div>

                  <Button
                    onClick={handleToday}
                    variant="outline"
                    size="sm"
                  >
                    Hoje
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Calendar Content */}
            <Card>
              <CardContent className="p-0">
                {viewMode === 'month' ? (
                  /* Month View */
                  <div className="overflow-hidden">
                    {/* Desktop: Full week names, Mobile: Abbreviated */}
                    <div className="hidden sm:grid grid-cols-7 bg-gray-100 border-b">
                      {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((day, index) => (
                        <div
                          key={index}
                          className="p-3 text-center text-sm font-semibold text-gray-700 border-r last:border-r-0"
                        >
                          {day}
                        </div>
                      ))}
                    </div>

                    <div className="grid sm:hidden grid-cols-7 bg-gray-100 border-b">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => (
                        <div
                          key={index}
                          className="p-2 text-center text-xs font-semibold text-gray-700"
                        >
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7">
                      {displayDates.map((date, index) => {
                        const dayAppointments = getAppointmentsForDay(date)
                        const isCurrentMonthDay = isCurrentMonth(date)
                        const today = isToday(date)

                        return (
                          <div
                            key={index}
                            className={`
                              min-h-[100px] sm:min-h-[120px] p-2
                              border-b border-r last:border-r-0
                              ${!isCurrentMonthDay ? 'bg-gray-50/50' : 'bg-white'}
                              ${today ? 'bg-primary/5 border-primary/20' : ''}
                              hover:bg-gray-50 transition-colors
                            `}
                          >
                            <div
                              className={`
                                text-sm font-medium mb-2
                                ${!isCurrentMonthDay ? 'text-gray-400' : 'text-gray-700'}
                                ${today ? 'text-primary font-bold' : ''}
                              `}
                            >
                              {date.getDate()}
                            </div>

                            {dayAppointments.length > 0 && (
                              <div className="space-y-1">
                                {dayAppointments.slice(0, 3).map((appointment) => (
                                  <button
                                    key={appointment.id}
                                    onClick={() => openEditAppointmentModal(appointment)}
                                    className="w-full text-left p-1.5 rounded text-xs bg-primary/10 hover:bg-primary/20 text-purple-900 transition-colors"
                                  >
                                    <div className="font-medium truncate">
                                      {new Date(appointment.start.dateTime).toLocaleTimeString('pt-BR', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </div>
                                    <div className="truncate opacity-90">
                                      {appointment.summary}
                                    </div>
                                  </button>
                                ))}

                                {dayAppointments.length > 3 && (
                                  <div className="text-xs text-center text-primary font-medium pt-1">
                                    +{dayAppointments.length - 3} mais
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  /* Day/Week List View */
                  <div className="divide-y">
                    {displayDates.map((date, index) => {
                      const dayAppointments = getAppointmentsForDay(date)
                      const today = isToday(date)

                      return (
                        <div
                          key={index}
                          className={`p-4 sm:p-6 ${today ? 'bg-primary/5/50' : 'bg-white'}`}
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <div className={`text-center ${today ? 'text-primary' : 'text-gray-600'}`}>
                              <div className="text-xs font-medium uppercase">
                                {getDayName(date, true)}
                              </div>
                              <div className={`text-2xl font-bold ${today ? 'text-primary' : 'text-gray-900'}`}>
                                {date.getDate()}
                              </div>
                            </div>

                            {today && (
                              <Badge variant="secondary" className="bg-primary/10 text-primary/90">
                                Hoje
                              </Badge>
                            )}
                          </div>

                          {dayAppointments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                              <CalendarX className="h-10 w-10 mb-2" />
                              <p className="text-sm">Nenhum agendamento</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {dayAppointments.map((appointment) => {
                                const descriptionParts = appointment.description?.split('\n') || []
                                const clientName = descriptionParts.find(p => p.startsWith('Cliente:'))?.replace('Cliente: ', '')
                                const phone = descriptionParts.find(p => p.startsWith('Telefone:'))?.replace('Telefone: ', '')
                                const serviceName = descriptionParts.find(p => p.startsWith('Serviço:'))?.replace('Serviço: ', '')

                                return (
                                  <div
                                    key={appointment.id}
                                    className="group relative bg-white border border-gray-200 rounded-lg p-4 hhover:border-primary/30 hover:shadow-md transition-all cursor-pointer"
                                    onClick={() => openEditAppointmentModal(appointment)}
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1 space-y-3">
                                        <div className="flex items-center gap-3">
                                          <div className="flex items-center gap-2 text-primary">
                                            <Clock className="h-4 w-4" />
                                            <span className="font-semibold">
                                              {new Date(appointment.start.dateTime).toLocaleTimeString('pt-BR', {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                              })}
                                              {' - '}
                                              {new Date(appointment.end.dateTime).toLocaleTimeString('pt-BR', {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                              })}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="space-y-2">
                                          {clientName && (
                                            <div className="flex items-center gap-2 text-gray-700">
                                              <User className="h-4 w-4 text-gray-400" />
                                              <span className="font-medium">{clientName}</span>
                                            </div>
                                          )}

                                          {phone && (
                                            <div className="flex items-center gap-2 text-gray-600 text-sm">
                                              <Phone className="h-4 w-4 text-gray-400" />
                                              <span>{phone}</span>
                                            </div>
                                          )}

                                          {serviceName && (
                                            <div className="flex items-center gap-2">
                                              <Badge variant="secondary" className="bg-primary/10 text-primary/90">
                                                {serviceName}
                                              </Badge>
                                            </div>
                                          )}

                                          {appointment.location && (
                                            <div className="flex items-center gap-2 text-gray-600 text-sm">
                                              <MapPin className="h-4 w-4 text-gray-400" />
                                              <span>{appointment.location}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 w-8 p-0 hover:bg-primary/10"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            openEditAppointmentModal(appointment)
                                          }}
                                        >
                                          <Edit className="h-4 w-4 text-primary" />
                                        </Button>

                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 w-8 p-0 hover:bg-red-50"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            openDeleteModal(appointment)
                                          }}
                                        >
                                          <Trash2 className="h-4 w-4 text-red-600" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      <Dialog open={showFormModal} onOpenChange={setShowFormModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl text-primary">
              {selectedAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}
            </DialogTitle>
            <DialogDescription>
              {selectedAppointment
                ? 'Atualize as informações do agendamento'
                : 'Preencha os dados para criar um novo agendamento'}
            </DialogDescription>
          </DialogHeader>

          <FormContent
            formData={formData}
            setFormData={setFormData}
            clients={clients}
            services={services}
          />

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              onClick={() => setShowFormModal(false)}
              disabled={loading}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>

            {selectedAppointment && (
              <Button
                onClick={() => {
                  setShowFormModal(false)
                  openDeleteModal(selectedAppointment)
                }}
                disabled={loading}
                variant="destructive"
                className="w-full sm:w-auto gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Excluir
              </Button>
            )}

            <Button
              onClick={handleSaveAppointment}
              disabled={loading}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90"
            >
              {loading ? 'Salvando...' : selectedAppointment ? 'Salvar Alterações' : 'Criar Agendamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          {appointmentToDelete && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-gray-900">
                {appointmentToDelete.summary}
              </p>
              <p className="text-sm text-gray-600">
                {new Date(appointmentToDelete.start.dateTime).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          )}

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              onClick={() => {
                setShowDeleteModal(false)
                setAppointmentToDelete(null)
              }}
              disabled={loading}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>

            <Button
              onClick={confirmDeleteAppointment}
              disabled={loading}
              variant="destructive"
              className="w-full sm:w-auto gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {loading ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
