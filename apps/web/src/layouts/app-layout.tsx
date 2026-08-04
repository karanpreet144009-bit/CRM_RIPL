import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Bot,
  Building2,
  CalendarCheck,
  Calculator,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  FileText,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Settings,
  Upload,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/auth-context';

type LinkItem = readonly [string, typeof Home, string];
const workspaceLinks: LinkItem[] = [
  ['/', Home, 'Dashboard'],
  ['/calculator', Calculator, 'Calculator'],
  ['/sales-dashboard', BarChart3, 'Sales dashboard'],
  ['/attendance', Clock3, 'Attendance'],
  ['/leads', Users, 'Leads'],
  ['/customers', Users, 'Customers'],
  ['/properties', Building2, 'Properties'],
  ['/availability-board', LayoutDashboard, 'Availability board'],
  ['/follow-ups', CalendarCheck, 'Follow-ups'],
  ['/site-visits', CalendarCheck, 'Site visits'],
  ['/bookings', FileText, 'Bookings'],
  ['/documents', FileText, 'Documents'],
  ['/payments', CreditCard, 'Payments'],
  ['/notifications', Bell, 'Notifications'],
];
const adminLinks: LinkItem[] = [
  ['/team', Users, 'Team management'],
  ['/brokers', Users, 'Broker management'],
  ['/loans', CreditCard, 'Loan management'],
  ['/expenses', CreditCard, 'Expense management'],
  ['/approvals', CheckCircle2, 'Approvals'],
  ['/reports', BarChart3, 'Reports'],
  ['/exports', Download, 'Export CSV'],
  ['/imports', Upload, 'Import CSV'],
  ['/activity-history', History, 'Activity history'],
  ['/security', Settings, 'Security center'],
  ['/settings', Settings, 'Settings'],
  ['/employees', Users, 'Employees'],
];
const roleNames: Record<string, string> = {
  ADMINISTRATOR: 'Administrator',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  SALES_EXECUTIVE: 'Sales Executive',
  RECEPTION: 'Reception',
  ACCOUNTANT: 'Accounts',
  ACCOUNTS_MANAGER: 'Accounts Manager',
  LICENSING_OFFICER: 'Licensing Officer',
};

function MenuLink({ item }: { item: LinkItem }) {
  const [to, Icon, name] = item;
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-white/15 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-200 hover:bg-white/10 hover:text-white'}`
      }
    >
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-slate-100 group-hover:bg-white/10">
        <Icon size={17} />
      </span>
      <span>{name}</span>
    </NavLink>
  );
}
export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdministrator = user?.roles.some((role) => ['ADMINISTRATOR', 'ADMIN'].includes(role)) ?? false;
  const hasExpenseAccess = user?.roles.some((role) => ['ADMINISTRATOR', 'MANAGER', 'ACCOUNTANT', 'ACCOUNTS_MANAGER'].includes(role)) ?? false;
  const roleLabel = (user?.roles ?? [])
    .map((role) => roleNames[role] ?? role.replaceAll('_', ' ').toLowerCase())
    .join(' · ');
  const visibleWorkspaceLinks = isAdministrator
    ? workspaceLinks.filter(([path]) => path !== '/attendance')
    : workspaceLinks;
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <aside className="fixed inset-y-0 flex w-72 flex-col overflow-hidden border-r border-slate-950/20 bg-[#0d2d49] text-white">
        <div className="border-b border-white/10 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gold text-lg font-bold text-navy">R</div>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-gold">RIPL</p>
              <h1 className="mt-0.5 text-lg font-bold tracking-tight">Internal ERP</h1>
            </div>
          </div>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Workspace</p>
          <div className="space-y-1">
            {visibleWorkspaceLinks.map((item) => (
              <MenuLink item={item} key={item[0]} />
            ))}
          </div>
          {isAdministrator && (
            <>
              <div className="my-5 border-t border-white/10" />
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Administration
              </p>
              <div className="space-y-1">
                {adminLinks.map((item) => (
                  <MenuLink item={item} key={item[0]} />
                ))}
              </div>
            </>
          )}
          {!isAdministrator && hasExpenseAccess && (
            <>
              <div className="my-5 border-t border-white/10" />
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Accounts</p>
              <div className="space-y-1"><MenuLink item={['/expenses', CreditCard, 'Expense management']} /></div>
            </>
          )}
        </nav>
        <div className="border-t border-white/10 bg-[#0a263e] p-4">
          <div className="mb-3 rounded-xl bg-white/5 px-3 py-2">
            <p className="truncate text-sm font-semibold">{user?.employee?.fullName ?? user?.email}</p>
            <p className="mt-0.5 truncate text-xs text-slate-300">{roleLabel}</p>
          </div>
          <button
            onClick={() => logout().then(() => navigate('/login'))}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
      <div className="ml-72">
        <header className="flex h-16 items-center justify-between border-b bg-white px-8">
          <span className="text-sm text-slate-500">Secure internal workspace</span>
          <span className="text-sm text-slate-400">RIPL</span>
        </header>
        <main className="p-8">
          <Outlet />
        </main>
      </div>
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/calculator')}
          title="Open employee calculator"
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-navy shadow-lg shadow-slate-900/15 transition hover:scale-105 hover:bg-slate-50"
        >
          <Calculator size={20} />
          Calculator
        </button>
        <button
          type="button"
          onClick={() => navigate('/ai-chatbot')}
          title="Open RIPL AI assistant"
          className="flex items-center gap-2 rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/30 transition hover:scale-105 hover:bg-[#0d2d49]"
        >
          <Bot size={20} />
          AI assistant
        </button>
      </div>
    </div>
  );
}
