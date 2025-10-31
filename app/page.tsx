'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Keyword, RedditPost } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [posts, setPosts] = useState<RedditPost[]>([])
  const [totalPostsCount, setTotalPostsCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthChecked, setIsAuthChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        // Ensure authenticated; redirect to login if not
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          router.replace('/auth/login')
          return
        }
        
        setIsAuthChecked(true)

        // Fetch keywords
        const keywordsResponse = await fetch('/api/keywords')
        const { data: keywordsData, error: keywordsError } = await keywordsResponse.json()

        if (!keywordsResponse.ok || keywordsError) {
          if (keywordsResponse.status === 401) {
            router.push('/auth/login')
            return
          }
          throw new Error(keywordsError || 'Failed to fetch keywords')
        }

        setKeywords(keywordsData || [])

        // Fetch total count of posts
        const { count: postsCount, error: countError } = await supabase
          .from('reddit_posts')
          .select('*', { count: 'exact', head: true })

        if (countError) {
          console.error('Error fetching posts count:', countError)
        } else {
          setTotalPostsCount(postsCount || 0)
        }

        // Fetch recent reddit posts (limit 10 for display)
        const { data: postsData, error: postsError } = await supabase
          .from('reddit_posts')
          .select(`
            *,
            keywords!inner (
              keyword
            )
          `)
          .order('last_checked_at', { ascending: false })
          .limit(10)

        if (postsError) {
          console.error('Error fetching posts:', postsError)
          // Try without join if relation doesn't work
          const { data: postsDataSimple, error: postsErrorSimple } = await supabase
            .from('reddit_posts')
            .select('*')
            .order('last_checked_at', { ascending: false })
            .limit(10)
          
          if (postsErrorSimple) throw postsErrorSimple
          setPosts(postsDataSimple || [])
        } else {
          setPosts(postsData || [])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        console.error('Dashboard fetch error:', err)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuthAndFetchData()
  }, [router, supabase])

  // Don't render anything until auth is checked
  if (!isAuthChecked || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center py-12">
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{error}</p>
        </div>
      </div>
    )
  }

  const totalKeywords = keywords.length
  const totalPosts = totalPostsCount

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 bg-clip-text text-transparent mb-2">Reddit SEO Tracker</h1>
              <p className="text-slate-600 text-lg">
                Track which Reddit posts rank on Google&apos;s first page for your keywords
              </p>
            </div>
            <Link
              href="/keywords"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-105 font-semibold"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Manage Keywords
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card p-6 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-600 mb-2">Total Keywords</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{totalKeywords}</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="card p-6 bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-600 mb-2">Total Posts Tracked</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">{totalPosts}</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="card p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-600 mb-2">Recent Activity</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                  {posts.filter((p) => {
                    const lastChecked = new Date(p.last_checked_at)
                    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
                    return lastChecked > dayAgo
                  }).length}
                </p>
                <p className="text-xs text-slate-500 mt-1 font-medium">Last 24 hours</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Keywords */}
          <div className="lg:col-span-2 space-y-6">
            {/* Keywords Section */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-gray-900">Your Keywords</h2>
                <Link
                  href="/keywords"
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  View all →
                </Link>
              </div>
              {keywords.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 mb-4">No keywords yet. Get started by adding your first keyword!</p>
                  <Link
                    href="/keywords"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add Keyword
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {keywords.slice(0, 6).map((keyword) => (
                    <Link
                      key={keyword.id}
                      href={`/keywords/${encodeURIComponent(keyword.keyword)}`}
                      className="p-5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all bg-white hover:bg-gradient-to-br hover:from-white hover:to-indigo-50/30 group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">{keyword.keyword}</h3>
                          <p className="text-xs text-slate-500">
                            Added {new Date(keyword.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="ml-4">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 group-hover:from-indigo-500 group-hover:to-purple-600 flex items-center justify-center transition-all group-hover:shadow-md group-hover:shadow-indigo-500/30">
                            <svg className="w-5 h-5 text-indigo-600 group-hover:text-white transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Latest Rankings */}
            {posts.length > 0 && (
              <div className="card p-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">Latest Rankings</h2>
                <div className="space-y-4">
                  {posts.slice(0, 5).map((post) => {
                    const keyword = (post as any).keywords?.keyword || keywords.find(k => k.id === post.keyword_id)?.keyword || 'Unknown'
                    const apifyData = (post as any).apify_scraped_data
                    const upvotes = apifyData?.upVotes || apifyData?.score || apifyData?.upvotes || apifyData?.upvoteCount || null
                    const comments = apifyData?.numberOfComments || apifyData?.numComments || apifyData?.commentsCount || (Array.isArray(apifyData?.comments) ? apifyData.comments.length : null) || null
                    
                    return (
                      <div
                        key={post.id}
                        className="p-5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all bg-white hover:bg-gradient-to-br hover:from-white hover:to-indigo-50/30"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                              <span className="text-lg font-bold text-white">#{post.rank_position}</span>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              <Link
                                href={`/keywords/${encodeURIComponent(keyword)}`}
                                className="text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent hover:from-indigo-700 hover:to-purple-700 transition-all"
                              >
                                {keyword}
                              </Link>
                              <span className="text-xs text-slate-400">•</span>
                              <span className="text-xs font-semibold text-slate-700">r/{post.subreddit}</span>
                              {apifyData && (
                                <>
                                  <span className="text-xs px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 font-semibold border border-emerald-200/50">Scraped</span>
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
                              )}
                            </div>
                            <a
                              href={post.post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-semibold text-slate-900 hover:text-indigo-600 line-clamp-2 block mb-2 transition-colors"
                            >
                              {post.post_title}
                            </a>
                            <a
                              href={post.post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-slate-500 hover:text-indigo-600 truncate block transition-colors"
                            >
                              {post.post_url}
                            </a>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Quick Stats */}
          <div className="space-y-6">
            {totalKeywords > 0 && totalPosts === 0 && (
              <div className="card p-6 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border-indigo-200">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/30">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-slate-900 mb-1">Get Started</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      Click on any keyword to check which Reddit posts rank on Google&apos;s first page.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
