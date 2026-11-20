export interface ExtraPickup {
  name: string;
  price?: number;
}

export interface Order {
  id: number;
  office_id: number;
  customer_id: number | null;
  driver_id: number | null;
  customer_phone: string | null;
  customer_name: string | null;
  order_text: string | null;
  pickup_address: string;
  dropoff_address: string;
  pickup_zone: string | null;
  dropoff_zone: string | null;
  extra_pickups: ExtraPickup[];
  contact_phone: string | null;
  notes: string | null;
  delivery_fee: string;
  calculated_fee: string | null;
  fee_overridden: boolean;
  commission_percent: string;
  status: string;
  created_at: string;
}

export interface Driver {
  id: number;
  full_name: string;
  phone: string;
  is_active: boolean;
  created_at: string;
}

export interface DriverFinance {
  id: number;
  full_name: string;
  phone: string;
  delivered_orders: number;
  due: string;
  paid: string;
  balance: string;
}

export interface OfficeRow {
  id: number;
  name: string;
  city: string;
  max_drivers: number;
  is_active: boolean;
  commission_percent: string;
  subscription_ends_at: string;
  days_left: number;
  drivers_count: number;
}
