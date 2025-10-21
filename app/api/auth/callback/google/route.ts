import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/agenda?error=no_code', request.url))
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    const { tokens } = await oauth2Client.getToken(code)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = request.headers.get('cookie')
    if (authHeader) {
      const sessionMatch = authHeader.match(/sb-[^=]+-auth-token=([^;]+)/)
      if (sessionMatch) {
        await supabase.auth.setSession({
          access_token: sessionMatch[1].split('.')[0],
          refresh_token: sessionMatch[1].split('.')[1]
        })
      }
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { error: upsertError } = await supabase
        .from('user_integrations')
        .upsert({
          user_id: user.id,
          google_calendar_access_token: tokens.access_token || null,
          google_calendar_refresh_token: tokens.refresh_token || null,
          google_calendar_connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (upsertError) {
        console.error('Error saving tokens to database:', upsertError)
      }
    }

    const redirectUrl = new URL('/agenda', request.url)
    redirectUrl.searchParams.set('google_connected', 'true')

    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('Erro no OAuth callback:', error)
    return NextResponse.redirect(new URL('/agenda?error=auth_failed', request.url))
  }
}
