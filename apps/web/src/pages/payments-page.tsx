import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CreditCard, Plus } from 'lucide-react';
import { api } from '../lib/api';

type Booking = {
  id: string;
  referenceNumber: string;
  customer: { fullName: string };
  property: { unitNumber: string; project: { name: string } };
};
type Payment = {
  id: string;
  amount: string | number;
  paymentDate: string;
  method: string;
  receiptNumber: string;
  booking: Booking;
};
type Schedule = {
  id: string;
  installmentName: string;
  dueDate: string;
  amount: string | number;
  gstRate: string | number;
  lateInterestRate: string | number;
  gstAmount: number;
  lateInterestAmount: number;
  totalDue: number;
  daysLate: number;
  notes?: string | null;
  status: string;
  effectiveStatus: string;
  booking: Booking;
};
type Outstanding = {
  referenceNumber: string;
  customer: string;
  unit: string;
  paid: number;
  outstanding: number;
  scheduledDue: number;
};
const money = (value: string | number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

export function PaymentsPage() {
  const client = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [bookingId, setBookingId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('UPI');
  const [schedule, setSchedule] = useState({
    bookingId: '',
    installmentName: '',
    dueDate: today(),
    amount: '',
    gstRate: '0',
    lateInterestRate: '0',
    notes: '',
  });
  const [message, setMessage] = useState('');
  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => (await api.get<{ data: Payment[] }>('/payments')).data.data,
  });
  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings'],
    queryFn: async () => (await api.get<{ data: Booking[] }>('/bookings')).data.data,
  });
  const { data: schedules = [] } = useQuery({
    queryKey: ['payment-schedules'],
    queryFn: async () => (await api.get<{ data: Schedule[] }>('/payments/schedules')).data.data,
  });
  const { data: outstanding } = useQuery({
    queryKey: ['outstanding-report'],
    queryFn: async () =>
      (
        await api.get<{ data: Outstanding[]; totals: { outstanding: number; scheduledDue: number } }>(
          '/payments/outstanding-report',
        )
      ).data,
  });
  const refresh = () =>
    ['payments', 'bookings', 'payment-schedules', 'outstanding-report'].forEach((key) =>
      client.invalidateQueries({ queryKey: [key] }),
    );
  const pay = useMutation({
    mutationFn: () =>
      api.post('/payments', { bookingId, amount: Number(amount), paymentDate: new Date().toISOString(), method }),
    onSuccess: () => {
      refresh();
      setPaymentOpen(false);
      setMessage('Payment recorded. Receipt is ready to print.');
    },
    onError: () => setMessage('Payment could not be recorded.'),
  });
  const addSchedule = useMutation({
    mutationFn: () =>
      api.post('/payments/schedules', {
        ...schedule,
        amount: Number(schedule.amount),
        gstRate: Number(schedule.gstRate),
        lateInterestRate: Number(schedule.lateInterestRate),
        notes: schedule.notes || null,
      }),
    onSuccess: () => {
      refresh();
      setScheduleOpen(false);
      setSchedule({
        bookingId: '',
        installmentName: '',
        dueDate: today(),
        amount: '',
        gstRate: '0',
        lateInterestRate: '0',
        notes: '',
      });
      setMessage('Payment schedule saved.');
    },
    onError: () => setMessage('Schedule could not be saved.'),
  });
  const settle = useMutation({
    mutationFn: (id: string) => api.patch(`/payments/schedules/${id}`, { status: 'PAID' }),
    onSuccess: () => {
      refresh();
      setMessage('Schedule status updated.');
    },
  });
  const printReceipt = (p: Payment) => {
    const page = window.open('', '_blank');
    if (!page) return;
    page.document.write(
      `<h1>RIPL</h1><h2>Payment Receipt</h2><hr/><p><b>Receipt:</b> ${p.receiptNumber}</p><p><b>Customer:</b> ${p.booking.customer.fullName}</p><p><b>Unit:</b> ${p.booking.property.project.name} · ${p.booking.property.unitNumber}</p><p><b>Amount received:</b> ${money(p.amount)}</p><p><b>Mode:</b> ${p.method.replaceAll('_', ' ')}</p><p><b>Date:</b> ${new Date(p.paymentDate).toLocaleDateString('en-IN')}</p><br/><p>Computer-generated receipt.</p><script>window.print()</script>`,
    );
    page.document.close();
  };
  const field = (key: keyof typeof schedule, label: string, type = 'text') => (
    <label className="text-sm font-medium">
      {label}
      <input
        required={key !== 'notes'}
        type={type}
        value={schedule[key]}
        onChange={(e) => setSchedule({ ...schedule, [key]: e.target.value })}
        className="mt-1 w-full rounded border bg-white p-2.5"
      />
    </label>
  );
  return (
    <section>
      <p className="text-sm text-slate-500">Workspace / Payments</p>
      <div className="mt-2 flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-navy">Payments & schedule</h2>
          <p className="mt-1 text-sm text-slate-600">Collections, due reminders, GST, late interest and receipts.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setScheduleOpen(true)}
            className="rounded border border-navy px-4 py-2.5 text-sm text-navy"
          >
            <CalendarDays className="mr-2 inline" size={17} />
            Add schedule
          </button>
          <button onClick={() => setPaymentOpen(true)} className="rounded bg-navy px-4 py-2.5 text-sm text-white">
            <Plus className="mr-2 inline" size={17} />
            Record payment
          </button>
        </div>
      </div>
      {message && <p className="mt-5 rounded bg-blue-50 p-3 text-sm text-navy">{message}</p>}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-slate-500">Total outstanding</p>
          <p className="mt-1 text-2xl font-bold text-navy">{money(outstanding?.totals.outstanding ?? 0)}</p>
        </div>
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-slate-500">Scheduled due including GST/interest</p>
          <p className="mt-1 text-2xl font-bold text-navy">{money(outstanding?.totals.scheduledDue ?? 0)}</p>
        </div>
      </div>
      {paymentOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            pay.mutate();
          }}
          className="mt-6 rounded-lg border bg-white p-6"
        >
          <h3 className="font-semibold">Record payment</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium">
              Booking
              <select
                required
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                className="mt-1 w-full rounded border p-2.5"
              >
                <option value="">Select booking</option>
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.referenceNumber} · {b.customer.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Amount
              <input
                required
                min="1"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded border p-2.5"
              />
            </label>
            <label className="text-sm font-medium">
              Payment mode
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="mt-1 w-full rounded border p-2.5"
              >
                {['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'OTHER'].map((m) => (
                  <option key={m}>{m.replaceAll('_', ' ')}</option>
                ))}
              </select>
            </label>
          </div>
          <button className="mt-5 rounded bg-navy px-4 py-2.5 text-sm text-white">
            {pay.isPending ? 'Saving...' : 'Save payment'}
          </button>
        </form>
      )}
      {scheduleOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addSchedule.mutate();
          }}
          className="mt-6 rounded-lg border border-amber-200 bg-amber-50/40 p-6"
        >
          <h3 className="font-semibold">Add payment schedule instalment</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium">
              Booking
              <select
                required
                value={schedule.bookingId}
                onChange={(e) => setSchedule({ ...schedule, bookingId: e.target.value })}
                className="mt-1 w-full rounded border bg-white p-2.5"
              >
                <option value="">Select booking</option>
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.referenceNumber} · {b.customer.fullName} · {b.property.unitNumber}
                  </option>
                ))}
              </select>
            </label>
            {field('installmentName', 'Instalment name')}
            {field('dueDate', 'Due date', 'date')}
            {field('amount', 'Amount before GST', 'number')}
            {field('gstRate', 'GST rate (%)', 'number')}
            {field('lateInterestRate', 'Late interest / year (%)', 'number')}
            {field('notes', 'Internal note')}
          </div>
          <button className="mt-5 rounded bg-navy px-4 py-2.5 text-sm text-white">
            {addSchedule.isPending ? 'Saving...' : 'Save schedule'}
          </button>
        </form>
      )}
      <div className="mt-6 overflow-x-auto rounded-lg border bg-white">
        <div className="border-b p-4">
          <h3 className="font-semibold">Payment schedule and alerts</h3>
          <p className="text-sm text-slate-500">Overdue schedules create alerts in Notifications automatically.</p>
        </div>
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4">Customer / unit</th>
              <th className="p-4">Instalment</th>
              <th className="p-4">Due</th>
              <th className="p-4">Base + GST</th>
              <th className="p-4">Late interest</th>
              <th className="p-4">Total due</th>
              <th className="p-4">Status</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr className="border-t" key={s.id}>
                <td className="p-4">
                  {s.booking.customer.fullName}
                  <span className="block text-xs text-slate-500">
                    {s.booking.property.project.name} · {s.booking.property.unitNumber}
                  </span>
                </td>
                <td className="p-4">{s.installmentName}</td>
                <td className="p-4">
                  {new Date(s.dueDate).toLocaleDateString('en-IN')}
                  {s.daysLate > 0 && <span className="block text-xs text-red-600">{s.daysLate} days late</span>}
                </td>
                <td className="p-4">
                  {money(s.amount)} + {money(s.gstAmount)}
                  <span className="block text-xs text-slate-500">GST {s.gstRate}%</span>
                </td>
                <td className="p-4">
                  {money(s.lateInterestAmount)}
                  <span className="block text-xs text-slate-500">{s.lateInterestRate}% p.a.</span>
                </td>
                <td className="p-4 font-semibold">{money(s.totalDue)}</td>
                <td className="p-4">
                  <span
                    className={
                      s.effectiveStatus === 'OVERDUE'
                        ? 'text-red-700'
                        : s.effectiveStatus === 'PAID'
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                    }
                  >
                    {s.effectiveStatus}
                  </span>
                </td>
                <td className="p-4">
                  {s.status === 'PENDING' && (
                    <button
                      onClick={() => settle.mutate(s.id)}
                      className="rounded border border-emerald-300 px-3 py-1 text-xs text-emerald-700"
                    >
                      Mark paid
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!schedules.length && <p className="p-8 text-center text-slate-500">No scheduled instalments yet.</p>}
      </div>
      <div className="mt-6 overflow-x-auto rounded-lg border bg-white">
        <div className="border-b p-4">
          <h3 className="font-semibold">Outstanding report</h3>
        </div>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4">Booking</th>
              <th className="p-4">Customer / unit</th>
              <th className="p-4">Paid</th>
              <th className="p-4">Outstanding</th>
              <th className="p-4">Scheduled due</th>
            </tr>
          </thead>
          <tbody>
            {outstanding?.data.map((r) => (
              <tr className="border-t" key={r.referenceNumber}>
                <td className="p-4">{r.referenceNumber}</td>
                <td className="p-4">
                  {r.customer}
                  <span className="block text-xs text-slate-500">{r.unit}</span>
                </td>
                <td className="p-4">{money(r.paid)}</td>
                <td className="p-4 font-semibold">{money(r.outstanding)}</td>
                <td className="p-4">{money(r.scheduledDue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 overflow-x-auto rounded-lg border bg-white">
        <div className="border-b p-4">
          <h3 className="font-semibold">Receipts</h3>
        </div>
        {payments.length ? (
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-4">Receipt</th>
                <th className="p-4">Booking / customer</th>
                <th className="p-4">Amount</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr className="border-t" key={p.id}>
                  <td className="p-4">{p.receiptNumber}</td>
                  <td className="p-4">
                    {p.booking.referenceNumber} · {p.booking.customer.fullName}
                  </td>
                  <td className="p-4">{money(p.amount)}</td>
                  <td className="p-4">
                    <button onClick={() => printReceipt(p)} className="rounded border px-3 py-1 text-xs">
                      Print receipt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center">
            <CreditCard className="mx-auto text-slate-400" />
            <p className="mt-2 text-sm text-slate-500">No receipts yet.</p>
          </div>
        )}
      </div>
    </section>
  );
}
