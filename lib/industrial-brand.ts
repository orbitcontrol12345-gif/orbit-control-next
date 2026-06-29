const BRAND_ALIASES: Record<string, string[]> = {
  'ABB': ['ABB', 'ASEA BROWN BOVERI'],
  'Allen Bradley': ['ALLEN BRADLEY', 'ALLEN-BRADLEY', 'ROCKWELL', 'ROCKWELL AUTOMATION'],
  'Siemens': ['SIEMENS', 'SIMATIC', 'SITOP', 'SIRIUS', 'SINAMICS', 'RUGGEDCOM'],
  'Schneider Electric': ['SCHNEIDER ELECTRIC', 'SCHNEIDER', 'MODICON', 'TELEMECANIQUE', 'MERLIN GERIN', 'SQUARE D', 'TAC XENTA'],
  'Honeywell': ['HONEYWELL', 'NEOTRONICS', 'FSC', 'XNX'],
  'Phoenix Contact': ['PHOENIX CONTACT', 'PHOENIX'],
  'Yokogawa': ['YOKOGAWA'],
  'Omron': ['OMRON'],
  'Mitsubishi': ['MITSUBISHI'],
  'Eaton': ['EATON', 'MOELLER', 'CUTLER HAMMER'],
  'GE': ['GENERAL ELECTRIC', 'GE FANUC', 'GE SECURITY', 'GE'],
  'Bently Nevada': ['BENTLY NEVADA'],
  'Bosch Rexroth': ['BOSCH REXROTH', 'REXROTH'],
  'Pilz': ['PILZ', 'PNOZ'],
  'Pepperl+Fuchs': ['PEPPERL+FUCHS', 'PEPPERL FUCHS'],
  'Endress+Hauser': ['ENDRESS+HAUSER', 'ENDRESS HAUSER'],
  'Legrand': ['LEGRAND'],
  'Socomec': ['SOCOMEC'],
  'Hirschmann': ['HIRSCHMANN'],
  'Sick': ['SICK'],
  'Fluke': ['FLUKE', 'FLUKE NETWORKS'],
  'Krohne': ['KROHNE'],
  'Danfoss': ['DANFOSS'],
  'SEW Eurodrive': ['SEW EURODRIVE', 'SEW'],
  'Festo': ['FESTO'],
  'IFM': ['IFM'],
  'Turck': ['TURCK'],
  'Balluff': ['BALLUFF'],
  'Wago': ['WAGO'],
  'Weidmuller': ['WEIDMULLER', 'WEIDMÜLLER'],
  'Finder': ['FINDER'],
  'Lovato': ['LOVATO'],
  'Carlo Gavazzi': ['CARLO GAVAZZI'],
  'Rittal': ['RITTAL'],
  'Johnson Controls': ['JOHNSON CONTROLS', 'METASYS'],
  'Emerson': ['EMERSON', 'LIEBERT'],
  'Fuji Electric': ['FUJI ELECTRIC', 'FUJI'],
  'Keyence': ['KEYENCE'],
  'Banner': ['BANNER'],
  'Parker': ['PARKER'],
  'Burkert': ['BURKERT'],
  'Dwyer': ['DWYER'],
  'Eurotherm': ['EUROTHERM', 'CHESSELL'],
  'Hach': ['HACH', 'POLYMETRON'],
  'Drager': ['DRAGER', 'DRAEGER'],
  'Elcometer': ['ELCOMETER'],
  'Keithley': ['KEITHLEY'],
  'ASCO': ['ASCO'],
};

function normalize(value: string) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^\w+üÜäÄöÖ\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectIndustrialBrand(input: string): string {
  const text = normalize(input);

  if (!text) return 'UNKNOWN';

  for (const [brand, aliases] of Object.entries(BRAND_ALIASES)) {
    for (const alias of aliases) {
      const normalizedAlias = normalize(alias);
      const pattern = new RegExp(`(^|\\s|[-/])${normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|[-/]|$)`, 'i');

      if (pattern.test(text)) {
        return brand;
      }
    }
  }

  return 'UNKNOWN';
}
