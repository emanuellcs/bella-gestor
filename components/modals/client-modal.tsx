"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useData } from "@/lib/data-context"
import type { Client } from "@/lib/types"
import { Loader2, Save, X, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatDate } from "@/lib/utils"

interface ClientModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client?: Client | null
  mode: "create" | "edit" | "view"
}

export function ClientModal({ open, onOpenChange, client, mode }: ClientModalProps) {
  const { addClient, updateClient } = useData()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    birthDate: "",
    serviceLocation: "",
    preferredSchedule: "",
    referralSource: "",
    notes: "",
    services: "",
    status: "active" as "active" | "inactive",
    marketingConsent: false,
    isClient: false,
  })

  useEffect(() => {
    if (open && client && (mode === "edit" || mode === "view")) {
      setFormData({
        name: client.name || "",
        email: client.email || "",
        phone: formatPhoneBR(client.phone || ""),
        birthDate: client.birthDate || "",
        serviceLocation: client.serviceLocation || "",
        preferredSchedule: client.preferredSchedule || "",
        referralSource: client.referralSource || "",
        notes: client.notes || "",
        services: client.services || "",
        status: client.status || "active",
        marketingConsent: client.marketingConsent || false,
        isClient: client.isClient || false,
      })
    } else if (open && mode === "create") {
      setFormData({
        name: "",
        email: "",
        phone: "",
        birthDate: "",
        serviceLocation: "",
        preferredSchedule: "",
        referralSource: "",
        notes: "",
        services: "",
        status: "active",
        marketingConsent: false,
        isClient: false,
      })
    }

    setValidationErrors({})
  }, [client, mode, open])

  const formatPhoneBR = (value: string): string => {
    const numbers = value.replace(/\D/g, "")
    const limited = numbers.slice(0, 11)

    if (limited.length <= 2) {
      return limited
    } else if (limited.length <= 6) {
      return limited.replace(/^(\d{2})(\d{0,4})/, "($1) $2")
    } else if (limited.length <= 10) {
      return limited.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3")
    } else {
      return limited.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
    }
  }

  const validatePhoneBR = (phone: string): boolean => {
    const numbers = phone.replace(/\D/g, "")
    return numbers.length === 10 || numbers.length === 11
  }

  const validateEmail = (email: string): boolean => {
    if (!email || email.trim() === "") return true
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    return emailRegex.test(email)
  }

  const cleanPhone = (phone: string): string => {
    return phone.replace(/\D/g, "")
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneBR(e.target.value)
    handleInputChange("phone", formatted)
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.name.trim()) {
      errors.name = "Nome é obrigatório"
    } else if (formData.name.trim().length < 3) {
      errors.name = "Nome deve ter pelo menos 3 caracteres"
    }

    if (!formData.phone.trim()) {
      errors.phone = "Telefone é obrigatório"
    } else if (!validatePhoneBR(formData.phone)) {
      errors.phone = "Telefone inválido. Use o formato (XX) XXXXX-XXXX"
    }

    if (formData.email && !validateEmail(formData.email)) {
      errors.email = "Email inválido"
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      toast({
        title: "Erro de validação",
        description: "Por favor, corrija os campos destacados.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const dataToSubmit = {
        ...formData,
        phone: cleanPhone(formData.phone),
      }

      if (mode === "create") {
        const result = await addClient(dataToSubmit)
        if (result) {
          toast({
            title: "Cliente criado",
            description: "O cliente foi criado com sucesso.",
          })
          onOpenChange(false)
        }
      } else if (mode === "edit" && client) {
        const result = await updateClient(client.id, dataToSubmit)
        if (result) {
          toast({
            title: "Cliente atualizado",
            description: "Os dados do cliente foram atualizados com sucesso.",
          })
          onOpenChange(false)
        }
      }
    } catch (error: any) {
      console.error("Error submitting form:", error)
      const errorTitle = error?.title || "Erro ao processar"
      const errorMessage = error?.message || "Ocorreu um erro inesperado."
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const isReadOnly = mode === "view"
  const modalTitle =
    mode === "create" ? "Novo Cliente" : mode === "edit" ? "Editar Cliente" : "Detalhes do Cliente"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
          <DialogDescription>
            {mode === "create" && "Preencha os dados para cadastrar um novo cliente no sistema."}
            {mode === "edit" && "Atualize as informações do cliente conforme necessário."}
            {mode === "view" && "Visualize todas as informações do cliente."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="basico" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basico">Básico</TabsTrigger>
              <TabsTrigger value="adicional">Adicional</TabsTrigger>
              <TabsTrigger value="preferencias">Preferências</TabsTrigger>
            </TabsList>

            <TabsContent value="basico" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Nome Completo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Ex: Maria Silva Santos"
                  readOnly={isReadOnly}
                  className={`${validationErrors.name ? "border-destructive" : ""} ${isReadOnly ? "bg-muted/30 cursor-default" : ""}`}
                />
                {validationErrors.name && (
                  <p className="text-sm text-destructive">{validationErrors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="maria@exemplo.com"
                    readOnly={isReadOnly}
                    className={`${validationErrors.email ? "border-destructive" : ""} ${isReadOnly ? "bg-muted/30 cursor-default" : ""}`}
                  />
                  {validationErrors.email && (
                    <p className="text-sm text-destructive">{validationErrors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">
                    Telefone <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    placeholder="(85) 95432-1098"
                    readOnly={isReadOnly}
                    className={`${validationErrors.phone ? "border-destructive" : ""} ${isReadOnly ? "bg-muted/30 cursor-default" : ""}`}
                  />
                  {validationErrors.phone && (
                    <p className="text-sm text-destructive">{validationErrors.phone}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Formato: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Data de Nascimento</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => handleInputChange("birthDate", e.target.value)}
                    readOnly={isReadOnly}
                    className={isReadOnly ? "bg-muted/30 cursor-default" : ""}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  {isReadOnly ? (
                    <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
                      {formData.status === "active" ? "Ativo" : "Inativo"}
                    </div>
                  ) : (
                    <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  placeholder="Adicione observações relevantes sobre o cliente..."
                  readOnly={isReadOnly}
                  className={isReadOnly ? "bg-muted/30 cursor-default resize-none" : ""}
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="adicional" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="serviceLocation">Local de Atendimento</Label>
                <Input
                  id="serviceLocation"
                  value={formData.serviceLocation}
                  onChange={(e) => handleInputChange("serviceLocation", e.target.value)}
                  placeholder="Ex: Clínica, Domicílio, Estúdio"
                  readOnly={isReadOnly}
                  className={isReadOnly ? "bg-muted/30 cursor-default" : ""}
                />
                <p className="text-xs text-muted-foreground">
                  Onde o cliente prefere ser atendido
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferredSchedule">Horário Preferencial</Label>
                <Input
                  id="preferredSchedule"
                  value={formData.preferredSchedule}
                  onChange={(e) => handleInputChange("preferredSchedule", e.target.value)}
                  placeholder="Ex: Manhã (8h-12h), Tarde (14h-18h)"
                  readOnly={isReadOnly}
                  className={isReadOnly ? "bg-muted/30 cursor-default" : ""}
                />
                <p className="text-xs text-muted-foreground">
                  Melhor horário para agendamentos
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="referralSource">Como Conheceu</Label>
                {isReadOnly ? (
                  <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
                    {formData.referralSource || "—"}
                  </div>
                ) : (
                  <Select
                    value={formData.referralSource}
                    onValueChange={(value) => handleInputChange("referralSource", value)}
                  >
                    <SelectTrigger id="referralSource">
                      <SelectValue placeholder="Selecione uma opção" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Orgânico Instagram">Orgânico Instagram</SelectItem>
                      <SelectItem value="Tráfego Instagram">Tráfego Instagram</SelectItem>
                      <SelectItem value="Tv Barueri">Tv Barueri</SelectItem>
                      <SelectItem value="Fachada">Fachada</SelectItem>
                      <SelectItem value="Indicação">Indicação</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">Origem do lead</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="services">Serviços de Interesse</Label>
                <Textarea
                  id="services"
                  value={formData.services}
                  onChange={(e) => handleInputChange("services", e.target.value)}
                  placeholder="Liste os serviços que o cliente demonstrou interesse..."
                  readOnly={isReadOnly}
                  className={isReadOnly ? "bg-muted/30 cursor-default resize-none" : ""}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Tratamentos ou procedimentos de interesse
                </p>
              </div>
            </TabsContent>

            <TabsContent value="preferencias" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="marketingConsent" className="text-base">
                      Consentimento de Marketing
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Cliente autoriza receber comunicações promocionais via WhatsApp, email e SMS
                    </p>
                  </div>
                  <Switch
                    id="marketingConsent"
                    checked={formData.marketingConsent}
                    onCheckedChange={(checked) => handleInputChange("marketingConsent", checked)}
                    disabled={isReadOnly}
                  />
                </div>

                <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="isClient" className="text-base">
                      Cliente Ativo
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Marca se o cliente já realizou pelo menos um atendimento
                    </p>
                  </div>
                  <Switch
                    id="isClient"
                    checked={formData.isClient}
                    onCheckedChange={(checked) => handleInputChange("isClient", checked)}
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              {client && mode !== "create" && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <h4 className="font-semibold text-sm">Informações do Sistema</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Data de Cadastro:</span>
                      <div className="font-medium">
                        {client.registrationDate ? formatDate(client.registrationDate) : "N/A"}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Última Visita:</span>
                      <div className="font-medium">
                        {client.lastVisit ? formatDate(client.lastVisit) : "Nunca"}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Total Gasto:</span>
                      <div className="font-medium text-lg">
                        R$ {client.totalSpent.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {Object.keys(validationErrors).length > 0 && !isReadOnly && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Existem erros no formulário. Por favor, corrija os campos destacados.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter className="mt-6">
            {!isReadOnly ? (
              <>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {mode === "create" ? "Criar Cliente" : "Salvar Alterações"}
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button type="button" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
