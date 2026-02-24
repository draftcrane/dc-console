"use client";

import { useRef, useEffect } from "react";

type CheckState = "checked" | "unchecked" | "indeterminate";

interface TriStateCheckboxProps {
  state: CheckState;
  onChange: () => void;
  label?: string;
  className?: string;
}

/**
 * TriStateCheckbox — accessible checkbox with checked/unchecked/indeterminate states.
 * 44pt minimum touch target for iPad-first design.
 * Calls e.stopPropagation() on click to prevent folder row navigation.
 */
export function TriStateCheckbox({
  state,
  onChange,
  label,
  className = "",
}: TriStateCheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = state === "indeterminate";
    }
  }, [state]);

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === "indeterminate" ? "mixed" : state === "checked"}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={`flex items-center justify-center w-[44px] h-[44px] shrink-0 ${className}`}
    >
      <input
        ref={inputRef}
        type="checkbox"
        checked={state === "checked"}
        onChange={() => {}}
        tabIndex={-1}
        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 pointer-events-none"
      />
    </button>
  );
}
