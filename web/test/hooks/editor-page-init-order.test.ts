import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Regression test for issue #119: EditorPage TDZ crash
 *
 * The EditorPage component previously crashed with a temporal dead zone (TDZ)
 * error when `useProjectActions` attempted to access `fetchProjectData` before
 * it was initialized. The fix was to reorder the hook declarations so that
 * `fetchProjectData` and its `useEffect` are defined before `useProjectActions`.
 *
 * After the #138 refactor, fetchProjectData lives inside the `useEditorProject`
 * hook. The TDZ invariant is maintained by ensuring `useEditorProject` is called
 * before `useProjectActions` in the page orchestrator.
 *
 * This test validates that ordering invariant.
 */
describe("EditorPage initialization order (#119 TDZ regression)", () => {
  const editorPagePath = path.resolve(
    __dirname,
    "../../src/app/(protected)/editor/[projectId]/page.tsx",
  );
  const pageSource = fs.readFileSync(editorPagePath, "utf-8");

  it("useEditorProject is called before useProjectActions in the page", () => {
    const useEditorProjectPos = pageSource.indexOf("useEditorProject(");
    expect(useEditorProjectPos).toBeGreaterThan(-1);

    const useProjectActionsPos = pageSource.indexOf("useProjectActions(");
    expect(useProjectActionsPos).toBeGreaterThan(-1);

    // useEditorProject must be called BEFORE useProjectActions
    expect(useEditorProjectPos).toBeLessThan(useProjectActionsPos);
  });
});
