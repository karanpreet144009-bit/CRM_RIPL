import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { UserPlus, Users } from 'lucide-react';
import { api } from '../lib/api';

type Employee = { id: string; fullName: string; email: string; phone: string; department: string; designation: string; status: 'ACTIVE' | 'INACTIVE' | 'LOCKED'; roles: string[] };
type EmployeeRole = 'MANAGER' | 'SALES_EXECUTIVE' | 'RECEPTION' | 'ACCOUNTANT';
type Form = { fullName: string; email: string; recoveryEmail: string; phone: string; department: string; designation: string; role: EmployeeRole; temporaryPassword: string };
type ApiError = { error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } } };

const initial: Form = { fullName: '', email: '', recoveryEmail: '', phone: '', department: 'Sales', designation: 'Sales Executive', role: 'SALES_EXECUTIVE', temporaryPassword: 'Welcome@12345' };

function getErrorMessage(error: unknown) {
  const response = (error as AxiosError<ApiError>)?.response?.data;
  const fields = response?.error?.details?.fieldErrors;
  const fieldMessage = fields ? Object.values(fields).flat().find(Boolean) : undefined;
  return fieldMessage ?? response?.error?.message ?? 'The employee account could not be created. Please try again.';
}

export function EmployeesPage() {
  const client = useQueryClient();
  const [form, setForm] = useState<Form>(initial);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => (await api.get<{ data: Employee[] }>('/employees')).data.data,
  });
  const create = useMutation({
    mutationFn: async (payload: Form) => (await api.post('/employees', payload)).data,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['employees'] });
      setOpen(false);
      setForm(initial);
      setNotice({ text: 'Employee account created. The employee must change the temporary password after their first sign-in.', kind: 'success' });
    },
    onError: (error) => setNotice({ text: getErrorMessage(error), kind: 'error' }),
  });
  const update = (key: keyof Form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return <section>
    <p className="text-sm text-slate-500">Workspace / Employees</p>
    <div className="mt-2 flex items-center justify-between">
      <div><h2 className="text-2xl font-bold text-navy">Employees</h2><p className="mt-1 text-sm text-slate-600">Create office accounts and assign operational roles.</p></div>
      <button onClick={() => { setNotice(null); setOpen(true); }} className="flex items-center gap-2 rounded bg-navy px-4 py-2.5 text-sm font-medium text-white"><UserPlus size={18} />Add employee</button>
    </div>
    {notice && <p role="status" className={`mt-5 rounded p-3 text-sm ${notice.kind === 'error' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>{notice.text}</p>}
    {open && <form onSubmit={(event) => { event.preventDefault(); setNotice(null); create.mutate(form); }} className="mt-6 rounded-lg border bg-white p-6">
      <h3 className="font-semibold text-navy">Create employee account</h3>
      <p className="mt-1 text-sm text-slate-500">Use the employee's own work email. Recovery email is optional and is used only for password recovery.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {([['fullName', 'Full name', 'text'], ['email', 'Work email', 'email'], ['phone', 'Phone', 'tel'], ['department', 'Department', 'text'], ['designation', 'Designation', 'text']] as const).map(([key, label, type]) => <label key={key} className="text-sm font-medium text-slate-700">{label}<input required type={type} value={form[key]} onChange={(event) => update(key, event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2.5" /></label>)}
        <label className="text-sm font-medium text-slate-700">Recovery email <span className="font-normal text-slate-400">(optional)</span><input type="email" value={form.recoveryEmail} onChange={(event) => update('recoveryEmail', event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2.5" /></label>
        <label className="text-sm font-medium text-slate-700">Temporary password<input required minLength={6} autoComplete="new-password" type="password" value={form.temporaryPassword} onChange={(event) => update('temporaryPassword', event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2.5" /><span className="mt-1 block text-xs font-normal text-slate-500">At least 6 characters. The employee should change it after first sign-in.</span></label>
        <label className="text-sm font-medium text-slate-700">Role<select value={form.role} onChange={(event) => update('role', event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2.5"><option value="SALES_EXECUTIVE">Sales Executive</option><option value="MANAGER">Manager</option><option value="RECEPTION">Reception</option><option value="ACCOUNTANT">Accounts</option></select></label>
      </div>
      <div className="mt-5 flex gap-3"><button disabled={create.isPending} className="rounded bg-navy px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">{create.isPending ? 'Creating…' : 'Create account'}</button><button type="button" onClick={() => setOpen(false)} className="rounded border px-4 py-2.5 text-sm">Cancel</button></div>
    </form>}
    <div className="mt-6 overflow-hidden rounded-lg border bg-white">{isLoading ? <p className="p-6 text-sm text-slate-500">Loading employees…</p> : isError ? <p className="p-6 text-sm text-red-700">Employees could not be loaded.</p> : data.length === 0 ? <div className="p-8 text-center"><Users className="mx-auto text-slate-400" /><p className="mt-3 text-sm text-slate-500">No employees yet.</p></div> : <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-4">Employee</th><th className="p-4">Role</th><th className="p-4">Department</th><th className="p-4">Phone</th><th className="p-4">Status</th></tr></thead><tbody>{data.map((employee) => <tr key={employee.id} className="border-t"><td className="p-4"><p className="font-medium text-navy">{employee.fullName}</p><p className="text-slate-500">{employee.email}</p></td><td className="p-4">{employee.roles.join(', ')}</td><td className="p-4">{employee.department}<br /><span className="text-slate-500">{employee.designation}</span></td><td className="p-4">{employee.phone}</td><td className="p-4"><span className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{employee.status}</span></td></tr>)}</tbody></table>}</div>
  </section>;
}
