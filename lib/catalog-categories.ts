export const CATEGORIES = [
  {
    name: 'PLCs',
    slug: 'plcs',
    description: 'Programmable Logic Controllers from leading brands',
    icon: 'cpu',
  },
  {
    name: 'HMIs',
    slug: 'hmis',
    description: 'Human Machine Interface panels and terminals',
    icon: 'monitor',
  },
  {
    name: 'Drives & VFDs',
    slug: 'drives-vfds',
    description: 'Variable Frequency Drives and servo drives',
    icon: 'zap',
  },
  {
    name: 'Sensors',
    slug: 'sensors',
    description: 'Proximity, photoelectric, pressure and temperature sensors',
    icon: 'radio',
  },
  {
    name: 'Circuit Breakers',
    slug: 'circuit-breakers',
    description: 'MCBs, MCCBs, ACBs and protection devices',
    icon: 'shield',
  },
  {
    name: 'Relays',
    slug: 'relays',
    description: 'Power relays, safety relays and relay modules',
    icon: 'activity',
  },
  {
    name: 'Power Supplies',
    slug: 'power-supplies',
    description: 'DIN rail and industrial DC power supplies',
    icon: 'battery-charging',
  },
  {
    name: 'Control Boards',
    slug: 'control-boards',
    description: 'Control cards, interface boards and modules',
    icon: 'circuit-board',
  },
  {
    name: 'Servo Systems',
    slug: 'servo-systems',
    description: 'Servo drives, motors and motion control',
    icon: 'settings',
  },
  {
    name: 'Safety Devices',
    slug: 'safety-devices',
    description: 'Safety relays, light curtains and E-stops',
    icon: 'alert-triangle',
  },
  {
    name: 'Obsolete Parts',
    slug: 'obsolete-parts',
    description: 'Hard-to-find and discontinued automation parts',
    icon: 'archive',
  },
  {
    name: 'Contactors',
    slug: 'contactors',
    description:
      'Motor contactors, auxiliary contactors and industrial switching devices',
    icon: 'zap',
  },
] as const;

export type CatalogCategoryName = (typeof CATEGORIES)[number]['name'];

export const CATEGORY_NAMES = CATEGORIES.map(
  (category) => category.name,
) as [CatalogCategoryName, ...CatalogCategoryName[]];
