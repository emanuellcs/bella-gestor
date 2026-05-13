import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAppointmentAction,
  updateAppointmentAction,
} from "@/actions/appointments";
import {
  createClientAction,
  deactivateClientAction,
} from "@/actions/clients";
import {
  getAppOptionsAction,
  updateAppSettingAction,
  upsertAppOptionAction,
} from "@/actions/options";
import { createProfessionalAction } from "@/actions/professionals";
import { createServiceAction, deleteServiceAction } from "@/actions/services";
import { AppRole, AppointmentStatus, SaleStatus } from "@/types";
import { dbFactories } from "@/test/factories";
import {
  createSupabaseMock,
  tableRows,
  type MockSupabaseClient,
} from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn<() => MockSupabaseClient>(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: mocks.getSupabaseAdmin,
}));

describe("entity server actions", () => {
  let supabase: MockSupabaseClient;

  beforeEach(() => {
    supabase = createSupabaseMock({
      mode: "admin",
      tables: {
        app_options: [dbFactories.appOption()],
        app_settings: [],
        clients: [dbFactories.client()],
        professionals: [],
        services: [dbFactories.service()],
        service_variants: [dbFactories.serviceVariant()],
        appointments: [dbFactories.appointment()],
        sales: [dbFactories.sale()],
      },
      rpc: {
        create_appointment_with_sale: () => dbFactories.appointment({ id: 101 }),
      },
    });
    mocks.getSupabaseAdmin.mockReturnValue(supabase);
  });

  it("creates clients through the domain-to-database mapper", async () => {
    const result = await createClientAction({
      name: "Carla",
      phone: "(11) 98888-7777",
      email: "carla@example.com",
      marketingConsent: true,
      isClient: true,
    });

    expect(result.success).toBe(true);
    expect(tableRows(supabase, "clients")[1]).toMatchObject({
      full_name: "Carla",
      phone: "(11) 98888-7777",
      marketing_consent: true,
      is_client: true,
    });
  });

  it("deactivates clients without hard-deleting the row", async () => {
    const result = await deactivateClientAction("10");

    expect(result.success).toBe(true);
    expect(tableRows(supabase, "clients")[0]).toMatchObject({
      is_active: false,
      deleted_at: null,
    });
  });

  it("creates services with variants and soft-deletes services with their variants", async () => {
    const createResult = await createServiceAction({
      name: "Drenagem",
      description: "",
      category: "Corpo",
      active: true,
      variants: [
        {
          variantName: "Sessao",
          price: 150,
          duration: 50,
          active: true,
        },
      ],
    });

    expect(createResult.success).toBe(true);
    expect(tableRows(supabase, "services")[1]).toMatchObject({
      name: "Drenagem",
      category: "Corpo",
    });
    expect(tableRows(supabase, "service_variants")[1]).toMatchObject({
      variant_name: "Sessao",
      price: 150,
    });

    const deleteResult = await deleteServiceAction("20");
    expect(deleteResult.success).toBe(true);
    expect(tableRows(supabase, "services")[0].deleted_at).toEqual(
      expect.any(String),
    );
    expect(tableRows(supabase, "service_variants")[0].deleted_at).toEqual(
      expect.any(String),
    );
  });

  it("creates professionals with role and commission metadata", async () => {
    const result = await createProfessionalAction({
      name: "Bianca",
      email: "bianca@example.com",
      functionTitle: "Esteticista",
      role: AppRole.PROFESSIONAL,
      commissionPct: 60,
    });

    expect(result.success).toBe(true);
    expect(tableRows(supabase, "professionals")[0]).toMatchObject({
      full_name: "Bianca",
      role: AppRole.PROFESSIONAL,
      commission_pct: 60,
    });
  });

  it("keeps options and settings writes isolated to their own tables", async () => {
    const options = await getAppOptionsAction();
    const option = await upsertAppOptionAction({
      option_type: "service_category",
      label: "Face",
      value: "face",
    });
    const setting = await updateAppSettingAction(
      "default_commission_pct",
      "70",
    );

    expect(options.success).toBe(true);
    expect(option.success).toBe(true);
    expect(setting.success).toBe(true);
    expect(tableRows(supabase, "app_options")[1]).toMatchObject({
      option_type: "service_category",
    });
    expect(tableRows(supabase, "app_settings")[0]).toMatchObject({
      key: "default_commission_pct",
      value: "70",
    });
  });

  it("creates appointments through the deployed atomic RPC contract", async () => {
    const result = await createAppointmentAction({
      clientId: "10",
      professionalId: "prof-1",
      startTime: "2026-05-13T13:00:00.000Z",
      endTime: "2026-05-13T14:00:00.000Z",
      status: AppointmentStatus.SCHEDULED,
      notes: "Teste",
      googleEventId: "google-1",
      serviceVariants: [
        { serviceVariantId: "55", quantity: 1, unitPrice: 120 },
      ],
      totalPrice: 120,
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      id: "101",
      googleEventId: "google-1",
    });
  });

  it("cancels the linked sale when an appointment is cancelled", async () => {
    const result = await updateAppointmentAction("100", {
      status: AppointmentStatus.CANCELLED,
    });

    expect(result.success).toBe(true);
    expect(tableRows(supabase, "sales")[0]).toMatchObject({
      status: SaleStatus.CANCELLED,
    });
  });
});
