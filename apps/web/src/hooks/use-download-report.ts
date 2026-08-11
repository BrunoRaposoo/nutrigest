import { useState } from 'react';
import { api } from '../lib/api';
import { getApiErrorMessage } from '../lib/api-error';

interface UseDownloadReportResult {
  download: () => Promise<void>;
  isDownloading: boolean;
  error: string | null;
}

export function useDownloadReport(
  url: string,
  filename: string,
  format: 'csv' | 'pdf',
): UseDownloadReportResult {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setIsDownloading(true);
    setError(null);

    try {
      const response = await api.get(url, {
        responseType: 'blob',
      });

      const mimeType =
        format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/pdf';
      const blob = new Blob([response.data], { type: mimeType });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      setError(getApiErrorMessage(err) || 'Erro ao baixar relatório');
    } finally {
      setIsDownloading(false);
    }
  };

  return { download, isDownloading, error };
}
