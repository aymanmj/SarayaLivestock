import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Search, Filter, Plus, ShieldAlert, HeartPulse, Scale, Milk, Layers, RefreshCw, Eye, ShoppingBag } from 'lucide-react';
import { Animal, Species } from '../api/types';
import { useAnimalsQuery } from '../api/queries';
import { AddAnimalModal } from '../components/AddAnimalModal';
import { AnimalProfileModal } from '../components/AnimalProfileModal';

export const AnimalsDirectory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState<string>('ALL');
  const [purposeFilter, setPurposeFilter] = useState<string>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);

  const { data: animals = [], isLoading: loading, error, refetch: loadAnimals } = useAnimalsQuery(searchTerm);
  const loadError = error ? (error as Error).message || 'تعذر تحميل سجل القطيع' : null;

  const filtered = animals.filter(animal => {
    const matchesSearch = 
      animal.tagNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (animal.rfidTag && animal.rfidTag.includes(searchTerm)) ||
      (animal.name && animal.name.includes(searchTerm)) ||
      (animal.breed && animal.breed.includes(searchTerm));
    
    const matchesSpecies = speciesFilter === 'ALL' || animal.species === speciesFilter;
    const matchesPurpose = purposeFilter === 'ALL' || animal.purpose === purposeFilter;

    return matchesSearch && matchesSpecies && matchesPurpose;
  });

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {loadError}
        </div>
      )}
      {/* Top Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
            سجل القطيع والماشية الرقمي
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">إدارة ملفات الأبقار والأغنام والماعز مع شجرة النسب والحالة الإنتاجية والصحية</p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => { loadAnimals(); }}
            disabled={loading}
            className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            title="تحديث القائمة"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-700 dark:text-emerald-400' : ''}`} />
          </button>
          <Link
            to="/sales"
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center gap-2 transition"
          >
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
            <span>المبيعات والنفوق (IAS 41)</span>
          </Link>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-900/30"
          >
            <Plus className="w-4 h-4" />
            إضافة رأس / مولود جديد
          </button>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="بحث برقم القرط، شريحة RFID، الاسم، أو السلالة..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pr-11 pl-4 py-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition shadow-inner"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {/* Species Filter */}
          <select
            value={speciesFilter}
            onChange={e => setSpeciesFilter(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">جميع الفصائل</option>
            <option value="CATTLE">أبقار (Cattle)</option>
            <option value="SHEEP">أغنام (Sheep)</option>
            <option value="GOAT">ماعز (Goat)</option>
          </select>

          {/* Purpose Filter */}
          <select
            value={purposeFilter}
            onChange={e => setPurposeFilter(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">جميع الأغراض</option>
            <option value="DAIRY">ألبان (Dairy)</option>
            <option value="BEEF">تسمين ولحوم (Beef)</option>
            <option value="DUAL">ثنائي الغرض (Dual)</option>
          </select>
        </div>
      </div>

      {/* Herd Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filtered.map(animal => {
          const isQuarantined = animal.withdrawalEndDate && new Date(animal.withdrawalEndDate) > new Date();
          
          return (
            <div
              key={animal.id}
              onClick={() => setSelectedAnimalId(animal.id)}
              className={`bg-white/90 dark:bg-slate-900/90 border rounded-2xl p-5 shadow-lg transition hover:-translate-y-1 cursor-pointer flex flex-col justify-between ${
                isQuarantined 
                  ? 'border-red-500/50 hover:border-red-500 shadow-red-950/20' 
                  : 'border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/50'
              }`}
            >
              <div>
                {/* Card Top: Tag Number & Status */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold text-slate-900 dark:text-white">#{animal.tagNumber}</span>
                    {animal.name && <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">({animal.name})</span>}
                  </div>
                  {isQuarantined ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      تحريم
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                      {animal.currentLifeStage || 'نشط'}
                    </span>
                  )}
                </div>

                {/* Card Meta Info */}
                <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center justify-between">
                    <span>السلالة:</span>
                    <strong className="text-slate-900 dark:text-white font-medium">{animal.breed}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>الجنس والغرض:</span>
                    <span className="text-slate-700 dark:text-slate-300">{animal.gender === 'FEMALE' ? 'أنثى' : 'ذكر'} • {animal.purpose}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>العنبر / الحظيرة:</span>
                    <span className="text-slate-700 dark:text-slate-300">{animal.barn?.name || 'غير مرتبط بعنبر'}</span>
                  </div>
                </div>
              </div>

              {/* Card Footer: Weight & View Profile */}
              <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
                  <Scale className="w-3.5 h-3.5" />
                  <span>{animal.entryWeightKg != null ? `${animal.entryWeightKg} كجم` : 'الوزن غير مسجل'}</span>
                </div>

                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAnimalId(animal.id);
                  }}
                  className="p-1.5 hover:bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-white rounded-lg transition flex items-center gap-1 text-[11px]"
                >
                  <Eye className="w-3.5 h-3.5" />
                  عرض الملف
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="p-12 text-center bg-white/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
          <Layers className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="font-bold text-slate-900 dark:text-white text-base">لم يتم العثور على أي نتائج مطابقة</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">جرّب تغيير عبارة البحث أو الفلاتر المحددة</p>
        </div>
      )}

      {/* Modals */}
      <AddAnimalModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={loadAnimals}
      />

      <AnimalProfileModal
        animalId={selectedAnimalId}
        onClose={() => setSelectedAnimalId(null)}
      />
    </div>
  );
};
