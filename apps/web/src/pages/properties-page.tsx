import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/auth-context';

type Status = 'AVAILABLE'|'LEAD_ASSIGNED'|'IN_DISCUSSION'|'FOLLOW_UP_ACTIVE'|'SITE_VISIT_SCHEDULED'|'PRICE_NEGOTIATION'|'HOLD'|'RESERVED'|'TOKEN_RECEIVED'|'BOOKING_IN_PROGRESS'|'BOOKED'|'SOLD'|'MANAGEMENT_BLOCKED'|'BLOCKED'|'CANCELLED';
type Type = 'BHK_2'|'BHK_3';
type Employee = { id: string; fullName: string };
type Form = { projectName: string; projectCode: string; unitNumber: string; type: Type; basePrice: string; finalPrice: string; dealingExecutiveId: string };
type Property = { id: string; referenceNumber: string; unitNumber: string; type: Type; basePrice: string; finalPrice: string; status: Status; dealingExecutiveId?: string|null; dealingExecutiveName?: string|null; lockCustomerName?: string|null; project: { name: string; code?: string; location?: string } };

const blank: Form = { projectName: '', projectCode: '', unitNumber: '', type: 'BHK_2', basePrice: '', finalPrice: '', dealingExecutiveId: '' };
const statuses: Status[] = ['AVAILABLE','LEAD_ASSIGNED','IN_DISCUSSION','FOLLOW_UP_ACTIVE','SITE_VISIT_SCHEDULED','PRICE_NEGOTIATION','HOLD','RESERVED','TOKEN_RECEIVED','BOOKING_IN_PROGRESS','BOOKED','SOLD','MANAGEMENT_BLOCKED','BLOCKED','CANCELLED'];
const labels: Record<Status, string> = { AVAILABLE: 'Available', LEAD_ASSIGNED: 'Lead Assigned', IN_DISCUSSION: 'In Discussion', FOLLOW_UP_ACTIVE: 'Follow-up Active', SITE_VISIT_SCHEDULED: 'Site Visit Scheduled', PRICE_NEGOTIATION: 'Price Negotiation', HOLD: 'Temporary Hold', RESERVED: 'Reserved', TOKEN_RECEIVED: 'Token Received', BOOKING_IN_PROGRESS: 'Booking in Progress', BOOKED: 'Booked', SOLD: 'Sold', MANAGEMENT_BLOCKED: 'Blocked by Management', BLOCKED: 'Blocked', CANCELLED: 'Cancelled' };

function CustomerCell({ property, canManage, refresh }: { property: Property; canManage: boolean; refresh: () => void }) {
  const [name, setName] = useState(property.lockCustomerName ?? '');
  const [editing, setEditing] = useState(false);
  const save = useMutation({
    mutationFn: (customerName: string | null) => api.patch(`/properties/${property.id}/talk-customer`, { customerName }),
    onSuccess: () => { setEditing(false); refresh(); }
  });
  if (!canManage) return <span>{property.lockCustomerName || '—'}</span>;
  if (!editing) return <button type="button" onClick={() => { setName(property.lockCustomerName ?? ''); setEditing(true); }} className="text-left text-sm text-navy underline">{property.lockCustomerName || 'Add customer'}</button>;
  return <div className="flex items-center gap-1"><input value={name} onChange={e => setName(e.target.value)} placeholder="Customer name" className="w-36 rounded border p-1 text-xs" /><button type="button" onClick={() => save.mutate(name.trim() || null)} disabled={save.isPending} className="rounded bg-navy px-2 py-1 text-xs text-white disabled:opacity-50">Save</button><button type="button" onClick={() => { setName(''); save.mutate(null); }} disabled={save.isPending} className="rounded border px-2 py-1 text-xs text-red-700 disabled:opacity-50">Remove</button></div>;
}

export function PropertiesPage() {
  const client = useQueryClient();
  const { user } = useAuth();
  const canManage = user?.roles.some(role => ['ADMINISTRATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) ?? false;
  const [form, setForm] = useState<Form>(blank);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | Status>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | Type>('ALL');
  const { data: properties = [], isLoading, dataUpdatedAt } = useQuery({ queryKey: ['properties'], queryFn: async () => (await api.get<{ data: Property[] }>('/properties')).data.data, refetchInterval: 15_000 });
  const { data: employees = [] } = useQuery({ enabled: canManage, queryKey: ['employees'], queryFn: async () => (await api.get<{ data: Employee[] }>('/employees')).data.data });
  const refresh = () => { void client.invalidateQueries({ queryKey: ['properties'] }); };
  const setField = (key: keyof Form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const visibleProperties = useMemo(() => properties.filter(property => {
    const text = `${property.unitNumber} ${property.referenceNumber} ${property.project.name} ${property.project.location ?? ''} ${property.dealingExecutiveName ?? ''} ${property.lockCustomerName ?? ''}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (statusFilter === 'ALL' || property.status === statusFilter) && (typeFilter === 'ALL' || property.type === typeFilter);
  }), [properties, search, statusFilter, typeFilter]);
  const summary = useMemo(() => ({
    available: properties.filter(property => property.status === 'AVAILABLE').length,
    talks: properties.filter(property => property.status === 'IN_DISCUSSION').length,
    reserved: properties.filter(property => ['RESERVED', 'BOOKING_IN_PROGRESS', 'BOOKED'].includes(property.status)).length,
    sold: properties.filter(property => property.status === 'SOLD').length
  }), [properties]);
  const saveProperty = useMutation({
    mutationFn: () => {
      const body = { ...form, basePrice: Number(form.basePrice), finalPrice: Number(form.finalPrice), dealingExecutiveId: form.dealingExecutiveId || null };
      return editing ? api.patch(`/properties/${editing.id}`, body) : api.post('/properties', { ...body, status: 'AVAILABLE' });
    },
    onSuccess: () => { refresh(); setOpen(false); setEditing(null); setForm(blank); setNotice('Property saved successfully.'); }
  });
  const updateStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: Status }) => api.patch(`/properties/${id}/status`, { status }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/properties/${id}`), onSuccess: () => { refresh(); setNotice('Property removed.'); } });
  const startEdit = (property: Property) => { setEditing(property); setForm({ projectName: property.project.name, projectCode: property.project.code ?? '', unitNumber: property.unitNumber, type: property.type, basePrice: property.basePrice, finalPrice: property.finalPrice, dealingExecutiveId: property.dealingExecutiveId ?? '' }); setOpen(true); };
  const clearFilters = () => { setSearch(''); setStatusFilter('ALL'); setTypeFilter('ALL'); };
  const exportVisibleProperties = () => {
    const quote = (value: string | number | null | undefined) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = visibleProperties.map(property => [property.referenceNumber, property.unitNumber, property.project.name, property.project.location, property.type, property.finalPrice, labels[property.status], property.dealingExecutiveName, property.lockCustomerName]);
    const csv = [['Reference', 'Unit', 'Project', 'Location', 'Type', 'Final price', 'Status', 'Dealing executive', 'Customer in talks'], ...rows].map(row => row.map(quote).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'rrpl-property-inventory.csv'; link.click(); URL.revokeObjectURL(url);
  };

  return <section>
    <p className="text-sm text-slate-500">Workspace / Properties</p>
    <div className="mt-2 flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold text-navy">Live property inventory</h2><p className="mt-1 text-sm text-slate-600">Search units and track the executive, customer, and current sales status.</p></div>{canManage && <button type="button" onClick={() => { setEditing(null); setForm(blank); setOpen(true); }} className="rounded bg-navy px-4 py-2.5 text-white"><Plus size={17} className="mr-1 inline" />Add property</button>}</div>
    {notice && <p className="mt-5 rounded bg-blue-50 p-3 text-sm text-navy">{notice}</p>}
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded border border-emerald-100 bg-emerald-50 p-4"><p className="text-sm text-emerald-800">Available units</p><p className="mt-1 text-2xl font-bold text-emerald-900">{summary.available}</p></div><div className="rounded border border-amber-100 bg-amber-50 p-4"><p className="text-sm text-amber-800">In talks</p><p className="mt-1 text-2xl font-bold text-amber-900">{summary.talks}</p></div><div className="rounded border border-blue-100 bg-blue-50 p-4"><p className="text-sm text-blue-800">Reserved / booked</p><p className="mt-1 text-2xl font-bold text-blue-900">{summary.reserved}</p></div><div className="rounded border border-slate-200 bg-slate-50 p-4"><p className="text-sm text-slate-600">Sold units</p><p className="mt-1 text-2xl font-bold text-navy">{summary.sold}</p></div></div>
    {open && <form onSubmit={event => { event.preventDefault(); saveProperty.mutate(); }} className="mt-5 rounded border bg-white p-6"><h3 className="font-semibold text-navy">{editing ? 'Edit property' : 'Add property'}</h3><div className="mt-4 grid gap-4 md:grid-cols-2">{([['projectName','Project name','text'],['projectCode','Project code','text'],['unitNumber','Unit number','text'],['basePrice','Base price','number'],['finalPrice','Final price','number']] as const).map(([key, title, type]) => <label key={key} className="text-sm font-medium">{title}<input required type={type} value={form[key]} onChange={event => setField(key, event.target.value)} className="mt-1 w-full rounded border p-2 font-normal" /></label>)}<label className="text-sm font-medium">Unit type<select value={form.type} onChange={event => setField('type', event.target.value)} className="mt-1 w-full rounded border p-2 font-normal"><option value="BHK_2">2 BHK</option><option value="BHK_3">3 BHK</option></select></label><label className="text-sm font-medium">Dealing executive<select value={form.dealingExecutiveId} onChange={event => setField('dealingExecutiveId', event.target.value)} className="mt-1 w-full rounded border p-2 font-normal"><option value="">Unassigned</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}</select></label></div><div className="mt-5 flex gap-2"><button disabled={saveProperty.isPending} className="rounded bg-navy px-4 py-2 text-white disabled:opacity-50">Save property</button><button type="button" onClick={() => { setOpen(false); setEditing(null); }} className="rounded border px-4 py-2">Cancel</button></div></form>}
    <div className="mt-6 rounded border bg-white p-4"><div className="grid gap-3 md:grid-cols-[1fr_180px_150px_auto]"><label className="relative"><Search size={17} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search unit, project, executive or customer" className="w-full rounded border py-2 pl-9 pr-3" /></label><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'ALL' | Status)} className="rounded border p-2"><option value="ALL">All statuses</option>{statuses.map(status => <option key={status} value={status}>{labels[status]}</option>)}</select><select value={typeFilter} onChange={event => setTypeFilter(event.target.value as 'ALL' | Type)} className="rounded border p-2"><option value="ALL">All types</option><option value="BHK_2">2 BHK</option><option value="BHK_3">3 BHK</option></select><button type="button" onClick={clearFilters} className="rounded border px-3 py-2 text-sm"><X size={16} className="mr-1 inline" />Clear</button></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">Showing {visibleProperties.length} of {properties.length} properties · Live refresh every 15 seconds{dataUpdatedAt ? ` · Updated ${new Date(dataUpdatedAt).toLocaleTimeString()}` : ''}</p><button type="button" onClick={exportVisibleProperties} disabled={visibleProperties.length === 0} className="rounded border border-navy px-3 py-2 text-sm text-navy disabled:opacity-50"><Download size={16} className="mr-1 inline" />Export visible CSV</button></div></div>
    <div className="mt-4 overflow-x-auto rounded border bg-white">{isLoading ? <p className="p-6">Loading properties…</p> : <table className="w-full min-w-[1100px] text-left"><thead className="bg-slate-50 text-sm text-slate-500"><tr><th className="p-4">Unit</th><th className="p-4">Project</th><th className="p-4">Price</th><th className="p-4">Status</th><th className="p-4">Dealing executive</th><th className="p-4">In talks with</th><th className="p-4">Actions</th></tr></thead><tbody>{visibleProperties.map(property => <tr key={property.id} className="border-t"><td className="p-4 font-medium">{property.unitNumber}<br /><small className="font-normal text-slate-500">{property.referenceNumber}</small></td><td className="p-4">{property.project.name}</td><td className="p-4">₹{Number(property.finalPrice).toLocaleString('en-IN')}</td><td className="p-4">{canManage ? <select value={property.status} onChange={event => updateStatus.mutate({ id: property.id, status: event.target.value as Status })} className="rounded border p-1 text-sm">{statuses.map(status => <option key={status} value={status}>{labels[status]}</option>)}</select> : labels[property.status]}</td><td className="p-4">{property.dealingExecutiveName || 'Unassigned'}</td><td className="p-4"><CustomerCell property={property} canManage={canManage} refresh={refresh} /></td><td className="p-4">{canManage && <><button type="button" onClick={() => startEdit(property)} className="mr-2 rounded border px-2 py-1 text-sm"><Pencil size={14} className="mr-1 inline" />Edit</button><button type="button" onClick={() => { if (confirm(`Remove unit ${property.unitNumber}?`)) remove.mutate(property.id); }} className="rounded border border-red-200 px-2 py-1 text-sm text-red-700"><Trash2 size={14} className="mr-1 inline" />Delete</button></>}</td></tr>)}{visibleProperties.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">No properties match the selected filters.</td></tr>}</tbody></table>}</div>
  </section>;
}
