import { beforeEach, describe, expect, it, vi } from "vitest";

import { getClientById, getActiveClients } from "@/services/clients";
import { getServices, getActiveServices } from "@/services/services";
import { AppRole } from "@/types";
import { dbFactories } from "@/test/factories";
import {
  createSupabaseMock,
  type MockSupabaseClient,
} from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({
  supabase: undefined as MockSupabaseClient | undefined,
}));

vi.mock("@/lib/supabase/client", () => ({
  get supabase() {
    return mocks.supabase;
  },
}));

describe("entity services", () => {
  beforeEach(() => {
    mocks.supabase = createSupabaseMock({
      mode: "authenticated",
      user: { id: "sec-1", role: AppRole.SECRETARY },
      tables: {
        clients: [
          dbFactories.client({ id: 10, is_active: true }),
          dbFactories.client({ id: 11, is_active: false }),
        ],
        services: [
          dbFactories.service({ id: 20, is_active: true }),
          dbFactories.service({ id: 21, is_active: false }),
        ],
        service_variants: [
          dbFactories.serviceVariant({ id: 55, service_id: 20 }),
          dbFactories.serviceVariant({
            id: 56,
            service_id: 20,
            deleted_at: "2026-05-13T12:00:00.000Z",
          }),
          dbFactories.serviceVariant({
            id: 57,
            service_id: 21,
            is_active: false,
          }),
        ],
      },
    });
  });

  it("maps active clients from paginated Supabase rows", async () => {
    const clients = await getActiveClients();

    expect(clients).toHaveLength(1);
    expect(clients[0]).toMatchObject({
      id: "10",
      name: "Maria Silva",
      status: "active",
    });
  });

  it("returns null for missing client rows instead of throwing", async () => {
    const client = await getClientById("999");

    expect(client).toBeNull();
  });

  it("maps services and filters soft-deleted variants", async () => {
    const services = await getServices();

    expect(services[0]).toMatchObject({
      id: "20",
      variants: [expect.objectContaining({ id: "55" })],
    });
  });

  it("returns only active services with active variants for public scheduling", async () => {
    const services = await getActiveServices();

    expect(services).toHaveLength(1);
    expect(services[0]).toMatchObject({
      id: "20",
      active: true,
      variants: [expect.objectContaining({ id: "55", active: true })],
    });
  });
});
