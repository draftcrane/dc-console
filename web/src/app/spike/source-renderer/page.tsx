"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { SourceContentRenderer } from "@/components/research/source-content-renderer";
import { FIXTURES } from "./fixtures";

const fixtureKeys = Object.keys(FIXTURES) as Array<keyof typeof FIXTURES>;

export default function SourceRendererSpike() {
  const [selectedFixture, setSelectedFixture] = useState<keyof typeof FIXTURES>("short");
  const [scrollToText, setScrollToText] = useState("");
  const [scrollToTextInput, setScrollToTextInput] = useState("");
  const [scrollToOffset, setScrollToOffset] = useState<number | undefined>(undefined);
  const [scrollToOffsetInput, setScrollToOffsetInput] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [renderTime, setRenderTime] = useState<number | null>(null);
  const renderStartRef = useRef<number>(0);

  const fixture = FIXTURES[selectedFixture];

  // Measure time-to-render when fixture changes
  useEffect(() => {
    renderStartRef.current = performance.now();
  }, [selectedFixture]);

  useEffect(() => {
    if (renderStartRef.current > 0) {
      // requestAnimationFrame fires after paint
      requestAnimationFrame(() => {
        setRenderTime(Math.round(performance.now() - renderStartRef.current));
      });
    }
  }, [selectedFixture]);

  const handleScrollToText = useCallback(() => {
    // Reset first so the effect re-fires even with the same value
    setScrollToText("");
    requestAnimationFrame(() => {
      setScrollToText(scrollToTextInput);
    });
  }, [scrollToTextInput]);

  const handleScrollToOffset = useCallback(() => {
    const val = parseInt(scrollToOffsetInput, 10);
    if (!isNaN(val)) {
      setScrollToOffset(undefined);
      requestAnimationFrame(() => {
        setScrollToOffset(val);
      });
    }
  }, [scrollToOffsetInput]);

  const handleTextSelect = useCallback((text: string) => {
    setSelectedText(text);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Spike #188: Source Content Renderer</h1>
          <p className="text-sm text-gray-500 mt-1">
            Proof-of-concept for rendering source HTML with search, scroll-to-position, and text
            selection.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Controls panel */}
          <div className="lg:w-80 shrink-0 space-y-4">
            {/* Fixture selector */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Fixture</label>
              <select
                value={selectedFixture}
                onChange={(e) => {
                  setSelectedFixture(e.target.value as keyof typeof FIXTURES);
                  setSelectedText("");
                  setScrollToText("");
                  setScrollToOffset(undefined);
                }}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {fixtureKeys.map((key) => (
                  <option key={key} value={key}>
                    {FIXTURES[key].label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1.5 tabular-nums">
                ~{fixture.wordCount.toLocaleString()} words
              </p>
            </div>

            {/* Scroll to text */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Scroll to text
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={scrollToTextInput}
                  onChange={(e) => setScrollToTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleScrollToText();
                  }}
                  placeholder="Enter a phrase..."
                  className="flex-1 border border-gray-200 rounded-md px-3 py-1.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500
                             placeholder:text-gray-400"
                />
                <button
                  onClick={handleScrollToText}
                  disabled={!scrollToTextInput}
                  className="px-3 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-md
                             hover:bg-gray-800 disabled:opacity-40 disabled:cursor-default"
                >
                  Go
                </button>
              </div>
            </div>

            {/* Scroll to offset */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Scroll to offset
              </label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  value={scrollToOffsetInput}
                  onChange={(e) => setScrollToOffsetInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleScrollToOffset();
                  }}
                  placeholder="Character offset"
                  min={0}
                  className="flex-1 border border-gray-200 rounded-md px-3 py-1.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500
                             placeholder:text-gray-400"
                />
                <button
                  onClick={handleScrollToOffset}
                  disabled={!scrollToOffsetInput}
                  className="px-3 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-md
                             hover:bg-gray-800 disabled:opacity-40 disabled:cursor-default"
                >
                  Go
                </button>
              </div>
            </div>

            {/* Selected text display */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Selected text
              </label>
              {selectedText ? (
                <p className="text-sm text-gray-600 bg-gray-50 rounded-md p-2 max-h-32 overflow-auto break-words">
                  &ldquo;{selectedText}&rdquo;
                </p>
              ) : (
                <p className="text-xs text-gray-400 italic">
                  Select text in the renderer to see it here
                </p>
              )}
            </div>

            {/* Performance metrics */}
            {renderTime !== null && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Performance
                </label>
                <p className="text-sm text-gray-600 tabular-nums">
                  Time to render: <strong>{renderTime}ms</strong>
                </p>
              </div>
            )}
          </div>

          {/* Renderer panel — 340px wide to match design spec */}
          <div
            className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col"
            style={{ width: 340, height: 600, minWidth: 340 }}
          >
            {/* Panel header chrome */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50 shrink-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">Source Document</p>
                <p className="text-xs text-gray-400 tabular-nums">
                  {fixture.wordCount.toLocaleString()} words
                </p>
              </div>
              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                340px
              </span>
            </div>

            {/* Renderer */}
            <div className="flex-1 min-h-0">
              <SourceContentRenderer
                content={fixture.html}
                searchEnabled
                scrollToText={scrollToText || undefined}
                scrollToOffset={scrollToOffset}
                onTextSelect={handleTextSelect}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
