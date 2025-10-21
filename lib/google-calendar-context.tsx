'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface GoogleCalendarContextType {
  isConnected: boolean
  accessToken: string | null
  refreshToken: string | null
  connect: () => void
  disconnect: () => void
  loading: boolean
}

const GoogleCalendarContext = createContext<GoogleCalendarContextType | undefined>(undefined)

export function GoogleCalendarProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTokensFromDatabase()

    const handleGoogleCalendarConnected = () => {
      loadTokensFromDatabase()
    }

    window.addEventListener('google-calendar-connected', handleGoogleCalendarConnected)

    return () => {
      window.removeEventListener('google-calendar-connected', handleGoogleCalendarConnected)
    }
  }, [])

  const loadTokensFromDatabase = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('user_integrations')
        .select('google_calendar_access_token, google_calendar_refresh_token')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading Google Calendar tokens:', error)
        setLoading(false)
        return
      }

      if (data && data.google_calendar_access_token && data.google_calendar_refresh_token) {
        setAccessToken(data.google_calendar_access_token)
        setRefreshToken(data.google_calendar_refresh_token)
        setIsConnected(true)
      }
    } catch (error) {
      console.error('Error loading tokens:', error)
    } finally {
      setLoading(false)
    }
  }

  const connect = () => {
    window.location.href = '/api/auth'
  }

  const disconnect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      await supabase
        .from('user_integrations')
        .update({
          google_calendar_access_token: null,
          google_calendar_refresh_token: null,
          google_calendar_connected_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

      setAccessToken(null)
      setRefreshToken(null)
      setIsConnected(false)
    } catch (error) {
      console.error('Error disconnecting:', error)
    }
  }

  return (
    <GoogleCalendarContext.Provider
      value={{ isConnected, accessToken, refreshToken, connect, disconnect, loading }}
    >
      {children}
    </GoogleCalendarContext.Provider>
  )
}

export function useGoogleCalendar() {
  const context = useContext(GoogleCalendarContext)
  if (context === undefined) {
    throw new Error('useGoogleCalendar must be used within a GoogleCalendarProvider')
  }
  return context
}
