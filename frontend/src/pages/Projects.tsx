import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { Plus, FolderOpen, Trash2, Users, Upload, Download, File, ArrowLeft, X } from 'lucide-react'
import clsx from 'clsx'

interface Project {
  id: number; name: string; description: string | null; manager_id: number
  is_active: boolean; created_at: string; manager?: { id: number; name: string; email: string }
}

interface ProjectFile {
  id: number; filename: string; content_type: string
  file_size: number; created_at: string; uploader_name: string
}

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileIcon(ct: string) {
  if (ct.startsWith('image/')) return '🖼️'
  if (ct === 'application/pdf') return '📄'
  if (ct.includes('word')) return '📝'
  if (ct.includes('sheet') || ct.includes('excel')) return '📊'
  if (ct.includes('zip') || ct.includes('rar')) return '🗜️'
  return '📁'
}

export default function Projects() {
  const { user } = useAuth()
  const [projects, setProjects]         = useState<Project[]>([])
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState({ name: '', description: '' })
  const [loading, setLoading]           = useState(false)
  const [selected, setSelected]         = useState<Project | null>(null)
  const [files, setFiles]               = useState<ProjectFile[]>([])
  const [uploading, setUploading]       = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const isManager = user?.role === 'manager'

  useEffect(() => {
    api.get('/api/projects').then(res => setProjects(res.data))
  }, [])

  async function openProject(p: Project) {
    setSelected(p)
    const res = await api.get(`/api/projects/${p.id}/files`)
    setFiles(res.data)
  }

  async function createProject() {
    if (!form.name.trim()) return
    setLoading(true)
    try {
      const res = await api.post('/api/projects', form)
      setProjects(prev => [...prev, res.data])
      setForm({ name: '', description: '' })
      setShowForm(false)
    } finally { setLoading(false) }
  }

  async function deleteProject(id: number) {
    await api.delete(`/api/projects/${id}`)
    setProjects(prev => prev.filter(p => p.id !== id))
    setDeleteConfirm(null)
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selected) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post(`/api/projects/${selected.id}/files`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setFiles(prev => [res.data, ...prev])
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function downloadFile(pf: ProjectFile) {
    const token = localStorage.getItem('token') ?? ''
    const base = import.meta.env.VITE_API_URL ?? ''
    const url = `${base}/api/projects/${selected!.id}/files/${pf.id}/download?token=${encodeURIComponent(token)}`
    const a = document.createElement('a')
    a.href = url
    a.download = pf.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function deleteFile(fileId: number) {
    await api.delete(`/api/projects/${selected!.id}/files/${fileId}`)
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  if (selected) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center">
            <FolderOpen size={18} className="text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{selected.name}</h1>
            {selected.description && <p className="text-xs text-gray-400 mt-0.5">{selected.description}</p>}
          </div>
          {isManager && selected.manager_id === user?.id && (
            <div className="ml-auto flex items-center gap-2">
              <input ref={fileRef} type="file" className="hidden" onChange={uploadFile} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors">
                <Upload size={15} />
                {uploading ? 'Uploading…' : 'Upload File'}
              </button>
            </div>
          )}
        </div>

        {files.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100 text-gray-400">
            <File size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No files yet.</p>
            {isManager && selected.manager_id === user?.id && (
              <p className="text-xs mt-1">Upload files using the button above.</p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium">File</th>
                  <th className="text-left px-5 py-3 font-medium">Uploaded by</th>
                  <th className="text-left px-5 py-3 font-medium">Size</th>
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {files.map(f => (
                  <tr key={f.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{fileIcon(f.content_type)}</span>
                        <span className="text-sm font-medium text-gray-800 max-w-[220px] truncate">{f.filename}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">{f.uploader_name}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{fmt(f.file_size)}</td>
                    <td className="px-5 py-3 text-sm text-gray-400">
                      {new Date(f.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => downloadFile(f)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="Download">
                          <Download size={15} />
                        </button>
                        {isManager && selected.manager_id === user?.id && (
                          <button onClick={() => deleteFile(f.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                            <X size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto overflow-y-auto flex-1">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isManager ? 'Manage your team projects' : 'Projects you are assigned to'}
          </p>
        </div>
        {isManager && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
            <Plus size={16} /> New Project
          </button>
        )}
      </div>


      {showForm && isManager && (
        <div className="mb-6 bg-white rounded-xl p-5 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Create New Project</h3>
          <div className="space-y-3">
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Project name *" required
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Description (optional)" rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
            <div className="flex gap-2">
              <button onClick={createProject} disabled={loading || !form.name.trim()}
                className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors">
                {loading ? 'Creating...' : 'Create Project'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">{isManager ? 'No projects yet. Create your first project!' : 'You have not been added to any projects yet.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <div key={project.id}
              className="bg-white rounded-xl p-5 border border-gray-100 hover:border-primary-200 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => openProject(project)}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center">
                  <FolderOpen size={18} className="text-primary-600" />
                </div>
                {isManager && project.manager_id === user?.id && (
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteConfirm(project.id) }}
                    className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <h3 className="font-semibold text-gray-800 mb-1">{project.name}</h3>
              {project.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{project.description}</p>}
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Users size={12} />
                <span>Manager: {project.manager?.name ?? 'You'}</span>
              </div>
              <div className="mt-2 text-xs text-gray-400">
                Created {new Date(project.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl w-80">
            <h3 className="font-semibold text-gray-900 mb-2">Delete project?</h3>
            <p className="text-sm text-gray-500 mb-4">This will also remove all uploaded files. This action cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => deleteProject(deleteConfirm)}
                className="flex-1 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">
                Delete
              </button>
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
