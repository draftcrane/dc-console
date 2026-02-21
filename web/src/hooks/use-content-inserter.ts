
import { useCallback, useMemo } from 'react';
import type { ChapterEditorHandle } from '@/components/editor/chapter-editor';

export interface UseContentInserterOptions {
  editorRef: React.RefObject<ChapterEditorHandle | null>;
}

export function useContentInserter({ editorRef }: UseContentInserterOptions) {
  const insertContent = useCallback(
    (content: string, format: 'html' | 'text') => {
      const handle = editorRef.current;
      if (!handle) return false;
      
      // Use requestAnimationFrame to prevent iPad viewport jumping
      requestAnimationFrame(() => {
        handle.insertContent(content, format);
      });

      return true;
    },
    [editorRef]
  );

  return useMemo(() => ({ insertContent }), [insertContent]);
}
