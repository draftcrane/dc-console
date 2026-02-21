
import React, { useState } from 'react';
import type { DriveAccount } from '@/hooks/use-drive-accounts';
import type { ProjectLibraryItem } from './SourcesPanel';
import { FileBrowser } from './FileBrowser';

interface LibraryTabProps {
  driveAccounts: DriveAccount[];
  onConnectDrive: () => void;
  onDisconnectDrive: (accountId: string) => void;
  libraryItems: ProjectLibraryItem[];
  setLibraryItems: React.Dispatch<React.SetStateAction<ProjectLibraryItem[]>>;
  onStartReview: (item: ProjectLibraryItem) => void;
}

export const LibraryTab = ({
  driveAccounts,
  onConnectDrive,
  onDisconnectDrive,
  libraryItems,
  setLibraryItems,
  onStartReview,
}: LibraryTabProps) => {
  const [browsingSource, setBrowsingSource] = useState<DriveAccount | null>(null);

  const handleRemoveItem = (itemToRemove: ProjectLibraryItem) => {
    setLibraryItems(prev => prev.filter(item => item.file.id !== itemToRemove.file.id));
  };

  if (browsingSource) {
    return (
      <div>
        <button onClick={() => setBrowsingSource(null)} className="text-sm text-blue-600 hover:underline mb-4">
          &larr; Back to Sources
        </button>
        <h3 className="text-lg font-semibold mb-2">
          Browsing: {browsingSource.email}
        </h3>
        <FileBrowser 
          connectionId={browsingSource.id} 
          libraryItems={libraryItems}
          setLibraryItems={setLibraryItems}
        />
      </div>
    );
  }

  const hasSources = driveAccounts.length > 0;

  return (
    <div className="space-y-6">
      {libraryItems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">In This Project</h3>
          <div className="space-y-2">
            {libraryItems.map(item => (
              <div key={item.file.id} className="p-2 border rounded-md flex justify-between items-center text-sm">
                <button onClick={() => onStartReview(item)} className="text-left flex-1 hover:underline truncate">
                  {item.file.name}
                </button>
                <button onClick={() => handleRemoveItem(item)} className="text-red-500 hover:text-red-700 ml-2 shrink-0 text-lg font-light">
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasSources ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Connected Sources</h3>
            <div className="space-y-2">
              {driveAccounts.map(account => (
                <div key={account.id} className="p-3 border rounded-md flex justify-between items-center">
                  <button onClick={() => setBrowsingSource(account)} className="text-left flex-1 hover:underline">
                    <span className="font-medium">Google Drive</span>
                    <span className="text-sm text-gray-500 block">{account.email}</span>
                  </button>
                  <button onClick={() => onDisconnectDrive(account.id)} className="text-sm text-red-600 hover:underline shrink-0 ml-4">
                    Disconnect
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button onClick={onConnectDrive} className="w-full p-2 border rounded-md hover:bg-gray-50 text-sm">
            + Add Another Google Account
          </button>
        </div>
      ) : (
        <div className="text-center p-4 border border-dashed rounded-lg">
          <h3 className="text-md font-semibold mb-2">Link a source to get started.</h3>
          <p className="text-sm text-gray-600 mb-4">
            Connect your existing notes and research from Google Drive or your computer.
          </p>
          <button 
            onClick={onConnectDrive}
            className="w-full p-2 mb-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Connect Google Drive
          </button>
          <button className="w-full p-2 border rounded-md hover:bg-gray-50" disabled>
            Upload Files from Device
          </button>
          <p className="text-xs text-gray-400 mt-4">
            More options like Dropbox and iCloud are coming soon.
          </p>
        </div>
      )}
    </div>
  );
};
