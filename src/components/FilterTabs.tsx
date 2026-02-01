import { ListFilter, User, Trash2, CheckCircle2 } from 'lucide-react';

export default function FilterTabs() {
  const tabs = [
    { name: 'All Leads', icon: ListFilter, count: 450, active: true },
    { name: 'My Leads', icon: User, count: 12, active: false },
    { name: 'Converted', icon: CheckCircle2, count: 5, active: false },
    { name: 'Trash', icon: Trash2, count: 2, active: false },
  ];

  return (
    <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
      {tabs.map((tab) => (
        <button
          key={tab.name}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap border ${
            tab.active 
            ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' 
            : 'glass-panel border-white/5 text-gray-400 hover:text-white hover:border-white/10'
          }`}
        >
          <tab.icon size={14} />
          {tab.name}
          <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] ${tab.active ? 'bg-white/20' : 'bg-black/20'}`}>
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  );
}