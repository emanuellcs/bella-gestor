import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";

import { server } from "@/test/setup";

const scriptUrl = "https://script.google.test/exec";

async function loadService() {
  vi.resetModules();
  process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL = scriptUrl;
  return import("@/services/googleCalendarAppsScript");
}

describe("Google Apps Script calendar adapter", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL;
  });

  it("sends create requests to the configured script endpoint", async () => {
    let action = "";
    server.use(
      http.get(scriptUrl, ({ request }) => {
        const url = new URL(request.url);
        action = url.searchParams.get("action") ?? "";
        return HttpResponse.json({ success: true, eventId: "google-1" });
      }),
    );

    const { createCalendarEvent } = await loadService();
    const result = await createCalendarEvent({
      summary: "Maria - Limpeza",
      startTime: "2026-05-13T13:00:00.000Z",
      endTime: "2026-05-13T14:00:00.000Z",
    });

    expect(action).toBe("create");
    expect(result).toEqual({ success: true, eventId: "google-1" });
  });

  it("returns an error payload when the script endpoint fails", async () => {
    server.use(
      http.get(scriptUrl, () => HttpResponse.text("fail", { status: 500 })),
    );

    const { listCalendarEvents } = await loadService();
    const result = await listCalendarEvents();

    expect(result).toMatchObject({ success: false, events: [] });
    expect(result.error).toContain("HTTP error");
  });
});
