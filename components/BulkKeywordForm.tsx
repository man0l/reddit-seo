'use client'

import { useState, FormEvent, KeyboardEvent, ClipboardEvent, useRef, useEffect } from 'react'

interface BulkKeywordFormProps {
  projectId: string
  onKeywordsAdded: () => void
}

export default function BulkKeywordForm({ projectId, onKeywordsAdded }: BulkKeywordFormProps) {
  const [keywords, setKeywords] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ added: number; skipped?: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Normalize keyword for comparison (trimmed, lowercase)
  const normalizeKeyword = (keyword: string): string => {
    return keyword.trim().toLowerCase()
  }

  // Check if keyword already exists (case-insensitive)
  const isDuplicate = (keyword: string): boolean => {
    const normalized = normalizeKeyword(keyword)
    return keywords.some((k) => normalizeKeyword(k) === normalized)
  }

  // Parse text into keywords (supports comma, newline, or space separation)
  const parseKeywords = (text: string): string[] => {
    const parsed = text
      .split(/[\n,]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
    
    // Remove duplicates (case-insensitive)
    const normalized = parsed.map((k) => normalizeKeyword(k))
    return parsed.filter((k, index) => normalized.indexOf(normalizeKeyword(k)) === index)
  }

  // Add keyword from input
  const addKeyword = (keyword: string) => {
    const trimmed = keyword.trim()
    if (!trimmed) return false

    if (isDuplicate(trimmed)) {
      setDuplicateError(`"${trimmed}" is already added`)
      setTimeout(() => setDuplicateError(null), 3000)
      return false
    }

    setKeywords([...keywords, trimmed])
    setInputValue('')
    setDuplicateError(null)
    return true
  }

  // Remove keyword by index
  const removeKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index))
  }

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    // Clear duplicate error when user starts typing
    if (duplicateError) {
      setDuplicateError(null)
    }
  }

  // Handle key press - add tag on comma or Enter
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault()
      if (inputValue.trim()) {
        addKeyword(inputValue)
      }
    } else if (e.key === 'Backspace' && inputValue === '' && keywords.length > 0) {
      // Remove last tag if input is empty and backspace is pressed
      removeKeyword(keywords.length - 1)
    }
    // Clear duplicate error when user starts typing
    if (duplicateError && e.key !== ',' && e.key !== 'Enter') {
      setDuplicateError(null)
    }
  }

  // Handle paste - parse pasted content and add keywords
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData('text')
    const parsedKeywords = parseKeywords(pastedText)
    
    if (parsedKeywords.length > 0) {
      // Add all parsed keywords that don't already exist (case-insensitive check)
      const newKeywords = parsedKeywords.filter((k) => !isDuplicate(k))
      
      if (newKeywords.length > 0) {
        setKeywords([...keywords, ...newKeywords])
        setDuplicateError(null)
      } else {
        setDuplicateError('All keywords are already added')
        setTimeout(() => setDuplicateError(null), 3000)
      }
      setInputValue('')
    }
  }

  // Copy all keywords to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(keywords.join(', '))
      // Show temporary feedback
      const copyBtn = document.getElementById('copy-btn')
      if (copyBtn) {
        const originalText = copyBtn.textContent
        copyBtn.textContent = 'Copied!'
        setTimeout(() => {
          if (copyBtn) copyBtn.textContent = originalText
        }, 2000)
      }
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Prepare keywords array including current input (check for duplicates)
    let keywordsToSubmit = [...keywords]
    if (inputValue.trim() && !isDuplicate(inputValue.trim())) {
      keywordsToSubmit.push(inputValue.trim())
    } else if (inputValue.trim() && isDuplicate(inputValue.trim())) {
      setError(`"${inputValue.trim()}" is already added`)
      return
    }

    if (keywordsToSubmit.length === 0) {
      setError('Please add at least one keyword')
      return
    }

    setIsLoading(true)

    // Clear input and keywords for UI
    setInputValue('')
    setKeywords([])

    try {
      const response = await fetch('/api/keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keywords: keywordsToSubmit, project_id: projectId }),
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to add keywords')
      }

      setKeywords([])
      setInputValue('')
      setSuccess({
        added: result.added || (Array.isArray(result.data) ? result.data.length : 1),
        skipped: result.skipped,
      })
      onKeywordsAdded()

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Focus input when component mounts or keywords change
  useEffect(() => {
    if (inputRef.current && !isLoading) {
      inputRef.current.focus()
    }
  }, [keywords.length, isLoading])

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="bulk-keywords" className="block text-sm font-semibold text-gray-700 mb-3">
          <span>Add keywords or copy and paste</span>
        </label>
        
        {/* Tag container */}
        <div className="min-h-[120px] w-full px-4 py-3 border border-slate-300 rounded-xl bg-white focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
          <div className="flex flex-wrap gap-2 mb-2">
            {keywords.map((keyword, index) => (
              <span
                key={`${keyword}-${index}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 rounded-lg text-sm font-semibold border border-indigo-200/50"
              >
                <span>{keyword}</span>
                <button
                  type="button"
                  onClick={() => removeKeyword(index)}
                  className="ml-1 text-indigo-600 hover:text-indigo-900 focus:outline-none rounded-full hover:bg-indigo-200 p-0.5"
                  aria-label={`Remove ${keyword}`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              id="bulk-keywords"
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={keywords.length === 0 ? 'Type keywords and press comma or Enter...' : ''}
              className="flex-1 min-w-[150px] outline-none text-sm"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Helper text and actions */}
        <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <p className="text-xs text-gray-500">
              {keywords.length > 0 
                ? `${keywords.length} keyword${keywords.length !== 1 ? 's' : ''} ready to add`
                : 'Type keywords and press comma or Enter to add them'}
            </p>
            {keywords.length > 0 && (
              <button
                type="button"
                id="copy-btn"
                onClick={handleCopy}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
              >
                Copy all
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isLoading || keywords.length === 0}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-105 font-semibold flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Adding...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add All Keywords ({keywords.length})
              </>
            )}
          </button>
        </div>

        {duplicateError && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
            <p className="text-sm text-yellow-800 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {duplicateError}
            </p>
          </div>
        )}
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-600 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </p>
          </div>
        )}
        {success && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-sm text-green-800 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Successfully added <strong>{success.added}</strong> keyword(s)
              {success.skipped && success.skipped > 0 && (
                <span className="ml-2 text-green-600">
                  ({success.skipped} already existed and were skipped)
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </form>
  )
}
