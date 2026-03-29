"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MoreVertical,
  Edit,
  Eye,
  Archive,
  Mail,
  Phone,
  Bell,
  AlertCircle,
  Plus,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Client } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";

interface VisibleColumns {
  birthDate: boolean;
  registrationDate: boolean;
  totalSpent: boolean;
  serviceLocation: boolean;
  preferredSchedule: boolean;
  referral_source: boolean;
  status: boolean;
  notes: boolean;
}

interface ClientListProps {
  clients: Client[];
  viewMode: "table" | "cards";
  gridColumns?: number;
  visibleColumns: VisibleColumns;
  selectedIds: Set<string>;
  onSelectOne: (id: string, index: number, event: unknown) => void;
  isAllSelected: boolean;
  onSelectAll: () => void;
  onView: (client: Client) => void;
  onEdit: (client: Client) => void;
  onDeactivate: (id: string) => void;
  onCreate: () => void;
}

export function ClientList({
  clients,
  viewMode,
  gridColumns = 3,
  visibleColumns,
  selectedIds,
  onSelectOne,
  isAllSelected,
  onSelectAll,
  onView,
  onEdit,
  onDeactivate,
  onCreate,
}: ClientListProps) {
  const getGridClass = () => {
    const gridMap: Record<number, string> = {
      1: "grid-cols-1",
      2: "grid-cols-1 md:grid-cols-2",
      3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
      4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
      5: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
    };
    return gridMap[gridColumns] || gridMap[3];
  };

  if (viewMode === "table") {
    return (
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b-2 border-primary/10">
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={onSelectAll}
                  className="h-5 w-5"
                />
              </TableHead>
              <TableHead className="min-w-[180px] font-semibold">
                Nome
              </TableHead>
              <TableHead className="min-w-[220px] font-semibold">
                Contato
              </TableHead>
              {visibleColumns.birthDate && <TableHead>Nascimento</TableHead>}
              {visibleColumns.registrationDate && (
                <TableHead>Cadastro</TableHead>
              )}
              {visibleColumns.totalSpent && <TableHead>Total Gasto</TableHead>}
              {visibleColumns.serviceLocation && <TableHead>Local</TableHead>}
              {visibleColumns.preferredSchedule && (
                <TableHead>Horário</TableHead>
              )}
              {visibleColumns.referral_source && (
                <TableHead>Indicação</TableHead>
              )}
              {visibleColumns.status && <TableHead>Status</TableHead>}
              {visibleColumns.notes && <TableHead>Observações</TableHead>}
              <TableHead className="w-[80px] sticky right-0 bg-background/95">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="h-64 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Nenhum cliente encontrado
                    </p>
                    <Button
                      onClick={onCreate}
                      variant="outline"
                      size="sm"
                      className="mt-2"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar cliente
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client, index) => (
                <TableRow key={client.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(client.id)}
                      onCheckedChange={(e) => onSelectOne(client.id, index, e)}
                      className="h-5 w-5"
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{client.name}</span>
                      {client.marketingConsent && (
                        <Bell className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-sm">
                      {client.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[150px]">
                            {client.email}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span>{client.phone}</span>
                      </div>
                    </div>
                  </TableCell>
                  {visibleColumns.birthDate && (
                    <TableCell>
                      {client.birthDate ? formatDate(client.birthDate) : "—"}
                    </TableCell>
                  )}
                  {visibleColumns.registrationDate && (
                    <TableCell>{formatDate(client.registrationDate)}</TableCell>
                  )}
                  {visibleColumns.totalSpent && (
                    <TableCell className="font-semibold">
                      {formatCurrency(client.totalSpent)}
                    </TableCell>
                  )}
                  {visibleColumns.serviceLocation && (
                    <TableCell>{client.serviceLocation || "—"}</TableCell>
                  )}
                  {visibleColumns.preferredSchedule && (
                    <TableCell>{client.preferredSchedule || "—"}</TableCell>
                  )}
                  {visibleColumns.referral_source && (
                    <TableCell>{client.referral_source || "—"}</TableCell>
                  )}
                  {visibleColumns.status && (
                    <TableCell>
                      <Badge
                        variant={client.isClient ? "default" : "secondary"}
                      >
                        {client.isClient ? "Comprou" : "Não comprou"}
                      </Badge>
                    </TableCell>
                  )}
                  {visibleColumns.notes && (
                    <TableCell className="max-w-[150px] truncate">
                      {client.notes || "—"}
                    </TableCell>
                  )}
                  <TableCell className="sticky right-0 bg-background/95">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(client)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(client)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDeactivate(client.id)}
                          className="text-destructive"
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          Desativar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className={`grid gap-4 p-4 ${getGridClass()}`}>
      {clients.length === 0 ? (
        <div className="col-span-full flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum cliente encontrado</p>
        </div>
      ) : (
        clients.map((client, index) => (
          <Card
            key={client.id}
            className="group relative overflow-hidden hover:shadow-lg transition-all border-2 hover:border-primary/20"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-primary/50" />
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Checkbox
                    checked={selectedIds.has(client.id)}
                    onCheckedChange={(e) => onSelectOne(client.id, index, e)}
                    className="h-5 w-5"
                  />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-lg truncate">
                      {client.name}
                    </h3>
                    <Badge
                      variant={client.isClient ? "default" : "secondary"}
                      className="mt-1"
                    >
                      {client.isClient ? "Cliente" : "Lead"}
                    </Badge>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView(client)}>
                      <Eye className="mr-2 h-4 w-4" /> Ver
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(client)}>
                      <Edit className="mr-2 h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDeactivate(client.id)}
                      className="text-destructive"
                    >
                      <Archive className="mr-2 h-4 w-4" /> Desativar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Separator className="my-3" />

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <span className="truncate">{client.email || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <span>{client.phone}</span>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total gasto</p>
                    <p className="font-bold text-primary">
                      {formatCurrency(client.totalSpent)}
                    </p>
                  </div>
                  {client.registrationDate && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Cadastro</p>
                      <p className="font-medium">
                        {formatDate(client.registrationDate)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
