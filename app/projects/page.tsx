'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Project } from '@/lib/types'
import ConfirmationModal from '@/components/ConfirmationModal'
import { createClient } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export default function ProjectsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [projects, setProjects] = useState<Project[]>([])
  const [isAuthChecked, setIsAuthChecked] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null)
  const [templateContent, setTemplateContent] = useState('')
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const [editingExclusions, setEditingExclusions] = useState<string | null>(null)
  const [exclusionList, setExclusionList] = useState<string[]>([])
  const [newExclusion, setNewExclusion] = useState('')
  const [isSavingExclusions, setIsSavingExclusions] = useState(false)

  const fetchProjects = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/projects')
      const { data, error: apiError } = await response.json()

      if (!response.ok || apiError) {
        throw new Error(apiError || 'Failed to fetch projects')
      }

      setProjects(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

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
        await fetchProjects()
      } catch (err) {
        console.error('Auth check failed:', err)
        router.replace('/auth/login')
      }
    }

    checkAuthAndFetchProjects()
  }, [router, supabase])

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName.trim(),
          description: projectDescription.trim() || undefined,
        }),
      })

      const { data, error: apiError } = await response.json()

      if (!response.ok || apiError) {
        throw new Error(apiError || 'Failed to create project')
      }

      setProjectName('')
      setProjectDescription('')
      setShowForm(false)
      await fetchProjects()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    const project = projects.find(p => p.id === id)
    if (project) {
      setConfirmDelete({ id, name: project.name })
    }
  }

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return

    setDeletingId(confirmDelete.id)
    setConfirmDelete(null)

    try {
      const response = await fetch(`/api/projects?id=${confirmDelete.id}`, {
        method: 'DELETE',
      })

      const { error: apiError } = await response.json()

      if (!response.ok || apiError) {
        throw new Error(apiError || 'Failed to delete project')
      }

      await fetchProjects()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete project')
    } finally {
      setDeletingId(null)
    }
  }

  const handleEditTemplate = (project: Project) => {
    setEditingTemplate(project.id)
    setTemplateContent(project.prompt_template || '')
  }

  const handleSaveTemplate = async (projectId: string) => {
    setIsSavingTemplate(true)
    setError(null)

    try {
      const response = await fetch('/api/projects', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: projectId,
          prompt_template: templateContent,
        }),
      })

      const { error: apiError } = await response.json()

      if (!response.ok || apiError) {
        throw new Error(apiError || 'Failed to save template')
      }

      setEditingTemplate(null)
      setTemplateContent('')
      await fetchProjects()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setIsSavingTemplate(false)
    }
  }

  const handleEditExclusions = (project: Project) => {
    setEditingExclusions(project.id)
    setExclusionList(project.subreddit_exclusions || [])
    setNewExclusion('')
  }

  const handleAddExclusion = () => {
    const subreddit = newExclusion.trim().toLowerCase().replace(/^r\//, '')
    if (subreddit && !exclusionList.includes(subreddit)) {
      setExclusionList([...exclusionList, subreddit])
      setNewExclusion('')
    }
  }

  const handleRemoveExclusion = (subreddit: string) => {
    setExclusionList(exclusionList.filter(s => s !== subreddit))
  }

  const handleSaveExclusions = async (projectId: string) => {
    setIsSavingExclusions(true)
    setError(null)

    try {
      const response = await fetch('/api/projects', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: projectId,
          subreddit_exclusions: exclusionList,
        }),
      })

      const { error: apiError } = await response.json()

      if (!response.ok || apiError) {
        throw new Error(apiError || 'Failed to save exclusions')
      }

      setEditingExclusions(null)
      setExclusionList([])
      setNewExclusion('')
      await fetchProjects()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save exclusions')
    } finally {
      setIsSavingExclusions(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="text-center py-12">
            <p className="text-slate-600">Loading projects...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 bg-clip-text text-transparent mb-2">Projects</h1>
              <p className="text-slate-600 text-lg">
                Manage your projects. Each project can contain multiple keywords.
              </p>
            </div>
            <Link
              href="/keywords"
              className="px-4 py-2 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/40 font-semibold"
            >
              Manage Keywords
            </Link>
          </div>
        </div>

        {/* Create Project Form */}
        {showForm ? (
          <div className="card p-6 mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Create New Project</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="project-name" className="block text-sm font-semibold text-slate-700 mb-2">
                  Project Name *
                </label>
                <input
                  id="project-name"
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., Client A SEO Project"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  disabled={isCreating}
                  required
                />
              </div>
              <div>
                <label htmlFor="project-description" className="block text-sm font-semibold text-slate-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  id="project-description"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Brief description of this project..."
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                  disabled={isCreating}
                />
              </div>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-600 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-105 font-semibold flex items-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Project
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setProjectName('')
                    setProjectDescription('')
                    setError(null)
                  }}
                  className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="mb-8">
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-105 font-semibold flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New Project
            </button>
          </div>
        )}

        {/* Projects List */}
        {error && !showForm && (
          <div className="card p-6 mb-8 bg-red-50 border-red-200">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-gray-500 mb-4">No projects yet. Create your first project to get started!</p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-500/30 font-semibold text-sm"
            >
              Create Project
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {projects.map((project) => (
              <div key={project.id} className="card p-6 hover:shadow-lg transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">{project.name}</h3>
                    {project.description && (
                      <p className="text-sm text-slate-600 line-clamp-2">{project.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditTemplate(project)}
                      className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg p-2 transition-all"
                      title="Edit prompt template"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(project.id)}
                      disabled={deletingId === project.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg p-2 transition-all disabled:opacity-50"
                      title="Delete project"
                    >
                      {deletingId === project.id ? (
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Prompt Template Editor */}
                {editingTemplate === project.id ? (
                  <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-semibold text-slate-700">
                        Prompt Template
                        <span className="text-xs text-slate-500 ml-2 font-normal">(Use {`{{variableName}}`} for variables)</span>
                      </label>
                      <div className="text-xs text-slate-500 font-mono">
                        Available: {`{{tone}}`}, {`{{businessDescription}}`}, {`{{postUrl}}`}, {`{{postText}}`}, {`{{commentsText}}`}, {`{{subreddit}}`}, {`{{postTitle}}`}
                      </div>
                    </div>
                    <textarea
                      value={templateContent}
                      onChange={(e) => setTemplateContent(e.target.value)}
                      rows={12}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono text-sm resize-none"
                      placeholder="Enter your prompt template with {{variables}}..."
                    />
                    {error && editingTemplate === project.id && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-xs text-red-600">{error}</p>
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleSaveTemplate(project.id)}
                        disabled={isSavingTemplate}
                        className="px-4 py-2 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/40 disabled:opacity-50 font-semibold"
                      >
                        {isSavingTemplate ? 'Saving...' : 'Save Template'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingTemplate(null)
                          setTemplateContent('')
                          setError(null)
                        }}
                        className="px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-700">Prompt Template</span>
                      <button
                        onClick={() => handleEditTemplate(project)}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
                      >
                        {project.prompt_template ? 'Edit' : 'Add Template'}
                      </button>
                    </div>
                    {project.prompt_template ? (
                      <pre className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-3 font-mono">
                        {project.prompt_template}
                      </pre>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No custom template set. Using default.</p>
                    )}
                  </div>
                )}

                {/* Subreddit Exclusions Editor */}
                {editingExclusions === project.id ? (
                  <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Subreddit Exclusion List
                      <span className="text-xs text-slate-500 ml-2 font-normal">(Posts from these subreddits will show a warning)</span>
                    </label>
                    <div className="space-y-3">
                      {/* Add new exclusion */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newExclusion}
                          onChange={(e) => setNewExclusion(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleAddExclusion()
                            }
                          }}
                          placeholder="e.g., spam or r/spam"
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleAddExclusion}
                          disabled={!newExclusion.trim()}
                          className="px-4 py-2 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                        >
                          Add
                        </button>
                      </div>
                      {/* Exclusion list */}
                      {exclusionList.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {exclusionList.map((subreddit) => (
                            <span
                              key={subreddit}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-700"
                            >
                              <span className="font-medium">r/{subreddit}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveExclusion(subreddit)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded p-0.5 transition-all"
                                title="Remove"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">No exclusions. Add subreddits to exclude.</p>
                      )}
                    </div>
                    {error && editingExclusions === project.id && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-xs text-red-600">{error}</p>
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleSaveExclusions(project.id)}
                        disabled={isSavingExclusions}
                        className="px-4 py-2 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/40 disabled:opacity-50 font-semibold"
                      >
                        {isSavingExclusions ? 'Saving...' : 'Save Exclusions'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingExclusions(null)
                          setExclusionList([])
                          setNewExclusion('')
                          setError(null)
                        }}
                        className="px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-700">Subreddit Exclusions</span>
                      <button
                        onClick={() => handleEditExclusions(project)}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
                      >
                        Manage
                      </button>
                    </div>
                    {project.subreddit_exclusions && project.subreddit_exclusions.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {project.subreddit_exclusions.map((subreddit) => (
                          <span key={subreddit} className="inline-flex items-center px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-700 font-medium">
                            r/{subreddit}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No exclusions set.</p>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                  <span className="text-xs text-slate-500">
                    Created {new Date(project.created_at).toLocaleDateString()}
                  </span>
                  <Link
                    href={`/keywords?project=${project.id}`}
                    className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    View Keywords →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!confirmDelete}
        title="Delete Project"
        message={`Are you sure you want to delete "${confirmDelete?.name}"? All keywords in this project will also be deleted. This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}

