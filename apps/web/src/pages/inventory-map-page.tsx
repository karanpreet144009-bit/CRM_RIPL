import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Grid3X3, UserRound } from 'lucide-react';
import { api } from '../lib/api';

type Property = {
  id: string;
  unitNumber: string;
  type: string;
  status: string;
  dealingExecutiveName?: string | null;
  lockCustomerName?: string | null;
  project: { name: string };
};

type MapStatus = 'AVAILABLE' | 'IN_DISCUSSION' | 'HOLD' | 'RESERVED' | 'BOOKED' | 'SOLD';

const statusStyle: Record<MapStatus, { label: string; tile: string; legend: string }> = {
  AVAILABLE: { label: 'Available', tile: 'border-emerald-300 bg-emerald-50 text-emerald-950 hover:bg-emerald-100', legend: 'bg-emerald-500' },
  IN_DISCUSSION: { label: 'In talks', tile: 'border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100', legend: 'bg-amber-500' },
  HOLD: { label: 'Hold', tile: 'border-orange-300 bg-orange-50 text-orange-950 hover:bg-orange-100', legend: 'bg-orange-500' },
  RESERVED: { label: 'Reserved', tile: 'border-blue-300 bg-blue-50 text-blue-950 hover:bg-blue-100', legend: 'bg-blue-500' },
  BOOKED: { label: 'Booked', tile: 'border-violet-300 bg-violet-50 text-violet-950 hover:bg-violet-100', legend: 'bg-violet-500' },
  SOLD: { label: 'Sold', tile: 'border-slate-400 bg-slate-200 text-slate-700 hover:bg-slate-300', legend: 'bg-slate-600' },
};

function mapStatus(status: string): MapStatus {
  if (status === 'SOLD') return 'SOLD';
  if (status === 'BOOKED') return 'BOOKED';
  if (['RESERVED', 'TOKEN_RECEIVED', 'BOOKING_IN_PROGRESS'].includes(status)) return 'RESERVED';
  if (['HOLD', 'BLOCKED', 'MANAGEMENT_BLOCKED', 'CANCELLED'].includes(status)) return 'HOLD';
  if (status === 'AVAILABLE') return 'AVAILABLE';
  return 'IN_DISCUSSION';
}

function floorFromUnit(unitNumber: string) {
  const digits = unitNumber.replace(/\D/g, '');
  if (digits.length <= 2) return { label: 'Ground floor', order: 0 };
  const number = Number(digits.slice(0, -2));
  return { label: `Floor ${number}`, order: number };
}

export function InventoryMapPage() {
  const [project, setProject] = useState('');
  const [status, setStatus] = useState<'ALL' | MapStatus>('ALL');
  const propertiesQuery = useQuery({
    queryKey: ['properties'],
    queryFn: async () => (await api.get<{ data: Property[] }>('/properties')).data.data,
    refetchInterval: 15_000,
  });
  const properties = propertiesQuery.data ?? [];
  const projects = useMemo(() => [...new Set(properties.map((item) => item.project.name))].sort(), [properties]);
  const filtered = properties.filter((item) => (!project || item.project.name === project) && (status === 'ALL' || mapStatus(item.status) === status));
  const floors = useMemo(() => {
    const groups = new Map<string, { order: number; units: Property[] }>();
    filtered.forEach((unit) => {
      const floor = floorFromUnit(unit.unitNumber);
      const current = groups.get(floor.label) ?? { order: floor.order, units: [] };
      current.units.push(unit);
      groups.set(floor.label, current);
    });
    return [...groups.entries()]
      .map(([label, data]) => ({ label, ...data, units: data.units.sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true })) }))
      .sort((a, b) => b.order - a.order);
  }, [filtered]);

  return <section>
    <p className="text-sm text-slate-500">Inventory / Visual unit map</p>
    <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="flex items-center gap-2 text-2xl font-bold text-navy"><Grid3X3 className="text-gold" />Inventory map</h2><p className="mt-1 text-sm text-slate-600">A live floor-wise view of every unit. Unit 501 is shown on Floor 5.</p></div>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Filter by project" value={project} onChange={(event) => setProject(event.target.value)} className="rounded border bg-white px-3 py-2 text-sm"><option value="">All projects</option>{projects.map((name) => <option key={name}>{name}</option>)}</select>
        <select aria-label="Filter by availability status" value={status} onChange={(event) => setStatus(event.target.value as 'ALL' | MapStatus)} className="rounded border bg-white px-3 py-2 text-sm"><option value="ALL">All statuses</option>{Object.entries(statusStyle).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
      </div>
    </div>
    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 rounded-lg border bg-white p-4 text-sm">{Object.entries(statusStyle).map(([key, item]) => <span className="inline-flex items-center gap-2" key={key}><i className={`h-3 w-3 rounded-full ${item.legend}`} />{item.label}</span>)}</div>
    {propertiesQuery.isLoading ? <p className="mt-6 rounded border bg-white p-6 text-sm text-slate-500">Loading inventory map...</p> : floors.length === 0 ? <div className="mt-6 rounded border bg-white p-10 text-center"><Building2 className="mx-auto text-slate-400" /><p className="mt-3 text-sm text-slate-500">No units match the selected filters.</p></div> : <div className="mt-6 space-y-5">{floors.map((floor) => <article className="overflow-hidden rounded-xl border bg-white" key={floor.label}><header className="flex items-center justify-between border-b bg-slate-50 px-5 py-3"><h3 className="font-semibold text-navy">{floor.label}</h3><span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600">{floor.units.length} units</span></header><div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">{floor.units.map((unit) => { const mapped = mapStatus(unit.status); const style = statusStyle[mapped]; return <article key={unit.id} title={`${unit.project.name} · ${style.label}`} className={`min-h-28 rounded-lg border p-3 transition ${style.tile}`}><div className="flex items-start justify-between gap-2"><p className="text-lg font-bold">{unit.unitNumber}</p><span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase">{unit.type.replace('_', ' ')}</span></div><p className="mt-2 text-xs font-semibold uppercase tracking-wide">{style.label}</p><p className="mt-1 truncate text-xs opacity-80">{unit.project.name}</p>{(unit.dealingExecutiveName || unit.lockCustomerName) && <p className="mt-2 flex items-center gap-1 truncate text-xs"><UserRound size={12} />{unit.lockCustomerName || unit.dealingExecutiveName}</p>}</article>; })}</div></article>)}</div>}
  </section>;
}
