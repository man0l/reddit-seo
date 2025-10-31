'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import KeywordForm from '@/components/KeywordForm'
import BulkKeywordForm from '@/components/BulkKeywordForm'
import KeywordList from '@/components/KeywordList'
import { Project } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export default function KeywordsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isAuthChecked, setIsAuthChecked] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single')
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickProjectName, setQuickProjectName] = useState('')
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    const checkAuthAndFetchProjects = async () => {
      try {
        // Check authentication first
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          router.replace('/auth/login')
          return
        }
        
        setIsAuthChecked(true)

        const response = await fetch('/api/projects')
        const { data, error } = await response.json()
        
        if (!response.ok || error) {
          if (response.status === 401) {
            router.replace('/auth/login')
            return
          }
          throw new Error(error || 'Failed to fetch projects')
        }
        
        setProjects(data || [])
        // Auto-select first project if available
        if (data && data.length > 0 && !selectedProjectId) {
          setSelectedProjectId(data[0].id)
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err)
      } finally {
        setIsLoadingProjects(false)
      }
    }

    checkAuthAndFetchProjects()
  }, [router, supabase, selectedProjectId])

  // Don't render until auth is checked
  if (!isAuthChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  const handleKeywordAdded = () => {
    setRefreshKey((prev) => prev + 1)
  }

  const handleKeywordClick = (keyword: string) => {
    router.push(`/keywords/${encodeURIComponent(keyword)}`)
  }

  const handleProjectCreated = async () => {
    // Refresh projects list
    const response = await fetch('/api/projects')
    const { data, error } = await response.json()
    if (!error && data) {
      setProjects(data)
      if (data.length > 0 && !selectedProjectId) {
        setSelectedProjectId(data[0].id)
      }
    }
  }

  const handleQuickCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickProjectName.trim()) return

    setIsCreatingProject(true)
    setCreateError(null)

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: quickProjectName.trim(),
        }),
      })

      const { data, error: apiError } = await response.json()

      if (!response.ok || apiError) {
        throw new Error(apiError || 'Failed to create project')
      }

      // Refresh projects and select the new one
      await handleProjectCreated()
      if (data?.id) {
        setSelectedProjectId(data.id)
      }

      setQuickProjectName('')
      setShowQuickAdd(false)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsCreatingProject(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 bg-clip-text text-transparent mb-2">Keyword Management</h1>
              <p className="text-slate-600 text-lg">
                Add keywords to track Reddit posts that rank on Google&apos;s first page
              </p>
            </div>
            <Link
              href="/projects"
              className="px-4 py-2 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/40 font-semibold"
            >
              Manage Projects
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
            <span>💡</span>
            <span>Click &quot;Check Rankings&quot; to find Reddit posts for each keyword. Rankings will be displayed inline below each keyword.</span>
          </p>
        </div>

        {/* Project Selector */}
        {isLoadingProjects ? (
          <div className="card p-6 mb-8">
            <p className="text-slate-600">Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="card p-6 mb-8 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border-indigo-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/30">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900 mb-1">No Projects Found</h3>
                <p className="text-sm text-slate-700 leading-relaxed mb-4">
                  Create a project first before adding keywords. Projects help organize your keywords.
                </p>
                <Link
                  href="/projects"
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-500/30 font-semibold text-sm"
                >
                  Create First Project
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="card p-6 mb-8">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-slate-700">
                Select Project
              </label>
              {!showQuickAdd && (
                <button
                  onClick={() => setShowQuickAdd(true)}
                  className="text-xs px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/40 font-semibold flex items-center gap-1.5"
                  title="Quick add project"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Quick Add
                </button>
              )}
            </div>
            
            {showQuickAdd ? (
              <form onSubmit={handleQuickCreateProject} className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={quickProjectName}
                    onChange={(e) => setQuickProjectName(e.target.value)}
                    placeholder="Project name..."
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                    disabled={isCreatingProject}
                    autoFocus
                    required
                  />
                  <button
                    type="submit"
                    disabled={isCreatingProject || !quickProjectName.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm flex items-center gap-2"
                  >
                    {isCreatingProject ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Create
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickAdd(false)
                      setQuickProjectName('')
                      setCreateError(null)
                    }}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all font-semibold text-sm"
                  >
                    Cancel
                  </button>
                </div>
                {createError && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-600 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {createError}
                    </p>
                  </div>
                )}
              </form>
            ) : (
              <select
                value={selectedProjectId || ''}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white font-medium"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Keyword Form Card */}
        {selectedProjectId && (
          <div className="card p-6 mb-8">
            {/* Tabs */}
            <div className="mb-6 border-b border-gray-200">
              <nav className="-mb-px flex gap-2">
                <button
                  onClick={() => setActiveTab('single')}
                  className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                    activeTab === 'single'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Add Single Keyword
                </button>
                <button
                  onClick={() => setActiveTab('bulk')}
                  className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                    activeTab === 'bulk'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Bulk Add Keywords
                </button>
              </nav>
            </div>

            {/* Forms */}
            {activeTab === 'single' ? (
              <KeywordForm projectId={selectedProjectId} onKeywordAdded={handleKeywordAdded} />
            ) : (
              <BulkKeywordForm projectId={selectedProjectId} onKeywordsAdded={handleKeywordAdded} />
            )}
          </div>
        )}

        {/* Keyword List */}
        {selectedProjectId && (
          <div key={refreshKey}>
            <KeywordList projectId={selectedProjectId} onKeywordClick={handleKeywordClick} />
          </div>
        )}
      </div>
    </div>
  )
}

