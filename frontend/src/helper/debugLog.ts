const PREFIX = "[NotebookLM]";

/** Frontend debug logger — prints every significant call site. */
export function debugLog(scope: string, message: string, data?: unknown) {
  const label = `${PREFIX} [${scope}] ${message}`;
  if (data !== undefined) {
    console.log(label, data);
  } else {
    console.log(label);
  }
}
