
import React, { useState } from 'react';
import { Line, AppState, User } from '../types';
import { Plus, Trash2, Layers, Edit, X, Eye } from 'lucide-react';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

const LineManagement: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!name.trim()) return;

    if (editingId) {
      onUpdate({
        ...state,
        lines: state.lines.map(l => l.id === editingId ? { ...l, name: name.trim() } : l)
      });
      setEditingId(null);
    } else {
      const newLine: Line = {
        id: crypto.randomUUID(),
        name: name.trim()
      };
      onUpdate({
        ...state,
        lines: [...state.lines, newLine]
      });
    }
    setName('');
  };

  const startEdit = (line: Line) => {
    if (!hasPermission) return;
    setEditingId(line.id);
    setName(line.name);
  };

  const removeLine = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Tem certeza? Isso pode afetar as gaiolas vinculadas.')) return;
    onUpdate({
      ...state,
      lines: state.lines.filter(l => l.id !== id),
      cages: state.cages.filter(c => c.lineId !== id)
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {hasPermission ? (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold mb-4 text-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {editingId ? <Edit className="w-5 h-5 text-amber-500" /> : <Plus className="w-5 h-5 text-blue-500" />}
              {editingId ? 'Editar Linha' : 'Nova Linha'}
            </div>
            {editingId && (
              <button onClick={() => { setEditingId(null); setName(''); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            )}
          </h3>
          <form onSubmit={handleSave} className="flex gap-4">
            <input 
              type="text" 
              placeholder="Ex: Linha 01" 
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button 
              type="submit"
              className={`${editingId ? 'bg-amber-600' : 'bg-blue-600'} text-white px-6 py-2 rounded-lg hover:opacity-90 transition-colors flex items-center gap-2 font-bold uppercase text-xs tracking-widest`}
            >
              {editingId ? 'Salvar' : 'Adicionar'}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-slate-100 p-6 rounded-xl border border-dashed border-slate-300 flex items-center gap-3 text-slate-500">
          <Eye className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-widest">Modo de Visualização (Apenas Leitura)</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {state.lines.map(line => (
          <div key={line.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-slate-800">{line.name}</div>
                <div className="text-xs text-slate-400">
                  {state.cages.filter(c => c.lineId === line.id).length} gaiolas
                </div>
              </div>
            </div>
            {hasPermission && (
              <div className="flex gap-2">
                <button onClick={() => startEdit(line)} className="text-slate-300 hover:text-blue-500 p-2 transition-colors">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => removeLine(line.id)} className="text-slate-300 hover:text-red-500 p-2 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LineManagement;
