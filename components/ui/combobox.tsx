// components/ui/combobox.tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandEmpty,
  CommandList,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./scroll-area";

export type ComboItem = { value: string; label: string; hint?: string };

export function Combobox({
  placeholder,
  items,
  value,
  onChange,
  emptyText = "Nenhum item encontrado",
  disabled,
}: {
  placeholder: string;
  items: ComboItem[];
  value: string;
  onChange: (v: string) => void;
  emptyText?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.value === value);

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-9 overflow-hidden"
          disabled={disabled}
        >
          <span className="truncate flex-1 text-left">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
        <Command>
          <CommandInput
            placeholder={`Buscar ${placeholder.toLowerCase()}...`}
          />
          <CommandEmpty>{emptyText}</CommandEmpty>
          <CommandList>
            <ScrollArea className="max-h-[200px] overflow-y-auto">
              <CommandGroup>
                {items.map((it) => (
                  <CommandItem
                    key={it.value}
                    value={it.label}
                    onSelect={() => {
                      onChange(it.value);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center">
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === it.value ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span>{it.label}</span>
                    </div>
                    {it.hint ? (
                      <span className="text-xs text-muted-foreground">
                        {it.hint}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
