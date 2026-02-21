
import React, { useState } from 'react';
import type { DriveAccount } from '@/hooks/use-drive-accounts';
import type { DriveFile } from '@/hooks/use-drive-files';
import { LibraryTab } from './LibraryTab';
import { ReviewTab } from './ReviewTab';
import { AssistTab } from './AssistTab';

type SourceTab = 'Library' | 'Review' | 'Assist';

export interface ProjectLibraryItem {
  file: DriveFile;
  connectionId: string;
}

interface SourcesPanelProps {
  onClose: () => void;
  driveAccounts: DriveAccount[];
  onConnectDrive: () => void;
  onDisconnectDrive: (accountId: string) => void;
  onInsertContent: (content: string, format: "html" | "text") => void;
}

export const SourcesPanel = ({ 
  onClose,
  driveAccounts,
  onConnectDrive,
  onDisconnectDrive,
  onInsertContent,
}: SourcesPanelProps) => {
  const [activeTab, setActiveTab] = useState<SourceTab>('Library');
  const [libraryItems, setLibraryItems] = useState<ProjectLibraryItem[]>([]);
  const [reviewingItem, setReviewingItem] = useState<ProjectLibraryItem | null>(null);
  const [assistingItem, setAssistingItem] = useState<ProjectLibraryItem | null>(null);

  const handleStartReview = (item: ProjectLibraryItem) => {
    setReviewingItem(item);
    setAssistingItem(null); // Clear assist when starting a new review
    setActiveTab('Review');
  };

  const handleStartAssist = (item: ProjectLibraryItem) => {
    setAssistingItem(item);
    setReviewingItem(item); // Keep review item in sync
    setActiveTab('Assist');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Library':
        return (
          <LibraryTab
            driveAccounts={driveAccounts}
            onConnectDrive={onConnectDrive}
            onDisconnectDrive={onDisconnectDrive}
            libraryItems={libraryItems}
            setLibraryItems={setLibraryItems}
            onStartReview={handleStartReview}
          />
        );
      case 'Review':
        return (
          <ReviewTab 
            reviewItem={reviewingItem} 
            onInsertContent={onInsertContent}
            onStartAssist={handleStartAssist}
          />
        );
      case 'Assist':
        return <AssistTab assistItem={assistingItem} />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed top-0 right-0 h-full w-[400px] bg-white border-l border-gray-200 shadow-lg z-50 flex flex-col">
      <div className="flex justify-between items-center p-4 border-b border-gray-200 shrink-0">
        <h2 className="text-lg font-semibold">Sources</h2>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 text-2xl font-light">&times;</button>
      </div>
      <div className="flex border-b border-gray-200 shrink-0">
        {(['Library', 'Review', 'Assist'] as SourceTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 p-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="p-4 overflow-y-auto flex-1">
        {renderContent()}
      </div>
    </div>
  );
};
