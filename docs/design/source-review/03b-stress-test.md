# Phase 3b: User Stress Test

> DraftCrane Source/Research UX Redesign
> Persona-based stress test of the Detailed Interaction Design (Option B: "Research Companion")
> Date: 2026-02-19

---

## Part 1: Flow-by-Flow Walkthrough

_All walkthroughs written in first person as Diane Mercer unless otherwise noted._

---

### Flow 1: Add Source from Google Drive

**Precondition check:** The flow says "Research Panel is open with Sources tab active." Okay, but how did I get here? I'm looking at the editor for the first time. I see a "Research" button in the toolbar. I tap it. A panel slides in from the right. It has three tabs at the top: Sources, Ask, Clips. Sources is selected by default. I see an empty list and a [+ Add] button. So far, so good -- the button is the obvious next thing to tap.

**Step 1: Tap [+ Add].**
I see it in the Sources tab header. It's right there next to the search field. I tap it. Clear.

**Step 2: Source Add Flow replaces the source list.**
The list smoothly transitions to show my connected Google accounts. I see "scott@email.com -- Browse Google Drive" and below it "Upload from device." This is clear. I know my stuff is in Google Drive. I also notice it says "FROM GOOGLE DRIVE" as a section header. That's helpful -- it tells me what I'm looking at.

**Step 3: Tap my Google account.**
I have one account. I tap it. No confusion here.

**Step 4: Drive browser appears inline.**
Now I see my folders. Research/, Interviews/, External Data/. Below the folders, I see loose files. This looks like my Drive -- same folder names, same files. There are checkboxes next to the files.

**Hesitation point:** I see a [Search files...] field at the top. That's good -- if I had a lot of files I'd want that. But right now I'm just browsing. I navigate into "Interviews/" (one tap), I see my files. I check two of them.

**Step 5-6: Select files.**
The checkboxes are clear. I tap "Interview-Smith.doc" and "Client-Notes.doc." Each gets a checkmark. I see files I already added are grayed out with "Already added" -- nice, I won't accidentally add duplicates.

**Step 7: Tap "Add 2 Selected."**
A big button at the bottom. Full width. Hard to miss. I tap it.

**Step 8: Back to source list.**
The view transitions back to my source list. I see the two new sources with "Processing..." spinners. After a few seconds, they show word counts and "Cached" status.

**The back navigation:** One thing I want to call out -- the [< Sources] back button at the top left is how I get back to my source list from the add flow. I notice it says "< Sources" -- I assume that means "back to the Sources list." That tracks.

**Where I did NOT get confused:** I never left the Sources tab. I never had a sheet open on top of another sheet. I never lost track of where I was. The flow stayed in one panel the whole time.

**Rating: GREEN**

This felt natural. The [+ Add] button was obvious. The Drive browser looked like my Drive. The checkboxes were clear. The "Add Selected" button was prominent. I never felt lost. The inline replacement pattern -- where the source list becomes the add flow and then becomes the source list again -- is intuitive. It feels like navigating _within_ a panel, not opening new windows on top of each other.

The one minor concern: if I had _no_ Google accounts connected, would I know to connect one? The design says it shows a "Connect Google Account" button in that case. Fine. But I'd need to have connected my account during initial setup before any of this makes sense. That's a separate flow I'm trusting works.

---

### Flow 2: Add Source from Local Device

**Step 1: Tap [+ Add] in Sources tab.**
Same as before. Clear.

**Step 2-3: Source Add Flow, tap "Upload file."**
I see "FROM DEVICE" with an "Upload file" option that shows accepted types: ".txt .md .docx .pdf." I tap it.

**Hesitation point:** I know what .pdf is. I know what .docx is (that's Word, right?). I don't know what .txt or .md are. Not a problem -- I wouldn't have those files anyway. I just need to know that my Word documents and PDFs are accepted. The fact that the accepted types are listed is actually reassuring. I know what I can bring in.

**Step 4-5: System file picker.**
iPadOS's file picker opens. This I know. This is Apple's own interface. I navigate to the file, tap it.

**Step 6: Back to source list.**
The picker closes. I see my new source with "Processing..." spinner. Done.

**Rating: GREEN**

Even simpler than Drive because the system file picker is something I already use. The only thing I'd note: will most of my files be in Google Drive, not on my device? Probably. So this is a backup path. But it's clean and works.

One wish: I wish I could add a Google Doc by pasting a link. Like, if I'm looking at a Google Doc in Safari and I want to add it to DraftCrane, I'd love to just copy the URL and paste it somewhere. The current design requires me to browse through Drive's folder structure to find the file. That's fine for most cases but sometimes I already have the doc open.

---

### Flow 3: View a Source While Writing

**Step 1: Tap a source card.**
I'm in the Sources tab. I see my list of sources. I tap "Interview-Smith.doc."

**Step 2: Source Detail View appears.**
The source list slides away and I see the full content of the document. At the top: "< Sources" back button, the filename, word count, and when it was cached. Below: the actual text of my interview notes.

**This is the critical moment:** In landscape mode on my iPad Pro, I can see the editor AND the source content side by side. Left side: my chapter. Right side: my source document. I'm reading my interview notes while my chapter sits right there. I can glance back and forth.

This is what I've been wanting. This is the upgrade from having two Safari tabs. The source content is right beside my writing. I don't have to switch anything. I don't have to remember what I was writing.

**Step 3: Reading the source.**
I scroll through the source content. It's a long document. I'm scanning for a specific stat. The design says that for documents over 10,000 words, a "Search within document" field appears. Mine is 1,240 words so no search field. I scroll and find what I'm looking for.

**Concern:** For my longer documents -- I have a few that are 5,000+ words -- I might want that search field even at 5,000 words. Scrolling through 5,000 words looking for one sentence is tedious. The 10,000-word threshold feels high. I'd lower it to maybe 2,000 words, or just always show it.

**Step 4: Tap "< Sources" to go back.**
I'm done reading. I tap the back button. The source list reappears. My place in my chapter hasn't changed.

**Portrait mode concern:** The design says in portrait mode, the Research Panel is an overlay covering 85% of the screen. So I can't see my editor while viewing a source. I'd be reading the source, then closing the panel, then writing, then opening the panel again. That back-and-forth is the same problem I have with two Safari tabs. In portrait mode, this flow is significantly less useful.

But -- I use my iPad Pro 12.9" in landscape most of the time with my Smart Keyboard. So for me, landscape is the default. In landscape, this is great.

**Rating: GREEN**

In landscape mode, this is a genuine improvement over my current workflow. Side-by-side viewing with one tap to open a source. The inline replacement (list becomes detail, then back to list) keeps me oriented. I always know where I am.

The portrait mode limitation is real but I'm rating this for my primary usage, which is landscape. I'd give portrait mode alone a YELLOW.

---

### Flow 4: Search Sources with Natural Language Query

**Step 1: Tap the "Ask" tab.**
I see three tabs at the top: Sources, Ask, Clips. I tap "Ask."

**First impression:** The tab opens and I see... space. A lot of empty space. Then at the very bottom, a text field: "Ask about your sources..." And above the empty space, some suggested queries:

- "What data do I have on..."
- "Summarize my notes about..."
- "Find quotes about..."

**Emotional reaction:** This is the moment. Right here. I read "Ask about your sources" and I think -- can I really just ask it a question? About MY documents? The ones I just added? I feel a flutter of something between excitement and skepticism. I've used ChatGPT enough to know that AI can be impressive and also confidently wrong. Let me try.

**Step 2-3: Tap the input, type a question.**
I tap the text field. My keyboard comes up. I type: "What did my workshop notes say about psychological safety?"

**iPad keyboard consideration:** When the keyboard appears, the design says the conversation area scrolls up and the input stays above the keyboard. This follows the iMessage pattern. Good -- I know this pattern. The input doesn't get hidden behind the keyboard. I can see what I'm typing.

**Step 4: Tap Send.**
I tap the arrow button next to the input field. A loading indicator appears. "Searching across 6 sources..."

**Step 5: Results appear.**
The AI responds with two result cards. The first one says:

> "Psychological safety was the strongest predictor of team performance, with 67% of teams reporting measurable improvement."
>
> -- Workshop Notes March 2024

I stare at this. It found the exact quote. From the right document. It's telling me which document it came from. Below the quote, there are two buttons: "Save to Clips" and "Insert."

**Emotional reaction:** I feel a rush. This is what I've been wanting. I have 30+ Google Docs and I've been searching through them manually for three years. This just found the exact passage I needed in seconds. If this works consistently, this tool is worth whatever it costs.

**The second result** is from a different document -- Q4-Report.doc. It found a related passage about psychological safety from a completely different source. I didn't even remember that document had this information. That's... genuinely useful. Cross-document discovery.

**Skepticism check:** But is the quote accurate? Did it actually say "67%" or did the AI make that up? I'd want to verify. I see the source title "Workshop Notes March 2024" -- can I tap it? The design for Flow 4 doesn't explicitly say the source title is tappable in the result cards, but Flow 5 and the ResultCard component spec say source titles are tappable links. So yes, I could tap it and go verify. That's important.

**Follow-up query:** The input field now says "Ask a follow-up..." I can ask another question. The conversation stays on screen -- my first question and its results are scrolled up above, and I can ask more. This is familiar from ChatGPT.

**Rating: GREEN**

This is the feature that makes DraftCrane worthwhile. The suggested queries give me a starting point. The results are structured with source citations. I can verify. I can save. I can ask follow-ups. The keyboard handling follows a familiar pattern. The loading state tells me what's happening.

The one risk -- and this is a BIG one -- is if the AI gives bad answers in practice. My rating is GREEN for the _interaction design_. The interaction is intuitive and clear. Whether the AI behind it actually works is a quality question, not a design question. If the AI hallucinates, no amount of good design will save it. But the design itself is right.

---

### Flow 5: Save a Snippet from Search Results

**Path A: Save from AI result (1 tap)**

**Step 1: Tap "Save to Clips."**
I'm looking at the AI result card from my previous search. I see the "Save to Clips" button. I tap it.

**Step 2: Feedback.**
The button changes to a checkmark with "Saved." The Clips tab up top now shows "(1)" next to it. Something was saved somewhere.

**Hesitation point:** "Clips." What are clips? This is the first time I'm really thinking about it. I saved something "to Clips." Is that like a clipboard? Like a scrapbook? I think... it's a collection of things I've saved? The word "clips" makes me think of video clips or newspaper clippings. Newspaper clippings -- that's actually the right metaphor. I'm clipping passages from my sources. Okay, I can work with that. It took me a beat, but I get it.

**Path B: Save from Source Detail View (2-3 taps)**

**Step 1: Long-press to select text.**
I'm reading a source document in the Source Detail View. I find a passage I like. I long-press on it. The standard iOS text selection handles appear.

**Step 2: Adjust selection.**
I drag the handles to select the exact passage I want. This is standard iOS text selection. I know how to do this.

**Step 3: Floating toolbar appears.**
Above my selection, a toolbar pops up. It shows the standard "Copy" option AND a "Save to Clips" option. The DraftCrane option is right there next to the system option.

**Step 4: Tap "Save to Clips."**
I tap it. A toast pops up: "Saved to Clips." The Clips tab badge increments.

**Hesitation point (Path B):** The long-press to select text is fine -- I do this all the time. But will I _discover_ the "Save to Clips" option in the floating toolbar? The design says it appears alongside the system "Copy" action. If it's in the standard iOS cut/copy/paste toolbar, I'll see it because I look at that toolbar whenever I select text. If it's a separate custom toolbar, I might miss it.

**Rating: GREEN (Path A) / YELLOW (Path B)**

Path A is dead simple. One tap. Clear feedback. The Clips badge updating tells me something happened.

Path B depends on whether the floating toolbar is discoverable. The text selection itself is natural -- it's a standard iOS gesture. But adding a custom action to the selection toolbar is something I've only seen in a few apps. Some apps do it well (Safari's "Share" option). Some apps do it poorly (random options I don't understand). If "Save to Clips" is clearly labeled and positioned, it'll work. But I'd give it YELLOW because discovery depends on UI details that could easily go wrong.

Also: the toast notification "Saved to Clips" is important. Without it, I wouldn't be confident the save worked. The toast confirms it.

---

### Flow 6: Insert a Snippet into the Editor

**Path A: Insert from Clips tab (2 taps)**

**Step 1: Tap "Clips" tab.**
I see it up top. It says "Clips (3)" -- I have three saved clips. I tap it.

**Step 2: I see my clips.**
Three cards, each with a quoted passage, the source document name, and when I saved it. Below each: "Insert" and "Delete" buttons.

**Step 3: Tap "Insert" on a clip.**
I tap "Insert" on the psychological safety quote. The design says: "Clip text is inserted at the current cursor position in the editor. A footnote is automatically created referencing the source document."

**Wait.** My cursor position in the editor. Where was my cursor? I've been tapping around in the Research Panel. Did the editor lose my cursor position? The design says: "The cursor position is tracked by the editor (Tiptap's selection state) and persisted even when the user interacts with the Research Panel."

I look at the editor (visible to my left in landscape mode). The cursor should be wherever I left it. Let's say it's at the end of a paragraph where I was writing about team performance. I tap "Insert."

**The result:** The quote appears in my chapter, wrapped in a blockquote (visually distinct from my own text). Below the chapter text, a footnote appears: "[1] Workshop Notes March 2024." A toast says "Inserted with footnote."

**Emotional reaction:** That's... really nice. The quote is clearly marked as a quote (blockquote styling). The footnote was created automatically -- I didn't have to figure out how to do footnotes. And it references my source document by name. This is the kind of thing that would have taken me 5 minutes of formatting. It just happened in one tap.

**Concern:** What if I don't want a blockquote? What if I want to paraphrase and just keep the footnote? The current design always wraps the inserted text in a blockquote. That's fine for direct quotes, but sometimes I'd want to insert the text as regular paragraph text with just the citation. This is a minor concern -- I can always edit the text after insertion to remove the blockquote formatting.

**Path B: Insert from AI result (1 tap)**

Even simpler. I'm in the Ask tab looking at results. I tap "Insert" on a result card. Same behavior -- text inserted with footnote. I don't even need to save it to Clips first.

**The cursor position problem (detailed):** Here's where I want to get specific about iPad behavior. When I tap into the Research Panel's Ask tab and type a query, the editor loses focus. My cursor is no longer blinking in the editor. When I tap "Insert," the design says the editor refocuses and inserts at the stored cursor position. On iPad, refocusing a contenteditable element can trigger the software keyboard. So after I tap "Insert," will my keyboard pop up unexpectedly? Will the viewport jump? These are real iPad Safari quirks that could make the insertion feel janky.

If the insertion is smooth -- text appears at the right spot, footnote appears at the bottom, no viewport jumping -- this is beautiful. If there's viewport jumping or keyboard flickering, it'll feel broken.

**Rating: YELLOW**

The interaction design is excellent. One or two taps to insert a cited quote with automatic footnoting. But I'm giving this YELLOW rather than GREEN because of two concerns:

1. **Cursor position reliability on iPad.** The design acknowledges this is tricky. If the cursor ends up in the wrong place or the viewport jumps, the experience breaks.
2. **Blockquote-only insertion.** I sometimes want to insert text as regular text with just a citation. The blockquote is appropriate for direct quotes but not for paraphrased material. A future enhancement could offer "Insert as quote" (blockquote + footnote) vs. "Insert citation only" (just the footnote, no text).

Marcus would rate this GREEN. He's used to precise cursor positioning and wouldn't worry about it. He'd appreciate the automatic footnoting as a time-saver.

---

### Flow 7: Remove a Source

**Step 1: Swipe left on a source card.**
I see my source in the list. I swipe left on it. Action buttons slide in from the right: "View," "Import," "Remove."

**Alternative:** I could also tap the "..." overflow button on the card. Good -- because I don't always discover swipe gestures. The "..." button is always visible.

**Step 2: Tap "Remove."**
I tap the red "Remove" text.

**Step 3: Confirmation dialog.**
A dialog pops up in the center of the screen:

> "Remove 'Interview-Smith.doc'?"
> "This removes the source from your project. The original file in Google Drive is not affected."
> "Related clips will keep their text but lose the source link."

**Emotional reaction:** This is exactly the information I need. My first fear when I see "Remove" on anything connected to my Google Drive is: "Will it delete my Google Doc?" The dialog explicitly says "The original file in Google Drive is not affected." I exhale. My file is safe.

The note about clips is also reassuring. If I saved some passages from this source and then remove it, my saved passages don't disappear. They just lose the connection back to the source. That's fair.

**Step 4: Tap "Remove."**
I tap the red "Remove" button in the dialog. The source fades out of the list. Done.

**Rating: GREEN**

This is exactly how destructive actions should work. Clear warning. Explicit reassurance about what happens to the original file. Information about side effects (clips). Two-tap confirmation so I can't accidentally delete things. The swipe-left pattern is familiar from iOS, and the "..." fallback ensures discoverability.

The only thing that could improve it: an "Undo" toast after removal instead of (or in addition to) the confirmation dialog. "Source removed. [Undo]" appearing for 5 seconds would let me recover from mistakes without the friction of a dialog. But the dialog approach is perfectly fine -- it's the safer choice for a less technical user like me.

---

### Flow 8: Browse Collected Snippets on Research Board

**Step 1: Tap "Clips" tab.**
I see "Clips (5)" in the tab bar. I tap it.

**Step 2: My clips appear.**
Five cards, each with a quoted passage, the source it came from, and when I saved it. Newest first. Each card has "Insert" and "Delete" buttons.

**First impression:** This feels like a collection of sticky notes. Each one has a quote I pulled from my research. I can read through them, remember why I saved them, and decide which ones to use in my chapter.

**Step 3: Scroll and review.**
I scroll through. The clips are in reverse chronological order (newest first). I read through them, re-familiarizing myself with what I've collected.

**Concern:** With only 5 clips, this is manageable. But what about when I have 30 clips? 50? The design shows a "Search clips..." field at the top. Good -- I can search by text or source title. But I might also want to organize clips by chapter topic. "These three clips are for Chapter 4. These two are for Chapter 7." The current design doesn't support any grouping. It's a flat chronological list. For now, that's fine. But as the Clips tab grows, I can see myself wanting folders or tags.

**Step 4 (optional): Tap source title.**
I see "Workshop Notes March 2024" under one of my clips. I tap it. The design says this navigates me to the Sources tab with the Source Detail View for that document, scrolled near the passage. That's useful -- if I want to see the full context around a clip, I can jump right to it.

**The back-navigation question:** After tapping the source title and viewing the source, how do I get back to Clips? The design says the Sources tab opens with the Source Detail View. So I'm now on the Sources tab. To get back to Clips, I'd tap the "Clips" tab. My clips list should still be there. The design says tab state persists. Good.

But wait -- I was on the Clips tab, I tapped a source title, and now I'm on the Sources tab viewing a source. That's a cross-tab navigation. It works logically, but it might feel disorienting. I went from Clips to Sources without explicitly choosing to switch tabs. A breadcrumb trail or a "Back to Clips" button in the Source Detail View would help me get back to where I was.

**Rating: YELLOW**

The clips display is clean and readable. Searching works. Insert and Delete are clear. But I'm giving YELLOW for two reasons:

1. **Cross-tab navigation confusion.** Tapping a source title in a clip takes me from the Clips tab to the Sources tab. That's logical but potentially disorienting. I'd want a clear way to get back to Clips.
2. **Scaling concern.** A flat chronological list works for 5-10 clips. It won't work for 30+. Search helps but isn't a substitute for organization. This is a known limitation the design acknowledges, but it affects my confidence in the long-term usability.

Marcus would also rate this YELLOW, but for different reasons. He'd be frustrated by the lack of chapter-based organization from day one. He'd want to tag clips by chapter as he saves them.

---

## Part 2: Experience Scenarios

### Scenario A: First-Time Experience

_"I just signed up for DraftCrane. I created my first project. I connected my Google Drive. Now I see the editor. I've been told there's a way to bring in my existing Google Docs as reference material. What do I do?"_

**1. Do I see the Research panel? Is it open by default? How do I find it?**

The design says the Research Panel is toggleable -- it's closed by default. So I see my editor taking up most of the screen, with my chapter sidebar on the left. I need to find the Research panel.

I scan the toolbar above the editor. I see formatting buttons (bold, italic, etc.) and then -- there should be a "Research" button. The design specifies this as a toolbar button that toggles the panel. If it's a clearly labeled button with text ("Research") or an obvious icon (a magnifying glass? a book?), I'll find it. If it's an ambiguous icon buried among 10 other toolbar icons, I might not.

**Assumption:** The button is reasonably prominent. I tap it. The panel slides in.

**2. Do I understand what "Sources" means in this context?**

The panel opens to the Sources tab. I see an empty state. What does the empty state say? The design for Flow 4 mentions an empty state for the Ask tab ("Add source documents first") but doesn't describe the Sources tab empty state explicitly. If the Sources tab empty state says something like:

> "No sources yet. Add your Google Docs and other research files to reference them while you write."

...then yes, I understand. "Sources" means "my reference files." The word "sources" is slightly academic, but in context -- next to "Add your Google Docs" -- it clicks.

If the empty state is just a blank list with a [+ Add] button and no explanation, I'd be confused. "Add what? What goes here?"

**3. Can I add my first source without help?**

Assuming the [+ Add] button is visible in the empty state, yes. I tap it, see my Google account, browse my Drive, select files, tap "Add Selected." I just walked through this in Flow 1. It works.

**4. After adding one source, do I understand what just happened and what I can do next?**

I see my source in the list with "Processing..." and then a word count. I understand: DraftCrane read my Google Doc and now has it available. I can tap on it to read it.

Do I understand what the Ask and Clips tabs are? Probably not yet. I might tap "Ask" out of curiosity and see the empty state with suggested queries. If I try one, I'd discover the AI search. If I don't, I'd move on and come back later.

The progressive disclosure works here: I added a source, I can view it, and the other tabs are there when I'm ready for them.

**5. Rating: YELLOW**

I'm giving this YELLOW, not GREEN, for one specific reason: **the Research panel is hidden by default.** If someone told me "there's a way to bring in your Google Docs," I'd look for it. But if nobody told me -- if I just signed up and started writing -- I might not discover the Research button in the toolbar for days or weeks. There's no onboarding prompt, no tooltip, no "Hey, want to add your research materials?" nudge.

The flows themselves are GREEN once I'm inside the panel. But _finding_ the panel in the first place is the gap. A first-use prompt or a visible empty state in the sidebar ("Add research material") would close this gap.

---

### Scenario B: Mid-Writing Experience

_"I'm deep in Chapter 6 -- 'Building Psychological Safety.' I just wrote a paragraph claiming that 'teams with high psychological safety are 40% more productive.' I need to verify that stat because I think it came from one of my workshop preparation docs."_

**1. I'm in the editor. The Research panel may or may not be open. What's my first move?**

If the panel is already open from earlier, I glance right. I see the Sources tab. But I don't want to browse -- I want to find a specific stat. I tap the "Ask" tab.

If the panel is closed, I tap the Research button in the toolbar. The panel opens. I switch to the Ask tab.

Either way, I'm 1-2 taps from the Ask tab.

**2. Do I search? Browse sources? How do I find this specific stat?**

I type in the Ask input: "What stat do I have about psychological safety and productivity?"

The AI responds. It finds two passages:

- One from Workshop Notes March 2024: "67% of teams reporting measurable improvement"
- One from Q4-Report.doc: "2.3x faster decision-making"

Wait. Neither of those says "40% more productive." Did I make up that number? Or did the AI miss it? This is a realistic scenario: I wrote a stat from memory and now I can't find it in my sources.

**3. Once I find it (or don't), how do I verify the context?**

I tap the source title "Workshop Notes March 2024" on the first result. The design says this takes me to the Sources tab with the Source Detail View. I can read the full document to see if there's a "40% more productive" stat anywhere in it.

I scroll through. I find a passage that says "teams with high psychological safety are 40% more likely to take productive risks." Aha -- I misremembered. It's "40% more likely to take productive risks," not "40% more productive." I need to correct my chapter.

**4. If I want to use a specific quote, how do I get it into my chapter?**

I have two options:

- I can long-press to select the corrected passage in the Source Detail View, tap "Save to Clips," then go to Clips and tap "Insert."
- Or I can go back to the Ask tab, ask a more specific question to get the passage as a result card, and tap "Insert" directly.

The faster path: I long-press, select "Psychological safety teams are 40% more likely to take productive risks (Google re:Work study, 2015)," tap "Save to Clips," switch to Clips tab, tap "Insert." That's about 5 taps after finding the passage.

The simpler path: I just select the text, copy it (standard iOS copy), close the Research panel, and paste it into my chapter. Then manually fix the footnote. That's fewer taps but no auto-footnote.

**5. How much time has this taken? Am I still in writing flow?**

Total time estimate: 30-60 seconds for the Ask query + reading results + verifying in the source + correcting my chapter. That's fast. Without DraftCrane, this would have been: open Google Drive (30s), try to remember which document (30s), open the wrong one first (30s), open the right one (15s), search within the doc (30s), find the passage (30s), copy it (10s), switch back to my writing doc (15s), paste (5s), create footnote manually (60s). Total: 3-4 minutes minimum. More likely 5-10 minutes because I'd get distracted reading.

DraftCrane compressed a 5-minute research interruption into about a minute. My writing flow is bruised but not broken.

**6. Rating: GREEN**

This is the scenario that sells DraftCrane. The Ask tab turns a multi-minute Google Drive scavenger hunt into a 30-second query. The ability to verify by tapping through to the source document addresses my trust concerns. The insertion path exists even if it's a few taps more than ideal.

The only thing that could make this RED: if the AI misattributes the quote or can't find it at all. The design can't control AI quality, but it handles the "no results" case with a helpful message. The _design_ is GREEN. The _experience_ depends on the AI working correctly.

---

### Scenario C: Research Session Experience

_"I'm not writing today. I'm organizing. I want to go through 5 of my Google Docs and pull out the best passages for my book. I'll use them later when I actually write."_

**1. Can I do this in DraftCrane, or do I need to use Google Docs directly?**

I can do this in DraftCrane. Here's the workflow:

- Open the Research Panel
- Go to the Sources tab
- Tap on the first source to view it
- Read through it, long-pressing to select good passages
- "Save to Clips" on each passage
- Tap "< Sources" to go back to the list
- Open the next source
- Repeat

Alternatively, I can use the Ask tab to accelerate: "Find the most important quotes about leadership from my interview documents." The AI surfaces key passages across multiple sources. I save the good ones to Clips. Much faster than reading each document front to back.

**2. Is there a workflow for "browse source, find passage, save for later"?**

Yes. The Source Detail View + "Save to Clips" via text selection is exactly this workflow. I browse the source, find a good passage, long-press to select it, tap "Save to Clips." It's a 3-gesture workflow (tap source, select text, save). That's clean.

The Ask tab offers a complementary workflow: instead of browsing, I ask questions and save the results. "What's the best quote about resilience in my Smith interview?" Save to Clips. "What data do I have about coaching ROI?" Save to Clips. This is a faster way to extract the highlights without reading every word.

**3. Can I organize what I save? By chapter? By topic?**

No. This is the gap. Clips are a flat chronological list. I can search them by text or source title, but I can't tag them "Chapter 4" or "Leadership" or "Stats." After a research session where I pull 15-20 passages, they'll all be in one list with no organization.

My current workflow: I read Google Docs and copy-paste good passages into Apple Notes, organized by chapter or topic. Each Apple Note is "Ch4 - Safety Quotes" or "Stats for Conclusion." DraftCrane's Clips tab doesn't offer this level of organization.

**4. How does this feel compared to my current workflow?**

Better in some ways, worse in others.

Better: I don't have to switch between apps. I don't have to copy-paste between Google Docs and Apple Notes. The source attribution is automatic (each clip knows where it came from). The Ask tab can surface passages I might miss by reading manually.

Worse: I can't organize my clips. My Apple Notes folders gave me structure. DraftCrane's flat list doesn't. After a heavy research session, I'd have a pile of unsorted clips and no way to group them by chapter.

About equal: The actual "select a passage" workflow is similar -- long-press and select text in DraftCrane vs. long-press and copy in Google Docs. The DraftCrane version has one fewer step (no paste into Apple Notes) but adds the constraint of working within the Research Panel's width.

**5. Rating: YELLOW**

The individual workflow steps are clean (GREEN-worthy), but the lack of clip organization makes a dedicated research session less productive than it could be. After pulling 20 passages from 5 documents, I'd have an unstructured pile. I'd miss my Apple Notes folders.

This is a "good enough to try, not good enough to commit to" situation. I'd use it for a session or two. If the Clips tab stays flat, I'd eventually go back to Apple Notes for my research organization and use DraftCrane only for writing + quick fact-checking.

To make this GREEN: add the ability to tag clips when saving them. Even a simple single-select "For which chapter?" dropdown on the save action would transform the Clips tab from a pile into a usable system.

---

## Part 3: Specific Concerns

### Terminology

**"Sources"**
I know what "sources" means in the abstract -- it's where information comes from. But it has an academic connotation. "Bibliography sources." "Cite your sources." When I see "Sources" as a tab label, my first thought is academic citation management. My _second_ thought is "oh, these are my reference files." The second thought is correct, but the first thought creates a moment of "is this for me?"

Better alternatives: "My Docs" (too casual?), "Reference Docs" (clearer but longer), "Files" (generic but accurate). Honestly, "Sources" is fine. It's one of those things that feels slightly off on first encounter but becomes invisible after the first session. I wouldn't change it unless user testing shows real confusion. **Verdict: Acceptable.**

**"Clips"**
This one is harder. "Clips" makes me think of video clips first. Then newspaper clippings. The newspaper metaphor is actually right -- I'm "clipping" passages from my sources. But the word doesn't immediately convey "saved passages from your research."

Better alternatives: "Saved" (boring but clear), "Snippets" (slightly technical), "Notes" (overloaded -- I might think these are my own notes), "Highlights" (implies visual highlighting, which isn't quite right), "Quotes" (too specific -- not everything I save is a quote).

I'd actually suggest "Saved" or "Saved Quotes" but neither is perfect. "Clips" is fine as long as the first-use experience clearly explains what it is. The empty state message becomes critical: "No clips yet. Save passages from your sources to reference them later." **Verdict: Slightly confusing at first. Needs clear empty state.**

**"Research"**
This is good. I'm doing research for my book. The panel helps me do research. "Research" as the panel name works. **Verdict: Good.**

**"Ask" tab**
Yes, this implies I can ask questions. And I can. The label matches the action. The only concern: "Ask" is a verb, while "Sources" and "Clips" are nouns. The inconsistency is subtle but noticeable. "Sources | Ask | Clips" -- one of these is not like the others. Alternatives: "Search" (but the Sources tab also has search), "Q&A" (too jargony), "Assistant" (too vague).

Actually, "Ask" is fine. It's the most direct label for "type a question here." **Verdict: Good.**

**Other terms:**

- "Processing..." on a new source: Clear. It's working on my file.
- "Cached 2h ago": I don't know what "cached" means. "Updated 2h ago" would be clearer.
- "Import as Chapter": This one still concerns me from the earlier analysis. Does "import" mean "copy"? Does "as chapter" mean it becomes a chapter? Yes, but the stakes are high -- I might accidentally turn a reference doc into a chapter. The confirmation dialog should be explicit about what happens.

### iPad-Specific Issues

**Three-panel layout (sidebar + editor + research): does the editor feel cramped?**

On my iPad Pro 12.9" in landscape, the viewport is about 1366pt. Sidebar: 260pt. Research Panel: 340pt. That leaves 766pt for the editor. That's generous -- more than enough. I wouldn't feel cramped.

On an iPad Air 11" in landscape, the viewport is 1180pt. After sidebar and Research Panel, the editor gets 580pt. That's still comfortable. I can write a paragraph and see 60+ characters per line. That's readable.

The concern is the iPad Air in portrait (820pt viewport). The design correctly identifies this as an overlay scenario -- the Research Panel covers 85% of the screen. Good design decision. Don't try to fit three panels in 820pt.

**Verdict: Not cramped on my device (iPad Pro landscape). Correctly handled for smaller devices.**

**Portrait mode: is the overlay research panel intuitive?**

The 85% overlay with a 15% visible strip of the editor behind it. I can swipe right to dismiss, or tap the visible strip. This pattern is familiar from apps like Apple Maps (the bottom sheet) and many iOS apps.

My concern: the 15% strip of editor visible on the left. Is that useful, or just visual noise? I can't really read or write in 15% of the screen width. It's more of a "you're still in the editor, just viewing research on top" visual cue. That's fine as long as it doesn't feel like a tease. I'd rather have the panel take the full screen in portrait than see a useless sliver of my chapter.

**Verdict: YELLOW. The 85% overlay pattern works, but the 15% editor strip might feel like wasted space rather than useful context. Consider making it full-screen in portrait with a clear "Back to editor" button at the top.**

**Touch targets: any interactions that feel too small or fiddly?**

The design specifies 44pt minimum for all interactive elements. Good. Specific areas I'd watch:

- **Checkboxes in the Drive browser:** The design says "44x44pt tap area (visually 24x24px icon)." That's good -- the visual checkbox is small but the tap target is large. As long as the tap target is truly 44pt, I won't have trouble.
- **Tab labels (Sources | Ask | Clips):** These need to be large enough to tap without accidentally hitting the adjacent tab. With three tabs in a 340pt panel, each tab gets about 100pt of width. That's plenty.
- **"..." overflow menu on source cards:** 44x44pt is specified. Good.
- **"Save to Clips" and "Insert" buttons on result cards:** These are small-text action links inside cards. If they're full-width buttons, fine. If they're small text links, they might be hard to tap. The design specifies "44pt minimum touch targets on all action buttons." As long as that's enforced in implementation, it's fine.

**Verdict: GREEN, assuming the 44pt specifications are followed in implementation.**

**Keyboard: when typing a query in the Ask tab, does the virtual keyboard cause problems?**

The design says the query input is at the bottom of the Ask tab (chat pattern) and the conversation area scrolls up when the keyboard appears, using the `visualViewport` API.

My concern: on iPad with the Smart Keyboard Folio attached, there IS no virtual keyboard. The physical keyboard is always there. So the layout should work identically whether or not a software keyboard is present. The design doesn't mention this scenario explicitly, but it shouldn't be a problem -- the input is at the bottom, the conversation scrolls, and the keyboard (physical or virtual) doesn't change the layout.

However: if I detach my Smart Keyboard and use the on-screen keyboard, the Ask tab needs to handle the viewport resize gracefully. The virtual keyboard on a 12.9" iPad Pro covers roughly 40% of the screen height. The Ask tab's conversation area would be compressed to about 60% of its normal height. That should still show the latest query and response, but scrolling through conversation history would be cramped.

**Verdict: GREEN for physical keyboard. YELLOW for virtual keyboard in portrait mode (cramped conversation area). Overall GREEN because I usually use my Smart Keyboard.**

**Split View: what if I have DraftCrane + Safari in Split View?**

This is how I work sometimes -- DraftCrane on the left, Safari or a Google Doc on the right, using iPadOS Split View. In Split View, each app gets roughly half the screen.

On my iPad Pro 12.9" in landscape, that's about 683pt per app. DraftCrane with 683pt: sidebar (260pt) + editor (423pt). That's right at the minimum editor width (400pt). If I open the Research Panel in this configuration, the editor would be pushed below 400pt. The design says: "If Research Panel would push editor below 400pt, the panel cannot open as side-by-side -- it opens as overlay instead."

So in Split View, the Research Panel would always be an overlay. That's acceptable -- I'm already in a constrained space. The overlay makes sense here.

**Verdict: GREEN. The design handles this correctly with the 400pt minimum and automatic overlay fallback.**

### Cognitive Load

**How many concepts must I hold in my head to use this?**

Let me count the concepts:

1. **Research Panel** -- a side panel I can open and close
2. **Sources** -- my reference documents connected to this project
3. **Ask** -- I can ask questions about my sources
4. **Clips** -- passages I've saved for later
5. **Insert** -- I can put a clip into my chapter with a footnote

That's five concepts. Compared to the current design (sources, linking, chapter-source associations, sheets stacking on sheets, viewers overlaying panels), this is dramatically simpler. Five concepts is manageable. Each one maps to something I already understand: a panel (like a drawer), files (like Drive), asking questions (like ChatGPT), saving things (like bookmarks), and inserting (like paste).

**Verdict: Manageable. Five concepts, each with a real-world analogy.**

**Is the tab model (Sources | Ask | Clips) intuitive or overwhelming?**

Three tabs is the sweet spot. Two would be too few (you'd have to combine unrelated things). Four would start feeling heavy. Three is the standard for mobile tab bars -- every iPhone app I use has a bottom bar with 3-5 tabs.

The tabs represent three distinct activities: browse, search, collect. Those activities don't overlap much, which makes the tab separation feel natural. I wouldn't go to the Ask tab to browse my files. I wouldn't go to the Sources tab to save a snippet.

The only cognitive load is remembering which tab I'm on. If I drift between tabs frequently, I might lose context. But the design preserves tab state (switching tabs doesn't reset), so I won't lose my work.

**Verdict: Intuitive. Three tabs is the right number.**

**Does the progressive disclosure work?**

Level 0: Panel closed. I'm just writing. Zero research UI visible.
Level 1: Panel open, tab selected. I see my sources, or the Ask interface, or my clips.
Level 2 (Sources tab only): Source detail view or add flow.

This is a clean two-level disclosure model. I never go deeper than two levels. I never have a sheet on top of a sheet on top of a panel. The "back" navigation is always one tap to get back to Level 1.

The transition from "I don't know this exists" (Level 0) to "I opened it and see tabs" (Level 1) is the only potentially confusing jump. Once I'm in Level 1, everything is flat tabs with at most one drill-down.

**Verdict: Yes, the progressive disclosure works. The two-level maximum is exactly right.**

**Is there a "wall" moment where complexity jumps suddenly?**

The closest thing to a "wall" would be the first time I use the Ask tab and receive AI results. Suddenly I see result cards with citations, "Save to Clips" buttons, "Insert" buttons, source title links. That's a lot of new UI appearing at once.

But it's not really a wall because I asked for it. I typed a question and submitted it. The results are in response to my action. Each result card is self-contained and the actions are labeled. I might not use "Save to Clips" or "Insert" the first time, but I'll understand what they do.

The bigger "wall" risk is the first-time setup: connecting Google Drive, adding sources, understanding what the Research Panel is for. That's the Scenario A YELLOW I identified above.

**Verdict: No wall. The complexity ramp is gradual.**

### Trust

**Does Diane trust that her Google Docs are safe?**

My first and deepest concern with any tool that touches my Google Drive: _will it change my files?_ Will it edit them? Will it share them? Will it delete them?

The detailed design doesn't include explicit reassurance messaging during the add flow. When I browse my Drive and select files, there's no message saying "DraftCrane reads your files but never modifies them." The confirmation dialog for _removing_ a source says "The original file in Google Drive is not affected" -- which is reassuring at removal time. But at _addition_ time, when I'm first connecting my files, there's no equivalent reassurance.

**What I'd want to see:** During the Source Add Flow, somewhere visible: "DraftCrane reads your files to help you search and reference them. Your original files are never modified." One sentence. Enormous trust impact.

**Verdict: Trust is partially addressed (removal dialog is good) but not fully addressed (addition flow needs reassurance). YELLOW.**

**Does she trust the AI search results?**

Not initially. I'd trust the results _after_ I verify them a few times. The design supports verification: I can tap the source title and see the original document. If the AI says "according to Workshop Notes March 2024" and I can open that document and see the quote in context, trust builds.

The design does NOT show the AI ever making things up. It quotes passages from my actual documents. That's fundamentally different from ChatGPT, which might paraphrase or hallucinate. If the AI consistently shows me exact quotes from named sources, I'll trust it within a few sessions.

**Verdict: Trust builds through verification. The design supports verification well. YELLOW initially, GREEN after a few uses.**

**Does she understand what "adding a source" does to her original file?**

Not clearly. "Adding a source" could mean:

- DraftCrane bookmarks my file (correct -- it's more like bookmarking)
- DraftCrane copies my file into its own storage (partially correct -- it caches the content)
- DraftCrane modifies my file (incorrect, but plausible fear)

The design should make clear that adding a source = "DraftCrane remembers this file and caches its text so you can search it." The cached/read-only nature should be explicit.

**Verdict: YELLOW. Needs clearer messaging about what "adding" does.**

**If she removes a source, does she worry about losing her Google Doc?**

No -- the removal dialog explicitly says "The original file in Google Drive is not affected." That's the right message at the right time. This is well-handled.

**Verdict: GREEN.**

---

## Part 4: The Verdict

### Traffic Light Summary

| #   | Flow / Scenario                      | Rating         | Key Factor                                                                                              |
| --- | ------------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | Add source from Google Drive         | GREEN          | Inline flow, no sheet stacking, clear back navigation                                                   |
| 2   | Add source from local device         | GREEN          | System file picker is familiar, supported types listed clearly                                          |
| 3   | View source while writing            | GREEN          | Side-by-side in landscape is the core value proposition                                                 |
| 4   | Search sources with natural language | GREEN          | Intuitive query pattern, structured results with citations                                              |
| 5   | Save a snippet from search results   | GREEN / YELLOW | Path A (from AI result) is trivial; Path B (text selection) depends on floating toolbar discoverability |
| 6   | Insert a snippet into the editor     | YELLOW         | Design is excellent but iPad cursor position and viewport behavior are risky                            |
| 7   | Remove a source                      | GREEN          | Perfect destructive action pattern with reassurance                                                     |
| 8   | Browse clips on Research Board       | YELLOW         | Clean display, but cross-tab navigation and lack of organization are concerns                           |
| A   | First-Time Experience                | YELLOW         | Panel discoverability and empty-state guidance need work                                                |
| B   | Mid-Writing Experience               | GREEN          | The killer scenario. Ask tab compresses a 5-minute interruption to 30 seconds                           |
| C   | Research Session Experience          | YELLOW         | Good individual steps, but flat clip list doesn't support dedicated research sessions                   |

**Summary: 6 GREEN, 5 YELLOW, 0 RED.**

No reds. That's significant. Nothing in this design would make me give up or feel completely lost. The yellows are about polish and edge cases, not fundamental confusion.

### Top 3 Changes I'd Make

**1. Add a "trust line" during the Source Add Flow.**

During Step 2 of Flow 1 (when the Source Add Flow first appears), add a single line of text above the account list:

> "DraftCrane reads your files to help you search and reference them. Your originals are never changed."

This costs nothing to implement. It addresses the deepest anxiety of anyone connecting their Google Drive to a new application. Every user will read this the first time. Most will only need to read it once. But that one reading prevents a trust barrier that could stop adoption before it starts.

**Why:** Both Diane and Marcus have their professional work in Google Drive. The fear of a tool modifying or mishandling their files is real and justified. The removal dialog says "Drive is not affected" but by then it's too late -- the trust barrier is at the _connection_ point, not the _removal_ point.

**2. Lower the in-document search threshold from 10,000 words to 2,000 words (or just always show it).**

The Source Detail View shows a "Search within document" field only for documents exceeding 10,000 words. That's too high. My average Google Doc is 2,000-4,000 words. Finding a specific sentence in a 3,000-word document by scrolling is tedious.

Always showing the search field in the Source Detail View -- or at minimum lowering the threshold to 2,000 words -- would dramatically improve the "verify a fact" workflow. When I tap through from an AI result to verify a citation, I want to find the passage quickly. Ctrl+F (or its equivalent) should always be available.

**Why:** The Source Detail View is where verification happens. Verification is what builds trust in the AI results. Making verification faster makes trust-building faster. The search field is the tool that makes verification fast.

**3. Add a first-use nudge for the Research Panel.**

When a user first opens a project that has no sources, show a subtle prompt or visual indicator near the Research toolbar button:

> "Have research files in Google Drive? Tap Research to bring them in."

This can be a tooltip, a pulsing dot, or a one-time banner at the top of the editor. It should appear once and then never again. The goal is to close the discoverability gap I identified in Scenario A -- the Research Panel is hidden by default, and without guidance, a new user might not find it for days.

**Why:** The entire Research Companion value proposition requires users to add sources. Users who don't discover the Research Panel never add sources. Users who never add sources never experience the Ask tab. Users who never experience the Ask tab never understand why DraftCrane is better than Google Docs. This is a funnel problem. The nudge ensures users enter the funnel.

### Deal Breakers

**Would anything in this design make Diane abandon DraftCrane entirely?**

No. Nothing in the _design_ is a deal breaker. The design is sound. The flows are intuitive. The complexity is managed.

The deal breaker is **AI quality.** If the Ask tab returns wrong answers, misattributes quotes, or hallucinates information, I will never trust DraftCrane with my research. This is not a design flaw -- it's an implementation risk. But it's worth stating explicitly: the design is building a product whose central value proposition depends on AI reliability. The design handles the "AI fails" case gracefully (error messages, fallback to manual browsing), but graceful degradation doesn't prevent abandonment. If I ask five questions and three give wrong answers, I won't ask a sixth.

**What must absolutely work:**

1. **The Ask tab must give correct, verifiable answers with accurate source citations.** This is the product.
2. **Side-by-side viewing in landscape must actually work on iPad Safari.** If the panel causes the editor to reflow, lag, or lose cursor position, the writing experience degrades.
3. **Adding sources from Drive must be fast.** If I have to tap 8 times per file and I have 30 files, I'll quit after 5.

### Moments of Delight

Despite my skepticism, here's what excites me about this design:

**1. The first successful Ask query.**
The moment when I type a question about my own documents and the AI returns the exact passage from the right file -- with the document name and a citation I can verify -- that is genuinely thrilling. I've been searching through 30 Google Docs manually for three years. If this works, it's the most significant time-saver I've encountered in any writing tool.

**2. Automatic footnotes on insertion.**
I _hate_ doing footnotes. I never know the right format. I forget to add them. I know my book needs them but I dread the work. The fact that tapping "Insert" on a clip or AI result creates a properly formatted footnote automatically -- that's the kind of invisible help that makes a tool feel magical. I'd tell my writing group about this specific feature.

**3. Side-by-side source viewing in landscape.**
After three years of toggling between Safari tabs, having my source document visible _beside_ my chapter text feels like the upgrade I didn't know I was waiting for. It's such a simple thing -- split the screen -- but none of my current tools do it seamlessly. DraftCrane in landscape with the Research Panel open is how I imagined writing a book would feel when I first started.

**4. Clips as a running collection.**
The idea that I'm building a curated collection of useful passages as I research -- and that each passage remembers where it came from -- is powerful. It's better than my Apple Notes system because the attribution is automatic. I've lost track of where quotes came from more times than I can count. If every clip carries its source, that problem disappears.

**What would make me tell a colleague about DraftCrane:**

"It reads all your Google Docs and you can just ask it questions -- like 'what did I write about psychological safety?' -- and it finds the exact quote, tells you which document it's from, and lets you drop it into your chapter with a footnote. In one tap."

That's the pitch. The Research Companion design makes that pitch possible. If the AI delivers, Diane becomes an evangelist.

---

## Marcus's Divergent Notes

_Brief perspective from Marcus Chen (34, academic, organized, 100+ documents)_

Marcus agrees with most of Diane's ratings but diverges on three points:

**Flow 1 (Add Source from Google Drive): YELLOW for Marcus.**
Marcus has 12 subfolders with 3-15 documents each. Adding 80+ documents one browse session at a time -- even with the improved inline Drive browser -- is a significant time investment. Marcus would want a "select entire folder" option or a "bulk add from folder" capability. The current design requires navigating into each folder, selecting files individually, adding them, going back, and navigating to the next folder. For 12 folders, that's 12 cycles of the add flow. The flow itself is GREEN, but at Marcus's scale, the repetition is YELLOW.

**Flow 8 (Browse Clips): RED for Marcus.**
Diane gave this YELLOW. Marcus gives it RED. With 15 chapters and a goal of 5-10 clips per chapter, Marcus anticipates 75-150 clips. A flat chronological list with search is not an organizational system -- it's a junk drawer. Marcus needs clips organized by chapter at minimum. Without chapter tagging or filtering, the Clips tab is unusable for his workflow. He'd never adopt it -- he'd continue using his Google Sheet index.

**Scenario C (Research Session): RED for Marcus.**
Same reasoning. A dedicated research session for Marcus means systematic extraction: read each source, pull relevant passages, tag them by chapter and theme, build a structured research base. The Clips tab's flat list doesn't support this. Marcus's reaction: "I'm spending an hour extracting research and it all goes into an unsorted pile? I'll stick with my spreadsheet."

Marcus's overall verdict: The design is architecturally correct (three tabs, no sheet stacking, AI search) and he'd adopt the Sources and Ask tabs immediately. But the Clips tab needs chapter-level organization before he can use it as a real research management tool. His deal breaker is not AI quality (he assumes AI is imperfect and will verify everything) -- it's organizational capability. If he can't structure his research within DraftCrane, he'll keep his external system and DraftCrane becomes a writing-only tool that fulfills half its promise.
