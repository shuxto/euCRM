interface TeamStatsProps {
  stats: Record<string, number>;
}

export default function TeamStats({ stats }: TeamStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-3 md:col-span-2">
      <div className="glass-panel p-3 rounded-xl border-l-4 border-l-green-500">
        <p className="text-[9px] uppercase font-bold text-green-400">Conversion</p>
        <p className="text-2xl font-bold text-white">{stats.conversion}</p>
      </div>
      <div className="glass-panel p-3 rounded-xl border-l-4 border-l-fuchsia-500">
        <p className="text-[9px] uppercase font-bold text-fuchsia-400">Retention</p>
        <p className="text-2xl font-bold text-white">{stats.retention}</p>
      </div>
      <div className="glass-panel p-3 rounded-xl border-l-4 border-l-yellow-500">
        <p className="text-[9px] uppercase font-bold text-yellow-400">Compliance</p>
        <p className="text-2xl font-bold text-white">{stats.compliance}</p>
      </div>
      <div className="glass-panel p-3 rounded-xl border-l-4 border-l-cyan-500">
        <p className="text-[9px] uppercase font-bold text-cyan-400">Leaders</p>
        <p className="text-2xl font-bold text-white">{stats.leader}</p>
      </div>
      <div className="glass-panel p-3 rounded-xl border-l-4 border-l-purple-500">
        <p className="text-[9px] uppercase font-bold text-purple-400">Managers</p>
        <p className="text-2xl font-bold text-white">{stats.manager}</p>
      </div>
      <div className="glass-panel p-3 rounded-xl border-l-4 border-l-red-500">
        <p className="text-[9px] uppercase font-bold text-red-400">Admins</p>
        <p className="text-2xl font-bold text-white">{stats.admin}</p>
      </div>
    </div>
  );
}