'use client'

import { useEffect, useState } from 'react'

interface GenerateReplyModalProps {
  isOpen: boolean
  postUrl: string | null
  onClose: () => void
}

export default function GenerateReplyModal({ isOpen, postUrl, onClose }: GenerateReplyModalProps) {
  const [businessDescription, setBusinessDescription] = useState('')
  const [style, setStyle] = useState<'casual' | 'laconic'>('casual')
  const [includeComments, setIncludeComments] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reply, setReply] = useState<string | null>(null)

  // Load saved description once
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('business_description')
      if (saved && !businessDescription) setBusinessDescription(saved)
    }
  }, [isOpen])

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset'
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!postUrl) return

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsSubmitting(false)
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
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as 'casual' | 'laconic')}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white"
              >
                <option value="casual">Casual</option>
                <option value="laconic">Laconic</option>
              </select>
            </div>
            <div className="md:col-span-2 flex items-center gap-3 mt-6 md:mt-8">
              <input
                id="include-comments"
                type="checkbox"
                checked={includeComments}
                onChange={(e) => setIncludeComments(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="include-comments" className="text-sm text-slate-700">Include recent Reddit comments to tailor the reply</label>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/40 disabled:opacity-50 font-semibold">
              {isSubmitting ? 'Generating...' : 'Generate Reply'}
            </button>
          </div>
        </form>

        {reply && (
          <div className="mt-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Suggested reply</label>
            <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 whitespace-pre-wrap text-sm text-slate-800">{reply}</div>
            <div className="flex justify-end mt-3">
              <button
                onClick={() => { navigator.clipboard.writeText(reply) }}
                className="px-3 py-2 text-xs font-semibold text-white rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              >
                Copy to clipboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

