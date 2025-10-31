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

    // Use admin client to generate a magic link for the target user
    const adminClient = createAdminClient()
    
    // Get the target user's email
    const { data: { user: targetUser }, error: userError } = await adminClient.auth.admin.getUserById(userId)
    
    if (userError || !targetUser) {
      throw userError || new Error('Target user not found')
    }

    if (!targetUser.email) {
      throw new Error('Target user has no email address')
    }

    // Generate a magic link for impersonation
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '') || 'http://localhost:3000'}/`,
      },
    })

    if (linkError || !linkData) {
      throw linkError || new Error('Failed to generate impersonation link')
    }

    // Extract the token_hash from the link
    const linkUrl = new URL(linkData.properties.action_link)
    const tokenHash = linkUrl.searchParams.get('token_hash') || linkUrl.hash.match(/token_hash=([^&]+)/)?.[1]

    if (!tokenHash) {
      throw new Error('Failed to extract token_hash from generated link')
    }

    // Exchange the token for a session using the regular client
    const cookieStore = await cookies()
    const response = NextResponse.json({ 
      data: { 
        success: true, 
        userId: targetUser.id,
        email: targetUser.email,
      }, 
      error: null 
    })

    // Create server client with response cookie handling
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

    // Verify the token and get the session
    const { data: { session }, error: sessionError } = await serverClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    })

    if (sessionError || !session) {
      throw sessionError || new Error('Failed to create session from magic link')
    }

    // Set the session to update cookies
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

