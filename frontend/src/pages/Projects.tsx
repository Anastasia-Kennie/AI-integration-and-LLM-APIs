import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { Plus, FolderOpen, Trash2, Users } from 'lucide-react'

interface Project {
  id: number; name: string; description: string | null; manager_id: number
  is_active: boolean; created_at: string; manager?: { id: number; name: string; email: string }
}

export default function Projects() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [loading, setLoading] = useState(false)
  const isManager = user?.role === 'manager'

  useEffect(() => {
    api.get('/api/projects').then(res => setProjects(res.data))
  }, [])

  async function createProject() {
    if (!form.name.trim()) return
    setLoading(true)
    try {
      const res = await api.post('/api/projects', form)
      setProjects(prev => [...prev, res.data])
      setForm({ name: '', description: '' })
      setShowForm(false)
    } finally {
      setLoading(false)
    }
  }

  async function deleteProject(id: number) {
    await api.delete(`/api/projects/${id}`)
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
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

      {!isManager && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          You are logged in as an <strong>Agent</strong>. Only managers can create projects.
        </div>
      )}

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
            <div key={project.id} className="bg-white rounded-xl p-5 border border-gray-100 hover:border-primary-200 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center">
                  <FolderOpen size={18} className="text-primary-600" />
                </div>
                {isManager && project.manager_id === user?.id && (
                  <button onClick={() => deleteProject(project.id)} className="text-gray-300 hover:text-red-500 transition-colors">
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
    </div>
  )
}
