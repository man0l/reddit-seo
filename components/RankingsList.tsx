'use client'

import { useState, useEffect } from 'react'
import { RedditPost } from '@/lib/types'
import GenerateReplyModal from '@/components/GenerateReplyModal'

interface RankingsListProps {
  keyword: string
}

export default function RankingsList({ keyword }: RankingsListProps) {
  const [posts, setPosts] = useState<RedditPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generateUrl, setGenerateUrl] = useState<string | null>(null)

  const fetchRankings = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/check-rankings/${encodeURIComponent(keyword)}`)
      const { data, error: apiError } = await response.json()

      if (!response.ok || apiError) {
        throw new Error(apiError || 'Failed to fetch rankings')
      }

      setPosts(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    setError(null)
    try {
      // Use POST to trigger the refresh (calls external APIs)
      const response = await fetch(`/api/check-rankings/${encodeURIComponent(keyword)}`, {
        method: 'POST',
      })
      const { data, error: apiError } = await response.json()

      if (!response.ok || apiError) {
        throw new Error(apiError || 'Failed to refresh rankings')
      }

      setPosts(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh rankings')
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchRankings()
  }, [keyword]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center gap-3">
          <svg className="animate-spin h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-slate-600 font-medium">Loading rankings...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={fetchRankings}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">
          No Reddit posts found ranking on the first page for this keyword.
        </p>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isRefreshing ? 'Checking...' : 'Check Rankings'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            Reddit Posts Ranking for &quot;{keyword}&quot;
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Posts ranking on Google&apos;s first page for this keyword
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-105 font-semibold flex items-center gap-2"
        >
          {isRefreshing ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Refreshing...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Rankings
            </>
          )}
        </button>
      </div>

      <div className="space-y-4">
        {posts.map((post) => (
          <div
            key={post.id}
            className="card p-5"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                  <span className="text-xl font-bold text-white">#{post.rank_position}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">r/{post.subreddit}</span>
                  <span className="text-xs text-gray-500">•</span>
                  <span className="text-xs text-gray-500">
                    Last checked {new Date(post.last_checked_at).toLocaleDateString()}
                  </span>
                  {(post as any).apify_scraped_data && (() => {
                    const apifyData = (post as any).apify_scraped_data
                    const upvotes = apifyData?.upVotes || apifyData?.score || apifyData?.upvotes || apifyData?.upvoteCount || null
                    const comments = apifyData?.numberOfComments || apifyData?.numComments || apifyData?.commentsCount || (Array.isArray(apifyData?.comments) ? apifyData.comments.length : null) || null
                    return (
                      <>
                        <span className="px-2.5 py-1 text-xs bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 font-semibold rounded-full border border-emerald-200/50">Scraped</span>
                        {upvotes !== null && (
                          <span className="text-xs text-slate-700 flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 font-medium border border-slate-200">
                            <svg className="w-3.5 h-3.5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                            {upvotes}
                          </span>
                        )}
                        {comments !== null && (
                          <span className="text-xs text-slate-700 flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 font-medium border border-slate-200">
                            <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {comments}
                          </span>
                        )}
                      </>
                    )
                  })()}
                </div>
                <a
                  href={post.post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg font-semibold text-blue-600 hover:text-blue-800 hover:underline block mb-2"
                >
                  {post.post_title}
                </a>
                <a
                  href={post.post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-500 hover:text-gray-700 break-all"
                >
                  {post.post_url}
                </a>
                <div className="mt-3">
                  <button
                    onClick={() => setGenerateUrl(post.post_url)}
                    className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-md shadow-indigo-500/30"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M8 6h8" />
                    </svg>
                    Generate AI Reply
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <GenerateReplyModal isOpen={!!generateUrl} postUrl={generateUrl} onClose={() => setGenerateUrl(null)} />
    </div>
  )
}

