import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { Pencil, UserPlus, Users } from 'lucide-react';
import { api } from '../lib/api';

type EmployeeRole = 'ADMIN' | 'MANAGER' | 'SALES_EXECUTIVE' | 'RECEPTION' | 'ACCOUNTANT' | 'LICENSING_OFFICER';
type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';
type Employee = { id: string; fullName: string; email: string; phone: string; department: string; designation: string; status: EmployeeStatus; roles: string[]; recoveryEmail?: string };
type CreateForm = { fullName: string; email: string; recoveryEmail: string; phone: string; department: string; designation: string; role: EmployeeRole; temporaryPassword: string };
type EditForm = Omit<CreateForm, 'temporaryPassword'> & { status: EmployeeStatus };
type ApiError = { error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } } };

const blankForm: CreateForm = { fullName: '', email: '', recoveryEmail: '', phone: '', department: 'Sales', designation: 'Sales Executive', role: 'SALES_EXECUTIVE', temporaryPassword: 'Welcome@12345' };
const roleOptions: Array<[EmployeeRole, string]> = [['SALES_EXECUTIVE', 'Sales Executive'], ['MANAGER', 'Manager'], ['ADMIN', 'Admin'], ['RECEPTION', 'Reception'], ['ACCOUNTANT', 'Accounts'], ['LICENSING_OFFICER', 'Licensing Officer']];

function getErrorMessage(error: unknown, fallback: string) {
  const response = (error as AxiosError<ApiError>)?.response?.data;
  const fields = response?.error?.details?.fieldErrors;
  return (fields ? Object.values(fields).flat().find(Boolean) : undefined) ?? response?.error?.message ?? fallback;
}

function EmployeeForm({ form, onChange, isEdit, pending, onCancel, onSubmit }: { form: CreateForm | EditForm; onChange: (key: string, value: string) => void; isEdit: boolean; pending: boolean; onCancel: () => void; onSubmit: () => void }) {
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="mt-6 rounded-lg border bg-white p-6">
    <h3 className="font-semibold text-navy">{isEdit ? 'Edit employee account' : 'Create employee account'}</h3>
    <p className="mt-1 text-sm text-slate-500">{isEdit ? 'Update employee and administrator contact, role, and account details.' : 'Use the employee’s own work email. Recovery email is optional and is used only for password recovery.'}</p>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {([['fullName', 'Full name', 'text'], ['email', 'Work email', 'email'], ['phone', 'Phone', 'tel'], ['department', 'Department', 'text'], ['designation', 'Designation', 'text']] as const).map(([key, label, type]) => <label key={key} className="text-sm font-medium text-slate-700">{label}<input required type={type} value={form[key]} onChange={(event) => onChange(key, event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2.5" /></label>)}
      <label className="text-sm font-medium text-slate-700">Recovery email <span className="font-normal text-slate-400">(optional)</span><input type="email" value={form.recoveryEmail} onChange={(event) => onChange('recoveryEmail', event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2.5" /></label>
      {!isEdit && <label className="text-sm font-medium text-slate-700">Temporary password<input required minLength={6} autoComplete="new-password" type="password" value={(form as CreateForm).temporaryPassword} onChange={(event) => onChange('temporaryPassword', event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2.5" /><span className="mt-1 block text-xs font-normal text-slate-500">At least 6 characters. The employee should change it after first sign-in.</span></label>}
      <label className="text-sm font-medium text-slate-700">Role<select value={form.role} onChange={(event) => onChange('role', event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2.5">{roleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {isEdit && <label className="text-sm font-medium text-slate-700">Account status<select value={(form as EditForm).status} onChange={(event) => onChange('status', event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2.5"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="LOCKED">Locked</option></select></label>}
    </div>
    <div className="mt-5 flex gap-3"><button disabled={pending} className="rounded bg-navy px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">{pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create account'}</button><button type="button" onClick={onCancel} className="rounded border px-4 py-2.5 text-sm">Cancel</button></div>
  </form>;
}

export function EmployeesPage() {
  const client = useQueryClient();
  const [createForm, setCreateForm] = useState<CreateForm>(blankForm);
  const [editForm, setEditForm] = useState<EditForm>();
  const [editingId, setEditingId] = useState<string>();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);
  const { data = [], isLoading, isError } = useQuery({ queryKey: ['employees'], queryFn: async () => (await api.get<{ data: Employee[] }>('/employees')).data.data });
  const refresh = () => client.invalidateQueries({ queryKey: ['employees'] });
  const create = useMutation({ mutationFn: async (payload: CreateForm) => (await api.post('/employees', payload)).data, onSuccess: () => { refresh(); setOpen(false); setCreateForm(blankForm); setNotice({ text: 'Employee account created. The employee must change the temporary password after their first sign-in.', kind: 'success' }); }, onError: (error) => setNotice({ text: getErrorMessage(error, 'The employee account could not be created. Please try again.'), kind: 'error' }) });
  const save = useMutation({ mutationFn: async ({ id, payload }: { id: string; payload: EditForm }) => (await api.put(`/employees/${id}`, payload)).data, onSuccess: () => { refresh(); setEditingId(undefined); setEditForm(undefined); setNotice({ text: 'Employee details updated.', kind: 'success' }); }, onError: (error) => setNotice({ text: getErrorMessage(error, 'Employee details could not be updated. Please try again.'), kind: 'error' }) });
  const updateCreate = (key: string, value: string) => setCreateForm((current) => ({ ...current, [key]: value } as CreateForm));
  const updateEdit = (key: string, value: string) => setEditForm((current) => current ? ({ ...current, [key]: value } as EditForm) : current);
  const beginEdit = (employee: Employee) => { setNotice(null); setOpen(false); setEditingId(employee.id); setEditForm({ fullName: employee.fullName, email: employee.email, recoveryEmail: employee.recoveryEmail ?? '', phone: employee.phone, department: employee.department, designation: employee.designation, role: (employee.roles[0] === 'ADMINISTRATOR' ? 'ADMIN' : employee.roles[0]) as EmployeeRole, status: employee.status }); };

  return <section>
    <p className="text-sm text-slate-500">Workspace / Employees</p>
    <div className="mt-2 flex items-center justify-between"><div><h2 className="text-2xl font-bold text-navy">Employees</h2><p className="mt-1 text-sm text-slate-600">Create and maintain office accounts, including administrator details.</p></div><button onClick={() => { setNotice(null); setEditingId(undefined); setOpen(true); }} className="flex items-center gap-2 rounded bg-navy px-4 py-2.5 text-sm font-medium text-white"><UserPlus size={18} />Add employee</button></div>
    {notice && <p role="status" className={`mt-5 rounded p-3 text-sm ${notice.kind === 'error' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>{notice.text}</p>}
    {open && <EmployeeForm form={createForm} onChange={updateCreate} isEdit={false} pending={create.isPending} onCancel={() => setOpen(false)} onSubmit={() => { setNotice(null); create.mutate(createForm); }} />}
    {editingId && editForm && <EmployeeForm form={editForm} onChange={updateEdit} isEdit pending={save.isPending} onCancel={() => { setEditingId(undefined); setEditForm(undefined); }} onSubmit={() => { setNotice(null); save.mutate({ id: editingId, payload: editForm }); }} />}
    <div className="mt-6 overflow-hidden rounded-lg border bg-white">{isLoading ? <p className="p-6 text-sm text-slate-500">Loading employees…</p> : isError ? <p className="p-6 text-sm text-red-700">Employees could not be loaded.</p> : data.length === 0 ? <div className="p-8 text-center"><Users className="mx-auto text-slate-400" /><p className="mt-3 text-sm text-slate-500">No employees yet.</p></div> : <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-4">Employee</th><th className="p-4">Role</th><th className="p-4">Department</th><th className="p-4">Phone</th><th className="p-4">Status</th><th className="p-4">Actions</th></tr></thead><tbody>{data.map((employee) => <tr key={employee.id} className="border-t"><td className="p-4"><p className="font-medium text-navy">{employee.fullName}</p><p className="text-slate-500">{employee.email}</p></td><td className="p-4">{employee.roles.join(', ')}</td><td className="p-4">{employee.department}<br /><span className="text-slate-500">{employee.designation}</span></td><td className="p-4">{employee.phone}</td><td className="p-4"><span className={`rounded px-2 py-1 text-xs ${employee.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{employee.status}</span></td><td className="p-4"><button onClick={() => beginEdit(employee)} className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-navy hover:bg-slate-50"><Pencil size={15} />Edit</button></td></tr>)}</tbody></table>}</div>
  </section>;
}
