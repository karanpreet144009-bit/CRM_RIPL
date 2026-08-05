import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check } from 'lucide-react';
import { api } from '../lib/api';

type Notification = { id: string; type: string; title: string; message: string; link?: string | null; readAt?: string | null; createdAt: string };

export function NotificationsPage() {
  const client = useQueryClient();
  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get<{ data: Notification[] }>('/notifications')).data.data,
    refetchInterval: 30_000,
  });
  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => client.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const data = notifications.data ?? [];
  return <section>
    <p className="text-sm text-slate-500">Workspace / Notifications</p>
    <h2 className="mt-2 text-2xl font-bold text-navy">Notifications</h2>
    <p className="mt-1 text-sm text-slate-600">Attendance, lead assignments, follow-ups, pending payments, and booking approvals.</p>
    <div className="mt-6 max-w-4xl overflow-hidden rounded-lg border bg-white">
      {notifications.isLoading ? <p className="p-6 text-sm text-slate-500">Loading notifications...</p> : data.length === 0 ? <div className="p-10 text-center"><Bell className="mx-auto text-slate-400" /><p className="mt-3 text-sm text-slate-500">No notifications yet.</p></div> : <div>{data.map((item) => <article key={item.id} className={`flex items-start gap-3 border-b p-4 last:border-0 ${item.readAt ? 'bg-white' : 'bg-blue-50/60'}`}><Bell className="mt-0.5 text-gold" size={18} /><div className="flex-1"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium text-navy">{item.title}</h3><time className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</time></div><p className="mt-1 text-sm text-slate-600">{item.message}</p>{item.link && <a href={item.link} className="mt-2 inline-block text-xs text-navy underline">Open related record</a>}</div>{!item.readAt && <button onClick={() => markRead.mutate(item.id)} className="inline-flex items-center gap-1 text-xs text-navy underline"><Check size={14} />Read</button>}</article>)}</div>}
    </div>
  </section>;
}
