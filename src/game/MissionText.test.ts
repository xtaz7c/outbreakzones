import { describe, expect, it } from 'vitest';
import { formatMissionLines } from './MissionText';

describe('formatMissionLines', () => {
  it('joins lines with newline characters rather than literal escape sequences', () => {
    const result = formatMissionLines(['first', 'second']);

    expect(result).toBe('first\\nsecond');
    expect(result).not.toContain('\\\\n');
    expect(result.split('\\n')).toEqual(['first', 'second']);
  });

  it('returns an empty string for no lines', () => {
    expect(formatMissionLines([])).toBe('');
  });
});
