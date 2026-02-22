
import React, { useState } from 'react';
import type { ProjectLibraryItem } from './SourcesPanel';
import { InstructionManager } from './InstructionManager';
import { useAiAnalysis } from '@/hooks/use-ai-analysis';
import type { AIInstruction } from '@/hooks/use-ai-instructions';

interface AssistTabProps {
  assistItem: ProjectLibraryItem | null;
}

export const AssistTab = ({ assistItem }: AssistTabProps) => {
  const [selectedInstruction, setSelectedInstruction] = useState<AIInstruction | null>(null);
  const { result, isLoading, error, startAnalysis } = useAiAnalysis();

  const handleRunAnalysis = () => {
    if (!assistItem || !selectedInstruction) return;
    startAnalysis({
      connectionId: assistItem.connectionId,
      fileId: assistItem.file.id,
      instruction: selectedInstruction.instructionText,
    });
  };

  if (!assistItem) {
    return <div className="text-sm text-center text-gray-500">Select a file and 'Send to Assist' to analyze its content.</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold truncate">{assistItem.file.name}</h3>
      
      <InstructionManager type="analysis" onSelectInstruction={setSelectedInstruction} />

      {selectedInstruction && (
        <div className="p-2 border rounded-md bg-gray-50 text-sm">
          <p className="font-semibold">{selectedInstruction.label}</p>
          <p className="text-gray-600">{selectedInstruction.instructionText}</p>
        </div>
      )}

      <button
        onClick={handleRunAnalysis}
        disabled={!selectedInstruction || isLoading}
        className="w-full p-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
      >
        {isLoading ? 'Running...' : 'Run Analysis'}
      </button>

      {(result || error) && (
        <div className="prose prose-sm max-w-none border-t pt-4">
          {error && <p className="text-red-500">Error: {error}</p>}
          {result && <p className="whitespace-pre-wrap">{result}</p>}
        </div>
      )}
    </div>
  );
};
