"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Project {
  id: string;
  title: string;
  wordCount: number;
}

interface ProjectSwitcherProps {
  /** Currently active project */
  currentProject: Project;
  /** All available projects */
  projects: Project[];
}

/**
 * Project Switcher Dropdown
 *
 * Per PRD Section 9 (Navigation Model):
 * - Multi-project: Simple dropdown in toolbar/sidebar header for book switching
 * - No separate dashboard
 *
 * Per PRD Section 14 (iPad-First):
 * - Touch targets minimum 44x44pt
 */
export function ProjectSwitcher({ currentProject, projects }: ProjectSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  function handleProjectSelect(projectId: string) {
    setIsOpen(false);
    if (projectId !== currentProject.id) {
      router.push(`/editor/${projectId}`);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 h-11 px-3 rounded-lg hover:bg-gray-100 transition-colors max-w-[200px]"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="text-sm font-medium text-foreground truncate">
          {currentProject.title}
        </span>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-64 bg-white border border-border rounded-lg shadow-lg z-50 py-1"
          role="listbox"
        >
          {/* Project list */}
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => handleProjectSelect(project.id)}
              className={`w-full px-4 py-3 text-left flex items-center justify-between min-h-[48px]
                         hover:bg-gray-50 transition-colors
                         ${project.id === currentProject.id ? "bg-blue-50" : ""}`}
              role="option"
              aria-selected={project.id === currentProject.id}
            >
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground truncate">
                  {project.title}
                </span>
              </div>
              <span className="ml-2 text-xs text-muted-foreground tabular-nums shrink-0">
                {project.wordCount.toLocaleString()}w
              </span>
              {project.id === currentProject.id && (
                <svg
                  className="ml-2 w-4 h-4 text-blue-600 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}

          {/* Separator */}
          <div className="border-t border-border my-1" />

          {/* New project link */}
          <Link
            href="/setup"
            onClick={() => setIsOpen(false)}
            className="w-full px-4 py-3 text-left flex items-center gap-2 min-h-[48px]
                       hover:bg-gray-50 transition-colors text-blue-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm font-medium">New Book</span>
          </Link>
        </div>
      )}
    </div>
  );
}

export default ProjectSwitcher;
