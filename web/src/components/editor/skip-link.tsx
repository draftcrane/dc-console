"use client";

/**
 * SkipLink - Visually hidden link that appears on focus for keyboard users.
 *
 * Provides a "Skip to writing area" link at the top of the editor page
 * that jumps directly to the Tiptap editor, bypassing the sidebar,
 * toolbar, and panel navigation.
 *
 * Per WCAG 2.4.1 (Bypass Blocks): A mechanism is available to bypass
 * blocks of content that are repeated on multiple pages.
 *
 * The link is visually hidden until focused via keyboard (Tab key),
 * at which point it appears as a prominent blue banner at the top
 * of the viewport. Uses the --dc-color-interactive-primary design token
 * for the focus ring and visual styling.
 */
export function SkipLink() {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById("writing-area");
    if (target) {
      target.focus({ preventScroll: false });
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <a href="#writing-area" onClick={handleClick} className="skip-link">
      Skip to writing area
    </a>
  );
}
