import { Download, FileSpreadsheet } from 'lucide-react';
import { downloadCsv, type ExportResource } from '../lib/csv-export';

const exports: { resource: ExportResource; title: string; description: string }[] = [
  { resource: 'leads', title: 'Leads', description: 'Lead details, source, status, owner and follow-up date.' },
  { resource: 'customers', title: 'Customers', description: 'Customer profile and contact details.' },
  { resource: 'properties', title: 'Properties', description: 'Unit inventory, price, availability and discussion lock details.' },
  { resource: 'bookings', title: 'Bookings', description: 'Booking customer, unit, token amount and approval status.' },
  { resource: 'payments', title: 'Payments', description: 'Receipts, payment date, unit, amount and payment mode.' },
];

export function ExportsPage() {
  return <section>
    <p className="text-sm text-slate-500">Workspace / CSV exports</p>
    <div className="mt-2"><h2 className="text-2xl font-bold text-navy">Export records</h2><p className="mt-1 text-sm text-slate-600">Download office records as CSV files for Excel, reporting, or secure backup.</p></div>
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{exports.map((item) => <article key={item.resource} className="rounded-lg border bg-white p-5 shadow-sm"><FileSpreadsheet className="text-gold" size={26} /><h3 className="mt-4 font-semibold text-navy">{item.title}</h3><p className="mt-1 min-h-10 text-sm text-slate-600">{item.description}</p><button onClick={() => downloadCsv(item.resource)} className="mt-5 inline-flex items-center gap-2 rounded bg-navy px-3.5 py-2 text-sm font-medium text-white"><Download size={16} />Download CSV</button></article>)}</div>
  </section>;
}
