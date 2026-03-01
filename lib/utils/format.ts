/**
 * Formatting utilities for Currency, Dates, Phone Numbers, and CEPs.
 */

export const SAO_TZ = "America/Sao_Paulo";

/**
 * Formats a number to BRL currency.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Formats a string or Date to Brazilian date format (DD/MM/YYYY).
 */
export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return "";

  if (input instanceof Date) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: SAO_TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(input);
  }

  const mDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (mDateOnly) {
    const [, y, mo, d] = mDateOnly;
    return `${d}/${mo}/${y}`;
  }

  const mLocal = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(input);
  const hasExplicitTZ = /Z|[+-]\d{2}:\d{2}$/.test(input);
  if (mLocal && !hasExplicitTZ) {
    const [, y, mo, d] = mLocal;
    return `${d}/${mo}/${y}`;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(input));
}

/**
 * Formats a string or Date to Brazilian date-time format (DD/MM/YYYY HH:mm).
 */
export function formatDateTime(input: string | Date | null | undefined): string {
  if (!input) return "";

  if (input instanceof Date) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: SAO_TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(input);
  }

  const mDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (mDateOnly) {
    const [, y, mo, d] = mDateOnly;
    return `${d}/${mo}/${y} 00:00`;
  }

  const mLocal = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(input);
  const hasExplicitTZ = /Z|[+-]\d{2}:\d{2}$/.test(input);
  if (mLocal && !hasExplicitTZ) {
    const [, y, mo, d, hh, mm] = mLocal;
    return `${d}/${mo}/${y} ${hh}:${mm}`;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(input));
}

/**
 * Generates current datetime in a format suitable for <input type="datetime-local">.
 */
export function zonedNowForInput(tz = SAO_TZ): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce((a: any, p) => ((a[p.type] = p.value), a), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/**
 * Formats a string into a Brazilian phone number: (XX) XXXXX-XXXX.
 */
export function formatBrazilianPhone(value: string): string {
  const numbers = value.replace(/\D/g, "");

  if (numbers.length === 0) return "";
  if (numbers.length <= 2) return `(${numbers}`;
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 10) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  }
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
}

/**
 * Extracts digits from a phone number string.
 */
export function unformatPhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

/**
 * Formats a string into a Brazilian CEP: XXXXX-XXX.
 */
export function formatCEP(value: string): string {
  const numbers = value.replace(/\D/g, "");

  if (numbers.length === 0) return "";
  if (numbers.length <= 5) return numbers;
  return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
}

/**
 * Extracts digits from a CEP string.
 */
export function unformatCEP(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

/**
 * Formats a phone number for InfinitePay standard (+55XXXXXXXXXXX).
 */
export function formatPhoneForInfinitePay(value: string): string {
  const numbers = unformatPhone(value);
  if (numbers.length < 10) return "";
  return `+55${numbers}`;
}
