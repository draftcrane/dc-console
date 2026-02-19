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
 * After the #138 refactor, fetchProjectData and the Project/Drive connection
 * callbacks live inside the `useEditorProject` hook. The TDZ invariant is now
 * maintained by ensuring `useEditorProject` is called before `useProjectActions`
 * in the page orchestrator, and its return values are wired to `useProjectActions`.
 *
 * This test validates:
 * 1. useEditorProject is called before useProjectActions (ordering).
 * 2. handleProjectConnected and handleProjectDisconnected from useEditorProject
 *    are passed to useProjectActions.
 * 3. useEditorProject hook internally defines fetchProjectData before the
 *    project-connected/disconnected callbacks that depend on it.
 */
describe("EditorPage initialization order (#119 TDZ regression)", () => {
  const editorPagePath = path.resolve(
    __dirname,
    "../../src/app/(protected)/editor/[projectId]/page.tsx",
  );
  const editorProjectHookPath = path.resolve(__dirname, "../../src/hooks/use-editor-project.ts");
  const pageSource = fs.readFileSync(editorPagePath, "utf-8");
  const hookSource = fs.readFileSync(editorProjectHookPath, "utf-8");

  it("useEditorProject is called before useProjectActions in the page", () => {
    const useEditorProjectPos = pageSource.indexOf("useEditorProject(");
    expect(useEditorProjectPos).toBeGreaterThan(-1);

    const useProjectActionsPos = pageSource.indexOf("useProjectActions(");
    expect(useProjectActionsPos).toBeGreaterThan(-1);

    // useEditorProject must be called BEFORE useProjectActions
    expect(useEditorProjectPos).toBeLessThan(useProjectActionsPos);
  });

  it("handleProjectConnected and handleProjectDisconnected are returned by useEditorProject and passed to useProjectActions", () => {
    // Verify the page destructures these from useEditorProject.
    // The destructuring block starts with the opening brace of the destructured return
    // and contains the property names.
    const editorProjectCallStart = pageSource.indexOf("} = useEditorProject(");
    expect(editorProjectCallStart).toBeGreaterThan(-1);

    // Look back to find the start of the destructuring (opening brace after "const {")
    const destructureStart = pageSource.lastIndexOf("const {", editorProjectCallStart);
    expect(destructureStart).toBeGreaterThan(-1);

    const destructureBlock = pageSource.slice(destructureStart, editorProjectCallStart);
    expect(destructureBlock).toContain("handleProjectConnected");
    expect(destructureBlock).toContain("handleProjectDisconnected");

    // Verify useProjectActions receives them
    const callStart = pageSource.indexOf("useProjectActions({");
    expect(callStart).toBeGreaterThan(-1);
    const callBlock = pageSource.slice(callStart, pageSource.indexOf("});", callStart) + 3);
    expect(callBlock).toContain("onProjectConnected: handleProjectConnected");
    expect(callBlock).toContain("onProjectDisconnected: handleProjectDisconnected");
  });

  it("fetchProjectData is defined before handleProjectConnected inside useEditorProject hook", () => {
    const fetchProjectDataDef = hookSource.indexOf("const fetchProjectData = useCallback");
    expect(fetchProjectDataDef).toBeGreaterThan(-1);

    const handleProjectConnectedDef = hookSource.indexOf(
      "const handleProjectConnected = useCallback",
    );
    expect(handleProjectConnectedDef).toBeGreaterThan(-1);

    // fetchProjectData must be defined before handleProjectConnected
    expect(fetchProjectDataDef).toBeLessThan(handleProjectConnectedDef);

    // handleProjectConnected should reference fetchProjectData
    const connectedBlock = hookSource.slice(
      handleProjectConnectedDef,
      hookSource.indexOf("const handleProjectDisconnected", handleProjectConnectedDef),
    );
    expect(connectedBlock).toContain("fetchProjectData");
  });

  it("fetchProjectData is defined before handleProjectDisconnected inside useEditorProject hook", () => {
    const fetchProjectDataDef = hookSource.indexOf("const fetchProjectData = useCallback");
    expect(fetchProjectDataDef).toBeGreaterThan(-1);

    const handleProjectDisconnectedDef = hookSource.indexOf(
      "const handleProjectDisconnected = useCallback",
    );
    expect(handleProjectDisconnectedDef).toBeGreaterThan(-1);

    // fetchProjectData must be defined before handleProjectDisconnected
    expect(fetchProjectDataDef).toBeLessThan(handleProjectDisconnectedDef);

    // handleProjectDisconnected should reference fetchProjectData
    const disconnectedBlock = hookSource.slice(
      handleProjectDisconnectedDef,
      hookSource.indexOf("return {", handleProjectDisconnectedDef),
    );
    expect(disconnectedBlock).toContain("fetchProjectData");
  });

  it("useProjectActions receives onProjectConnected and onProjectDisconnected callbacks", () => {
    // Extract the useProjectActions call block
    const callStart = pageSource.indexOf("useProjectActions({");
    expect(callStart).toBeGreaterThan(-1);

    // Find the closing of the options object (matching brace)
    const callBlock = pageSource.slice(callStart, pageSource.indexOf("});", callStart) + 3);

    expect(callBlock).toContain("onProjectConnected: handleProjectConnected");
    expect(callBlock).toContain("onProjectDisconnected: handleProjectDisconnected");
  });
});
