import React, { useState } from 'react';
import { Briefcase, Plus, Trash2, Edit2, Check, X, Loader2 } from 'lucide-react';
import { createJobTitle, updateJobTitle, deleteJobTitle } from '../api/client';

interface JobTitlesModalProps {
  isOpen: boolean;
  onClose: () => void;
  titles: string[];
  onTitlesUpdated: () => void;
  onSelectTitle?: (title: string) => void;
}

export const JobTitlesModal: React.FC<JobTitlesModalProps> = ({
  isOpen,
  onClose,
  titles,
  onTitlesUpdated,
  onSelectTitle,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await createJobTitle(newTitle.trim());
      setNewTitle('');
      onTitlesUpdated();
      if (onSelectTitle) onSelectTitle(newTitle.trim());
    } catch (err: any) {
      setError(err.message || 'تعذر إضافة المسمى');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async (oldTitle: string) => {
    if (!editValue.trim() || editValue.trim() === oldTitle) {
      setEditingTitle(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await updateJobTitle(oldTitle, editValue.trim());
      setEditingTitle(null);
      onTitlesUpdated();
    } catch (err: any) {
      setError(err.message || 'تعذر تعديل المسمى');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (title: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف المسمى الوظيفي "${title}" من قائمة الاختيارات؟`)) return;
    setLoading(true);
    setError(null);
    try {
      await deleteJobTitle(title);
      onTitlesUpdated();
    } catch (err: any) {
      setError(err.message || 'تعذر حذف المسمى');
    } finally {
      setLoading(false);
    }
  };

  const filteredTitles = titles.filter(t => t.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">إدارة المسميات الوظيفية الموحدة</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">تحديد وتوحيد مسميات العاملين لتفادي التكرار والأخطاء</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold">
            {error}
          </div>
        )}

        {/* Add Form */}
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="أدخل مسمى وظيفي جديد (مثال: فني تغذية)"
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={loading || !newTitle.trim()}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>إضافة</span>
          </button>
        </form>

        {/* Search */}
        {titles.length > 5 && (
          <div>
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="بحث في المسميات..."
              className="w-full px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-900 dark:text-white border-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        )}

        {/* Titles List */}
        <div className="max-h-64 overflow-y-auto space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800/60 pr-1">
          {filteredTitles.map((title) => (
            <div key={title} className="flex items-center justify-between py-2 text-xs group">
              {editingTitle === title ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="flex-1 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveEdit(title)}
                    className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingTitle(null)}
                    className="p-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <span
                    onClick={() => {
                      if (onSelectTitle) {
                        onSelectTitle(title);
                        onClose();
                      }
                    }}
                    className={`font-semibold text-slate-800 dark:text-slate-200 ${
                      onSelectTitle ? 'cursor-pointer hover:text-emerald-500' : ''
                    }`}
                  >
                    {title}
                  </span>
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                    <button
                      onClick={() => {
                        setEditingTitle(title);
                        setEditValue(title);
                      }}
                      title="تعديل المسمى"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(title)}
                      title="حذف من القائمة"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {filteredTitles.length === 0 && (
            <div className="py-8 text-center text-slate-400 text-xs">لا توجد مسميات وظيفية مطابقة.</div>
          )}
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
