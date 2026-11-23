/**
 * Joins mission HUD and result lines using actual newline characters.
 * Keeping this in one place prevents literal "\\n" sequences from leaking into UI text.
 */
export function formatMissionLines(lines: readonly string[]): string {
  return lines.join('\n');
}
