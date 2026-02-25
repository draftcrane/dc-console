"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ToastProvider } from "@/components/toast";
import { AccordionSection } from "@/components/help/accordion-section";
import { FeedbackSheet } from "@/components/feedback/feedback-sheet";
import { resetOnboarding } from "@/components/editor/onboarding-tooltips";

// === FAQ Data ===

interface QAPair {
  q: string;
  a: string;
}

interface FAQSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: QAPair[];
}

const FAQ_SECTIONS: FAQSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
    items: [
      {
        q: "How do I create a new book?",
        a: 'From the dashboard, tap "New Book." Give it a title and your first chapter will be ready to go.',
      },
      {
        q: "Can I import something I've already written?",
        a: 'Yes. On the dashboard, tap "Import from a backup file" and select a DraftCrane backup (.zip). Your chapters and settings will be restored.',
      },
      {
        q: "How many books can I have?",
        a: "As many as you need. Each book has its own chapters, sources, and settings.",
      },
    ],
  },
  {
    id: "writing-editing",
    title: "Writing & Editing",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      </svg>
    ),
    items: [
      {
        q: "Does my work save automatically?",
        a: "Yes. DraftCrane saves your chapters automatically as you type. You never need to press a save button.",
      },
      {
        q: "How do I add a new chapter?",
        a: 'In the sidebar, tap the "+" button at the bottom of your chapter list. You can rename it by tapping the title.',
      },
      {
        q: "How do I reorder chapters?",
        a: "Press and hold a chapter in the sidebar, then drag it to a new position. The order updates immediately.",
      },
      {
        q: "Can I rename my book?",
        a: 'Open the settings menu (gear icon in the toolbar), then tap "Rename Book."',
      },
    ],
  },
  {
    id: "ai-features",
    title: "AI Writing Partner",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
    ),
    items: [
      {
        q: "How do I use the AI rewrite feature?",
        a: 'Select a passage of text in your chapter. A toolbar will appear with an "AI Rewrite" option. Choose an instruction or write your own, and the AI will suggest a revision.',
      },
      {
        q: "Will the AI change my text without asking?",
        a: 'Never. The AI only suggests rewrites. You always choose "Use This" to accept or "Discard" to keep your original text.',
      },
      {
        q: "Can I try again if I don't like the suggestion?",
        a: 'Yes. Tap "Try Again" in the rewrite sheet. You can edit your instruction and get a new suggestion as many times as you want.',
      },
    ],
  },
  {
    id: "sources-research",
    title: "Sources & Research",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    items: [
      {
        q: "How do I add source documents?",
        a: "Tap the Library icon in the toolbar. You can connect Google Drive or upload files directly from your device.",
      },
      {
        q: "What file types are supported?",
        a: "PDF, Word documents (.docx), plain text files, and Google Docs via Drive.",
      },
      {
        q: "Can I reference sources while I write?",
        a: "Yes. Your sources are available in the side panel so you can read them alongside your chapter.",
      },
    ],
  },
  {
    id: "exporting",
    title: "Exporting Your Work",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
    ),
    items: [
      {
        q: "How do I export my book?",
        a: "From the editor, open the settings menu and choose your export format. Your book will be compiled and downloaded.",
      },
      {
        q: "Can I back up my work?",
        a: "Yes. Export a backup file (.zip) from the settings menu. This includes all chapters and can be re-imported later.",
      },
      {
        q: "Will I lose my formatting when I export?",
        a: "No. Headings, bold, italic, lists, and block quotes are all preserved in every export format.",
      },
    ],
  },
  {
    id: "account",
    title: "Account & Privacy",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
    items: [
      {
        q: "How do I sign out?",
        a: "Tap your profile icon in the top right, or use the settings menu inside the editor.",
      },
      {
        q: "Is my writing private?",
        a: "Yes. Your chapters are stored securely and are only accessible when you are signed in. No one else can see your work.",
      },
      {
        q: "How do I delete my account?",
        a: 'Contact us using the "Report a problem" button below. We will process your request and remove all your data.',
      },
    ],
  },
];

// === Component ===

export default function HelpPage() {
  return (
    <ToastProvider>
      <HelpPageContent />
    </ToastProvider>
  );
}

function HelpPageContent() {
  const router = useRouter();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const accordionRef = useRef<HTMLDivElement>(null);

  /** ArrowUp/Down/Home/End navigation between accordion section headers */
  const handleAccordionKeyDown = useCallback((e: React.KeyboardEvent) => {
    const container = accordionRef.current;
    if (!container) return;

    const headers = Array.from(container.querySelectorAll<HTMLElement>("h3 > button"));
    const currentIndex = headers.indexOf(e.target as HTMLElement);
    if (currentIndex === -1) return;

    let nextIndex: number | null = null;
    switch (e.key) {
      case "ArrowDown":
        nextIndex = (currentIndex + 1) % headers.length;
        break;
      case "ArrowUp":
        nextIndex = (currentIndex - 1 + headers.length) % headers.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = headers.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    headers[nextIndex].focus();
  }, []);

  const handleReplayTour = () => {
    resetOnboarding();
    router.push("/dashboard");
  };

  return (
    <div className="mx-auto max-w-[640px] px-4 py-8 pb-[env(safe-area-inset-bottom)]">
      {/* Page heading */}
      <h1 className="font-serif text-3xl font-semibold text-[var(--dc-color-text-primary)] mb-8">
        Help
      </h1>

      {/* FAQ Sections */}
      <div ref={accordionRef} onKeyDown={handleAccordionKeyDown}>
        {FAQ_SECTIONS.map((section) => (
          <AccordionSection
            key={section.id}
            id={section.id}
            title={section.title}
            icon={section.icon}
          >
            {section.items.map((item, i) => (
              <div key={i}>
                <h4 className="text-sm font-medium text-[var(--dc-color-text-primary)] mb-1">
                  {item.q}
                </h4>
                <p className="text-sm leading-relaxed text-[var(--dc-color-text-muted)]">
                  {item.a}
                </p>
              </div>
            ))}
          </AccordionSection>
        ))}
      </div>

      {/* Footer actions */}
      <div className="mt-10 rounded-xl border border-gray-200 bg-[var(--dc-color-surface-secondary)] p-6 text-center">
        <h2 className="text-base font-semibold text-[var(--dc-color-text-primary)] mb-2">
          Still need help?
        </h2>
        <p className="text-sm text-[var(--dc-color-text-muted)] mb-4">
          We read every report and use your feedback to improve DraftCrane.
        </p>
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => setFeedbackOpen(true)}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-gray-900 px-6
                       text-sm font-medium text-white hover:bg-gray-800 transition-colors min-h-[44px]"
          >
            Report a problem
          </button>
          <button
            onClick={handleReplayTour}
            className="text-sm text-[var(--dc-color-text-muted)] hover:text-[var(--dc-color-text-secondary)] transition-colors min-h-[44px]"
          >
            Replay the tour
          </button>
        </div>
      </div>

      {/* Feedback Sheet */}
      <FeedbackSheet isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
