'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

interface User {
  id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  providers: string[]
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isAuthChecked, setIsAuthChecked] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [impersonating, setImpersonating] = useState<string | null>(null)

  useEffect(() => {
    const checkAuthAndFetchUsers = async () => {
      try {
        // Check authentication first
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          router.replace('/auth/login')
          return
        }

        // Check if user is admin
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
        if (!adminEmail || user.email !== adminEmail) {
          router.replace('/')
          return
        }

        setIsAuthChecked(true)

        // Fetch users
        const response = await fetch('/api/admin/users')
        const { data, error: apiError } = await response.json()

        if (!response.ok || apiError) {
          if (response.status === 401 || response.status === 403) {
            router.replace('/')
            return
          }
          throw new Error(apiError || 'Failed to fetch users')
        }

        setUsers(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuthAndFetchUsers()
  }, [router, supabase])

  const handleImpersonate = async (userId: string) => {
    setImpersonating(userId)
    try {
      const response = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })

      const { data, error: apiError } = await response.json()

      if (!response.ok || apiError) {
        throw new Error(apiError || 'Failed to impersonate user')
      }

      // Refresh the page to show the new session
      window.location.href = '/'
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to impersonate user')
    } finally {
      setImpersonating(null)
    }
  }

  // Don't render until auth is checked
  if (!isAuthChecked || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 bg-clip-text text-transparent mb-2">
            Admin Panel
          </h1>
          <p className="text-slate-600 text-lg">
            Manage users and impersonate accounts
          </p>
        </div>

        <div className="card p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">All Users</h2>
            <p className="text-sm text-gray-600">
              Total: {users.length} user{users.length !== 1 ? 's' : ''}
            </p>
          </div>

          {users.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Created</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Last Sign In</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Providers</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{user.email || 'No email'}</span>
                          {user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL && (
                            <span className="px-2 py-0.5 text-xs bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 font-semibold rounded-full border border-indigo-200">
                              Admin
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {user.last_sign_in_at
                          ? new Date(user.last_sign_in_at).toLocaleDateString()
                          : 'Never'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1 flex-wrap">
                          {user.providers.map((provider) => (
                            <span
                              key={provider}
                              className="px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded border border-slate-200"
                            >
                              {provider}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleImpersonate(user.id)}
                          disabled={impersonating === user.id}
                          className="px-3 py-1.5 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                        >
                          {impersonating === user.id ? 'Switching...' : 'Login As'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

