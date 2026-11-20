/**
 * Types for the tables in supabase/migrations. Keep in sync with the SQL
 * (or regenerate with `npx supabase gen types typescript` once the CLI is linked).
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "in_production"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

type Table<Row, Insert, Update = Partial<Insert>> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };

export type ProductRow = {
  slug: string;
  name: string;
  capacity: number;
  price_from_cents: number | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CustomerRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  auth_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderRow = {
  id: string;
  order_number: string;
  customer_id: string;
  status: OrderStatus;
  locale: "nl" | "en";
  currency: "EUR";
  subtotal_cents: number;
  shipping_cents: number;
  discount_cents: number;
  tax_cents: number | null;
  total_cents: number;
  shipping_country: "NL" | "BE" | "DE";
  shipping_address: Json;
  billing_address: Json | null;
  payment_provider: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  notes: string | null;
  requires_logo_review: boolean;
  logo_approved_at: string | null;
  logo_review_note: string | null;
  created_at: string;
  updated_at: string;
};

export type ShippingRateRow = {
  country: "NL" | "BE" | "DE";
  price_cents: number | null;
  active: boolean;
  updated_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_slug: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  configuration: Json;
  engraving_text: string | null;
  design_url: string | null;
  logo_original_path: string | null;
  logo_preview_path: string | null;
  created_at: string;
};

export type NewsletterSubscriberRow = {
  id: string;
  email: string;
  locale: "nl" | "en";
  source: string;
  consent_at: string;
  confirmation_token: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      products: Table<ProductRow, Omit<ProductRow, "created_at" | "updated_at">>;
      customers: Table<
        CustomerRow,
        Pick<CustomerRow, "email"> & Partial<Omit<CustomerRow, "id" | "email" | "created_at" | "updated_at">>
      >;
      orders: Table<
        OrderRow,
        Pick<
          OrderRow,
          "customer_id" | "locale" | "subtotal_cents" | "total_cents" | "shipping_country" | "shipping_address"
        > &
          Partial<
            Pick<
              OrderRow,
              | "shipping_cents"
              | "discount_cents"
              | "tax_cents"
              | "billing_address"
              | "payment_provider"
              | "payment_reference"
              | "notes"
              | "status"
              | "requires_logo_review"
              | "logo_approved_at"
            >
          >
      >;
      order_items: Table<
        OrderItemRow,
        Omit<OrderItemRow, "id" | "created_at" | "engraving_text" | "design_url" | "logo_original_path" | "logo_preview_path"> &
          Partial<Pick<OrderItemRow, "engraving_text" | "design_url" | "logo_original_path" | "logo_preview_path">>
      >;
      shipping_rates: Table<ShippingRateRow, Pick<ShippingRateRow, "country"> & Partial<Omit<ShippingRateRow, "country">>>;
      newsletter_subscribers: Table<
        NewsletterSubscriberRow,
        Pick<NewsletterSubscriberRow, "email" | "locale"> & Partial<Pick<NewsletterSubscriberRow, "source">>
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: { order_status: OrderStatus };
    CompositeTypes: Record<string, never>;
  };
};
