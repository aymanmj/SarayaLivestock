import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  Shield, 
  KeyRound, 
  Plus, 
  Lock, 
  Unlock, 
  RotateCw, 
  CheckCircle2, 
  ShieldCheck,
  Building2
} from 'lucide-react';
import { UserRole } from '../context/AuthContext';
import { generatedApiClient, unwrapGenerated } from '../api/client';
import { VaultSecurityModal } from '../components/VaultSecurityModal';
import type { components } from '../api/generated/schema';

type SystemUser = components['schemas']['UserAdministrationResponseDto'];

const ROLE_LABELS: Record<UserRole, { title: string; color: string; desc: string }> = {
  SUPER_ADMIN: {
    title: 'مدير عام المنظومة (Super Admin)',
    color: 'bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
    desc: 'صلاحيات مطلقة لكافة إعدادات المزرعة، والتقارير المالية، والأمان، وإدارة المستخدمين.',
  },
  FARM_MANAGER: {
    title: 'مدير العمليات الميدانية (Farm Manager)',
    color: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    desc: 'إشراف شامل على القطيع، والمحلب، والتغذية، والتسمين، واستخراج تقارير الأداء.',
  },
  VETERINARIAN: {
    title: 'طبيب بيطري (Veterinarian)',
    color: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30',
    desc: 'تسجيل العلاجات، وتفعيل أقفال الأمان والتحريم، وجدولة ومتابعة السونار والتلقيح.',
  },
  MILKER: {
    title: 'مشرف ومشغل المحلب (Milker)',
    color: 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    desc: 'محطة التسجيل السريع للحلب، وقراءة الموازين، وربط تانك التجميع، وتتبع الإنتاج.',
  },
  ACCOUNTANT: {
    title: 'محاسب ومسؤول المشتريات (Accountant)',
    color: 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    desc: 'التقارير المالية، وشلال التكلفة، وتقييم الأصول البيولوجية IAS 41، ومشتريات الأعلاف.',
  },
  WORKER: {
    title: 'فني ميداني وتغذية (Field Worker)',
    color: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
    desc: 'وزن الماشية، وصرف خلطات الأعلاف للعنابر، ومتابعة حركات القطيع.',
  },
};

export const UsersManagement: React.FC = () => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // New user form state
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('WORKER');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const json = unwrapGenerated(
        await generatedApiClient.GET('/api/v1/users'),
        'تحميل المستخدمين',
      );
      setUsers(Array.isArray(json) ? json : []);
    } catch (error: any) {
      setUsers([]);
      setFeedback(error.message || 'تعذر تحميل المستخدمين من الخادم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async (id: string, current: boolean) => {
    try {
      const updated = unwrapGenerated(await generatedApiClient.PATCH('/api/v1/users/{id}/toggle-status', {
        params: { path: { id } },
      }), 'تحديث حالة المستخدم');
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updated } : u));
      setFeedback('تم تحديث حالة تفعيل المستخدم بنجاح.');
    } catch (error: any) {
      setFeedback(error.message || 'تعذر تحديث حالة المستخدم');
    }
  };

  const handleRoleChange = async (id: string, role: UserRole) => {
    try {
      const updated = unwrapGenerated(await generatedApiClient.PATCH('/api/v1/users/{id}/role', {
        params: { path: { id } },
        body: { role },
      }), 'تحديث دور المستخدم');
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updated } : u));
      setFeedback('تم تعديل دور وصلاحيات المستخدم بنجاح.');
    } catch (error: any) {
      setFeedback(error.message || 'تعذر تحديث دور المستخدم');
    }
  };

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newFullName) return;

    try {
      const body = unwrapGenerated(await generatedApiClient.POST('/api/v1/auth/register', {
        body: {
          username: newUsername,
          fullName: newFullName,
          email: newEmail || undefined,
          password: newPassword,
          role: newRole,
        },
      }), 'إنشاء المستخدم');
      setUsers(prev => [{ ...body, isActive: true, farm: null }, ...prev]);
      setFeedback(`✓ تم إنشاء حساب المستخدم (${newFullName}) بنجاح.`);
      setIsAddingUser(false);
      setNewUsername('');
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');
    } catch (error: any) {
      setFeedback(error.message || 'تعذر إنشاء المستخدم');
    }
  };

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  const openEditModal = (u: SystemUser) => {
    setEditingUserId(u.id);
    setEditUsername(u.username);
    setEditFullName(u.fullName);
    setEditEmail(u.email || '');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId || !editUsername || !editFullName) return;

    try {
      const updated = unwrapGenerated(await generatedApiClient.PATCH('/api/v1/users/{id}', {
        params: { path: { id: editingUserId } },
        body: {
          username: editUsername,
          fullName: editFullName,
          email: editEmail || undefined,
        },
      }), 'تعديل بيانات المستخدم');
      
      setUsers(prev => prev.map(u => u.id === editingUserId ? { ...u, ...updated } : u));
      setFeedback(`✓ تم تحديث بيانات (${editFullName}) بنجاح.`);
      setEditingUserId(null);
    } catch (error: any) {
      setFeedback(error.message || 'تعذر تعديل المستخدم');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
            إدارة المستخدمين والأدوار والصلاحيات (RBAC & Security)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            توزيع الصلاحيات الميدانية والإدارية، وتدوير الأسرار ومفاتيح التشفير، وحماية العمليات
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsVaultModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30 text-xs font-bold flex items-center gap-2 transition"
          >
            <ShieldCheck className="w-4 h-4" />
            خزينة الأسرار (HashiCorp Vault)
          </button>

          <button
            onClick={() => setIsAddingUser(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            إضافة مستخدم جديد
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      {/* Add User Modal / Form */}
      {isAddingUser && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/40 shadow-2xl animate-in fade-in duration-200">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            تسجيل مستخدم جديد في منظومة المزرعة
          </h3>

          <form onSubmit={handleAddUserSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1 font-semibold">اسم المستخدم (Username)</label>
              <input
                type="text"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="مثال: vet.ahmed"
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1 font-semibold">الاسم ثلاثي</label>
              <input
                type="text"
                value={newFullName}
                onChange={e => setNewFullName(e.target.value)}
                placeholder="د. أحمد الصاوي"
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1 font-semibold">البريد الإلكتروني</label>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="ahmed@saraya-livestock.com"
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1 font-semibold">الدور والصلاحية (Role)</label>
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value as UserRole)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="SUPER_ADMIN">مدير عام المنظومة (SUPER_ADMIN)</option>
                <option value="FARM_MANAGER">مدير المزرعة (FARM_MANAGER)</option>
                <option value="VETERINARIAN">طبيب بيطري (VETERINARIAN)</option>
                <option value="MILKER">مشرف محلب (MILKER)</option>
                <option value="ACCOUNTANT">محاسب مالي (ACCOUNTANT)</option>
                <option value="WORKER">فني ميداني (WORKER)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1 font-semibold">كلمة المرور المبدئية</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                minLength={12}
                required
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition"
              >
                حفظ المستخدم
              </button>
              <button
                type="button"
                onClick={() => setIsAddingUser(false)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUserId && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/40 shadow-2xl animate-in fade-in duration-200">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            تعديل بيانات المستخدم
          </h3>

          <form onSubmit={handleEditSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1 font-semibold">اسم المستخدم (Username)</label>
              <input
                type="text"
                value={editUsername}
                onChange={e => setEditUsername(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1 font-semibold">الاسم ثلاثي</label>
              <input
                type="text"
                value={editFullName}
                onChange={e => setEditFullName(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1 font-semibold">البريد الإلكتروني</label>
              <input
                type="email"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-3 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingUserId(null)}
                className="px-6 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition"
              >
                حفظ التعديلات
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            سجل مستخدمي المنظومة ومشغلي المزرعة
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{users.length} مستخدم مسجل</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50/40 dark:bg-slate-950/40">
                <th className="py-3 px-4">المستخدم</th>
                <th className="py-3 px-4">البريد الإلكتروني</th>
                <th className="py-3 px-4">الدور الوظيفي والصلاحيات</th>
                <th className="py-3 px-4">الحالة</th>
                <th className="py-3 px-4 text-left">إجراءات الحساب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-xs">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-100/40 dark:bg-slate-800/40 transition">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-emerald-700 dark:text-emerald-400 text-xs">
                        {u.fullName.slice(0, 1)}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">{u.fullName}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">@{u.username}</span>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">{u.email || '-'}</td>

                  <td className="py-3 px-4">
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value as UserRole)}
                      className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200 text-[11px] font-bold focus:outline-none focus:border-emerald-500"
                    >
                      <option value="SUPER_ADMIN">مدير عام (SUPER_ADMIN)</option>
                      <option value="FARM_MANAGER">مدير المزرعة (FARM_MANAGER)</option>
                      <option value="VETERINARIAN">طبيب بيطري (VETERINARIAN)</option>
                      <option value="MILKER">مشرف محلب (MILKER)</option>
                      <option value="ACCOUNTANT">محاسب (ACCOUNTANT)</option>
                      <option value="WORKER">فني ميداني (WORKER)</option>
                    </select>
                  </td>

                  <td className="py-3 px-4">
                    {u.isActive ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                        نشط ومفعل
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400">
                        معطل مؤقتاً
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-left flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditModal(u)}
                      className="px-3 py-1 rounded-lg text-[11px] font-bold transition border bg-indigo-100 dark:bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => handleToggleStatus(u.id, u.isActive)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition border ${
                        u.isActive
                          ? 'bg-rose-100 dark:bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30'
                          : 'bg-emerald-100 dark:bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {u.isActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vault Security Modal */}
      <VaultSecurityModal
        isOpen={isVaultModalOpen}
        onClose={() => setIsVaultModalOpen(false)}
      />
    </div>
  );
};
