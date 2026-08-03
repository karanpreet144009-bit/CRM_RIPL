import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Settings } from 'lucide-react';
import { api } from '../lib/api';
type Settings = {
  company: {
    companyName: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    gstNumber?: string | null;
  } | null;
  departments: { id: string; name: string }[];
  leadSources: { id: string; name: string }[];
  roles: { id: string; code: string; name: string; permissions: string[] }[];
};
export function SettingsPage() {
  const client = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get<{ data: Settings }>('/settings')).data.data,
  });
  const [department, setDepartment] = useState('');
  const [source, setSource] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const saveCompany = useMutation({
    mutationFn: () => api.put('/settings/company', { companyName, email, phone }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['settings'] }),
  });
  const addDepartment = useMutation({
    mutationFn: () => api.post('/settings/departments', { name: department }),
    onSuccess: () => {
      setDepartment('');
      client.invalidateQueries({ queryKey: ['settings'] });
    },
  });
  const addSource = useMutation({
    mutationFn: () => api.post('/settings/lead-sources', { name: source }),
    onSuccess: () => {
      setSource('');
      client.invalidateQueries({ queryKey: ['settings'] });
    },
  });
  if (isLoading) return <p className="text-sm text-slate-500">Loading settings…</p>;
  const company = data?.company;
  const currentName = companyName || company?.companyName || 'RIPL';
  return (
    <section>
      <p className="text-sm text-slate-500">Administration / Settings</p>
      <div className="mt-2 flex items-center gap-3">
        <Settings className="text-gold" />
        <div>
          <h2 className="text-2xl font-bold text-navy">Admin settings</h2>
          <p className="mt-1 text-sm text-slate-600">
            Company profile, departments, lead sources, roles, and permissions.
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <article className="rounded-lg border bg-white p-5">
          <h3 className="font-semibold text-navy">Company information</h3>
          <div className="mt-4 grid gap-3">
            <input
              value={currentName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Company name"
              className="rounded border p-2.5"
            />
            <input
              value={email || company?.email || ''}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              className="rounded border p-2.5"
            />
            <input
              value={phone || company?.phone || ''}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Phone"
              className="rounded border p-2.5"
            />
          </div>
          <button
            onClick={() => saveCompany.mutate()}
            className="mt-4 inline-flex items-center gap-2 rounded bg-navy px-4 py-2.5 text-sm text-white"
          >
            <Save size={16} />
            Save company
          </button>
        </article>
        <article className="rounded-lg border bg-white p-5">
          <h3 className="font-semibold text-navy">Departments</h3>
          <div className="mt-4 flex gap-2">
            <input
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="e.g. Sales"
              className="flex-1 rounded border p-2.5"
            />
            <button onClick={() => addDepartment.mutate()} className="rounded bg-navy px-3 text-white">
              <Plus size={18} />
            </button>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            {data?.departments.map((item) => item.name).join(' · ') || 'No departments added.'}
          </p>
        </article>
        <article className="rounded-lg border bg-white p-5">
          <h3 className="font-semibold text-navy">Lead sources</h3>
          <div className="mt-4 flex gap-2">
            <input
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="e.g. Website"
              className="flex-1 rounded border p-2.5"
            />
            <button onClick={() => addSource.mutate()} className="rounded bg-navy px-3 text-white">
              <Plus size={18} />
            </button>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            {data?.leadSources.map((item) => item.name).join(' · ') || 'No lead sources added.'}
          </p>
        </article>
        <article className="rounded-lg border bg-white p-5">
          <h3 className="font-semibold text-navy">Roles & permissions</h3>
          <div className="mt-4 space-y-3">
            {data?.roles.map((role) => (
              <div key={role.id} className="rounded bg-slate-50 p-3">
                <p className="font-medium text-navy">{role.name}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {role.permissions.length ? role.permissions.join(', ') : 'No permissions configured'}
                </p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
