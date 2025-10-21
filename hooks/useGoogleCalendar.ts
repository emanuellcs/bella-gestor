import { useState } from 'react';
import { CalendarEvent } from '@/lib/google-calendar';

export function useGoogleCalendar() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getHeaders = () => {
    const accessToken = localStorage.getItem('google_access_token');
    const refreshToken = localStorage.getItem('google_refresh_token');
    
    return {
      'Content-Type': 'application/json',
      'x-access-token': accessToken || '',
      'x-refresh-token': refreshToken || '',
    };
  };

  const createEvent = async (event: CalendarEvent) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(event),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar evento');
      }
      
      const data = await response.json();
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const listEvents = async (timeMin?: string, timeMax?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (timeMin) params.append('timeMin', timeMin);
      if (timeMax) params.append('timeMax', timeMax);
      
      const response = await fetch(`/api/calendar?${params.toString()}`, {
        method: 'GET',
        headers: getHeaders(),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao listar eventos');
      }
      
      const data = await response.json();
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getEvent = async (eventId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/calendar?eventId=${eventId}`, {
        method: 'GET',
        headers: getHeaders(),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao obter evento');
      }
      
      const data = await response.json();
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateEvent = async (eventId: string, event: Partial<CalendarEvent>) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/calendar', {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ eventId, ...event }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar evento');
      }
      
      const data = await response.json();
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteEvent = async (eventId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/calendar?eventId=${eventId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao deletar evento');
      }
      
      const data = await response.json();
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    createEvent,
    listEvents,
    getEvent,
    updateEvent,
    deleteEvent,
    loading,
    error,
  };
}
