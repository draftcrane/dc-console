
import React, { useRef } from 'react';
import type { ProjectLibraryItem } from './SourcesPanel';
import { useFileContent } from '@/hooks/use-file-content';
import sanitizeHtml from 'sanitize-html';

interface ReviewTabProps {
  reviewItem: ProjectLibraryItem | null;
  onInsertContent: (content: string, format: "html" | "text") => void;
  onStartAssist: (item: ProjectLibraryItem) => void;
}

const sanitizeOptions = {
  allowedTags: [ 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol', 'li', 'b', 'i', 'strong', 'em', 'br' ],
  allowedAttributes: {
    'a': [ 'href' ]
  }
};

export const ReviewTab = ({ reviewItem, onInsertContent, onStartAssist }: ReviewTabProps) => {
  const { data, isLoading, error } = useFileContent({
    connectionId: reviewItem?.connectionId ?? null,
    fileId: reviewItem?.file.id ?? null,
  });
  const contentRef = useRef<HTMLDivElement>(null);

  const handleInsert = () => {
    if (!data) return;

    const selection = window.getSelection();
    // Check if selection is within the review content area
    if (selection && selection.rangeCount > 0 && contentRef.current?.contains(selection.anchorNode)) {
      const selectedText = selection.toString();
      if (selectedText.length > 0) {
        // For now, insert selection as plain text, wrapped in paragraph tags
        onInsertContent(selectedText.split('\n').map(p => `<p>${p}</p>`).join(''), 'html');
        return;
      }
    }

    // No selection, insert full content
    onInsertContent(data.content, data.format);
  };

  const handleAssist = () => {
    if (reviewItem) {
      onStartAssist(reviewItem);
    }
  };


  if (!reviewItem) {
    return <div className="text-sm text-center text-gray-500">Select an item from the Library to review its content.</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold truncate">{reviewItem.file.name}</h3>

      <div className="flex gap-2">
        <button 
          onClick={handleInsert}
          disabled={!data || isLoading}
          className="flex-1 p-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          Insert into Chapter
        </button>
        <button 
          onClick={handleAssist}
          disabled={!reviewItem}
          className="flex-1 p-2 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Send to Assist
        </button>
      </div>

      <div ref={contentRef} className="prose prose-sm max-w-none border-t pt-4 focus:outline-none" tabIndex={-1}>
        {isLoading && <p>Loading content...</p>}
        {error && <p className="text-red-500">Error: {error}</p>}
        {data && (
          data.format === 'html' ? (
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.content, sanitizeOptions) }} />
          ) : (
            <p className="whitespace-pre-wrap">{data.content}</p>
          )
        )}
      </div>
    </div>
  );
};
