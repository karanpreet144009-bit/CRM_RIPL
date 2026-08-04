import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Download, FileText, Plus, ReceiptText, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/auth-context';

type Expense = { id: string; referenceNo: string; category: string; description: string; amount: string | number; expenseDate: string; vendorName?: string | null; paymentMode?: string | null; status: string; receiptFileName?: string | null };
type Data = { items: Expense[]; totals: Record<string, number> };
type ExpenseForm = { category: string; description: string; amount: string; expenseDate: string; vendorName: string; paymentMode: string; receiptNote: string };
const money = (n: number | string) => `₹${Number(n).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

export function ExpensesPage() {
  const client = useQueryClient();
  const { user } = useAuth();
  const isApprover = user?.roles.some((role) => role === 'ADMINISTRATOR' || role === 'MANAGER') ?? false;
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [form, setForm] = useState<ExpenseForm>({ category: 'MARKETING', description: '', amount: '', expenseDate: today(), vendorName: '', paymentMode: 'CASH', receiptNote: '' });
  const query = useQuery({ queryKey: ['expenses'], queryFn: async () => (await api.get<{ data: Data }>('/expenses')).data.data });
  const data = query.data;
  const refresh = () => client.invalidateQueries({ queryKey: ['expenses'] });
  const create = useMutation({
    mutationFn: () => {
      const body = new FormData();
      Object.entries({ ...form, amount: String(Number(form.amount)), vendorName: form.vendorName || '', receiptNote: form.receiptNote || '' }).forEach(([key, value]) => body.append(key, value));
      if (receiptFile) body.append('receiptFile', receiptFile);
      return api.post('/expenses', body);
    },
    onSuccess: () => { setOpen(false); setReceiptFile(null); setMessage('Expense submitted for approval.'); refresh(); },
    onError: () => setMessage('Unable to submit expense. Attach a PDF smaller than 4 MB.'),
  });
  const approval = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/expenses/${id}/approval`, { status }), onSuccess: () => { setMessage('Expense approval updated.'); refresh(); } });
  const downloadReceipt = async (expense: Expense) => {
    try {
      const response = await api.get(`/expenses/${expense.id}/receipt-file`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a'); link.href = url; link.download = expense.receiptFileName || `${expense.referenceNo}-receipt.pdf`; link.click(); URL.revokeObjectURL(url);
    } catch { setMessage('Could not download this receipt PDF.'); }
  };
  if (query.isLoading || !data) return <p className="text-slate-500">Loading expenses...</p>;
  return <section>
    <p className="text-sm text-slate-500">Administration / Expenses</p>
    <div className="mt-2 flex flex-wrap justify-between gap-3"><div><h2 className="text-2xl font-bold text-navy">Expense management</h2><p className="mt-1 text-sm text-slate-600">Marketing, site and office spending with approval control.</p></div><button onClick={() => setOpen(true)} className="rounded bg-navy px-4 py-2.5 text-sm text-white"><Plus className="mr-1 inline" size={16} />Add expense</button></div>
    {message && <p className="mt-5 rounded bg-blue-50 p-3 text-sm text-navy">{message}</p>}
    <div className="mt-5 grid gap-4 md:grid-cols-4">{['total', 'MARKETING', 'SITE', 'OFFICE'].map((key) => <div key={key} className="rounded-lg border bg-white p-4"><p className="text-xs uppercase text-slate-500">{key === 'total' ? 'Total expenses' : key.toLowerCase()}</p><p className="mt-2 text-xl font-bold text-navy">{money(data.totals[key] || 0)}</p></div>)}</div>
    {open && <form onSubmit={(event) => { event.preventDefault(); create.mutate(); }} className="mt-6 rounded-lg border bg-white p-5"><h3 className="font-semibold">Submit expense</h3><div className="mt-4 grid gap-3 md:grid-cols-3"><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="rounded border p-2.5">{['MARKETING', 'SITE', 'OFFICE', 'OTHER'].map((value) => <option key={value}>{value}</option>)}</select><input required placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="rounded border p-2.5" /><input required type="number" min="1" placeholder="Amount" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="rounded border p-2.5" /><input type="date" value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} className="rounded border p-2.5" /><input placeholder="Vendor / payee" value={form.vendorName} onChange={(event) => setForm({ ...form, vendorName: event.target.value })} className="rounded border p-2.5" /><select value={form.paymentMode} onChange={(event) => setForm({ ...form, paymentMode: event.target.value })} className="rounded border p-2.5">{['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE'].map((value) => <option key={value}>{value}</option>)}</select><input placeholder="Receipt / bill note" value={form.receiptNote} onChange={(event) => setForm({ ...form, receiptNote: event.target.value })} className="rounded border p-2.5" /><label className="rounded border border-dashed p-2 text-sm text-slate-600"><FileText className="mr-1 inline" size={15} />Attach receipt / bill PDF<input type="file" accept="application/pdf" onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs" /><span className="block text-xs text-slate-400">PDF only, maximum 4 MB</span></label></div><button disabled={create.isPending} className="mt-4 rounded bg-navy px-4 py-2.5 text-sm text-white disabled:opacity-50">{create.isPending ? 'Uploading...' : 'Submit for approval'}</button></form>}
    <div className="mt-6 overflow-x-auto rounded-lg border bg-white"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-4">Reference</th><th className="p-4">Category</th><th className="p-4">Description / vendor</th><th className="p-4">Date</th><th className="p-4">Amount</th><th className="p-4">Receipt / bill</th><th className="p-4">Status</th><th className="p-4">Approval</th></tr></thead><tbody>{data.items.map((item) => <tr key={item.id} className="border-t"><td className="p-4">{item.referenceNo}</td><td className="p-4">{item.category}</td><td className="p-4">{item.description}<span className="block text-xs text-slate-500">{item.vendorName || '—'} · {item.paymentMode || '—'}</span></td><td className="p-4">{new Date(item.expenseDate).toLocaleDateString('en-IN')}</td><td className="p-4 font-semibold">{money(item.amount)}</td><td className="p-4">{item.receiptFileName ? <button onClick={() => void downloadReceipt(item)} className="inline-flex items-center gap-1 text-navy underline"><Download size={14} />{item.receiptFileName}</button> : '—'}</td><td className="p-4">{item.status}</td><td className="p-4">{isApprover && item.status === 'PENDING' ? <><button onClick={() => approval.mutate({ id: item.id, status: 'APPROVED' })} className="mr-2 text-emerald-700"><Check className="inline" size={16} />Approve</button><button onClick={() => approval.mutate({ id: item.id, status: 'REJECTED' })} className="text-red-700"><X className="inline" size={16} />Reject</button></> : item.status === 'PENDING' ? 'Waiting for approval' : '—'}</td></tr>)}</tbody></table>{!data.items.length && <div className="p-10 text-center text-slate-500"><ReceiptText className="mx-auto" /><p className="mt-2">No expenses submitted.</p></div>}</div>
  </section>;
}
