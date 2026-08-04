export interface ProductTypeDefinition {
  label: string;
  applications: string;
  systems: string;
  industries: string;
  keywords: string[];
}

export const PRODUCT_TYPES: Record<string, ProductTypeDefinition> = {
  INDUSTRIAL_PART: {
    label: 'industrial automation component',
    applications:
      'industrial automation, equipment maintenance and replacement',
    systems:
      'industrial control systems and OEM machinery',
    industries:
      'manufacturing, process automation, utilities and OEM industries',
    keywords: [],
  },

  PLC_CPU: {
    label: 'programmable logic controller (PLC CPU)',
    applications:
      'machine automation, production lines, industrial process control and factory automation',
    systems:
      'PLC systems, industrial controllers and automated machinery',
    industries:
      'manufacturing, automotive, food processing, packaging and water treatment',
    keywords: [
      'PLC CPU',
      'CPU',
      'PROCESSOR',
      'CENTRAL PROCESSING UNIT',
    ],
  },

  DIGITAL_INPUT: {
    label: 'digital input module',
    applications:
      'sensor monitoring, digital signal acquisition and machine status detection',
    systems:
      'PLC racks, distributed I/O systems and industrial controllers',
    industries:
      'factory automation, OEM machinery and process industries',
    keywords: [
      'DIGITAL INPUT',
      'INPUT MODULE',
      'DI MODULE',
      'INPUT CARD',
    ],
  },

  DIGITAL_OUTPUT: {
    label: 'digital output module',
    applications:
      'relay control, actuator control and industrial output switching',
    systems:
      'PLC racks, industrial control systems and distributed I/O',
    industries:
      'manufacturing, packaging, OEM equipment and automation',
    keywords: [
      'DIGITAL OUTPUT',
      'OUTPUT MODULE',
      'DO MODULE',
      'OUTPUT CARD',
    ],
  },

  ANALOG_INPUT: {
    label: 'analog input module',
    applications:
      'analog signal acquisition, process monitoring and instrumentation',
    systems:
      'PLC systems and industrial process controllers',
    industries:
      'oil and gas, water treatment, utilities and manufacturing',
    keywords: [
      'ANALOG INPUT',
      'AI MODULE',
      'INPUT ANALOG',
    ],
  },

  ANALOG_OUTPUT: {
    label: 'analog output module',
    applications:
      'analog signal control, variable process control and instrumentation',
    systems:
      'PLC systems and industrial automation controllers',
    industries:
      'process automation, manufacturing and utilities',
    keywords: [
      'ANALOG OUTPUT',
      'AO MODULE',
      'OUTPUT ANALOG',
    ],
  },

  HMI: {
    label: 'human machine interface (HMI)',
    applications:
      'operator control, machine visualization and industrial monitoring',
    systems:
      'PLC systems, SCADA and industrial automation platforms',
    industries:
      'manufacturing, food processing, packaging and OEM machinery',
    keywords: [
      'HMI',
      'TOUCH PANEL',
      'OPERATOR PANEL',
    ],
  },

  VFD: {
    label: 'variable frequency drive',
    applications:
      'motor speed control, energy saving and process automation',
    systems:
      'AC motors and industrial drive systems',
    industries:
      'HVAC, manufacturing, water treatment and process industries',
    keywords: [
      'VFD',
      'INVERTER',
      'VARIABLE FREQUENCY DRIVE',
      'AC DRIVE',
    ],
  },

  POWER_SUPPLY: {
    label: 'industrial power supply',
    applications:
      'stable DC power distribution and industrial control power',
    systems:
      'PLC systems, HMIs and industrial automation equipment',
    industries:
      'manufacturing, OEM machinery and automation',
    keywords: [
      'POWER SUPPLY',
      'PSU',
      '24VDC',
      'POWER MODULE',
    ],
  },
};
