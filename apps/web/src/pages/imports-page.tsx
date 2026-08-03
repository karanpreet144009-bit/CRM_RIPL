import { useState } from 'react';
import { FileUp, Upload } from 'lucide-react';
import { api } from '../lib/api';

type Resource = 'leads' | 'customers' | 'properties' | 'bookings' | 'payments';
type Result = { imported: number; skipped: number; errors: string[] };
const options: { value: Resource; label: string; note: string }[] = [
  { value: 'leads', label: 'Leads', note: 'Use the Leads CSV downloaded from RRPL ERP.' },
  { value: 'customers', label: 'Customers', note: 'Use the Customers CSV downloaded from RRPL ERP.' },
  { value: 'properties', label: 'Properties', note: 'Use the Properties CSV downloaded from RRPL ERP.' },
  { value: 'bookings', label: 'Bookings', note: 'Import customers and properties before bookings.' },
  { value: 'payments', label: 'Payments', note: 'Import bookings before payments.' },
];

export function ImportsPage() {
  const [resource, setResource] = useState<Resource>('leads');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const selected = options.find((option) => option.value === resource)!;
  const submit = async () => {
    if (!file) {
      setError('Select a CSV file first.');
      return;
    }
    if (file.size > 1_000_000) {
      setError('The CSV file must be 1 MB or smaller.');
      return;
    }
    try {
      setUploading(true);
      setError('');
      setResult(null);
      const csv = await file.text();
      const response = await api.post<{ data: Result }>(`/imports/${resource}`, { csv });
      setResult(response.data.data);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error?.message ?? 'The CSV file could not be imported.');
    } finally {
      setUploading(false);
    }
  };
  return (
    <section>
      <p className="text-sm text-slate-500">Administration / CSV import</p>
      <div className="mt-2">
        <h2 className="text-2xl font-bold text-navy">Import records</h2>
        <p className="mt-1 text-sm text-slate-600">
          Bring a CSV file from another office computer into RRPL ERP. Duplicate rows are skipped safely.
        </p>
      </div>
      <div className="mt-6 max-w-2xl rounded-lg border bg-white p-6 shadow-sm">
        <FileUp className="text-gold" size={30} />
        <h3 className="mt-4 font-semibold text-navy">Choose CSV data</h3>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Record type
          <select
            value={resource}
            onChange={(event) => {
              setResource(event.target.value as Resource);
              setResult(null);
              setError('');
            }}
            className="mt-1 w-full rounded border border-slate-300 p-2.5"
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-sm text-slate-500">{selected.note}</p>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="mt-1 block w-full rounded border border-slate-300 p-2"
          />
        </label>
        {file && <p className="mt-2 text-sm text-slate-500">Selected: {file.name}</p>}
        <button
          disabled={uploading}
          onClick={submit}
          className="mt-5 inline-flex items-center gap-2 rounded bg-navy px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          <Upload size={17} />
          {uploading ? 'Importing…' : 'Import CSV'}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-5 max-w-2xl rounded bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}
      {result && (
        <div className="mt-5 max-w-2xl rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Import complete</p>
          <p className="mt-1">
            Imported: {result.imported} · Skipped: {result.skipped}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-amber-900">
              {result.errors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
