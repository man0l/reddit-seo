'use client'

import { useEffect, useState } from 'react'
import { ReplyStyle, REPLY_STYLES } from '@/lib/types'

interface GenerateReplyModalProps {
  isOpen: boolean
  postUrl: string | null
  onClose: () => void
}

export default function GenerateReplyModal({ isOpen, postUrl, onClose }: GenerateReplyModalProps) {
  const [businessDescription, setBusinessDescription] = useState('')
  const [style, setStyle] = useState<ReplyStyle>('casual')
  const [includeComments, setIncludeComments] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reply, setReply] = useState<string | null>(null)
  const [subreddit, setSubreddit] = useState<string | null>(null)
  const [isExcluded, setIsExcluded] = useState(false)
  const [confirmExcluded, setConfirmExcluded] = useState(false)
  const [isLoadingPostInfo, setIsLoadingPostInfo] = useState(false)
  const [editedReply, setEditedReply] = useState<string>('')
  const [hasDraft, setHasDraft] = useState(false)

  // Load saved description, drafts, and check exclusions once
  useEffect(() => {
    if (isOpen && postUrl) {
      const saved = localStorage.getItem('business_description')
      if (saved && !businessDescription) setBusinessDescription(saved)

      // Load draft if exists
      const draftKey = `reply_draft_${postUrl}`
      const savedDraft = localStorage.getItem(draftKey)
      if (savedDraft) {
        setEditedReply(savedDraft)
        setReply(savedDraft) // Show draft as reply
        setHasDraft(true)
      }

      // Check post info and exclusions
      setIsLoadingPostInfo(true)
      fetch(`/api/check-post-info?postUrl=${encodeURIComponent(postUrl)}`)
        .then(res => res.json())
        .then(({ data, error }) => {
          if (!error && data) {
            setSubreddit(data.subreddit)
            setIsExcluded(data.isExcluded)
            setConfirmExcluded(false) // Reset confirmation on open
          }
        })
        .catch(() => {
          // Silently fail - we'll just proceed without exclusion check
        })
        .finally(() => setIsLoadingPostInfo(false))
    } else {
      // Reset state when modal closes
      setSubreddit(null)
      setIsExcluded(false)
      setConfirmExcluded(false)
      setEditedReply('')
      setHasDraft(false)
    }
  }, [isOpen, postUrl])

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset'
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!postUrl) return

    // Check if excluded and not confirmed
    if (isExcluded && !confirmExcluded) {
      setError('Please confirm that you want to proceed with posting to an excluded subreddit.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setReply(null)

    try {
      // Persist description one-time
      if (!localStorage.getItem('business_description') && businessDescription.trim().length > 0) {
        localStorage.setItem('business_description', businessDescription.trim())
      } else if (businessDescription.trim().length > 0) {
        localStorage.setItem('business_description', businessDescription.trim())
      }

      const res = await fetch('/api/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postUrl,
          businessDescription: businessDescription.trim(),
          style,
          includeComments,
        }),
      })

      const { data, error: apiError } = await res.json()
      if (!res.ok || apiError) throw new Error(apiError || 'Failed to generate reply')
      setReply(data.reply)
      setEditedReply(data.reply)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveDraft = () => {
    if (!postUrl || !editedReply.trim()) return
    
    const draftKey = `reply_draft_${postUrl}`
    localStorage.setItem(draftKey, editedReply.trim())
    setHasDraft(true)
  }

  const handleClearDraft = () => {
    if (!postUrl) return
    
    const draftKey = `reply_draft_${postUrl}`
    localStorage.removeItem(draftKey)
    setHasDraft(false)
    if (editedReply === reply) {
      setEditedReply('')
      setReply(null)
    }
  }

  if (!isOpen || !postUrl) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Generate AI Reply</h3>
            <p className="text-xs text-slate-500 break-all mt-1">{postUrl}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Business description</label>
            <textarea
              value={businessDescription}
              onChange={(e) => setBusinessDescription(e.target.value)}
              placeholder="Describe your business, audience, product/service, tone constraints..."
              rows={3}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              required
            />
            <p className="text-xs text-slate-500 mt-1">Saved for next time.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Style</label>
              <div className="relative">
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value as ReplyStyle)}
                  className="w-full px-4 py-3 pr-10 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white appearance-none cursor-pointer hover:border-indigo-400 hover:shadow-sm font-medium text-slate-900"
                >
                  {Object.entries(REPLY_STYLES).map(([key, config]) => (
                    <option key={key} value={key}>
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="md:col-span-2 flex items-center gap-3 mt-6 md:mt-8">
              <div className="relative flex items-center">
                <input
                  id="include-comments"
                  type="checkbox"
                  checked={includeComments}
                  onChange={(e) => setIncludeComments(e.target.checked)}
                  className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer transition-all"
                />
              </div>
              <label htmlFor="include-comments" className="text-sm text-slate-700 cursor-pointer">Include recent Reddit comments to tailor the reply</label>
            </div>
          </div>

          {/* Exclusion Warning */}
          {isExcluded && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-amber-900 mb-1">
                    Subreddit in Exclusion List
                  </h4>
                  <p className="text-sm text-amber-800 mb-3">
                    This post is from <span className="font-semibold">r/{subreddit}</span>, which is in your project's exclusion list.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      id="confirm-excluded"
                      type="checkbox"
                      checked={confirmExcluded}
                      onChange={(e) => setConfirmExcluded(e.target.checked)}
                      className="w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 cursor-pointer"
                    />
                    <label htmlFor="confirm-excluded" className="text-sm text-amber-800 cursor-pointer font-medium">
                      I understand and want to proceed anyway
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">Cancel</button>
            <button type="submit" disabled={isSubmitting || (isExcluded && !confirmExcluded)} className="px-4 py-2 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed font-semibold">
              {isSubmitting ? 'Generating...' : 'Generate Reply'}
            </button>
          </div>
        </form>

        {(reply || editedReply) && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-slate-700">Suggested reply</label>
              {hasDraft && (
                <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-medium border border-amber-200">
                  Draft saved
                </span>
              )}
            </div>
            <textarea
              value={editedReply}
              onChange={(e) => {
                setEditedReply(e.target.value)
                if (!reply) setReply(e.target.value)
              }}
              rows={12}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm resize-none font-mono"
              placeholder="Generated reply will appear here..."
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={!editedReply.trim()}
                  className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Save Draft
                </button>
                {hasDraft && (
                  <button
                    type="button"
                    onClick={handleClearDraft}
                    className="px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all"
                  >
                    Clear Draft
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(editedReply || reply || '') }}
                className="px-3 py-2 text-xs font-semibold text-white rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy to clipboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

