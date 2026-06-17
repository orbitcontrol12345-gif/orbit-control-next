export type ProductCondition = 'New' | 'Used' | 'Refurbished' | 'Not Working';

export type ProductCategory =
  | 'PLCs'
  | 'HMIs'
  | 'Sensors'
  | 'Drives & VFDs'
  | 'Circuit Breakers'
  | 'Relays'
  | 'Control Boards'
  | 'Power Supplies'
  | 'Obsolete Parts'
  | 'Servo Systems'
  | 'Safety Devices';

export interface Product {
  id: string;
  sku: string;
  brand: string;
  partNumber: string;
  name: string;
  category: ProductCategory;
  condition: ProductCondition;
  inStock: boolean;
  description: string;
  technicalSpecs: Record<string, string>;
  datasheetUrl?: string;
  imageUrl: string;
  tags: string[];
  slug: string;
  weight?: string;
  dimensions?: string;
}

export interface RFQRequest {
  id?: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  country: string;
  part_number: string;
  quantity: number;
  message: string;
  status?: string;
  created_at?: string;
}

export interface SellSurplusRequest {
  id?: string;
  company: string;
  contact_person: string;
  email: string;
  phone: string;
  country: string;
  brand: string;
  part_numbers: string;
  quantity: string;
  condition: string;
  message: string;
  status?: string;
  created_at?: string;
}

export interface ContactMessage {
  id?: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  created_at?: string;
}

export interface Brand {
  name: string;
  slug: string;
  logo?: string;
  description: string;
  productCount: number;
  country: string;
}
