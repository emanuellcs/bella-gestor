const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL || "";

export async function createCalendarEvent(eventData: any) {
  try {
    if (!APPS_SCRIPT_URL) {
      throw new Error("NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL não configurada");
    }

    const params = new URLSearchParams({
      action: "create",
      eventData: JSON.stringify(eventData),
    });

    const response = await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating calendar event:", error);
    return { success: false, error: String(error) };
  }
}

export async function updateCalendarEvent(eventId: string, eventData: any) {
  try {
    if (!APPS_SCRIPT_URL) {
      throw new Error("NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL não configurada");
    }

    const params = new URLSearchParams({
      action: "update",
      eventId,
      eventData: JSON.stringify(eventData),
    });

    const response = await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating calendar event:", error);
    return { success: false, error: String(error) };
  }
}

export async function deleteCalendarEvent(eventId: string) {
  try {
    if (!APPS_SCRIPT_URL) {
      throw new Error("NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL não configurada");
    }

    const params = new URLSearchParams({
      action: "delete",
      eventId,
    });

    const response = await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error deleting calendar event:", error);
    return { success: false, error: String(error) };
  }
}

export async function listCalendarEvents(
  timeMin?: string,
  timeMax?: string,
  query?: string, // NEW: optional free-text search (e.g. professional email)
) {
  try {
    if (!APPS_SCRIPT_URL) {
      throw new Error("NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL não configurada");
    }

    const params = new URLSearchParams({
      action: "list",
      timeMin: timeMin || new Date().toISOString(),
    });

    if (timeMax) params.append("timeMax", timeMax);
    // Pass the query so Apps Script can use it when its implementation supports it
    if (query) params.append("q", query);

    const response = await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error listing calendar events:", error);
    return { success: false, error: String(error), events: [] };
  }
}
