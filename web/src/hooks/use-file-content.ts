
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface UseFileContentParams {
  connectionId: string | null;
  fileId: string | null;
}

interface FileContent {
  content: string;
  format: 'html' | 'text';
}

export function useFileContent({ connectionId, fileId }: UseFileContentParams) {
  const { getToken } = useAuth();
  const [data, setData] = useState<FileContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    if (!connectionId || !fileId) {
      setData(null);
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const response = await fetch(
        `${API_URL}/drive/connection/${connectionId}/files/${fileId}/content`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch file content');
      }

      const contentData = await response.json();
      setData(contentData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [connectionId, fileId, getToken]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  return { data, isLoading, error, refetch: fetchContent };
}
