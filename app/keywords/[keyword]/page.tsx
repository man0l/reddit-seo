'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import RankingsList from '@/components/RankingsList'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export default function KeywordRankingsPage({
  params,
}: {
  params: Promise<{ keyword: string }>
}) {
  const router = useRouter()
  const supabase = createClient()
  const [isAuthChecked, setIsAuthChecked] = useState(false)
  const { keyword } = use(params)
  const decodedKeyword = decodeURIComponent(keyword)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        router.replace('/auth/login')
        return
      }
      
      setIsAuthChecked(true)
    }

    checkAuth()
  }, [router, supabase])

  if (!isAuthChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="mb-6">
          <Link
            href="/keywords"
            className="text-indigo-600 hover:text-indigo-800 text-sm mb-4 inline-flex items-center gap-2 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Keywords
          </Link>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 bg-clip-text text-transparent mb-2">Rankings</h1>
          <p className="text-slate-600 text-lg">
            Reddit posts ranking on Google&apos;s first page for &quot;{decodedKeyword}&quot;
          </p>
        </div>

        <RankingsList keyword={decodedKeyword} />
      </div>
    </div>
  )
}

