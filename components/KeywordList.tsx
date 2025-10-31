'use client'

import { useState, useEffect } from 'react'
import { Keyword, RedditPost } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import ConfirmationModal from '@/components/ConfirmationModal'
import GenerateReplyModal from '@/components/GenerateReplyModal'

interface KeywordListProps {
  projectId: string
  onKeywordClick?: (keyword: string) => void
}

interface KeywordWithPosts extends Keyword {
  posts: RedditPost[]
  isLoadingPosts?: boolean
  hasChecked?: boolean
}

export default function KeywordList({ projectId, onKeywordClick }: KeywordListProps) {
  const supabase = createClient()
  const [keywords, setKeywords] = useState<KeywordWithPosts[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedKeywords, setExpandedKeywords] = useState<Set<string>>(new Set())
  const [checkingRankings, setCheckingRankings] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState<number | null>(null)
  const [confirmSingleDelete, setConfirmSingleDelete] = useState<string | null>(null)
  const [generateUrl, setGenerateUrl] = useState<string | null>(null)
  const [postsWithDrafts, setPostsWithDrafts] = useState<Set<string>>(new Set())

  const fetchKeywords = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/keywords?project_id=${encodeURIComponent(projectId)}`)
      const { data, error: apiError } = await response.json()

      if (!response.ok || apiError) {
        throw new Error(apiError || 'Failed to fetch keywords')
      }

      const keywordsData = data || []
      
      // Fetch posts for each keyword
      const keywordsWithPosts = await Promise.all(
        keywordsData.map(async (keyword: Keyword) => {
          const { data: posts, error: postsError } = await supabase
            .from('reddit_posts')
            .select('*')
            .eq('keyword_id', keyword.id)
            .order('rank_position', { ascending: true })

          return {
            ...keyword,
            posts: posts || [],
            hasChecked: posts && posts.length > 0,
          }
        })
      )

      setKeywords(keywordsWithPosts)
      
      // Auto-expand keywords that have posts
      const keywordsWithPostsIds = keywordsWithPosts
        .filter(k => k.posts && k.posts.length > 0)
        .map(k => k.id)
      setExpandedKeywords(new Set(keywordsWithPostsIds))
      
      // Check which posts have drafts
      const allPostUrls = keywordsWithPosts
        .flatMap(k => k.posts || [])
        .map(p => p.post_url)
      
      if (allPostUrls.length > 0) {
        // Batch check drafts for all posts
        const draftChecks = await Promise.all(
          allPostUrls.map(async (postUrl) => {
            try {
              const response = await fetch(`/api/reply-drafts?postUrl=${encodeURIComponent(postUrl)}`)
              const { data, error } = await response.json()
              return { postUrl, hasDraft: !error && data?.draft_content && data.draft_content.length > 0 }
            } catch {
              return { postUrl, hasDraft: false }
            }
          })
        )
        
        const draftsSet = new Set(
          draftChecks.filter(check => check.hasDraft).map(check => check.postUrl)
        )
        setPostsWithDrafts(draftsSet)
      }
      
      // Clean up selected IDs for keywords that no longer exist
      setSelectedIds(prev => {
        const keywordIds = new Set(keywordsWithPosts.map(k => k.id))
        return new Set(Array.from(prev).filter(id => keywordIds.has(id)))
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const checkRankingsForKeyword = async (keyword: KeywordWithPosts) => {
    setCheckingRankings(prev => new Set(prev).add(keyword.id))
    
    try {
      // Use POST to trigger actual ranking check (calls external APIs)
      const response = await fetch(`/api/check-rankings/${encodeURIComponent(keyword.keyword)}`, {
        method: 'POST',
      })
      const { data, error: apiError } = await response.json()

      if (!response.ok || apiError) {
        throw new Error(apiError || 'Failed to check rankings')
      }

      // Update the keyword with new posts
      setKeywords(prev => prev.map(k => 
        k.id === keyword.id 
          ? { ...k, posts: data || [], hasChecked: true }
          : k
      ))

      // Auto-expand if there are results
      if (data && data.length > 0) {
        setExpandedKeywords(prev => new Set(prev).add(keyword.id))
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to check rankings')
    } finally {
      setCheckingRankings(prev => {
        const next = new Set(prev)
        next.delete(keyword.id)
        return next
      })
    }
  }

  const toggleExpand = (keywordId: string) => {
    setExpandedKeywords(prev => {
      const next = new Set(prev)
      if (next.has(keywordId)) {
        next.delete(keywordId)
      } else {
        next.add(keywordId)
      }
      return next
    })
  }

  useEffect(() => {
    fetchKeywords()
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === keywords.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(keywords.map(k => k.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    setConfirmBulkDelete(selectedIds.size)
  }

  const confirmBulkDeleteAction = async () => {
    if (!confirmBulkDelete) return

    setIsBulkDeleting(true)
    setConfirmBulkDelete(null)

    try {
      const idsArray = Array.from(selectedIds)
      const response = await fetch(`/api/keywords?ids=${encodeURIComponent(JSON.stringify(idsArray))}`, {
        method: 'DELETE',
      })

      const { error: apiError } = await response.json()

      if (!response.ok || apiError) {
        throw new Error(apiError || 'Failed to delete keywords')
      }

      setSelectedIds(new Set())
      await fetchKeywords()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete keywords')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setConfirmSingleDelete(id)
  }

  const confirmSingleDeleteAction = async () => {
    if (!confirmSingleDelete) return

    setDeletingId(confirmSingleDelete)
    setConfirmSingleDelete(null)

    try {
      const response = await fetch(`/api/keywords?id=${confirmSingleDelete}`, {
        method: 'DELETE',
      })

      const { error: apiError } = await response.json()

      if (!response.ok || apiError) {
        throw new Error(apiError || 'Failed to delete keyword')
      }

      await fetchKeywords()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete keyword')
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Loading keywords...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchKeywords}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (keywords.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No keywords yet. Add your first keyword above!</p>
      </div>
    )
  }

  const selectedCount = selectedIds.size
  const allSelected = keywords.length > 0 && selectedIds.size === keywords.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Your Keywords</h2>
        {selectedCount > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 font-medium">
              {selectedCount} selected
            </span>
            <button
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="px-4 py-2 text-sm bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl hover:from-red-600 hover:to-rose-700 transition-all shadow-md shadow-red-500/30 hover:shadow-lg hover:shadow-red-500/40 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
            >
              {isBulkDeleting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Deleting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Selected ({selectedCount})
                </>
              )}
            </button>
          </div>
        )}
      </div>
      {keywords.length > 0 && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label className="text-sm text-gray-700 cursor-pointer font-medium" onClick={toggleSelectAll}>
            Select All
          </label>
        </div>
      )}
      <div className="space-y-4">
        {keywords.map((keyword) => {
          const isExpanded = expandedKeywords.has(keyword.id)
          const isChecking = checkingRankings.has(keyword.id)
          const hasPosts = keyword.posts && keyword.posts.length > 0

          return (
            <div
              key={keyword.id}
              className="card overflow-hidden"
            >
              {/* Keyword Header */}
              <div className="p-5">
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(keyword.id)}
                    onChange={() => toggleSelect(keyword.id)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleExpand(keyword.id)}
                        className="text-left hover:text-blue-600 transition-colors flex-1"
                        disabled={isChecking}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900 text-lg">{keyword.keyword}</span>
                          <span className="text-sm text-gray-500">
                            Added {new Date(keyword.created_at).toLocaleDateString()}
                          </span>
                          {hasPosts && (
                            <span className="px-2.5 py-1 text-xs bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 font-semibold rounded-full border border-emerald-200/50">
                              {keyword.posts.length} post{keyword.posts.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </button>
                      {hasPosts && (
                        <button
                          onClick={() => toggleExpand(keyword.id)}
                          className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                        >
                          <svg
                            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => checkRankingsForKeyword(keyword)}
                      disabled={isChecking}
                      className="px-4 py-2 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/40 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center gap-2"
                    >
                      {isChecking ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Checking...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          {keyword.hasChecked ? 'Refresh' : 'Check Rankings'}
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(keyword.id)}
                      disabled={deletingId === keyword.id}
                      className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-rose-50 rounded-xl transition-all disabled:opacity-50 font-semibold flex items-center gap-2 border border-red-200 hover:border-red-300"
                    >
                      {deletingId === keyword.id ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Deleting...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Posts Section */}
              {isExpanded && (
                <div className="border-t border-gray-200 px-5 py-4 bg-gray-50">
                  {hasPosts ? (
                    <div className="space-y-3">
                      {keyword.posts.map((post) => (
                        <div
                          key={post.id}
                          className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                                <span className="text-lg font-bold text-white">#{post.rank_position}</span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="text-xs font-semibold text-gray-700">r/{post.subreddit}</span>
                                <span className="text-xs text-gray-500">•</span>
                                <span className="text-xs text-gray-500">
                                  {new Date(post.last_checked_at).toLocaleDateString()}
                                </span>
                                {postsWithDrafts.has(post.post_url) && (
                                  <span className="text-xs text-amber-600 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200" title="Draft saved">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Draft
                                  </span>
                                )}
                                {(post as any).apify_scraped_data && (() => {
                                  const apifyData = (post as any).apify_scraped_data
                                  const upvotes = apifyData?.upVotes || apifyData?.score || apifyData?.upvotes || apifyData?.upvoteCount || null
                                  const comments = apifyData?.numberOfComments || apifyData?.numComments || apifyData?.commentsCount || (Array.isArray(apifyData?.comments) ? apifyData.comments.length : null) || null
                                  return (
                                    <>
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
                                className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline block line-clamp-2 mb-2"
                              >
                                {post.post_title}
                              </a>
                              <a
                                href={post.post_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-gray-500 hover:text-gray-700 break-all block truncate"
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
                  ) : keyword.hasChecked ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 text-sm font-medium">No Reddit posts found ranking on the first page</p>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 text-sm font-medium">Click &quot;Check Rankings&quot; to find Reddit posts</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={!!confirmBulkDelete}
        title="Delete Keywords"
        message={`Are you sure you want to delete ${confirmBulkDelete || 0} keyword${(confirmBulkDelete || 0) !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmBulkDeleteAction}
        onCancel={() => setConfirmBulkDelete(null)}
      />

      <ConfirmationModal
        isOpen={!!confirmSingleDelete}
        title="Delete Keyword"
        message="Are you sure you want to delete this keyword? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmSingleDeleteAction}
        onCancel={() => setConfirmSingleDelete(null)}
      />

      <GenerateReplyModal 
        isOpen={!!generateUrl} 
        postUrl={generateUrl} 
        onClose={() => {
          setGenerateUrl(null)
          // Refresh draft status when modal closes
          if (generateUrl) {
            fetch(`/api/reply-drafts?postUrl=${encodeURIComponent(generateUrl)}`)
              .then(res => res.json())
              .then(({ data, error }) => {
                const hasDraft = !error && data?.draft_content && data.draft_content.length > 0
                setPostsWithDrafts(prev => {
                  const next = new Set(prev)
                  if (hasDraft) {
                    next.add(generateUrl)
                  } else {
                    next.delete(generateUrl)
                  }
                  return next
                })
              })
              .catch(() => {})
          }
        }} 
      />
    </div>
  )
}

export { KeywordList }
