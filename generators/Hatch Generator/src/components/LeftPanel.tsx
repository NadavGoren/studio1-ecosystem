import { useState } from 'react';
import { LayersTab } from './sidebar/LayersTab';
import { useAppStore } from '../store';
import { Layers, FolderOpen, Save, Trash2, FilePlus, Calendar } from 'lucide-react';

export function LeftPanel() {
  const [activeTab, setActiveTab] = useState<'layers' | 'projects'>('layers');
  const [newProjectName, setNewProjectName] = useState('');
  const { savedProjects, saveProject, loadProject, deleteProject } = useAppStore();

  const handleSave = () => {
    if (!newProjectName.trim()) return;
    saveProject(newProjectName);
    setNewProjectName('');
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-72 flex flex-col border-r border-gray-200 bg-white h-full z-20 shadow-sm">
      {/* Tabs Header */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('layers')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'layers' 
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' 
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          <Layers size={14} /> Layers
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'projects' 
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' 
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          <FolderOpen size={14} /> Projects
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'layers' ? (
          <LayersTab />
        ) : (
          <div className="h-full flex flex-col p-4 overflow-y-auto">
            
            {/* Save New Project Section */}
            <div className="mb-6 bg-gray-50 p-3 rounded-lg border border-gray-100">
              <label className="text-xs font-bold text-gray-700 uppercase mb-2 block">Save Current Work</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Project Name..." 
                  className="flex-1 text-sm px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
                <button 
                  onClick={handleSave}
                  disabled={!newProjectName.trim()}
                  className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Save Project"
                >
                  <Save size={16} />
                </button>
              </div>
            </div>

            {/* Projects List */}
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                <span className="text-xs font-bold text-gray-500 uppercase">Saved Projects ({savedProjects.length})</span>
              </div>
              
              {savedProjects.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FilePlus size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No projects saved yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedProjects.map((project) => (
                    <div 
                      key={project.id} 
                      className="group flex flex-col bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all overflow-hidden"
                    >
                      <div className="p-3">
                        <div className="flex gap-3 mb-2">
                          {/* Thumbnail */}
                          {project.thumbnail ? (
                            <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded border border-gray-200 overflow-hidden flex items-center justify-center">
                              <img 
                                src={project.thumbnail} 
                                alt={project.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                              <FilePlus size={20} className="text-gray-400" />
                            </div>
                          )}
                          
                          {/* Project Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <h3 className="font-medium text-sm text-gray-800 truncate pr-2" title={project.name}>{project.name}</h3>
                              <button 
                                onClick={() => { if(confirm('Delete project?')) deleteProject(project.id); }}
                                className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            
                            <div className="flex items-center gap-4 text-[10px] text-gray-500">
                              <span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(project.date)}</span>
                              <span>{project.data.shapes.length} Shapes</span>
                            </div>
                          </div>
                        </div>

                        <button 
                          onClick={() => { if(confirm('Load project? Unsaved changes will be lost.')) loadProject(project.id); }}
                          className="w-full py-1.5 text-xs font-medium bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded border border-gray-200 hover:border-blue-200 transition-colors"
                        >
                          Load Project
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



