import { type LucideIcon, Bell, Building2, CalendarCheck, FileText, Users } from 'lucide-react';

const content: Record<string, { title: string; description: string; icon: LucideIcon }> = {
  leads: { title: 'Leads', description: 'Manage customer enquiries, assignment, follow-ups, and lead progress.', icon: Users },
  properties: { title: 'Properties', description: 'Manage project inventory, unit availability, holds, and reservations.', icon: Building2 },
  'follow-ups': { title: 'Follow-ups', description: 'View scheduled calls, meetings, and site-visit actions.', icon: CalendarCheck },
  bookings: { title: 'Bookings', description: 'Track draft, approval, confirmation, and payment workflow.', icon: FileText },
  employees: { title: 'Employees', description: 'Create and manage office employee accounts and roles.', icon: Users },
  notifications: { title: 'Notifications', description: 'View lead assignment, booking, and follow-up alerts.', icon: Bell },
};

export function ModulePage({ module }: { module: keyof typeof content }) {
  const item = content[module];
  const Icon = item.icon;
  return <section><p className="text-sm text-slate-500">Workspace / {item.title}</p><div className="mt-2 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-lg bg-blue-50 text-navy"><Icon size={22}/></span><div><h2 className="text-2xl font-bold text-navy">{item.title}</h2><p className="mt-1 text-sm text-slate-600">{item.description}</p></div></div><div className="mt-8 rounded-lg border bg-white p-8"><h3 className="font-semibold text-navy">No records yet</h3><p className="mt-2 text-sm text-slate-500">Records will appear here as this module is populated.</p></div></section>;
}
