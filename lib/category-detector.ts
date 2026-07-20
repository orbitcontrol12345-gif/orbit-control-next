export const CATEGORY_RULES = [
  {
    category: 'PLC',
    keywords: [
      'PLC',
      'CPU',
      'PROCESSOR MODULE',
      'CONTROLLOGIX',
      'SLC500',
      'MICROLOGIX',
      'COMPACTLOGIX',
      'SIMATIC S7',
      'SIMATIC S5',
    ],
  },

  {
    category: 'HMI',
    keywords: [
      'HMI',
      'TOUCH PANEL',
      'OPERATOR PANEL',
      'PANELVIEW',
      'KTP',
      'MP277',
      'COMFORT PANEL',
      'GRAPHIC PANEL',
    ],
  },

  {
    category: 'VFD',
    keywords: [
      'VFD',
      'INVERTER',
      'VARIABLE FREQUENCY DRIVE',
      'AC DRIVE',
      'FREQUENCY CONVERTER',
      'MICROMASTER',
      'SINAMICS',
      'POWERFLEX',
      'ALTIVAR',
    ],
  },

  {
    category: 'SERVO DRIVE',
    keywords: [
      'SERVO DRIVE',
      'SERVO AMPLIFIER',
      'SERVO CONTROLLER',
      'SERVOPACK',
    ],
  },

  {
    category: 'POWER SUPPLY',
    keywords: [
      'POWER SUPPLY',
      'PSU',
      'POWER MODULE',
      '24VDC',
      'SMPS',
    ],
  },

  {
    category: 'CIRCUIT BREAKER',
    keywords: [
      'CIRCUIT BREAKER',
      'MCCB',
      'MCB',
      'BREAKER',
      'ACB',
      'ELCB',
      'RCCB',
    ],
  },

  {
    category: 'CONTACTOR',
    keywords: [
      'CONTACTOR',
      'CONTACT BLOCK',
    ],
  },

  {
    category: 'RELAY',
    keywords: [
      'RELAY',
      'SAFETY RELAY',
      'SOLID STATE RELAY',
      'SSR',
    ],
  },

  {
    category: 'SENSOR',
    keywords: [
      'SENSOR',
      'PROXIMITY',
      'PHOTOELECTRIC',
      'PHOTO SENSOR',
      'LIMIT SWITCH',
      'INDUCTIVE SENSOR',
      'CAPACITIVE SENSOR',
    ],
  },

  {
    category: 'ENCODER',
    keywords: [
      'ENCODER',
      'ROTARY ENCODER',
      'ABSOLUTE ENCODER',
      'INCREMENTAL ENCODER',
    ],
  },

  {
    category: 'I/O MODULE',
    keywords: [
      'INPUT MODULE',
      'OUTPUT MODULE',
      'DIGITAL INPUT',
      'DIGITAL OUTPUT',
      'ANALOG INPUT',
      'ANALOG OUTPUT',
      'I/O MODULE',
      'IO MODULE',
    ],
  },

  {
    category: 'COMMUNICATION MODULE',
    keywords: [
      'COMMUNICATION MODULE',
      'ETHERNET MODULE',
      'PROFINET',
      'PROFIBUS',
      'MODBUS',
      'DEVICENET',
      'CANOPEN',
    ],
  },
];

export function detectCategory(
  title: string,
  brand?: string,
  partNumber?: string
): string {
  const text = `${title} ${brand ?? ''} ${partNumber ?? ''}`.toUpperCase();

  for (const rule of CATEGORY_RULES) {
    if (
      rule.keywords.some((keyword) => text.includes(keyword))
    ) {
      return rule.category;
    }
  }

  return 'Industrial Automation';
}
