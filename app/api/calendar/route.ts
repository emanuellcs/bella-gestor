import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

function getOAuth2Client(accessToken: string, refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return oauth2Client;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accessToken = request.headers.get('x-access-token');
    const refreshToken = request.headers.get('x-refresh-token');
    
    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { error: 'Tokens não fornecidos' },
        { status: 401 }
      );
    }

    const oauth2Client = getOAuth2Client(accessToken, refreshToken);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const eventId = searchParams.get('eventId');
    const timeMin = searchParams.get('timeMin');
    const timeMax = searchParams.get('timeMax');

    if (eventId) {
      const response = await calendar.events.get({
        calendarId: 'primary',
        eventId: eventId,
      });
      return NextResponse.json(response.data);
    } else {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin || new Date().toISOString(),
        timeMax: timeMax || undefined,
        maxResults: 50,
        singleEvents: true,
        orderBy: 'startTime',
      });
      return NextResponse.json(response.data.items || []);
    }
  } catch (error: any) {
    console.error('Error in GET /api/calendar:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar eventos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.headers.get('x-access-token');
    const refreshToken = request.headers.get('x-refresh-token');
    
    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { error: 'Tokens não fornecidos' },
        { status: 401 }
      );
    }

    const event = await request.json();
    const oauth2Client = getOAuth2Client(accessToken, refreshToken);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      sendUpdates: 'all',
    });
    
    return NextResponse.json(response.data, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/calendar:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao criar evento' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const accessToken = request.headers.get('x-access-token');
    const refreshToken = request.headers.get('x-refresh-token');
    
    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { error: 'Tokens não fornecidos' },
        { status: 401 }
      );
    }

    const { eventId, ...eventData } = await request.json();
    
    if (!eventId) {
      return NextResponse.json(
        { error: 'ID do evento não fornecido' },
        { status: 400 }
      );
    }

    const oauth2Client = getOAuth2Client(accessToken, refreshToken);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const response = await calendar.events.patch({
      calendarId: 'primary',
      eventId: eventId,
      requestBody: eventData,
      sendUpdates: 'all',
    });
    
    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error in PATCH /api/calendar:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar evento' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const accessToken = request.headers.get('x-access-token');
    const refreshToken = request.headers.get('x-refresh-token');
    
    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { error: 'Tokens não fornecidos' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    
    if (!eventId) {
      return NextResponse.json(
        { error: 'ID do evento não fornecido' },
        { status: 400 }
      );
    }

    const oauth2Client = getOAuth2Client(accessToken, refreshToken);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
      sendUpdates: 'all',
    });
    
    return NextResponse.json({ message: 'Evento deletado com sucesso' });
  } catch (error: any) {
    console.error('Error in DELETE /api/calendar:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar evento' },
      { status: 500 }
    );
  }
}
