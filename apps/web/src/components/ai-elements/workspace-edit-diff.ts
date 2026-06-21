import DiffMatchPatch, {
  DIFF_DELETE,
  DIFF_EQUAL,
  DIFF_INSERT,
} from "diff-match-patch"

export type WorkspaceEditDiffOperation =
  | typeof DIFF_DELETE
  | typeof DIFF_EQUAL
  | typeof DIFF_INSERT

export type WorkspaceEditDiffSegment = {
  operation: WorkspaceEditDiffOperation
  text: string
}

const diffMatchPatch = new DiffMatchPatch()

export function buildWorkspaceEditDiffSegments(
  beforeMarkdown: string,
  afterMarkdown: string,
): WorkspaceEditDiffSegment[] {
  const diffs = diffMatchPatch.diff_main(beforeMarkdown, afterMarkdown, true)
  diffMatchPatch.diff_cleanupSemantic(diffs)

  return diffs
    .filter(([, text]) => Boolean(text))
    .map(([operation, text]) => ({
      operation: operation as WorkspaceEditDiffOperation,
      text,
    }))
}

export function hasWorkspaceEditDiffChanges(segments: WorkspaceEditDiffSegment[]) {
  return segments.some((segment) => segment.operation !== DIFF_EQUAL)
}