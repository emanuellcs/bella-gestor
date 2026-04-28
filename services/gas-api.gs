// This file is a mirror of the API deployed in Google Apps Script. It should not be modified here.

function doGet(e) {
  try {
    const action = e.parameter.action;

    if (!action) {
      return jsonResponse({
        success: false,
        error: "Ação não especificada",
      });
    }

    let response;

    if (action === "list") {
      const timeMin = e.parameter.timeMin;
      const timeMax = e.parameter.timeMax;
      const query = e.parameter.q;
      response = listEvents(timeMin, timeMax, query);
    } else if (action === "read") {
      const eventId = e.parameter.eventId;
      if (!eventId) {
        return jsonResponse({
          success: false,
          error: "ID do evento não fornecido",
        });
      }
      response = getEvent(eventId);
    } else if (action === "create") {
      const eventData = JSON.parse(e.parameter.eventData || "{}");
      response = createEvent(eventData);
    } else if (action === "update") {
      const eventId = e.parameter.eventId;
      const eventData = JSON.parse(e.parameter.eventData || "{}");
      if (!eventId) {
        return jsonResponse({
          success: false,
          error: "ID do evento não fornecido",
        });
      }
      response = updateEvent(eventId, eventData);
    } else if (action === "delete") {
      const eventId = e.parameter.eventId;
      if (!eventId) {
        return jsonResponse({
          success: false,
          error: "ID do evento não fornecido",
        });
      }
      response = deleteEvent(eventId);
    } else {
      response = {
        success: false,
        error: "Ação GET inválida: " + action,
      };
    }

    return jsonResponse(response);
  } catch (error) {
    Logger.log("Erro no doGet: " + error.toString());
    return jsonResponse({
      success: false,
      error: "Erro no servidor: " + error.toString(),
    });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function createEvent(eventData) {
  const calendarId = "primary";

  try {
    if (!eventData.summary) {
      return {
        success: false,
        error: "Título do evento é obrigatório",
      };
    }

    if (!eventData.startTime || !eventData.endTime) {
      return {
        success: false,
        error: "Data/hora de início e fim são obrigatórias",
      };
    }

    const event = {
      summary: eventData.summary,
      description: eventData.description || "",
      location: eventData.location || "",
      start: {
        dateTime: eventData.startTime,
        timeZone: "America/Sao_Paulo",
      },
      end: {
        dateTime: eventData.endTime,
        timeZone: "America/Sao_Paulo",
      },
      attendees: eventData.attendees || [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 },
          { method: "popup", minutes: 30 },
        ],
      },
    };

    const createdEvent = Calendar.Events.insert(event, calendarId, {
      sendUpdates: "all",
    });

    Logger.log("Evento criado com sucesso: " + createdEvent.id);

    return {
      success: true,
      eventId: createdEvent.id,
      htmlLink: createdEvent.htmlLink,
      event: {
        id: createdEvent.id,
        summary: createdEvent.summary,
        description: createdEvent.description,
        location: createdEvent.location,
        start: createdEvent.start,
        end: createdEvent.end,
        htmlLink: createdEvent.htmlLink,
      },
    };
  } catch (error) {
    Logger.log("Erro ao criar evento: " + error.toString());
    return {
      success: false,
      error: "Erro ao criar evento: " + error.toString(),
    };
  }
}

function buildEventPatch(eventData, requireSummaryAndTimes) {
  const patch = {};

  if (requireSummaryAndTimes && !eventData.summary) {
    throw new Error("Título do evento é obrigatório");
  }

  if (requireSummaryAndTimes && (!eventData.startTime || !eventData.endTime)) {
    throw new Error("Data/hora de início e fim são obrigatórias");
  }

  if (eventData.summary !== undefined) {
    patch.summary = eventData.summary;
  }

  if (eventData.description !== undefined) {
    patch.description = eventData.description || "";
  }

  if (eventData.location !== undefined) {
    patch.location = eventData.location || "";
  }

  if (eventData.startTime !== undefined) {
    if (!eventData.startTime) {
      throw new Error("Data/hora de início inválida");
    }
    patch.start = {
      dateTime: eventData.startTime,
      timeZone: "America/Sao_Paulo",
    };
  }

  if (eventData.endTime !== undefined) {
    if (!eventData.endTime) {
      throw new Error("Data/hora de fim inválida");
    }
    patch.end = {
      dateTime: eventData.endTime,
      timeZone: "America/Sao_Paulo",
    };
  }

  if (eventData.attendees !== undefined) {
    patch.attendees = eventData.attendees || [];
  }

  return patch;
}

function getEvent(eventId) {
  const calendarId = "primary";

  try {
    const event = Calendar.Events.get(calendarId, eventId);

    return {
      success: true,
      event: {
        id: event.id,
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: event.start,
        end: event.end,
        htmlLink: event.htmlLink,
        attendees: event.attendees || [],
      },
    };
  } catch (error) {
    Logger.log("Erro ao buscar evento: " + error.toString());
    return {
      success: false,
      error: "Erro ao buscar evento: " + error.toString(),
    };
  }
}

function updateEvent(eventId, eventData) {
  const calendarId = "primary";

  try {
    const patch = buildEventPatch(eventData, false);

    if (Object.keys(patch).length === 0) {
      return {
        success: false,
        error: "Nenhum campo fornecido para atualização",
      };
    }

    const updatedEvent = Calendar.Events.patch(patch, calendarId, eventId, {
      sendUpdates: "all",
    });

    Logger.log("Evento atualizado com sucesso: " + eventId);

    return {
      success: true,
      event: {
        id: updatedEvent.id,
        summary: updatedEvent.summary,
        description: updatedEvent.description,
        location: updatedEvent.location,
        start: updatedEvent.start,
        end: updatedEvent.end,
        htmlLink: updatedEvent.htmlLink,
      },
    };
  } catch (error) {
    Logger.log("Erro ao atualizar evento: " + error.toString());
    return {
      success: false,
      error: "Erro ao atualizar evento: " + error.toString(),
    };
  }
}

function deleteEvent(eventId) {
  const calendarId = "primary";

  try {
    const cancelledEvent = Calendar.Events.patch(
      {
        status: "cancelled",
      },
      calendarId,
      eventId,
      {
        sendUpdates: "all",
      },
    );

    Logger.log("Evento cancelado logicamente com sucesso: " + eventId);

    return {
      success: true,
      message: "Evento cancelado com sucesso",
      eventId: eventId,
      event: {
        id: cancelledEvent.id,
        status: cancelledEvent.status,
      },
    };
  } catch (error) {
    Logger.log("Erro ao deletar evento: " + error.toString());
    return {
      success: false,
      error: "Erro ao deletar evento: " + error.toString(),
    };
  }
}

function listEvents(timeMin, timeMax, query) {
  const calendarId = "primary";

  try {
    const now = new Date();
    const optionalArgs = {
      timeMin: timeMin || now.toISOString(),
      timeMax: timeMax || undefined,
      maxResults: 250,
      singleEvents: true,
      orderBy: "startTime",
      showDeleted: false,
    };

    if (query) {
      optionalArgs.q = query;
    }

    let events = [];
    let pageToken;

    do {
      if (pageToken) {
        optionalArgs.pageToken = pageToken;
      }

      const response = Calendar.Events.list(calendarId, optionalArgs);
      events = events.concat(response.items || []);
      pageToken = response.nextPageToken;
    } while (pageToken);

    const simplifiedEvents = events.map(function (event) {
      return {
        id: event.id,
        summary: event.summary,
        description: event.description || "",
        location: event.location || "",
        start: event.start,
        end: event.end,
        htmlLink: event.htmlLink,
        attendees: event.attendees || [],
      };
    });

    Logger.log("Listados " + events.length + " eventos");

    return {
      success: true,
      count: events.length,
      events: simplifiedEvents,
    };
  } catch (error) {
    Logger.log("Erro ao listar eventos: " + error.toString());
    return {
      success: false,
      error: "Erro ao listar eventos: " + error.toString(),
      count: 0,
      events: [],
    };
  }
}
