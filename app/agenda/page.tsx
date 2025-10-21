'use client'

import { useState, useEffect } from 'react'
import { useData } from '@/lib/data-context'
import { useGoogleCalendar } from '@/lib/google-calendar-context'
import {
  syncAppointmentToGoogleCalendar,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getAppointmentsByDateRange,
} from '@/services/api'
import { Appointment, AppointmentStatus } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Calendar, Plus, ChevronLeft, ChevronRight, Clock, User, Trash2, AlertCircle, CalendarX } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

type ViewMode = 'day' | 'week' | 'month'

interface AppointmentFormData {
  clientId: string
  startTime: string
  endTime: string
  status: AppointmentStatus
  notes: string
}

export default function AgendaPage() {
  const { clients } = useData()
  const { isConnected, accessToken, refreshToken, connect, disconnect } = useGoogleCalendar()
  
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)
  const [disconnectConfirmText, setDisconnectConfirmText] = useState('')
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [syncWithGoogle, setSyncWithGoogle] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<AppointmentFormData>({
    clientId: '',
    startTime: '',
    endTime: '',
    status: AppointmentStatus.SCHEDULED,
    notes: '',
  })

  useEffect(() => {
    loadAppointments()
  }, [currentDate, viewMode])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const googleConnected = params.get('google_connected')
    const error = params.get('error')

    if (error) {
      alert('Erro ao conectar com o Google Calendar. Tente novamente.')
      window.history.replaceState({}, '', '/agenda')
      return
    }

    if (googleConnected === 'true') {
      window.history.replaceState({}, '', '/agenda')
      window.dispatchEvent(new Event('google-calendar-connected'))
    }
  }, [])

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

  function getDayName(date: Date): string {
    return date.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase()
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  async function loadAppointments() {
    setLoading(true)
    try {
      const { start, end } = getDateRange()
      const data = await getAppointmentsByDateRange(
        start.toISOString(),
        end.toISOString()
      )
      setAppointments(data)
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error)
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
      startTime: '',
      endTime: '',
      status: AppointmentStatus.SCHEDULED,
      notes: '',
    })
    setShowModal(true)
  }

  function openEditAppointmentModal(appointment: Appointment) {
    setSelectedAppointment(appointment)
    setFormData({
      clientId: appointment.clientId,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      status: appointment.status,
      notes: appointment.notes || '',
    })
    setShowModal(true)
  }

  async function handleSaveAppointment() {
    if (!formData.clientId || !formData.startTime || !formData.endTime) {
      alert('Preencha todos os campos obrigatórios')
      return
    }

    setLoading(true)
    
    try {
      let savedAppointment: Appointment | null = null

      if (selectedAppointment) {
        savedAppointment = await updateAppointment(selectedAppointment.id, {
          clientId: formData.clientId,
          startTime: formData.startTime,
          endTime: formData.endTime,
          status: formData.status,
          notes: formData.notes,
        })
      } else {
        savedAppointment = await createAppointment({
          clientId: formData.clientId,
          clientName: clients.find(c => c.id === formData.clientId)?.name || '',
          professionalId: 'user-1',
          serviceVariants: [],
          startTime: formData.startTime,
          endTime: formData.endTime,
          status: formData.status,
          notes: formData.notes,
          totalPrice: 0,
          createdAt: new Date().toISOString(),
        })
      }

      if (savedAppointment && syncWithGoogle && isConnected && accessToken && refreshToken) {
        const client = clients.find(c => c.id === formData.clientId)
        
        if (client) {
          if (selectedAppointment?.googleCalendarEventId) {
            await updateGoogleCalendarEvent(
              selectedAppointment.googleCalendarEventId,
              savedAppointment,
              client,
              accessToken,
              refreshToken
            )
          } else {
            const googleEventId = await syncAppointmentToGoogleCalendar(
              savedAppointment,
              client,
              accessToken,
              refreshToken
            )
            
            if (googleEventId) {
              await updateAppointment(savedAppointment.id, {
                googleCalendarEventId: googleEventId,
              })
            }
          }
        }
      }

      setShowModal(false)
      await loadAppointments()
    } catch (error) {
      console.error('Erro ao salvar agendamento:', error)
      alert('Erro ao salvar agendamento. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteAppointment(appointment: Appointment) {
    if (!confirm('Deseja realmente excluir este agendamento?')) return

    setLoading(true)
    
    try {
      if (appointment.googleCalendarEventId && isConnected && accessToken && refreshToken) {
        await deleteGoogleCalendarEvent(
          appointment.googleCalendarEventId,
          accessToken,
          refreshToken
        )
      }

      await deleteAppointment(appointment.id)
      setShowModal(false)
      await loadAppointments()
    } catch (error) {
      console.error('Erro ao excluir agendamento:', error)
      alert('Erro ao excluir agendamento. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnectGoogle() {
    if (disconnectConfirmText !== 'DESCONECTAR') {
      alert('Digite "DESCONECTAR" para confirmar')
      return
    }

    setLoading(true)
    try {
      await disconnect()
      setShowDisconnectModal(false)
      setDisconnectConfirmText('')
    } catch (error) {
      console.error('Erro ao desconectar:', error)
      alert('Erro ao desconectar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  function getAppointmentsForDay(date: Date): Appointment[] {
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)
    
    return appointments.filter(apt => {
      const aptDate = new Date(apt.startTime)
      return aptDate >= dayStart && aptDate <= dayEnd
    })
  }

  function getStatusVariant(status: AppointmentStatus): "default" | "secondary" | "destructive" | "outline" {
    const variants = {
      [AppointmentStatus.SCHEDULED]: "default" as const,
      [AppointmentStatus.CONFIRMED]: "secondary" as const,
      [AppointmentStatus.COMPLETED]: "outline" as const,
      [AppointmentStatus.CANCELLED]: "destructive" as const,
    }
    return variants[status] || "default"
  }

  function getStatusLabel(status: AppointmentStatus): string {
    const labels: Record<AppointmentStatus, string> = {
      [AppointmentStatus.SCHEDULED]: 'Agendado',
      [AppointmentStatus.CONFIRMED]: 'Confirmado',
      [AppointmentStatus.COMPLETED]: 'Concluído',
      [AppointmentStatus.CANCELLED]: 'Cancelado',
    }
    return labels[status] || status
  }

  function getViewModeLabel(mode: ViewMode): string {
    const labels = {
      day: 'Hoje',
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground">Gerencie seus agendamentos</p>
        </div>
        
        <div className="flex items-center gap-3">
          {!isConnected ? (
            <Button onClick={connect} variant="outline" className="gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Conectar Google Agenda
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-2">
                <Calendar className="h-3 w-3" />
                Conectado
              </Badge>
              <Button 
                onClick={() => setShowDisconnectModal(true)} 
                variant="ghost" 
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                Desconectar
              </Button>
            </div>
          )}

          <Button onClick={openNewAppointmentModal} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button onClick={handlePrevious} variant="outline" size="icon" disabled={loading}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Button onClick={handleToday} variant="outline" disabled={loading}>
                Hoje
              </Button>

              <Button onClick={handleNext} variant="outline" size="icon" disabled={loading}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <CardTitle className="text-lg capitalize">{formatDateRange()}</CardTitle>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  {getViewModeLabel(viewMode)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setViewMode('day')}>
                  Hoje
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
        </CardHeader>

        <CardContent className="p-0">
          {viewMode === 'month' ? (
            <>
              <div className="grid grid-cols-7 border-t">
                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((day, index) => (
                  <div
                    key={index}
                    className="p-2 text-center border-r last:border-r-0 bg-muted/50"
                  >
                    <div className="text-xs font-medium text-muted-foreground">{day}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {displayDates.map((date, index) => {
                  const dayAppointments = getAppointmentsForDay(date)
                  const isCurrentMonthDay = isCurrentMonth(date)
                  
                  return (
                    <div
                      key={index}
                      className={`min-h-[120px] p-2 border-r border-t last:border-r-0 ${
                        !isCurrentMonthDay ? 'bg-muted/30' : ''
                      }`}
                    >
                      <div className={`text-sm font-medium mb-1 ${
                        isToday(date) 
                          ? 'text-primary font-bold' 
                          : !isCurrentMonthDay
                          ? 'text-muted-foreground'
                          : ''
                      }`}>
                        {date.getDate()}
                      </div>
                      {dayAppointments.length > 0 ? (
                        <div className="space-y-1">
                          {dayAppointments.slice(0, 3).map((appointment) => (
                            <div
                              key={appointment.id}
                              className="text-xs p-1 bg-primary/10 rounded cursor-pointer hover:bg-primary/20"
                              onClick={() => openEditAppointmentModal(appointment)}
                            >
                              <div className="font-medium truncate">
                                {new Date(appointment.startTime).toLocaleTimeString('pt-BR', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </div>
                              <div className="truncate">{appointment.clientName}</div>
                            </div>
                          ))}
                          {dayAppointments.length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              +{dayAppointments.length - 3} mais
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <div className={`grid ${viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-1'} border-t`}>
                {displayDates.map((date, index) => (
                  <div
                    key={index}
                    className="border-r last:border-r-0 p-4 text-center"
                  >
                    {viewMode === 'week' && (
                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        {getDayName(date)}
                      </div>
                    )}
                    <div className={`text-2xl font-bold ${
                      isToday(date) ? 'text-primary' : ''
                    }`}>
                      {date.getDate()}
                    </div>
                  </div>
                ))}
              </div>

              <div className={`grid ${viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-1'} border-t min-h-[500px]`}>
                {displayDates.map((date, index) => {
                  const dayAppointments = getAppointmentsForDay(date)
                  
                  return (
                    <div
                      key={index}
                      className="border-r last:border-r-0 p-3 bg-muted/30"
                    >
                      {dayAppointments.length === 0 ? (
                        <Alert className="border-dashed">
                          <CalendarX className="h-4 w-4" />
                          <AlertTitle className="text-sm">Sem agendamentos</AlertTitle>
                          <AlertDescription className="text-xs">
                            Nenhum agendamento para este dia
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="space-y-2">
                          {dayAppointments.map((appointment) => (
                            <Card
                              key={appointment.id}
                              className="cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => openEditAppointmentModal(appointment)}
                            >
                              <CardContent className="p-3 space-y-2">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {new Date(appointment.startTime).toLocaleTimeString('pt-BR', { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </div>
                                  {appointment.googleCalendarEventId && (
                                    <Calendar className="h-3 w-3 text-primary" />
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <p className="font-semibold text-sm truncate">
                                    {appointment.clientName}
                                  </p>
                                </div>
                                
                                <Badge variant={getStatusVariant(appointment.status)} className="text-xs">
                                  {getStatusLabel(appointment.status)}
                                </Badge>

                                {appointment.notes && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {appointment.notes}
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}
            </DialogTitle>
            <DialogDescription>
              {selectedAppointment ? 'Atualize as informações do agendamento' : 'Preencha os dados para criar um novo agendamento'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedAppointment?.googleCalendarEventId && (
              <Alert>
                <Calendar className="h-4 w-4" />
                <AlertDescription>
                  Este agendamento está sincronizado com o Google Agenda
                </AlertDescription>
              </Alert>
            )}

            {isConnected && !selectedAppointment?.googleCalendarEventId && (
              <Alert>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="syncGoogle"
                    checked={syncWithGoogle}
                    onCheckedChange={(checked) => setSyncWithGoogle(checked as boolean)}
                  />
                  <div className="space-y-1">
                    <label
                      htmlFor="syncGoogle"
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      Sincronizar com Google Agenda
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Este agendamento será automaticamente adicionado ao Google Calendar
                    </p>
                  </div>
                </div>
              </Alert>
            )}

            {!isConnected && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Conecte sua conta do Google para sincronizar agendamentos automaticamente
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="client">Cliente *</Label>
              <Select
                value={formData.clientId}
                onValueChange={(value) => setFormData({ ...formData, clientId: value })}
              >
                <SelectTrigger id="client">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Data e Hora de Início *</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endTime">Data e Hora de Término *</Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as AppointmentStatus })}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AppointmentStatus.SCHEDULED}>Agendado</SelectItem>
                  <SelectItem value={AppointmentStatus.CONFIRMED}>Confirmado</SelectItem>
                  <SelectItem value={AppointmentStatus.COMPLETED}>Concluído</SelectItem>
                  <SelectItem value={AppointmentStatus.CANCELLED}>Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
                placeholder="Adicione observações sobre o agendamento..."
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between">
            <div>
              {selectedAppointment && (
                <Button
                  onClick={() => handleDeleteAppointment(selectedAppointment)}
                  disabled={loading}
                  variant="destructive"
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={() => setShowModal(false)} disabled={loading} variant="outline">
                Cancelar
              </Button>
              <Button onClick={handleSaveAppointment} disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDisconnectModal} onOpenChange={setShowDisconnectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar Google Agenda</DialogTitle>
            <DialogDescription>
              Esta ação irá remover a sincronização com o Google Calendar. Os agendamentos criados anteriormente permanecerão no Google Calendar, mas novos agendamentos não serão sincronizados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Atenção</AlertTitle>
              <AlertDescription>
                Esta ação não pode ser desfeita automaticamente. Você precisará reconectar sua conta do Google para continuar sincronizando.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="confirmText">
                Digite <strong>DESCONECTAR</strong> para confirmar
              </Label>
              <Input
                id="confirmText"
                value={disconnectConfirmText}
                onChange={(e) => setDisconnectConfirmText(e.target.value)}
                placeholder="DESCONECTAR"
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              onClick={() => {
                setShowDisconnectModal(false)
                setDisconnectConfirmText('')
              }} 
              disabled={loading} 
              variant="outline"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleDisconnectGoogle} 
              disabled={loading || disconnectConfirmText !== 'DESCONECTAR'}
              variant="destructive"
            >
              {loading ? 'Desconectando...' : 'Desconectar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
