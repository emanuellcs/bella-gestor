"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  User,
  Phone,
  Calendar as CalendarIcon,
  Trash2,
  Edit,
  RefreshCw,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppointmentStatus } from "@/types";

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string };
  end: { dateTime: string };
  htmlLink?: string;
  internalStatus?: AppointmentStatus;
}

interface CalendarViewProps {
  currentDate: Date;
  events: GoogleCalendarEvent[];
  isLoading: boolean;
  onEdit?: (event: GoogleCalendarEvent) => void;
  onDelete?: (event: GoogleCalendarEvent) => void;
  onCheckout?: (event: GoogleCalendarEvent) => void;
}

export function CalendarView({
  currentDate,
  events,
  isLoading,
  onEdit,
  onDelete,
  onCheckout,
}: CalendarViewProps) {
  const getWeekRange = (date: Date) => {
    const start = new Date(date);
    const dow = (start.getDay() + 7) % 7;
    const diff = start.getDate() - dow;
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const weekDays = useMemo(() => {
    const start = getWeekRange(currentDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const isSameDate = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const getEventsForDay = (date: Date) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return events.filter((ev) => {
      const d = new Date(ev.start.dateTime);
      return d >= start && d <= end;
    });
  };

  const parseField = (desc: string | undefined, label: string) => {
    const line = (desc || "").split("\n").find((p) => p.startsWith(label));
    return line ? line.replace(label, "").trim() : "";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <RefreshCw className="h-4 w-4 animate-spin" /> Carregando
              agendamentos...
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {weekDays.map((date) => {
                const dayEvents = getEventsForDay(date);
                const today = isSameDate(date, new Date());

                return (
                  <div
                    key={date.getTime()}
                    className="border rounded-md overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
                      <div className="flex items-center gap-2">
                        <Badge variant={today ? "default" : "secondary"}>
                          {date
                            .toLocaleDateString("pt-BR", { weekday: "short" })
                            .toUpperCase()}
                        </Badge>
                        <div className="font-semibold">
                          {date.toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                    </div>

                    {dayEvents.length === 0 ? (
                      <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                        Nenhum agendamento
                      </div>
                    ) : (
                      <ul className="divide-y">
                        {dayEvents.map((ev) => {
                          const clientName = parseField(
                            ev.description,
                            "Cliente: ",
                          );
                          const phone = parseField(
                            ev.description,
                            "Telefone: ",
                          );
                          const professionalText = parseField(
                            ev.description,
                            "Profissional: ",
                          );
                          const eventDate = new Date(ev.start.dateTime);

                          // Corrected Logic (FIX 4): Only show for 'scheduled' status when past due
                          const isScheduled =
                            ev.internalStatus === AppointmentStatus.SCHEDULED ||
                            !ev.internalStatus;
                          const isPastDue =
                            eventDate < new Date() && isScheduled;

                          return (
                            <li
                              key={ev.id}
                              className={`px-3 py-3 hover:bg-muted/30 transition ${isPastDue ? "bg-orange-50/40" : ""}`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                  <div
                                    className={`rounded p-2 ${isPastDue ? "bg-orange-100" : "bg-primary/10"}`}
                                  >
                                    <Clock
                                      className={`h-4 w-4 ${isPastDue ? "text-orange-600" : "text-primary"}`}
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium truncate flex items-center gap-2">
                                      {eventDate.toLocaleTimeString("pt-BR", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                      {isPastDue && (
                                        <Badge className="bg-orange-100 text-orange-700 text-[9px] h-4 border-orange-200">
                                          PENDENTE
                                        </Badge>
                                      )}
                                      {ev.internalStatus ===
                                        AppointmentStatus.COMPLETED && (
                                        <Badge className="bg-green-100 text-green-700 text-[9px] h-4 border-green-200">
                                          FINALIZADO
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      {ev.summary}
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground uppercase font-medium">
                                      {clientName && (
                                        <span className="flex items-center gap-1">
                                          <User className="h-3 w-3" />{" "}
                                          {clientName}
                                        </span>
                                      )}
                                      {phone && (
                                        <span className="flex items-center gap-1 text-muted-foreground/70">
                                          <Phone className="h-2.5 w-2.5" />{" "}
                                          {phone}
                                        </span>
                                      )}
                                      {professionalText && (
                                        <span className="bg-muted px-1.5 rounded">
                                          {professionalText}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {isPastDue && onCheckout && (
                                    <Button
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700 text-white font-bold h-8 text-xs"
                                      onClick={() => onCheckout(ev)}
                                    >
                                      Finalizar e Pagar
                                    </Button>
                                  )}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() => onEdit?.(ev)}
                                      >
                                        <Edit className="h-4 w-4 mr-2" /> Editar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          window.open(
                                            ev.htmlLink || "#",
                                            "_blank",
                                            "noopener,noreferrer",
                                          )
                                        }
                                      >
                                        <CalendarIcon className="h-4 w-4 mr-2" />{" "}
                                        Ver no Google
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => onDelete?.(ev)}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />{" "}
                                        Excluir
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
