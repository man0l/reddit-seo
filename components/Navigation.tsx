'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export default function Navigation() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setIsLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      router.refresh()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <nav className="border-b border-gray-200 bg-white shadow-sm">
      <div className="container mx-auto px-6 py-4 max-w-7xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent hover:from-indigo-700 hover:to-purple-700 transition-all">
            Reddit SEO Tracker
          </Link>
          <div className="flex items-center gap-6">
            {user ? (
              <>
                <Link
                  href="/"
                  className="text-slate-600 hover:text-indigo-600 transition-colors font-semibold px-4 py-2 rounded-xl hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50"
                >
                  Dashboard
                </Link>
                <Link
                  href="/projects"
                  className="text-slate-600 hover:text-indigo-600 transition-colors font-semibold px-4 py-2 rounded-xl hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50"
                >
                  Projects
                </Link>
                <Link
                  href="/keywords"
                  className="text-slate-600 hover:text-indigo-600 transition-colors font-semibold px-4 py-2 rounded-xl hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50"
                >
                  Keywords
                </Link>
                <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
                  <span className="text-sm text-slate-600">{user.email}</span>
                  <button
                    onClick={handleSignOut}
                    className="text-sm text-slate-600 hover:text-red-600 transition-colors font-semibold px-4 py-2 rounded-xl hover:bg-red-50"
                  >
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              !isLoading && (
                <Link
                  href="/auth/login"
                  className="text-slate-600 hover:text-indigo-600 transition-colors font-semibold px-4 py-2 rounded-xl hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50"
                >
                  Sign In
                </Link>
              )
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

