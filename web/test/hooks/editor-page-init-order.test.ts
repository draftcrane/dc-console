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
 * This test statically validates that initialization order is maintained,
 * preventing future regressions from code reordering.
 */
describe("EditorPage initialization order (#119 TDZ regression)", () => {
  const editorPagePath = path.resolve(
    __dirname,
    "../../src/app/(protected)/editor/[projectId]/page.tsx",
  );
  const source = fs.readFileSync(editorPagePath, "utf-8");

  it("fetchProjectData is defined before useProjectActions is called", () => {
    // Find the position of the fetchProjectData useCallback definition
    const fetchProjectDataDef = source.indexOf("const fetchProjectData = useCallback");
    expect(fetchProjectDataDef).toBeGreaterThan(-1);

    // Find the position of the useProjectActions call
    const useProjectActionsCall = source.indexOf("useProjectActions(");
    expect(useProjectActionsCall).toBeGreaterThan(-1);

    // fetchProjectData must be defined BEFORE useProjectActions is called
    expect(fetchProjectDataDef).toBeLessThan(useProjectActionsCall);
  });

  it("fetchProjectData useEffect runs before useProjectActions is called", () => {
    // The useEffect that invokes fetchProjectData
    const fetchEffectPattern = /useEffect\(\s*\(\)\s*=>\s*\{\s*\n?\s*fetchProjectData\(\)/;
    const fetchEffectMatch = source.match(fetchEffectPattern);
    expect(fetchEffectMatch).not.toBeNull();

    const fetchEffectPos = source.indexOf(fetchEffectMatch![0]);
    const useProjectActionsPos = source.indexOf("useProjectActions(");

    // The useEffect calling fetchProjectData must appear before useProjectActions
    expect(fetchEffectPos).toBeLessThan(useProjectActionsPos);
  });

  it("handleProjectConnected is defined before useProjectActions and depends on fetchProjectData", () => {
    const handleProjectConnectedDef = source.indexOf("const handleProjectConnected = useCallback");
    expect(handleProjectConnectedDef).toBeGreaterThan(-1);

    const useProjectActionsPos = source.indexOf("useProjectActions(");

    // handleProjectConnected must be defined before useProjectActions
    expect(handleProjectConnectedDef).toBeLessThan(useProjectActionsPos);

    // handleProjectConnected's definition should reference fetchProjectData
    // (it calls fetchProjectData to refresh server state after Drive connect)
    const handleProjectConnectedBlock = source.slice(
      handleProjectConnectedDef,
      source.indexOf("const handleProjectDisconnected", handleProjectConnectedDef),
    );
    expect(handleProjectConnectedBlock).toContain("fetchProjectData");
  });

  it("handleProjectDisconnected is defined before useProjectActions and depends on fetchProjectData", () => {
    const handleProjectDisconnectedDef = source.indexOf(
      "const handleProjectDisconnected = useCallback",
    );
    expect(handleProjectDisconnectedDef).toBeGreaterThan(-1);

    const useProjectActionsPos = source.indexOf("useProjectActions(");

    // handleProjectDisconnected must be defined before useProjectActions
    expect(handleProjectDisconnectedDef).toBeLessThan(useProjectActionsPos);

    // handleProjectDisconnected's definition should reference fetchProjectData
    const handleProjectDisconnectedBlock = source.slice(
      handleProjectDisconnectedDef,
      useProjectActionsPos,
    );
    expect(handleProjectDisconnectedBlock).toContain("fetchProjectData");
  });

  it("useProjectActions receives onProjectConnected and onProjectDisconnected callbacks", () => {
    // Extract the useProjectActions call block
    const callStart = source.indexOf("useProjectActions({");
    expect(callStart).toBeGreaterThan(-1);

    // Find the closing of the options object (matching brace)
    const callBlock = source.slice(callStart, source.indexOf("});", callStart) + 3);

    expect(callBlock).toContain("onProjectConnected: handleProjectConnected");
    expect(callBlock).toContain("onProjectDisconnected: handleProjectDisconnected");
  });
});
