import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL

export async function GET(request: NextRequest) {
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

    // Use admin client to list all users
    const adminClient = createAdminClient()
    const { data: { users }, error: usersError } = await adminClient.auth.admin.listUsers()

    if (usersError) {
      throw usersError
    }

    // Format user data
    const formattedUsers = users.map((user) => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      email_confirmed_at: user.email_confirmed_at,
      providers: user.app_metadata?.providers || [],
    }))

    return NextResponse.json({ data: formattedUsers, error: null })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

