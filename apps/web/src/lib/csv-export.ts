import { api } from './api';

export type ExportResource = 'leads' | 'customers' | 'properties' | 'bookings' | 'payments';

export async function downloadCsv(resource: ExportResource) {
  const response = await api.get(`/exports/${resource}.csv`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `rrpl-${resource}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
