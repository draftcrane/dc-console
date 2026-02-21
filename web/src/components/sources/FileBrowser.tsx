
import React, { useState } from 'react';
import Image from 'next/image';
import { useDriveFiles, type DriveFile } from '@/hooks/use-drive-files';
import type { ProjectLibraryItem } from './SourcesPanel';

interface FileBrowserProps {
  connectionId: string;
  libraryItems: ProjectLibraryItem[];
  setLibraryItems: React.Dispatch<React.SetStateAction<ProjectLibraryItem[]>>;
}

export const FileBrowser = ({ connectionId, libraryItems, setLibraryItems }: FileBrowserProps) => {
  const [folderStack, setFolderStack] = useState([{ id: 'root', name: 'My Drive' }]);
  const currentFolder = folderStack[folderStack.length - 1];

  const { files, isLoading, error, loadMore, hasMore } = useDriveFiles({
    connectionId,
    folderId: currentFolder.id,
  });

  const handleFolderClick = (folder: DriveFile) => {
    setFolderStack(prev => [...prev, { id: folder.id, name: folder.name }]);
  };

  const handleBackClick = () => {
    if (folderStack.length > 1) {
      setFolderStack(prev => prev.slice(0, -1));
    }
  };

  const isFolder = (file: DriveFile) => file.mimeType === 'application/vnd.google-apps.folder';

  const handleSelectionChange = (file: DriveFile, isSelected: boolean) => {
    if (isSelected) {
      setLibraryItems(prev => [...prev, { file, connectionId }]);
    } else {
      setLibraryItems(prev => prev.filter(item => item.file.id !== file.id));
    }
  };

  const isSelected = (file: DriveFile) => {
    return libraryItems.some(item => item.file.id === file.id);
  };

  return (
    <div>
      <div className="p-2 border-b">
        <input
          type="search"
          placeholder={`Search in ${currentFolder.name}...`}
          className="w-full p-2 border rounded-md text-sm"
        />
      </div>

      <div className="p-2">
        {folderStack.length > 1 && (
          <button onClick={handleBackClick} className="text-sm text-blue-600 hover:underline mb-2">
            &larr; Back
          </button>
        )}

        {isLoading && files.length === 0 && <p className="text-sm text-gray-500">Loading files...</p>}
        {error && <p className="text-sm text-red-500">Error: {error}</p>}

        {!isLoading && !error && files.length === 0 && (
          <p className="text-sm text-gray-500 text-center p-4">This folder is empty.</p>
        )}

        <ul className="space-y-1">
          {files.map(file => (
            <li key={file.id} className="flex items-center space-x-2 p-1 rounded-md hover:bg-gray-50">
              <input 
                type="checkbox" 
                className="shrink-0" 
                disabled={isFolder(file)}
                checked={isSelected(file)}
                onChange={(e) => handleSelectionChange(file, e.target.checked)}
              />
              {file.iconLink && <Image src={file.iconLink} alt="" width={16} height={16} className="w-4 h-4 shrink-0" />}
              {isFolder(file) ? (
                <button onClick={() => handleFolderClick(file)} className="text-sm text-left flex-1 truncate">
                  {file.name}
                </button>
              ) : (
                <span className="text-sm flex-1 truncate">{file.name}</span>
              )}
            </li>
          ))}
        </ul>

        {hasMore && (
          <button 
            onClick={loadMore} 
            disabled={isLoading}
            className="w-full text-center text-sm text-blue-600 p-2 mt-2 hover:bg-gray-100 rounded-md disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  );
};
