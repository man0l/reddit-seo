import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL

export async function POST(request: NextRequest) {
  try {
    if (!ADMIN_EMAIL) {
      return NextResponse.json(
        { data: null, error: 'Admin email not configured' },
        { status: 500 }
      )
    }

    // Check authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { data: null, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    if (user.email !== ADMIN_EMAIL) {
      return NextResponse.json(
        { data: null, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    // Get target user ID from request body
    const body = await request.json()
    const { userId } = body

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { data: null, error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Use admin client to create a session for the target user
    const adminClient = createAdminClient()
    const { data: { session }, error: createError } = await adminClient.auth.admin.createSession({
      userId,
    })

    if (createError || !session) {
      throw createError || new Error('Failed to create session')
    }

    // Create a response that will set the cookies using Supabase SSR pattern
    const cookieStore = await cookies()
    const response = NextResponse.json({ 
      data: { 
        success: true, 
        userId: session.user.id,
        email: session.user.email,
      }, 
      error: null 
    })

    // Create a server client to properly handle cookie setting
    const serverClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    // Set the session using the server client
    await serverClient.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })

    return response
  } catch (error) {
    console.error('Error impersonating user:', error)
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

