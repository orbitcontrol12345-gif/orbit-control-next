export type ExtractedPartNumber = {
  value: string;
  labeled: boolean;
};

const MAX_PART_NUMBERS_PER_MESSAGE = 40;

function normalizePartNumber(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '');
}

function cleanCandidate(value: string): string {
  return value
    .replace(
      /\s+(?:qty|quantity|pieces?|pcs?|condition|delivery|required)\b.*$/i,
      '',
    )
    .replace(/^[\s#:'"`([{<]+/, '')
    .replace(/[\s,;:'"`.)\]}>]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPlausiblePartNumber(
  value: string,
  allowNumericOnly: boolean,
): boolean {
  if (value.length < 4 || value.length > 60) {
    return false;
  }

  if (!/^[A-Z0-9][A-Z0-9._/ -]*[A-Z0-9]$/i.test(value)) {
    return false;
  }

  const normalized = normalizePartNumber(value);

  if (normalized.length < 4 || !/\d/.test(normalized)) {
    return false;
  }

  if (!allowNumericOnly && !/[A-Z]/i.test(normalized)) {
    return false;
  }

  return true;
}

function removeQuotedHistory(text: string): string {
  const replySeparator =
    /^\s*(?:-----\s*Original Message\s*-----|On .+ wrote:|From:\s+.+)$/im;
  const match = replySeparator.exec(text);

  return match ? text.slice(0, match.index) : text;
}

function addCandidate(
  candidates: Map<string, ExtractedPartNumber>,
  rawValue: string,
  labeled: boolean,
): void {
  const value = cleanCandidate(rawValue);

  if (!isPlausiblePartNumber(value, labeled)) {
    return;
  }

  const key = normalizePartNumber(value);
  const existing = candidates.get(key);

  if (!existing || (labeled && !existing.labeled)) {
    candidates.set(key, { value, labeled });
  }
}

/**
 * Finds likely manufacturer part numbers in the newest portion of an email.
 * Labeled values may be numeric-only. Unlabeled values must contain both
 * letters and numbers and are later verified against the Orbit catalog.
 */
export function extractPartNumberCandidates(
  rawText: string,
): ExtractedPartNumber[] {
  const text = removeQuotedHistory(rawText || '').slice(0, 100_000);
  const candidates = new Map<string, ExtractedPartNumber>();
  const lines = text.split(/\r?\n/);
  const labelPattern =
    /\b(?:part\s*(?:number|no\.?|#)|p\s*\/\s*n|mpn|model\s*(?:number|no\.?|#)?|catalog\s*(?:number|no\.?|#)|material\s*(?:number|no\.?|#))\s*(?:[:#=-]\s*)?(.+)$/i;
  const separatedPattern = /\b[A-Z0-9]+(?:[-_/.][A-Z0-9]+)+\b/gi;
  const compactPattern = /\b(?=[A-Z0-9]{6,35}\b)(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\d)[A-Z0-9]+\b/gi;

  for (const line of lines) {
    const labelMatch = line.match(labelPattern);

    if (labelMatch?.[1]) {
      for (const value of labelMatch[1].split(/[;,|]/)) {
        addCandidate(candidates, value, true);
      }
    }

    for (const match of line.matchAll(separatedPattern)) {
      addCandidate(candidates, match[0], false);
    }

    for (const match of line.matchAll(compactPattern)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;

      if (
        /[-_/.]/.test(line[start - 1] || '') ||
        /[-_/.]/.test(line[end] || '')
      ) {
        continue;
      }

      addCandidate(candidates, match[0], false);
    }

    if (candidates.size >= MAX_PART_NUMBERS_PER_MESSAGE) {
      break;
    }
  }

  return Array.from(candidates.values()).slice(
    0,
    MAX_PART_NUMBERS_PER_MESSAGE,
  );
}

export function normalizePartNumberForMatch(
  value: string,
): string {
  return normalizePartNumber(value);
}
