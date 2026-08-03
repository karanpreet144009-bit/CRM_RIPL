import { useState } from 'react';
import { Bot, Send } from 'lucide-react';

type Message = { role: 'user' | 'bot'; text: string };
function answer(question: string) {
  const value = question.toLowerCase();
  if (value.includes('lead'))
    return 'Open Leads to add, assign, qualify, and track a customer lead. Use Follow-ups to schedule the next call or meeting.';
  if (value.includes('booking'))
    return 'Open Bookings to create a booking, record token amount, upload documents, or submit a cancellation request.';
  if (value.includes('payment') || value.includes('emi'))
    return 'Open Payments for receipts, payment schedules, GST, interest, outstanding amounts, and due reminders.';
  if (value.includes('customer'))
    return 'Open Customers to edit contact details, add family/budget preferences, remarks, documents, and communication history.';
  if (value.includes('property') || value.includes('unit'))
    return 'Open Properties or Availability board to manage units, availability, dealing executive, and customer discussion status.';
  if (value.includes('follow')) return 'Open Follow-ups to schedule calls, meetings, site visits, and reminders.';
  if (value.includes('employee') || value.includes('attendance'))
    return 'Administrators can manage employees. Employees can mark attendance from the Attendance page.';
  return 'I can help with leads, customers, properties, bookings, payments, follow-ups, employees, and reports. Try asking: “How do I add a booking?”';
}
export function AiChatbotPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: 'Hello. I am the RIPL internal assistant. How can I help you today?' },
  ]);
  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((current) => [...current, { role: 'user', text }, { role: 'bot', text: answer(text) }]);
    setInput('');
  };
  return (
    <section className="mx-auto max-w-3xl">
      <p className="text-sm text-slate-500">Workspace / AI assistant</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="rounded-lg bg-navy p-2 text-white">
          <Bot size={22} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-navy">RIPL assistant</h2>
          <p className="text-sm text-slate-600">Internal ERP guidance for your office team.</p>
        </div>
      </div>
      <div className="mt-6 rounded-xl border bg-white">
        <div className="h-[420px] space-y-3 overflow-y-auto p-5">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === 'user'
                  ? 'ml-auto max-w-[80%] rounded-lg bg-navy p-3 text-sm text-white'
                  : 'max-w-[80%] rounded-lg bg-slate-100 p-3 text-sm text-slate-700'
              }
            >
              {m.text}
            </div>
          ))}
        </div>
        <div className="flex gap-2 border-t p-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send();
            }}
            placeholder="Ask about any ERP task..."
            className="flex-1 rounded border p-2.5"
          />
          <button onClick={send} className="rounded bg-navy px-4 text-white">
            <Send size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
