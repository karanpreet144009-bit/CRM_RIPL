import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Mail, MessageCircle, Plus, Upload, Users } from 'lucide-react';
import { api } from '../lib/api';
type Customer = {
  id: string;
  referenceNumber: string;
  fullName: string;
  primaryPhone: string;
  email: string | null;
  remarks?: string | null;
  familyDetails?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  preferences?: string | null;
};
type DocumentType = 'PAN' | 'AADHAAR' | 'AGREEMENT' | 'RECEIPT' | 'BROCHURE' | 'OTHER';
type Doc = { id: string; type: DocumentType; originalName: string; createdAt: string };
export function CustomersPage() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false),
    [name, setName] = useState(''),
    [phone, setPhone] = useState(''),
    [email, setEmail] = useState(''),
    [remarks, setRemarks] = useState(''),
    [familyDetails, setFamilyDetails] = useState(''),
    [budgetMin, setBudgetMin] = useState(''),
    [budgetMax, setBudgetMax] = useState(''),
    [preferences, setPreferences] = useState(''),
    [communicationChannel, setCommunicationChannel] = useState('CALL'),
    [communicationDirection, setCommunicationDirection] = useState('OUTBOUND'),
    [communicationSummary, setCommunicationSummary] = useState(''),
    [message, setMessage] = useState(''),
    [selected, setSelected] = useState<Customer | null>(null),
    [file, setFile] = useState<File | null>(null),
    [type, setType] = useState<DocumentType>('PAN');
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => (await api.get<{ data: Customer[] }>('/customers')).data.data,
  });
  const docs = useQuery({
    enabled: !!selected,
    queryKey: ['customer-documents', selected?.id],
    queryFn: async () =>
      (await api.get<{ data: Doc[] }>('/customer-documents', { params: { customerId: selected!.id } })).data.data,
  });
  const profile = useQuery({
    enabled: !!selected,
    queryKey: ['customer-profile', selected?.id],
    queryFn: async () =>
      (
        await api.get<{
          data: Customer & {
            communications: { id: string; channel: string; direction: string; summary: string; occurredAt: string }[];
          };
        }>(`/customers/${selected!.id}`)
      ).data.data,
  });
  const create = useMutation({
    mutationFn: () =>
      api.post('/customers', {
        fullName: name,
        primaryPhone: phone,
        email,
        remarks,
        familyDetails,
        budgetMin: budgetMin || undefined,
        budgetMax: budgetMax || undefined,
        preferences,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['customers'] });
      setOpen(false);
      setName('');
      setPhone('');
      setEmail('');
      setRemarks('');
      setFamilyDetails('');
      setBudgetMin('');
      setBudgetMax('');
      setPreferences('');
      setMessage('Customer created.');
    },
  });
  const updateProfile = useMutation({
    mutationFn: () =>
      api.patch(`/customers/${selected!.id}`, {
        fullName: name,
        primaryPhone: phone,
        email,
        familyDetails,
        budgetMin: budgetMin || undefined,
        budgetMax: budgetMax || undefined,
        preferences,
        remarks,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['customers'] });
      void client.invalidateQueries({ queryKey: ['customer-profile', selected?.id] });
      setMessage('Customer profile updated.');
    },
  });
  const addCommunication = useMutation({
    mutationFn: () =>
      api.post(`/customers/${selected!.id}/communications`, {
        channel: communicationChannel,
        direction: communicationDirection,
        summary: communicationSummary,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['customer-profile', selected?.id] });
      setCommunicationSummary('');
      setMessage('Communication entry saved.');
    },
  });
  const upload = useMutation({
    mutationFn: async () => {
      if (!selected || !file) throw new Error();
      const form = new FormData();
      form.append('type', type);
      form.append('file', file);
      return api.post(`/customer-documents/${selected.id}`, form);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['customer-documents', selected?.id] });
      setFile(null);
      setMessage('Document uploaded.');
    },
  });
  const shareDefaultPdf = async (customer: Customer, channel: 'WhatsApp' | 'Email') => {
    try {
      const response = await api.get('/customer-documents/default-brochure', { responseType: 'blob' });
      const brochure = new File([response.data], 'RIPL-Brochure.pdf', { type: 'application/pdf' });
      const greeting = `Dear ${customer.fullName},\n\nGreetings from RIPL.\n\nPlease find our brochure attached for your reference. We would be pleased to assist you with any questions or arrange a visit.\n\nWarm regards,\nRIPL`;
      if (channel === 'Email') {
        openGmail(customer.email ?? '', greeting);
        setMessage(
          'A Gmail draft was opened. Attach the brochure PDF you previously downloaded, then press Send yourself.',
        );
        return;
      }
      if (navigator.canShare?.({ files: [brochure] })) {
        await navigator.share({ title: 'RIPL brochure', text: greeting, files: [brochure] });
        setMessage(`Choose ${channel} in the share menu to send the brochure PDF.`);
        return;
      }
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = brochure.name;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`The brochure PDF was downloaded. Attach it in ${channel} with the greeting.`);
    } catch {
      setMessage('Could not prepare the brochure PDF. Check the secure ERP connection and try again.');
    }
  };
  const openGmail = (to: string, body: string) =>
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent('RIPL brochure')}&body=${encodeURIComponent(body)}`,
      '_blank',
      'noopener,noreferrer',
    );
  const downloadDefaultBrochure = async () => {
    const response = await api.get('/customer-documents/default-brochure', { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'RIPL-Brochure.pdf';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setMessage('Brochure PDF downloaded. Keep this file and reuse it for future customer emails.');
  };
  const shareDoc = async (doc: Doc, channel: 'whatsapp' | 'email') => {
    if (!selected) return;
    const response = await api.post<{ data: { shareUrl: string; expiresAt: string } }>(
      `/customer-documents/${doc.id}/share`,
    );
    const text = `Hello ${selected.fullName}, please find the RIPL brochure here: ${response.data.data.shareUrl}`;
    if (channel === 'whatsapp')
      window.open(
        `https://wa.me/${selected.primaryPhone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`,
        '_blank',
        'noopener,noreferrer',
      );
    else openGmail(selected.email ?? '', text);
  };
  const download = async (doc: Doc) => {
    const response = await api.get(`/customer-documents/${doc.id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data),
      a = document.createElement('a');
    a.href = url;
    a.download = doc.originalName;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section>
      <p className="text-sm text-slate-500">Workspace / Customers</p>
      <div className="mt-2 flex justify-between">
        <div>
          <h2 className="text-2xl font-bold text-navy">Customers</h2>
          <p className="mt-1 text-sm text-slate-600">
            Profiles, internal remarks, documents, and one-click brochure sharing.
          </p>
        </div>
        <button onClick={() => setOpen(true)} className="rounded bg-navy px-4 py-2.5 text-white">
          <Plus className="mr-1 inline" size={17} />
          Add customer
        </button>
      </div>
      {message && <p className="mt-5 rounded bg-blue-50 p-3">{message}</p>}
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="mt-6 rounded border bg-white p-6"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <label>
              Full name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded border p-2"
              />
            </label>
            <label>
              Phone
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded border p-2"
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded border p-2"
              />
            </label>
          </div>
          <label className="mt-4 block">
            Internal customer remark
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label>
              Family details
              <textarea
                value={familyDetails}
                onChange={(e) => setFamilyDetails(e.target.value)}
                placeholder="Family members, decision makers, occupation"
                className="mt-1 w-full rounded border p-2"
              />
            </label>
            <label>
              Budget & preferences
              <textarea
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                placeholder="Location, unit type, size, facing, amenities"
                className="mt-1 w-full rounded border p-2"
              />
            </label>
            <label>
              Minimum budget
              <input
                type="number"
                min="0"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                className="mt-1 w-full rounded border p-2"
              />
            </label>
            <label>
              Maximum budget
              <input
                type="number"
                min="0"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                className="mt-1 w-full rounded border p-2"
              />
            </label>
          </div>
          <button className="mt-4 rounded bg-navy px-4 py-2 text-white">Save customer</button>
        </form>
      )}
      <div className="mt-6 overflow-x-auto rounded border bg-white">
        {isLoading ? (
          <p className="p-6">Loading customers...</p>
        ) : (
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-4">Customer</th>
                <th className="p-4">Phone</th>
                <th className="p-4">Email</th>
                <th className="p-4">Remark</th>
                <th className="p-4">Brochure</th>
                <th className="p-4">Documents</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-t">
                  <td className="p-4 font-medium">
                    {customer.fullName}
                    <br />
                    <small>{customer.referenceNumber}</small>
                    <br />
                    <button
                      onClick={() => {
                        setSelected(customer);
                        setName(customer.fullName);
                        setPhone(customer.primaryPhone);
                        setEmail(customer.email ?? '');
                        setRemarks(customer.remarks ?? '');
                        setFamilyDetails(customer.familyDetails ?? '');
                        setPreferences(customer.preferences ?? '');
                        setBudgetMin(customer.budgetMin?.toString() ?? '');
                        setBudgetMax(customer.budgetMax?.toString() ?? '');
                      }}
                      className="mt-2 rounded border px-2 py-1 text-xs text-navy"
                    >
                      Edit customer
                    </button>
                  </td>
                  <td className="p-4">{customer.primaryPhone}</td>
                  <td className="p-4">{customer.email || '—'}</td>
                  <td className="p-4">
                    <p className="max-w-48 truncate">{customer.remarks || '—'}</p>
                    <button
                      onClick={() => {
                        setSelected(customer);
                        setRemarks(customer.remarks ?? '');
                        setFamilyDetails(customer.familyDetails ?? '');
                        setPreferences(customer.preferences ?? '');
                        setBudgetMin(customer.budgetMin?.toString() ?? '');
                        setBudgetMax(customer.budgetMax?.toString() ?? '');
                      }}
                      className="mt-2 rounded border px-2 py-1 text-xs text-navy"
                    >
                      Add / edit remark
                    </button>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => shareDefaultPdf(customer, 'WhatsApp')}
                      className="mr-2 rounded border border-emerald-200 px-2 py-1 text-emerald-700"
                    >
                      <MessageCircle className="mr-1 inline" size={14} />
                      WhatsApp PDF
                    </button>
                    <button
                      disabled={!customer.email}
                      onClick={() => shareDefaultPdf(customer, 'Email')}
                      className="rounded border px-2 py-1 text-navy disabled:opacity-40"
                    >
                      <Mail className="mr-1 inline" size={14} />
                      Open Gmail
                    </button>
                    <button
                      onClick={() => void downloadDefaultBrochure()}
                      className="ml-2 rounded border px-2 py-1 text-navy"
                    >
                      <Download className="mr-1 inline" size={14} />
                      Download PDF
                    </button>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => {
                        setSelected(customer);
                        setFile(null);
                        setRemarks(customer.remarks ?? '');
                        setFamilyDetails(customer.familyDetails ?? '');
                        setPreferences(customer.preferences ?? '');
                        setBudgetMin(customer.budgetMin?.toString() ?? '');
                        setBudgetMax(customer.budgetMax?.toString() ?? '');
                      }}
                      className="rounded border px-2 py-1 text-navy"
                    >
                      <Upload className="mr-1 inline" size={14} />
                      Add document
                    </button>
                    <button
                      onClick={() => {
                        setSelected(customer);
                        setFile(null);
                        setRemarks(customer.remarks ?? '');
                        setFamilyDetails(customer.familyDetails ?? '');
                        setPreferences(customer.preferences ?? '');
                        setBudgetMin(customer.budgetMin?.toString() ?? '');
                        setBudgetMax(customer.budgetMax?.toString() ?? '');
                      }}
                      className="ml-2 rounded border px-2 py-1 text-navy"
                    >
                      <FileText className="mr-1 inline" size={14} />
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {selected && (
        <div className="mt-6 rounded border bg-white p-6">
          <div className="flex justify-between">
            <div>
              <h3 className="font-semibold">Customer details: {selected.fullName}</h3>
              <p className="text-sm text-slate-500">
                Upload your own BROCHURE to share a secure link that expires in 7 days.
              </p>
            </div>
            <button onClick={() => setSelected(null)}>Close</button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_auto]">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DocumentType)}
              className="rounded border p-2"
            >
              {(['PAN', 'AADHAAR', 'AGREEMENT', 'RECEIPT', 'BROCHURE', 'OTHER'] as DocumentType[]).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="rounded border p-2"
            />
            <button disabled={!file} onClick={() => upload.mutate()} className="rounded bg-navy px-4 text-white">
              <Upload className="mr-1 inline" size={15} />
              Upload
            </button>
          </div>
          <div className="mt-4">
            {(docs.data ?? []).map((doc) => (
              <div key={doc.id} className="flex items-center justify-between border-t p-3">
                <span>
                  {doc.type} - {doc.originalName}
                </span>
                <span>
                  <button onClick={() => download(doc)} className="mr-3 text-navy underline">
                    <Download className="inline" size={14} /> Download
                  </button>
                  {doc.type === 'BROCHURE' && (
                    <>
                      <button onClick={() => shareDoc(doc, 'whatsapp')} className="mr-3 text-emerald-700 underline">
                        WhatsApp
                      </button>
                      <button
                        disabled={!selected.email}
                        onClick={() => shareDoc(doc, 'email')}
                        className="text-navy underline"
                      >
                        Email
                      </button>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-6 border-t pt-6 lg:grid-cols-2">
            <div>
              <h3 className="font-semibold">Family, budget & preferences</h3>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <label className="text-sm">
                    Full name
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <label className="text-sm">
                    Phone
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <label className="text-sm">
                    Email
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  Family details
                  <textarea
                    value={familyDetails}
                    onChange={(e) => setFamilyDetails(e.target.value)}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>
                <label className="block text-sm">
                  Budget & property preferences
                  <textarea
                    value={preferences}
                    onChange={(e) => setPreferences(e.target.value)}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    Minimum budget
                    <input
                      type="number"
                      min="0"
                      value={budgetMin}
                      onChange={(e) => setBudgetMin(e.target.value)}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <label className="text-sm">
                    Maximum budget
                    <input
                      type="number"
                      min="0"
                      value={budgetMax}
                      onChange={(e) => setBudgetMax(e.target.value)}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  Internal remark
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>
                <button onClick={() => updateProfile.mutate()} className="rounded bg-navy px-4 py-2 text-white">
                  Save customer details
                </button>
              </div>
            </div>
            <div>
              <h3 className="font-semibold">Customer communication history</h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <select
                  value={communicationChannel}
                  onChange={(e) => setCommunicationChannel(e.target.value)}
                  className="rounded border p-2"
                >
                  {['CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'SMS', 'OTHER'].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <select
                  value={communicationDirection}
                  onChange={(e) => setCommunicationDirection(e.target.value)}
                  className="rounded border p-2"
                >
                  <option>OUTBOUND</option>
                  <option>INBOUND</option>
                </select>
              </div>
              <textarea
                value={communicationSummary}
                onChange={(e) => setCommunicationSummary(e.target.value)}
                placeholder="What was discussed, next action, or response"
                className="mt-3 w-full rounded border p-2"
              />
              <button
                disabled={!communicationSummary.trim()}
                onClick={() => addCommunication.mutate()}
                className="mt-3 rounded bg-navy px-4 py-2 text-white disabled:opacity-40"
              >
                Add communication
              </button>
              <div className="mt-4 max-h-64 space-y-2 overflow-auto">
                {profile.data?.communications?.length ? (
                  profile.data.communications.map((entry) => (
                    <div key={entry.id} className="rounded border p-3 text-sm">
                      <b>
                        {entry.channel} · {entry.direction}
                      </b>
                      <span className="float-right text-slate-500">{new Date(entry.occurredAt).toLocaleString()}</span>
                      <p className="mt-1">{entry.summary}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No communication history yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
