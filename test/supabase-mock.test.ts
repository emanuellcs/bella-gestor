import { describe, expect, it } from "vitest";

import { AppRole } from "@/types";
import { dbFactories } from "@/test/factories";
import { createSupabaseMock, tableRows } from "@/test/supabase-mock";

describe("in-memory Supabase mock RLS", () => {
  it("lets service-role admin bypass RLS", async () => {
    const supabase = createSupabaseMock({
      mode: "admin",
      tables: {
        payments: [dbFactories.payment()],
      },
    });

    const result = await supabase
      .from("payments")
      .update({ status: "cancelled" })
      .eq("id", 800)
      .select("*")
      .single();

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({ status: "cancelled" });
  });

  it("denies professional writes to finance tables", async () => {
    const supabase = createSupabaseMock({
      mode: "authenticated",
      user: { id: "prof-1", role: AppRole.PROFESSIONAL },
      tables: { payments: [] },
    });

    const result = await supabase.from("payments").insert({
      sale_id: 900,
      amount: 120,
      status: "paid",
    });

    expect(result.error).toMatchObject({ code: "42501", status: 403 });
    expect(tableRows(supabase, "payments")).toHaveLength(0);
  });

  it("allows professionals to view only their own appointments", async () => {
    const supabase = createSupabaseMock({
      mode: "authenticated",
      user: { id: "prof-1", role: AppRole.PROFESSIONAL },
      tables: {
        appointments: [
          dbFactories.appointment({ id: 100, professional_id: "prof-1" }),
          dbFactories.appointment({ id: 101, professional_id: "prof-2" }),
        ],
      },
    });

    const result = await supabase.from("appointments").select("*");

    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      expect.objectContaining({ id: 100, professional_id: "prof-1" }),
    ]);
  });

  it("allows secretary operational writes but denies hard deletes", async () => {
    const supabase = createSupabaseMock({
      mode: "authenticated",
      user: { id: "sec-1", role: AppRole.SECRETARY },
      tables: {
        services: [dbFactories.service()],
      },
    });

    const updateResult = await supabase
      .from("services")
      .update({ name: "Novo nome" })
      .eq("id", 20)
      .select("*")
      .single();
    const deleteResult = await supabase.from("services").delete().eq("id", 20);

    expect(updateResult.error).toBeNull();
    expect(updateResult.data).toMatchObject({ name: "Novo nome" });
    expect(deleteResult.error).toMatchObject({ code: "42501" });
  });
});
