const REMOVE_PATTERNS = [
  /\bLOT OF\b/gi,
  /\bLOT\b/gi,
  /\bPIECES\b/gi,
  /\bPIECE\b/gi,
  /\bPCS\b/gi,
  /\bHEAVY[- ]?DUTY\b/gi,
  /\bPRINTED CIRCUIT BOARD\b/gi,
  /\bCIRCUIT BOARD\b/gi,
  /\bBOARD\b/gi,
  /\bCARD\b/gi,
  /\bMODULE\b/gi,
  /\bUNIT\b/gi,
  /\bPOWER\b/gi,
  /\bSUPPLY\b/gi,
  /\bINTERFACE\b/gi,
  /\bREV\.?[A-Z0-9]+\b/gi,
  /\bNEW\b/gi,
  /\bUSED\b/gi,
  /\bOPEN BOX\b/gi,
  /\bFOR PARTS\b/gi,
];

export function normalizeProductTitle(title: string) {
  let t = String(title || '').toUpperCase();

  for (const pattern of REMOVE_PATTERNS) {
    t = t.replace(pattern, ' ');
  }

  return t
    .replace(/[.,()/_-]/g, ' ')
    .replace(/\s+/g, ' ')
    title = title
  .replace(/\bLOT\s*OF\s*\d+\s*PIECES?\b/gi, '')
  .replace(/\bLOT\s*\d+\s*PCS\.?\b/gi, '')
  .replace(/\bLOT\s*\d+\s*PCS\b/gi, '')
  .replace(/\bLOT\s*\d+\b/gi, '')
  .replace(/\b\d+\s*PIECES?\b/gi, '')
  .replace(/\b\d+\s*PCS\b/gi, '')
  .replace(/\bLOT\b/gi, '')
  .replace(/\s+/g, ' ')
    .trim();
}
