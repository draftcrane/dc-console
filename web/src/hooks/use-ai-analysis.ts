
import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface AiAnalysisParams {
  connectionId: string;
  fileId: string;
  instruction: string;
}

export function useAiAnalysis() {
  const { getToken } = useAuth();
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAnalysis = useCallback(
    async (params: AiAnalysisParams) => {
      setIsLoading(true);
      setError(null);
      setResult('');

      try {
        const token = await getToken();
        const response = await fetch(`${API_URL}/ai/analyze-source`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(params),
        });

        if (!response.ok || !response.body) {
          const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(errorData.error);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('
');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const eventData = line.substring(6);
              try {
                const parsed = JSON.parse(eventData);
                if (parsed.type === 'token') {
                  setResult(prev => prev + parsed.text);
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.message);
                }
              } catch (e) {
                // Ignore parsing errors for now
              }
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  return { result, isLoading, error, startAnalysis };
}
