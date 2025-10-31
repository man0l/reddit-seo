'use client'

import { use } from 'react'
import RankingsList from '@/components/RankingsList'
import Link from 'next/link'

export default function KeywordRankingsPage({
  params,
}: {
  params: Promise<{ keyword: string }>
}) {
  const { keyword } = use(params)
  const decodedKeyword = decodeURIComponent(keyword)

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

