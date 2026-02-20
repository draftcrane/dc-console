# Source/Reference Material UX Pattern Catalog

> Industry research for DraftCrane source management redesign
> Date: 2026-02-19

## Table of Contents

1. [Individual Tool Analyses](#1-individual-tool-analyses)
2. [Cross-Cutting Pattern Catalog](#2-cross-cutting-pattern-catalog)
3. [Anti-Patterns](#3-anti-patterns-for-draftcrane)
4. [Relevance Matrix](#4-relevance-matrix)
5. [Key Insights for DraftCrane](#5-key-insights-for-draftcrane)

---

## 1. Individual Tool Analyses

### 1.1 Scrivener

**Source/Reference Model:**
Scrivener treats reference materials as first-class citizens in its project hierarchy. The Binder sidebar contains a dedicated "Research" folder that sits alongside the manuscript's "Draft" folder. Any file type -- PDFs, images, web archives, audio, video, text notes -- can be imported into Research and organized into subfolders. Research items are peers to manuscript items in the navigation hierarchy; they simply live under a different root folder. The mental model is: everything about your project lives in one container, with a clear partition between "what you're writing" and "what you're writing from."

**Key UI Patterns:**

- **Binder (persistent sidebar):** A tree-view sidebar always visible on the left. All project items -- manuscript chapters, research files, character sheets, notes -- appear in a single navigable hierarchy. Users click to open any item in the main editor.
- **Split Editor:** The editor area can be split horizontally or vertically, allowing two Binder items to be viewed simultaneously. A common workflow is to write in one pane and view a research PDF in the other.
- **Copyholders:** A "pinned" reference strip attached to the bottom or side of an editor pane. The copyholder stays fixed while you navigate through different documents in the main editor, providing a persistent reference while writing.
- **Inspector Bookmarks:** The right-hand Inspector panel has a Bookmarks tab with two tiers: Document Bookmarks (specific to the current document) and Project Bookmarks (accessible from anywhere). Bookmarks create a two-way relationship: bookmarking Document A from Document B also bookmarks B from A. Clicking a bookmark can open it inline in the Inspector's preview area, in a Quick Reference panel, or in a split editor.
- **Quick Reference panels:** Floating windows that display any Binder item. Users can have multiple Quick Reference panels open simultaneously, creating an ad hoc multi-window research layout.

**Strengths:**

- The unified Binder provides a clear mental model: everything lives in one place.
- Four distinct ways to view references (split editor, copyholder, Inspector bookmark preview, Quick Reference panel) cover different workflow needs -- from a glance at a note to deep side-by-side comparison.
- Research files are imported into the project, eliminating broken links or external dependency.
- The copyholder pattern is particularly elegant: a reference that stays put while you navigate.

**Weaknesses:**

- **Steep learning curve.** Scrivener is consistently criticized for overwhelming new users. External training courses sell for 4x the price of the software itself. Users report "opening the program and being completely overwhelmed." The multi-week adoption process is well-documented.
- **Feature discovery is poor.** Copyholders, Inspector bookmarks, and Quick Reference panels are powerful but not discoverable -- users must know they exist and how to activate them.
- **The Binder becomes unwieldy at scale.** A nonfiction author with hundreds of research documents can end up with a Binder that's more research than manuscript, making navigation difficult.
- **The four reference-viewing methods create confusion.** Split Editor vs. Copyholder vs. Inspector vs. Quick Reference -- users must learn when to use which.

**iPad/Touch Compatibility:**

- Scrivener for iOS exists but is significantly limited compared to desktop. Split-screen is available via iPadOS multitasking but is described as "difficult." Quick Reference is available by swiping left on a Binder item, tapping "More," and selecting "Quick Reference" -- a non-obvious gesture chain. The Inspector exists but on a smaller screen it competes with the editor for space. The full Copyholder feature is not available on iPad. Overall, the iOS version is "very limited compared to the full program."

**Relevance to DraftCrane:**

- The Binder as a "everything in one sidebar" concept is strong, but DraftCrane's sources live in Google Drive, not inside the project -- so the "imported research" model doesn't directly map.
- The copyholder pattern (a pinned reference while navigating) is highly relevant for the editor + source side-by-side use case.
- Inspector bookmarks' two-way linking (chapter <-> source) is directly analogous to DraftCrane's current "link source to chapter" concept, but Scrivener's naming and UI make the relationship much more intuitive.
- The complexity and learning curve are exactly what DraftCrane must avoid for Diane and Marcus.

---

### 1.2 Notion

**Source/Reference Model:**
Notion treats everything as a "page" or a "database entry." There is no distinct concept of "reference material" -- instead, information is structured through linked databases, nested pages, and relational properties. Research materials might be entries in a "Sources" database linked to entries in a "Chapters" database via a relation property. The mental model is a relational database with a rich-text UI on top.

**Key UI Patterns:**

- **Side Peek:** When clicking a database item, it opens in a right-hand side panel (side peek) that shows the full page content alongside the database view. This split view lets you browse a list while reading details. Table, Board, List, and Timeline views default to side peek. Users can switch between Side Peek, Center Peek (modal), and Full Page.
- **Center Peek:** A focused modal overlay for deeper reading/editing. Gallery and Calendar views default to center peek. Less contextual than side peek but better for concentrated work.
- **Linked Databases:** A database can be displayed inline on any page, filtered to show only relevant entries. A chapter page could embed a filtered view of the Sources database showing only linked sources.
- **Page References / Mentions:** Typing `@` followed by a page name inserts a clickable reference inline. This provides lightweight source citation without formal citation infrastructure.
- **Relation Properties:** Database entries can be formally linked via relation columns. A "Chapter" database could have a "Sources" relation that links to the "Sources" database, creating bidirectional references.

**Strengths:**

- Side peek is an elegant pattern for "browse and preview" -- you never lose your list context while examining details.
- The database + relation model is powerful for managing source metadata (author, type, status, date, tags) and creating filtered views.
- Templates provide structure without requiring the user to build from scratch.
- Inline `@mentions` provide the lightest possible way to reference another document.

**Weaknesses:**

- **The database paradigm is not intuitive for non-technical users.** Setting up relations, creating filtered views, and understanding linked databases requires a conceptual model that many users never grasp. Management consultants and coaches are unlikely to build this infrastructure themselves.
- **No real writing environment.** Notion is good for notes and planning but weak for sustained long-form writing. Its editor lacks focus-mode, word count goals, and writing-specific features.
- **Side peek can feel cramped on smaller screens.** On iPad, the side panel + database view leaves limited space for content.
- **Too many options for opening pages.** Side peek vs. center peek vs. full page creates decision fatigue similar to Scrivener's four reference views.

**iPad/Touch Compatibility:**

- Notion's iPad app is functional but optimized for shorter interactions. Side peek works but on a 10.9" iPad Air, the content area becomes narrow. Touch targets are generally adequate. Notion has invested in mobile performance (2022 "faster mobile apps" release), but the database-heavy workflows feel desktop-oriented. Drag-and-drop between databases is limited on touch.

**Relevance to DraftCrane:**

- Side peek is the strongest pattern to study. A right-hand panel that shows source content while the chapter list or editor stays visible on the left could directly inform DraftCrane's source viewer.
- The `@mention` pattern for lightweight source references could replace "link source to chapter" with something more intuitive -- typing `@` to reference a source within chapter text.
- Relation properties are too complex for DraftCrane's audience, but the concept of bidirectional chapter-source links is valid if surfaced through simpler UI.
- Notion's weakness at long-form writing confirms that DraftCrane's Tiptap editor investment is the right call.

---

### 1.3 Google Docs

**Source/Reference Model:**
Google Docs historically treated reference materials through the Explore panel -- a right-hand sidebar that combined web search, Google Drive file search, and image search, with the ability to cite web results as footnotes in MLA, APA, or Chicago format. As of January 2024, the Explore panel was deprecated and replaced by Gemini AI integration in the side panel. The current model is: AI-mediated access to document content and web knowledge, plus basic footnote/citation tools built into the editor.

**Key UI Patterns:**

- **Gemini Side Panel (current, 2025-2026):** A right-hand sidebar activated by clicking the Gemini icon. Users can ask Gemini to summarize the current document, generate outlines, brainstorm ideas, refine writing, and ask questions about content in their Drive. Gemini can reference files from Drive and emails from Gmail in its responses. The panel stays open while the user continues editing.
- **Footnotes and Citations:** Built-in footnote insertion (Ctrl+Alt+F / Cmd+Option+F) places numbered references at the bottom of the page. The deprecated Explore panel could auto-format web citations; this is now manual or requires Zotero/other integrations.
- **Audio Summaries (Feb 2026):** Gemini can generate spoken summaries of documents with playback controls, speed adjustment, and voice selection. Designed for "catching up on documents while multitasking."
- **Comments and Suggestions:** The right margin hosts a comments stream and suggested edits, providing contextual annotation alongside the main text.

**Strengths:**

- **Everyone knows Google Docs.** Diane and Marcus already live here. Any pattern that resembles Google Docs reduces learning curve to near zero.
- The Gemini side panel is a direct precedent for AI + document integration. Users ask questions in natural language and get contextual answers.
- Footnotes are a familiar citation mechanism for nonfiction writers.
- Real-time collaboration means Diane's editor/coach can work alongside her -- a pattern DraftCrane may want to support later.

**Weaknesses:**

- **No concept of "project-level" sources.** Google Docs is single-document oriented. There is no way to associate a set of reference documents with a manuscript. Each doc is an island.
- **Long documents perform poorly.** Google Docs notoriously struggles with book-length manuscripts (100+ pages). Performance degrades, navigation becomes difficult, and there's no chapter structure.
- **The Explore panel was removed.** Google's own experiment with integrated research (web search + Drive search + cite-as-footnote) was apparently not successful enough to maintain, replaced by the broader Gemini AI approach.
- **Gemini access requires paid Workspace plans.** As of March 2026, Gemini is bundled with Business and Enterprise plans ($2-4/user/month increase).
- **No structured source management.** You cannot "attach" a reference document to a Google Doc, create a source library, or generate a bibliography without external tools like Zotero.

**iPad/Touch Compatibility:**

- Google Docs on iPad is solid for editing but the Gemini side panel and advanced features are primarily desktop experiences. The deprecated Explore panel had reduced functionality on mobile (no Drive search, no citation formatting -- only hyperlinks). Footnote insertion works on iPad. Overall, Google Docs is the baseline familiarity for DraftCrane's users on iPad.

**Relevance to DraftCrane:**

- The Gemini side panel is a direct precedent for DraftCrane's planned Research Assistant (#128). Users ask questions, AI responds using document context. This validates the "side panel for AI research" pattern.
- The Explore panel's failure is instructive: combining web search, Drive search, and citation into one panel may have been too many things in one place.
- Google Docs' weakness at project-level source management is exactly the gap DraftCrane fills. The opportunity is to provide structure Google Docs lacks while keeping the simplicity Google Docs users expect.
- The deprecation of Explore in favor of Gemini suggests the industry is moving from "search and browse" to "ask and receive" for research integration.

---

### 1.4 Ulysses

**Source/Reference Model:**
Ulysses uses a three-pane library metaphor (Library > Group List > Editor) and treats reference materials through two mechanisms: **sheet attachments** (notes, images, keywords attached to individual sheets) and **material sheets** (sheets explicitly marked as non-exportable research). Material sheets live alongside manuscript sheets within the same group (folder) but are visually distinct and excluded from word counts, writing goals, and exports. The mental model is: research lives beside your writing, clearly marked as "not part of the final text."

**Key UI Patterns:**

- **Three-Pane Layout:** Library (folder tree) on the left, sheet list (document list) in the middle, editor on the right. On iPad, users swipe between panes or collapse panes to focus. Keyboard shortcuts toggle between 3-pane, 2-pane, and editor-only views.
- **Material Sheets:** Any sheet can be toggled to "material" status via a long-press or swipe menu. Material sheets appear in the sheet list with a distinct visual treatment (dimmed or marked). They coexist with manuscript sheets in the same group, maintaining proximity between a chapter and its research without polluting export or statistics.
- **Attachments Pane:** Each sheet has an attachments area (accessible via a paperclip icon) where users can add notes, images, PDFs, and keywords. A paperclip indicator in the sheet list shows which sheets have attachments.
- **Split View (iPad):** Ulysses supports iPadOS Split View and Slide Over, allowing two instances of the app side by side. A user can view a material sheet in one instance and write in another.
- **Keywords:** Color-coded keyword tags that can be assigned to sheets for organization and filtering. Available on both manuscript and material sheets.

**Strengths:**

- **Material sheets are brilliantly simple.** One toggle separates "research" from "manuscript" without requiring a separate folder hierarchy, a different UI, or a mental model shift. Research and writing live side by side.
- **The attachments pane is lightweight.** Notes and images attached to a sheet are always one tap away but never clutter the writing surface.
- **iPad-native design.** Ulysses is one of the few writing apps truly built for iPad. The three-pane layout adapts elegantly to different iPad sizes, and swipe gestures for navigation feel natural.
- **Progressive disclosure through pane collapsing.** Starting in editor-only mode and progressively revealing the sheet list and library gives users control over complexity.

**Weaknesses:**

- **Limited file type support for attachments.** You can attach notes, images, and keywords, but not PDFs, web pages, or arbitrary file types. Research that doesn't fit in a text note or image can't be attached.
- **No relational linking between sheets.** Unlike Scrivener's bookmarks or Obsidian's wiki-links, Ulysses has no mechanism for creating explicit relationships between sheets. You can't say "this chapter references these three research sheets."
- **Material sheets don't scale for large research libraries.** With 100+ research documents (Marcus's scenario), the sheet list becomes overwhelmed -- material sheets are mixed in with manuscript sheets, and scrolling through them all is tedious.
- **No built-in reference viewing alongside editor.** Unlike Scrivener's copyholder or split editor, Ulysses on iPad requires using iPadOS multitasking (Split View) to see a reference alongside writing. This is system-level, not app-level.

**iPad/Touch Compatibility:**

- Ulysses is the gold standard for iPad writing apps. The three-pane layout, swipe navigation, keyboard shortcuts, and iPadOS integration are excellent. Touch targets are appropriate. Material sheet toggling via swipe-left menu is discoverable and quick. Attachment access via paperclip icon meets the 44pt minimum touch target. This is the iPad benchmark DraftCrane should study most closely.

**Relevance to DraftCrane:**

- Material sheets are the single most relevant pattern for DraftCrane. The concept of "this content is related to your project but not part of the manuscript" maps directly to how Drive sources relate to chapters.
- The three-pane layout (navigation > list > content) is the structural model DraftCrane should consider. On iPad, it adapts gracefully between overview and focused modes.
- The attachments-pane concept (lightweight metadata/notes per chapter) could replace DraftCrane's "link source to chapter" with something more tangible.
- Ulysses' weakness at scale (100+ research docs in a flat list) is a key problem DraftCrane must solve for Marcus.

---

### 1.5 Obsidian

**Source/Reference Model:**
Obsidian treats every piece of content as a plain-text Markdown note in a local "vault" (folder on the filesystem). References between notes are created via wiki-style links (`[[Note Name]]`). The system automatically tracks these links and surfaces them as **backlinks** (what links to this note) and **outgoing links** (what this note links to). Research is not a separate category -- it's just more notes with links between them. The mental model is a knowledge graph where every note is a node and every link is an edge.

**Key UI Patterns:**

- **Backlinks Panel (right sidebar):** A collapsible right-hand sidebar tab shows all notes that link to the current note, divided into "Linked mentions" (explicit `[[wiki-links]]`) and "Unlinked mentions" (notes containing the current note's title as plain text). Each backlink shows surrounding context, allowing quick assessment of relevance.
- **Transclusion / Embedding:** Using `![[Note Name]]` syntax, users can embed the content of one note inside another. The embedded content renders inline and updates when the source note changes. Block-level transclusion (`![[Note#^block-id]]`) allows embedding specific paragraphs or quotes.
- **Graph View:** An interactive force-directed graph visualization of all notes and their connections. Users can filter by tags, folders, or search terms. Useful for discovering clusters of related research and finding gaps.
- **Split Panes / Linked Panes:** The editor supports multiple panes (horizontal, vertical, or floating). "Linked panes" synchronize: clicking a link in one pane opens it in the linked pane, creating a browsing experience where references open beside the current note.
- **Community Plugins:** Thousands of plugins extend functionality. Research-relevant plugins include Dataview (SQL-like queries across notes), Zotero integration, citation plugins, and kanban boards.

**Strengths:**

- **Backlinks create emergent structure.** Instead of manually organizing research into folders, users link notes naturally and the structure emerges. This reduces upfront organizational overhead.
- **Transclusion is powerful for nonfiction writing.** Embedding a quote from a research note into a chapter draft, with automatic updates when the source is edited, is exactly the "snippet into manuscript" workflow.
- **The graph view provides insight.** For a nonfiction author with many sources, seeing the relationship graph can reveal which sources connect to which chapters, which topics are underserved, and where research gaps exist.
- **The plugin ecosystem is unmatched.** Any missing feature likely has a community plugin.

**Weaknesses:**

- **Requires a technical mental model.** Wiki-link syntax, Markdown, vaults, plugins, YAML frontmatter -- Obsidian assumes comfort with plain-text tooling. Diane "doesn't know what Markdown is."
- **The graph view is more impressive than useful.** For large vaults, the graph becomes a hairball. It's better for exploration than daily reference management.
- **Organization requires discipline.** Without folders or tags, a vault of hundreds of notes becomes chaotic. With folders and tags, the user faces the same organizational overhead as any file system.
- **Feature bloat via plugins.** The power of the plugin ecosystem is also its curse -- new users can spend weeks configuring their setup instead of writing.

**iPad/Touch Compatibility:**

- Obsidian has an iOS/iPadOS app with access to vaults, most core plugins, and community plugins. However, significant limitations exist on touch: users cannot adjust pane sizes without a trackpad or mouse, touch input has had responsiveness issues in settings and plugin browsing, and some community plugins are desktop-only. The app works but the experience is degraded compared to desktop. Graph view on iPad is functional but difficult to navigate with precision via touch.

**Relevance to DraftCrane:**

- Backlinks are conceptually perfect for DraftCrane's source-chapter relationship: if a chapter references a source, the source's backlinks panel would automatically show which chapters reference it (and vice versa). This eliminates the need for manual "link/unlink" actions.
- Transclusion maps directly to the Research Board snippet insertion workflow (#133). Dragging a snippet from a source into a chapter could use a transclusion-like model where the snippet maintains a reference to its source.
- The graph view is not appropriate for DraftCrane's audience, but the underlying concept of "show me how my sources relate to my chapters" could be expressed as a simpler visualization.
- The technical mental model is a hard "no" for DraftCrane's personas. Any backlink or transclusion behavior must happen through UI affordances, never through syntax.

---

### 1.6 Bear

**Source/Reference Model:**
Bear is a note-taking app that uses wiki-style links (`[[Note Title]]`) and a flat tag-based hierarchy (tags in note body, e.g., `#research/interviews`) instead of folders. Backlinks were added in Bear 2, surfaced in the Info Panel. Bear does not have a distinct concept of "reference materials" -- all notes are equal, differentiated only by tags and links. The mental model is: a flat collection of notes organized by tags and connected by links.

**Key UI Patterns:**

- **Three-Column Layout:** Sidebar (tag tree + navigation) > Note List > Editor. Very similar to Ulysses' three-pane model. On iPad, columns can be collapsed.
- **Info Panel (right sidebar):** Activated by a toolbar button or swipe gesture on iPad. Contains three tabs: Info (word count, character count, date metadata), Table of Contents (auto-generated from headings), and Backlinks (notes that link to the current note, split into linked mentions and unlinked mentions).
- **Wiki Links:** `[[Note Title]]` creates a clickable link between notes. Typing `[[` triggers autocomplete with note title suggestions. This is the primary mechanism for connecting research to writing.
- **Tag-Based Organization:** Tags are inline (`#tag/subtag`) and create a navigable hierarchy in the sidebar. A note can have multiple tags, providing cross-referencing without duplication. Tags like `#book/chapter-3` and `#research/interviews` can co-exist on the same note.
- **Simplicity-First Design:** Bear deliberately limits features to maintain a clean, focused writing environment. No database views, no relational properties, no split editor, no graph view.

**Strengths:**

- **Radical simplicity.** Bear's design philosophy is "tools stay out of your way so you can just write." The writing experience is distraction-free, and features are revealed through progressive disclosure (Info Panel is hidden by default).
- **The Info Panel is a model of progressive disclosure.** Collapsed by default, it reveals word counts, table of contents, and backlinks only when the user asks for them. This is exactly the right approach for non-technical users who don't want to see metadata unless they need it.
- **Tag-based organization is intuitive.** Users don't need to decide where a note "lives" -- it can have multiple tags. This is more flexible than a folder hierarchy for research that spans multiple chapters.
- **iPad experience is polished.** Bear is designed for Apple platforms with careful attention to iOS/iPadOS. The Info Panel is accessed by swiping, touch targets are appropriate, and the app feels native.

**Weaknesses:**

- **No way to view two notes simultaneously.** Without a split editor, users must switch back and forth between a research note and their writing. This is a fundamental limitation for the "write with reference materials" use case.
- **Wiki-link syntax is a barrier.** While `[[` autocomplete helps, the underlying Markdown/wiki-link paradigm may confuse users who have never used it.
- **Limited file attachment support.** Bear handles text and images well but cannot attach or preview PDFs, spreadsheets, or other document types.
- **Backlinks are informational only.** The backlinks panel shows what links to a note but doesn't provide a way to navigate the relationship graph or manage the connections. There's no "unlink" action or relationship metadata.
- **Scales poorly for large research collections.** The flat note list, even with tags, becomes unwieldy with hundreds of notes.

**iPad/Touch Compatibility:**

- Bear is excellent on iPad. It was designed as an Apple-native app and the iPad experience is first-class. The Info Panel can be opened with a left-swipe gesture. The keyboard shows main formatting options in a custom toolbar. Apple Pencil support is available for sketching. The three-column layout collapses gracefully to fit different iPad sizes. Bear is the simplicity benchmark for iPad writing apps.

**Relevance to DraftCrane:**

- Bear's Info Panel progressive disclosure model is the strongest pattern for DraftCrane's source metadata. Sources, linked chapters, word counts, and AI analysis results could live in a right-hand panel that's hidden by default and revealed on demand.
- Tag-based organization (rather than folder hierarchy) is worth considering for source categorization. A source could be tagged `#chapter-3` and `#interviews` without needing to "live" in one place.
- Bear's deliberate simplicity is the design philosophy DraftCrane should follow. Every feature added to the source management UI should be evaluated against Bear's "does it stay out of your way?" standard.
- The lack of split-view is a real limitation that DraftCrane should not replicate. Side-by-side source viewing while writing is a core need.

---

### 1.7 Zotero

**Source/Reference Model:**
Zotero is a dedicated reference manager. Its model is a structured library of bibliographic items (books, articles, web pages, PDFs, etc.), each with rich metadata (author, title, date, journal, DOI, tags, notes). Items are organized into collections (which function like playlists -- an item can be in multiple collections). The library integrates with word processors via plugins that provide a "search > select > insert citation > auto-generate bibliography" pipeline. The mental model is: a curated library of sources with structured metadata, connected to your writing via formal citations.

**Key UI Patterns:**

- **Three-Pane Library:** Left sidebar (collection tree), center panel (item list), right panel (item details/metadata). This is the standard reference-manager layout, closely mirroring email clients.
- **Word Processor Integration Toolbar:** Zotero adds a toolbar to Word/LibreOffice/Google Docs with buttons for "Add/Edit Citation," "Add/Edit Bibliography," "Document Preferences" (citation style), and "Refresh." The citation insertion flow is: position cursor > click "Add Citation" > type in search box > select from results > citation appears in text.
- **Red Search Bar for Citation Insertion:** When inserting a citation, Zotero opens a floating search bar (the "citation dialog") where users type an author name, title, or keyword. Results appear as the user types, and clicking a result inserts it. This is fast and keyboard-driven.
- **Built-in PDF Reader (Zotero 7):** PDFs open in tabs within Zotero's main window. A left sidebar shows page thumbnails. Users can highlight, annotate, and extract annotations into notes. Annotations sync across devices via Zotero's iOS app.
- **Context Pane:** The right-hand pane shows bibliographic metadata, tags, related items, and notes for the currently selected item. When reading a PDF, the context pane shows the item's metadata alongside the reader.
- **Google Docs Integration:** The Zotero Connector browser extension adds a "Zotero" menu to Google Docs. The same search-and-insert pipeline works directly in the browser. Citations are stored as special codes that Zotero can update when the user changes citation style or edits source metadata.

**Strengths:**

- **The search-insert-bibliography pipeline is the gold standard for citation.** The flow from "I need to cite something" to "citation appears in my text with a bibliography entry" is seamless. This is the pattern that nonfiction authors need.
- **Collections allow multi-chapter source organization.** A source can be in the "Chapter 3" collection and the "Leadership Theory" collection simultaneously, without duplication. This maps perfectly to DraftCrane's source-chapter relationship.
- **Rich metadata management.** Tags, notes, related items, and bibliographic fields provide comprehensive source documentation.
- **Cross-platform citation style support.** Over 10,000 citation styles means the output works for any publisher's requirements.

**Weaknesses:**

- **The library is a separate application.** Users must switch between Zotero (library management) and their word processor (writing). The integration toolbar bridges this gap but doesn't eliminate context-switching.
- **The mental model is academic.** "Collections," "bibliographic metadata," "citation style," "DOI" -- this vocabulary and conceptual framework is designed for academics, not management consultants writing their first book.
- **Setup overhead is significant.** Installing Zotero, the browser connector, the word processor plugin, configuring sync, importing sources -- this is multi-step setup that Diane would not complete.
- **No iPad writing integration.** The Zotero iOS app is a PDF reader and annotation tool, not a writing tool. There is no way to insert citations from Zotero into a document on iPad.

**iPad/Touch Compatibility:**

- Zotero's iOS app is limited to library browsing, PDF reading, and annotation. Citation insertion only works via desktop word processor plugins. The PDF reader syncs annotations and reading position across devices, which is useful for research on the go. But the core "search > cite > bibliography" workflow is desktop-only.

**Relevance to DraftCrane:**

- The search-and-insert citation pipeline is the single most relevant pattern from Zotero. DraftCrane's Research Assistant (#125-130) should replicate this flow: user searches sources > gets results with snippets > inserts a reference/quote into their chapter.
- Zotero's collection model (a source belongs to multiple collections) validates the concept that DraftCrane sources should be associated with multiple chapters without duplication.
- The "red search bar" citation dialog is a specific UI pattern worth adapting: a minimal, focused search that surfaces results from the source library.
- The desktop-only limitation means DraftCrane has an opportunity to bring this workflow to iPad -- a differentiated capability.
- The academic vocabulary and setup complexity are anti-patterns to avoid.

---

### 1.8 ChatGPT Projects

**Source/Reference Model:**
ChatGPT Projects treats files as context for a conversational AI. Users upload documents (PDFs, DOCXs, images, text files) to a project, set custom instructions, and then all conversations within that project have access to those files. The model is "upload and ask" -- files become a knowledge base that the AI draws from when answering questions. There is no manual organization, tagging, or linking of files; the AI handles the retrieval.

**Key UI Patterns:**

- **Project-Level File Uploads:** A dedicated area in the project settings where users upload files. Files are listed with names and types. The upload limit varies by plan: 5 files (Free), 25 files (Plus), 40 files (Pro/Enterprise).
- **Conversational Query Interface:** Users type natural-language questions in a chat interface. The AI responds using information from uploaded files and its training data. Responses can include direct quotes, summaries, and synthesized insights from across multiple uploaded documents.
- **Custom Instructions:** Project-level instructions that persist across all conversations within the project. Users can define context ("I'm writing a nonfiction book about leadership") and preferences ("Always cite the source document name when referencing uploaded files").
- **Project Sharing (Oct 2025):** Shared projects allow team members to access the same files, instructions, and conversation history. The AI draws from the group's collective uploaded knowledge.
- **Inline File References:** When the AI references an uploaded file, it can name the file and sometimes indicate where in the document the information was found. However, this is inconsistent and depends on the model's interpretation.

**Strengths:**

- **Zero organizational overhead.** Users upload files and ask questions. No folders, tags, collections, links, or metadata to manage. This is the ultimate simplicity for Diane.
- **Natural language access to source materials.** Instead of browsing folders or scanning PDFs, users ask "What does the Smith interview say about resilience?" and get an answer. This is dramatically more accessible than any manual reference system.
- **Cross-document synthesis.** The AI can combine information from multiple uploaded documents in a single response, something impossible with manual source browsing.
- **The pattern is immediately familiar.** Anyone who has used ChatGPT knows how to interact. The learning curve is near zero.

**Weaknesses:**

- **File limits are restrictive.** 5-40 files depending on plan. A nonfiction author with hundreds of Google Docs research files cannot upload them all.
- **Context window constraints.** Only 128K-200K tokens can be held in active context, meaning approximately 200-300 pages. Large research libraries exceed this, causing the AI to lose context on some sources.
- **No structured citation.** The AI may name a source file but doesn't provide page numbers, consistent citation formatting, or bibliography generation. For a nonfiction book, this is insufficient.
- **Opaque retrieval.** Users cannot see which files the AI is drawing from or control its search. There's no equivalent of "search only in these three documents."
- **No integration with the writing surface.** ChatGPT Projects is a research/Q&A tool, not a writing tool. There's no way to drag an AI response into a manuscript, create a footnote, or maintain source references in a document.
- **Hallucination risk.** While project-scoped AI reduces hallucination, it doesn't eliminate it. The AI may conflate information from different sources or infer connections that don't exist.

**iPad/Touch Compatibility:**

- ChatGPT works well on iPad via the native app or Safari. The conversational interface is inherently touch-friendly -- it's just a chat. File upload is slightly cumbersome (selecting multiple files from the Files app) but functional. The simplicity of the interaction model makes it one of the most iPad-compatible patterns studied.

**Relevance to DraftCrane:**

- The "upload and ask" model is the foundational pattern for DraftCrane's Research Assistant (#121-137). The planned workflow of "connect Drive sources > ask questions > get cited answers > insert into manuscript" is a more structured version of ChatGPT Projects.
- The zero-organizational-overhead approach is the right default for Diane. She should be able to ask questions about her sources without organizing them first.
- ChatGPT's weaknesses (no structured citation, no writing integration, opaque retrieval) define DraftCrane's differentiation opportunity. If DraftCrane can provide the conversational ease of ChatGPT Projects with proper source citations, snippet insertion, and footnote generation, it delivers unique value.
- The file limit constraint is relevant because DraftCrane connects to Google Drive rather than requiring uploads. This is a structural advantage.
- Custom instructions per project map to DraftCrane's project-level settings (voice, tone, genre).

---

## 2. Cross-Cutting Pattern Catalog

### 2.1 Source Organization Patterns

| Pattern | Tools | Description | Complexity |
|---|---|---|---|
| **Folder/Tree Hierarchy** | Scrivener (Binder), Zotero (Collections) | Sources organized into nested folders. Visual tree in sidebar. | Medium -- requires upfront folder creation |
| **Tag-Based** | Bear (#tags), Ulysses (Keywords), Obsidian (YAML tags) | Sources tagged with one or more labels. Cross-referenced without duplication. | Low-Medium -- tags are flexible but require naming discipline |
| **Link-Based / Graph** | Obsidian (wiki-links), Bear (wiki-links) | Sources connected through explicit links. Structure emerges from connections. | Low (creation) / High (comprehension) |
| **Database/Relational** | Notion (databases + relations) | Sources as database entries with structured metadata and formal relationships. | High -- requires schema design |
| **Flat Upload** | ChatGPT Projects | Sources uploaded to a bucket with no required organization. | Minimal -- no organization required |
| **Material Designation** | Ulysses (Material Sheets), Scrivener (Research folder) | Sources marked as "not-manuscript" but coexisting in the project structure. | Low -- one toggle to designate |

### 2.2 Source Access Patterns

| Pattern | Tools | Description | Screen Impact |
|---|---|---|---|
| **Persistent Sidebar** | Scrivener (Binder), Zotero (Library), Notion (Sidebar) | Always-visible navigation panel for source browsing. | Takes 20-30% of screen width permanently |
| **Split Editor / Dual Pane** | Scrivener (Split Editor), Obsidian (Split Panes) | Editor divided into two areas, one for writing and one for reference. | 50/50 screen split, reduces writing area |
| **Copyholder / Pinned Reference** | Scrivener (Copyholder) | A smaller reference pane pinned to the editor that persists during navigation. | Takes 20-30% of one editor pane |
| **Right-Hand Panel / Side Peek** | Notion (Side Peek), Bear (Info Panel), Zotero (Context Pane), Google Docs (Gemini Panel) | Contextual panel that opens on the right, showing details of selected item. | Overlays or pushes content; can be dismissed |
| **Center Modal / Overlay** | Notion (Center Peek) | Focused modal overlay for deep reading of a source. | Covers primary content; focuses attention |
| **Floating Window** | Scrivener (Quick Reference) | Independent floating window for reference viewing. | Desktop-only; not practical on iPad |
| **Inline Embedding / Transclusion** | Obsidian (transclusion) | Source content embedded directly in the writing surface. | No additional screen cost; content is inline |
| **Conversational Interface** | ChatGPT Projects, Google Docs (Gemini) | Natural language Q&A that retrieves and presents source content. | Side panel for chat; content arrives as conversation |

### 2.3 Source-to-Writing Integration Patterns

| Pattern | Tools | Description | Formality |
|---|---|---|---|
| **Drag-and-Drop Insertion** | Obsidian (embed link), Notion (@ mention) | Drag a source or snippet from a panel directly into the editor. | Informal -- creates a reference or embed |
| **Search-Select-Cite Pipeline** | Zotero (citation dialog) | Invoke a search, select from results, citation + bibliography auto-generated. | Formal -- structured citation with bibliography |
| **@ Mention / Inline Reference** | Notion (@ page mention), Obsidian ([[wiki-link]]) | Type a trigger character to reference another document inline. | Semi-formal -- creates a clickable link |
| **Copy-Paste with Attribution** | Manual pattern across all tools | User copies from source, pastes into editor, manually adds footnote. | Informal -- relies on user discipline |
| **AI-Mediated Insertion** | ChatGPT Projects, Google Docs (Gemini) | Ask AI a question, receive answer with source reference, paste or insert into text. | Variable -- depends on AI's citation quality |
| **Transclusion / Live Embed** | Obsidian (![[note]]) | Embed source content that stays synchronized with the original. | Formal -- content is live-linked |
| **Snippet Collection to Insertion** | Zotero (annotations to notes), planned DraftCrane Research Board | Collect relevant excerpts from sources, then selectively insert into manuscript. | Two-stage -- collect first, insert later |

### 2.4 AI + Source Patterns

| Pattern | Tools | Description |
|---|---|---|
| **Document-Scoped Q&A** | ChatGPT Projects, Google NotebookLM | Upload documents, ask questions, receive answers grounded in uploaded content |
| **Side Panel AI Assistant** | Google Docs (Gemini), Notion AI | AI assistant in a side panel that can reference the current document and connected files |
| **Summarization on Demand** | Google Docs (Gemini audio summaries), ChatGPT, NotebookLM | AI generates a summary of a document or set of documents |
| **AI-Powered Search** | Google Docs (deprecated Explore), Notion AI | AI finds relevant content across connected documents based on a query |
| **Structured Snippet Extraction** | Google NotebookLM (inline citations), planned DraftCrane (#127) | AI extracts specific passages with source attribution and presents them as structured results |
| **Contextual Suggestion** | Notion AI (database autofill), Google Docs (Gemini writing suggestions) | AI proactively suggests relevant information or improvements based on context |

### 2.5 Progressive Disclosure Patterns

| Pattern | Tools | Description | Levels |
|---|---|---|---|
| **Default Hidden Panel** | Bear (Info Panel), Google Docs (Gemini Panel) | Metadata and tools are hidden until explicitly invoked. Editor takes full width by default. | 2 (hidden / visible) |
| **Collapsible Panes** | Ulysses (3-pane to 1-pane), Obsidian (sidebar toggle) | Multiple panes can be individually shown or hidden to control information density. | 3+ (each pane toggleable) |
| **Contextual Surface** | Notion (Side Peek on click), Zotero (Context Pane on selection) | Additional information appears only when a specific item is selected or clicked. | 2 (no selection / selected) |
| **Mode Switching** | Scrivener (Composition Mode vs. Standard), Ulysses (Editor-only vs. 3-pane) | Distinct modes that offer different levels of UI complexity. | 2-3 (focus / standard / full) |
| **Conversational Escalation** | ChatGPT Projects | Start with a question, receive a brief answer, ask follow-ups for more depth. | Continuous (user controls depth) |
| **Nested Sheets / Modals** | DraftCrane current (4 layers of nested sheets) | Each action opens a new layer on top of the previous one. | 4+ (becomes disorienting) |

---

## 3. Anti-Patterns for DraftCrane

### 3.1 Organizational Overhead Barrier

**Pattern:** Requiring users to set up folders, collections, databases, or tagging systems before they can start working with sources.

**Offenders:** Notion (database relations), Zotero (library setup + collections), Scrivener (Research folder hierarchy), Obsidian (vault structure + frontmatter tags).

**Why it fails for DraftCrane:** Diane has 14 years of scattered Google Docs. She needs to *write*, not build an organizational system. Marcus has his own Google Drive folder structure that works for him. Forcing either persona to recreate or remap their organization inside DraftCrane is a deal-breaker. Sources should "just work" once connected to a project, with optional organization available for users who want it.

### 3.2 Technical Mental Model Requirement

**Pattern:** Requiring understanding of Markdown syntax, wiki-link notation, YAML frontmatter, database relations, or file-system concepts.

**Offenders:** Obsidian (`[[wiki-links]]`, `![[transclusion]]`, YAML), Bear (`[[wiki-links]]`, `#tags`), Notion (database relations, formulas, filters).

**Why it fails for DraftCrane:** "Diane doesn't know what Markdown is." Any source management feature that requires typing special characters, understanding linking syntax, or configuring database schemas will not be adopted. Every relationship between chapters and sources must be expressible through standard GUI interactions: tap, drag, select from a list.

### 3.3 Multi-Window / Desktop-Centric Interactions

**Pattern:** Floating windows, multi-monitor layouts, hover-dependent menus, drag-and-drop between separate windows, right-click context menus as primary interaction.

**Offenders:** Scrivener (Quick Reference floating windows, 4 reference-viewing methods), Obsidian (desktop plugin ecosystem, pane resizing), Zotero (separate application + word processor plugin).

**Why it fails for DraftCrane:** iPad Safari is the primary test target. There are no floating windows. There is no hover state. Right-click requires a long-press, which is not discoverable. Any interaction that depends on desktop affordances will fail on iPad.

### 3.4 Deeply Nested Modal Chains

**Pattern:** Opening a panel that opens a sheet that opens another sheet that opens a viewer -- 3+ levels of stacked modals or sheets.

**Offenders:** DraftCrane's current implementation (SourcesPanel > AddSourceSheet > DriveBrowserSheet > SourceViewerSheet -- 4 layers).

**Why it fails for DraftCrane:** Progressive disclosure research indicates that designs exceeding 2 disclosure levels typically have low usability because users get lost moving between levels. On iPad, where the back gesture can accidentally dismiss the wrong layer, deep nesting is especially disorienting. The current 4-layer chain is the core UX problem to solve.

### 3.5 Separate-Application Integration

**Pattern:** Requiring users to install, configure, and switch between a separate application and their writing tool.

**Offenders:** Zotero (separate app + browser extension + word processor plugin), Obsidian + Zotero integration (requires both apps + plugin configuration).

**Why it fails for DraftCrane:** DraftCrane's value proposition is an integrated writing environment. Requiring users to install a separate source manager defeats the purpose. All source management must happen within the DraftCrane interface.

### 3.6 Feature-Count Complexity

**Pattern:** Providing multiple ways to accomplish the same task, requiring users to learn when to use which method.

**Offenders:** Scrivener (4 methods for viewing references), Notion (3 peek modes), Obsidian (sidebar backlinks vs. inline backlinks vs. graph view vs. Dataview queries).

**Why it fails for DraftCrane:** DraftCrane should provide *one clear way* to view a source alongside writing, *one clear way* to link a source to a chapter, and *one clear way* to insert a source reference. Optionality is complexity.

---

## 4. Relevance Matrix

| Pattern | iPad-First | Non-Technical | Google Drive Compat. | AI Integration | Complexity Budget |
|---|---|---|---|---|---|
| **Persistent sidebar (Binder)** | Moderate Fit | Strong Fit | Strong Fit | Moderate Fit | Moderate Fit |
| **Split editor (dual pane)** | Poor Fit | Strong Fit | Strong Fit | Moderate Fit | Moderate Fit |
| **Copyholder (pinned reference)** | Moderate Fit | Strong Fit | Strong Fit | Moderate Fit | Strong Fit |
| **Right-hand panel (Side Peek)** | Strong Fit | Strong Fit | Strong Fit | Strong Fit | Strong Fit |
| **Center modal (overlay)** | Strong Fit | Strong Fit | Strong Fit | Moderate Fit | Strong Fit |
| **Floating windows** | Poor Fit | Moderate Fit | Moderate Fit | Poor Fit | Poor Fit |
| **Inline transclusion** | Strong Fit | Poor Fit | Poor Fit | Moderate Fit | Poor Fit |
| **Conversational AI panel** | Strong Fit | Strong Fit | Strong Fit | Strong Fit | Strong Fit |
| **Search-select-cite pipeline** | Strong Fit | Moderate Fit | Strong Fit | Strong Fit | Moderate Fit |
| **@ mention inline reference** | Strong Fit | Moderate Fit | Moderate Fit | Moderate Fit | Strong Fit |
| **Tag-based organization** | Strong Fit | Moderate Fit | Moderate Fit | Moderate Fit | Moderate Fit |
| **Material sheet designation** | Strong Fit | Strong Fit | Strong Fit | Moderate Fit | Strong Fit |
| **Folder/tree hierarchy** | Moderate Fit | Strong Fit | Strong Fit | Moderate Fit | Moderate Fit |
| **Database/relational model** | Poor Fit | Poor Fit | Poor Fit | Moderate Fit | Poor Fit |
| **Wiki-link syntax** | Moderate Fit | Poor Fit | Poor Fit | Poor Fit | Poor Fit |
| **Upload-and-ask (ChatGPT)** | Strong Fit | Strong Fit | Strong Fit | Strong Fit | Strong Fit |
| **Info panel (progressive disclosure)** | Strong Fit | Strong Fit | Strong Fit | Strong Fit | Strong Fit |
| **Collapsible panes** | Strong Fit | Strong Fit | Strong Fit | Moderate Fit | Strong Fit |
| **Snippet collect-then-insert** | Strong Fit | Strong Fit | Strong Fit | Strong Fit | Moderate Fit |
| **Graph visualization** | Poor Fit | Poor Fit | Poor Fit | Moderate Fit | Poor Fit |

**Top-scoring patterns (5/5 Strong Fit):**
- Right-hand panel (Side Peek)
- Conversational AI panel
- Upload-and-ask
- Info panel (progressive disclosure)

**Strong patterns (4/5 Strong Fit):**
- Center modal (overlay)
- Copyholder (pinned reference)
- Collapsible panes
- Material sheet designation
- Snippet collect-then-insert

---

## 5. Key Insights for DraftCrane

### Insight 1: The Right-Hand Panel Is the Universal Pattern

Every tool studied uses some form of right-hand contextual panel: Scrivener's Inspector, Notion's Side Peek, Google Docs' Gemini panel, Ulysses' attachments, Obsidian's backlinks sidebar, Bear's Info Panel, Zotero's Context Pane. This is the strongest cross-cutting pattern in the research. DraftCrane should adopt a single right-hand panel that serves multiple purposes (source preview, chapter metadata, AI research results) through tabs or contextual switching. On iPad, this panel should slide in from the right and push (not overlay) the editor content, following the pattern established by Bear's Info Panel and Notion's Side Peek.

### Insight 2: "Ask, Don't Browse" Is the Future of Source Access

The trajectory from Google Docs' Explore panel (manual search and browse, deprecated 2024) to Gemini's side panel (conversational Q&A, current) to ChatGPT Projects (upload and ask, current) to NotebookLM (source-grounded Q&A with citations) is clear: the industry is moving from "browse your references" to "ask about your references." DraftCrane's Research Assistant (#128-130) is aligned with this trajectory. The primary source access pattern for Diane should not be "open your source library and find the document" but rather "ask a question and get an answer with a citation." Manual source browsing should still exist for Marcus (who knows exactly which document he wants) but should be secondary.

### Insight 3: Two Disclosure Levels Maximum

Progressive disclosure research and the tool analysis both confirm: UIs that exceed 2 levels of disclosure (hidden > visible, or summary > detail) create navigation confusion. DraftCrane's current 4-layer sheet chain (SourcesPanel > AddSourceSheet > DriveBrowserSheet > SourceViewerSheet) is the clearest example of this anti-pattern. The redesign should collapse this to a maximum of 2 levels: (1) the source list/panel visible alongside the editor, and (2) a source detail view that replaces (not stacks on top of) the list. Bear's Info Panel and Notion's Side Peek both demonstrate this: click to expand the panel (level 1), click an item to see its details (level 2).

### Insight 4: Source-Chapter Relationships Should Be Implicit, Not Managed

Scrivener's Inspector Bookmarks and Obsidian's backlinks both demonstrate that the best source-chapter relationships emerge from use, not from explicit "link/unlink" actions. When an author references a source in their chapter (via citation, snippet insertion, or AI query), the system should automatically record that relationship. When viewing a source, the system should show which chapters reference it (backlinks). When viewing a chapter, the system should show which sources are referenced (outgoing links). The current "link/unlink source to chapter" action should be replaced by these implicit relationships, supplemented by an optional "pin to chapter" action for sources the author wants quick access to while writing a specific chapter.

### Insight 5: Google Drive Integration Is DraftCrane's Structural Advantage

Every tool studied either requires importing files into its own storage (Scrivener, Obsidian, Zotero) or uploading them to a cloud service (ChatGPT Projects, NotebookLM). DraftCrane's Google Drive integration means sources stay where they are -- in the user's Drive, in their existing folder structure. This is a differentiator, but it must be executed without the "link/unlink" confusion of the current design. The connection should feel like "DraftCrane can see your Drive" rather than "you need to link files from Drive into DraftCrane." The model should be closer to ChatGPT Projects' "upload and ask" simplicity but with Drive as the source instead of file uploads. Users select which Drive folders are "in scope" for a project (#122), and then DraftCrane can search, summarize, and cite from those folders automatically.

### Insight 6: The Editor Must Not Shrink Below Usable Width on iPad

Split editor patterns (Scrivener) and persistent sidebars (Notion, Zotero) work on desktop but create critically narrow writing areas on iPad. On a 10.9" iPad Air in portrait mode, the usable width is approximately 820px. A 50/50 split leaves each pane at 410px -- too narrow for comfortable writing. The right-hand panel must be either (a) full-width overlay that temporarily replaces the editor (like a sheet), (b) a push panel that compresses the editor to ~60% width (only acceptable in landscape), or (c) a pattern that doesn't require simultaneous viewing. For Diane on her iPad Pro in landscape, a 60/40 split (editor/panel) gives ~740px for writing -- marginal but workable. In portrait, the panel should replace the editor entirely, with a clear back gesture to return.

### Insight 7: The Snippet Pipeline Is the Killer Feature

Zotero's "search > select > cite" pipeline, ChatGPT Projects' "ask > receive answer > use," and the planned Research Board (#131-133) all point to the same workflow: research produces snippets, snippets are collected, collected snippets are inserted into the manuscript with attribution. This is the workflow that makes DraftCrane more than "Google Docs with chapters." The pipeline is: (1) AI searches sources and returns relevant passages with citations, (2) the user collects interesting passages to a Research Board, (3) the user drags snippets from the Research Board into the chapter editor, (4) the system automatically creates a footnote referencing the source. This combines the best of Zotero (structured citation), ChatGPT (conversational search), and Scrivener (side-by-side reference), adapted for iPad touch interaction and non-technical users.

---

## Sources

### Scrivener
- [4 Ways to View Reference Materials in Scrivener](https://www.jenterpstra.com/blog/view-reference-materials-in-scrivener)
- [Splitting the Scrivener Editor](https://www.literatureandlatte.com/blog/see-more-of-your-project-splitting-the-scrivener-editor)
- [Scrivener's Research Folder](https://www.literatureandlatte.com/blog/use-scriveners-research-folder-to-store-information-about-your-project)
- [Quick Reference in Scrivener for iOS](https://www.literatureandlatte.com/blog/quick-reference-in-scrivener-for-ios-side-by-side-editing-and-research)
- [Use Bookmarks in Scrivener Projects](https://www.literatureandlatte.com/blog/use-bookmarks-in-scrivener-projects-to-link-to-internal-and-external-files)
- [Scrivener Copyholders](https://www.literatureandlatte.com/blog/use-copyholders-to-extend-the-scrivener-editor)
- [Scrivener Review 2026](https://elephas.app/blog/scrivener-review)
- [Scrivener Review 2025](https://writergadgets.com/scrivener-review/)

### Notion
- [How to Link Databases in Notion](https://notiondemy.com/link-databases-in-notion/)
- [Open Any Page in Peek Mode](https://bensomething.notion.site/Open-Any-Page-in-Peek-Mode-ba4fb02f62e7432c8e596b5038b1f198)
- [Notion Side Peek Release](https://www.notion.com/releases/2022-07-20)
- [Efficiently Using Peek Pages in Notion](https://www.sparxno.com/blog/peek-pages-notion)
- [Notion AI Overview 2026](https://pradeepsingh.com/notion-ai/)
- [Notion AI for Docs](https://www.notion.com/help/guides/notion-ai-for-docs)

### Google Docs
- [Google Docs Explore Tool](https://shakeuplearning.com/blog/5-ways-to-use-the-google-docs-explore-tool/)
- [Gemini in Google Docs](https://workspace.google.com/products/docs/ai/)
- [Gemini for Google Workspace Guide 2026](https://refractiv.co.uk/news/gemini-google-workspace-guide/)
- [How to Use AI in Google Docs 2026](https://dupple.com/learn/how-to-use-ai-in-google-docs)
- [Gemini Audio Summaries for Google Docs](https://winbuzzer.com/2026/02/13/google-gemini-audio-summaries-google-docs-xcxwbn/)
- [Google Workspace Gemini Sidebar](https://www.computerworld.com/article/3845447/google-workspace-how-to-use-gemini-ai-side-panel.html)

### Ulysses
- [Ulysses 19 Review - MacStories](https://www.macstories.net/reviews/ulysses-19-brings-cursor-support-external-folders-material-sheets-and-more/)
- [Ulysses Material Sheets](https://blog.ulysses.app/material-sheets/)
- [First Steps: Library & Editor](https://help.ulysses.app/en_US/getting-started/first-steps-library-editor)
- [How to Write a Novel with Ulysses](https://stories.ulysses.app/how-to-write-a-novel-with-ulysses-ii-research-editing-and-export/)
- [Ulysses Split View Editor](https://thesweetsetup.com/ulysses-15-introduces-split-view-editor-new-image-export-and-previewing-features-and-keyword-management-improvements/)

### Obsidian
- [Obsidian Backlinks Documentation](https://help.obsidian.md/plugins/backlinks)
- [Mastering Obsidian Backlinks](https://bluprio.com/blog/mastering-obsidian-backlinks-a-complete)
- [Connecting and Transcluding Notes in Obsidian](https://thesweetsetup.com/connecting-and-transcluding-notes-in-obsidian/)
- [Obsidian Graph View Documentation](https://help.obsidian.md/plugins/graph)
- [Obsidian Review](https://www.lindy.ai/blog/obsidian-review)
- [Customizing Obsidian on iPad](https://tfthacker.substack.com/p/customizing-obsidian-on-your-ipad-8b71019a276c)

### Bear
- [Bear Info Panel, ToC, and Backlinks](https://bear.app/faq/how-to-use-the-info-panel-table-of-contents-and-backlinks-in-bear/)
- [Bear App Review 2026](https://dockshare.io/apps/bear)
- [Bear: Linked Notes vs Tags](https://www.laroquephoto.com/blog/2024/3/12/bear-days-linked-notes-vs-tags)
- [What's New in Bear 2](https://bear.app/faq/whats-new-in-bear-2/)
- [Bear Community: Backlinks and Info Column](https://community.bear.app/t/forum-feedback-backlinks-and-info-column/5926/129)

### Zotero
- [Zotero Word Processor Integration](https://www.zotero.org/support/word_processor_integration)
- [Zotero Google Docs Integration](https://www.zotero.org/support/google_docs)
- [Zotero PDF Reader](https://www.zotero.org/support/pdf_reader)
- [Zotero at UC Berkeley](https://guides.lib.berkeley.edu/zotero/bibliographies)
- [Zotero Citations Between Google Docs and Word](https://www.zotero.org/blog/move-zotero-citations-between-google-docs-word-and-libreoffice/)

### ChatGPT Projects
- [Using Projects in ChatGPT (OpenAI)](https://help.openai.com/en/articles/10169521-using-projects-in-chatgpt)
- [ChatGPT Project Sharing](https://www.aioperator.com/blog/chatgpt-project-sharing-a-new-feature-that-improves-team-collaboration)
- [What is ChatGPT Projects](https://elephas.app/blog/what-is-chatgpt-projects-how-it-works-pricing-and-more-2025-cmbadknjf0044yq8md6n8jrlp)
- [ChatGPT Projects vs NotebookLM](https://elephas.app/blog/chatgpt-projects-vs-notebooklm)
- [ChatGPT File Upload Limits 2026](https://onefileapp.com/blog/bypass-chatgpt-file-upload-limit-2025)

### UX Research
- [Progressive Disclosure - NN/g](https://www.nngroup.com/articles/progressive-disclosure/)
- [Progressive Disclosure - IxDF](https://www.interaction-design.org/literature/topics/progressive-disclosure)
- [Progressive Disclosure for Mobile Apps](https://uxplanet.org/design-patterns-progressive-disclosure-for-mobile-apps-f41001a293ba)

### Google NotebookLM
- [NotebookLM Sources](https://support.google.com/notebooklm/answer/14276468)
- [NotebookLM FAQ](https://support.google.com/notebooklm/answer/16269187?hl=en)
- [NotebookLM Tutorial - DataCamp](https://www.datacamp.com/tutorial/notebooklm)
