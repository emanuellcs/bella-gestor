import { describe, expect, it, vi } from "vitest";

import { resolveAppointmentForCheckoutAction } from "@/actions/appointment-reconciliation";

vi.mock("@/lib/supabase/appointment-reconciliation-repository", () => ({
  SupabaseAppointmentReconciliationRepository: vi.fn(),
}));

describe("appointment reconciliation actions", () => {
  it("returns a human-readable validation error for invalid checkout payloads", async () => {
    const result = await resolveAppointmentForCheckoutAction({
      id: "",
      summary: "",
      start: { dateTime: "" },
      end: { dateTime: "" },
    });

    expect(result.success).toBe(false);
    expect(result).toMatchObject({
      status: "error",
    });
    if (!result.success) {
      expect(result.error).toContain("Evento do Google");
      expect(result.error).toContain("Início do evento");
    }
  });
});
