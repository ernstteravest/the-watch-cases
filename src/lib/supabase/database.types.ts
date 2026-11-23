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

export type RoleId = "owner" | "manager" | "editor" | "support";

export type Permission =
  | "dashboard.view"
  | "orders.read"
  | "orders.manage"
  | "orders.refund"
  | "customers.read"
  | "customers.manage"
  | "customers.export"
  | "customers.delete"
  | "products.manage"
  | "content.edit"
  | "content.publish"
  | "media.manage"
  | "analytics.view"
  | "settings.read"
  | "settings.manage"
  | "users.manage"
  | "audit.read";

export type RoleRow = { id: string; name_nl: string; name_en: string; description: string | null; sort_order: number };
export type PermissionRow = { key: string; description: string };
export type RolePermissionRow = { role_id: string; permission: string };

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string;
  role_id: string;
  active: boolean;
  invited_by: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditLogRow = {
  id: number;
  created_at: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: Json;
  ip_hash: string | null;
};

export type PaymentRow = {
  id: string;
  order_id: string;
  provider: "stripe";
  kind: "payment" | "refund";
  provider_ref: string;
  amount_cents: number;
  currency: "EUR";
  status: "pending" | "succeeded" | "failed" | "cancelled";
  method: string | null;
  failure_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MediaRow = {
  id: string;
  bucket: "site-media";
  path: string;
  mime_type: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
  size_bytes: number;
  width: number | null;
  height: number | null;
  alt_nl: string;
  alt_en: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ContentPageRow = { key: string; label_nl: string; label_en: string; sort_order: number };

export type ContentKind = "text" | "rich_text" | "image" | "link" | "boolean";

export type ContentEntryRow = {
  id: string;
  page_key: string;
  key: string;
  locale: "nl" | "en" | null;
  kind: ContentKind;
  draft_value: Json | null;
  draft_media_id: string | null;
  draft_updated_at: string | null;
  draft_updated_by: string | null;
  published_value: Json | null;
  published_media_id: string | null;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
};

export type ContentRevisionRow = {
  id: number;
  entry_id: string;
  action: "draft" | "publish" | "unpublish";
  value: Json | null;
  media_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type PublishedContentRow = {
  key: string;
  locale: "nl" | "en" | null;
  kind: ContentKind;
  value: Json | null;
  media_path: string | null;
  media_width: number | null;
  media_height: number | null;
  alt_nl: string | null;
  alt_en: string | null;
  published_at: string;
};

export type SiteSettingRow = {
  key: string;
  value: Json;
  is_public: boolean;
  updated_by: string | null;
  updated_at: string;
};

export type AnalyticsEventType = "page_view" | "configurator_open" | "add_to_cart" | "checkout_start" | "order_paid";

export type AnalyticsEventRow = {
  id: number;
  created_at: string;
  type: AnalyticsEventType;
  path: string;
  locale: "nl" | "en" | null;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  device: "mobile" | "tablet" | "desktop" | null;
  country: string | null;
  visitor_hash: string | null;
  order_id: string | null;
  value_cents: number | null;
};

export type DataRequestRow = {
  id: string;
  customer_id: string | null;
  email: string;
  type: "access" | "erasure" | "rectification" | "objection" | "restriction" | "portability";
  status: "open" | "in_progress" | "completed" | "rejected";
  received_at: string;
  due_at: string;
  completed_at: string | null;
  notes: string | null;
  handled_by: string | null;
  created_at: string;
  updated_at: string;
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
      roles: Table<RoleRow, RoleRow>;
      permissions: Table<PermissionRow, PermissionRow>;
      role_permissions: Table<RolePermissionRow, RolePermissionRow>;
      profiles: Table<
        ProfileRow,
        Pick<ProfileRow, "id" | "email" | "full_name" | "role_id"> &
          Partial<Pick<ProfileRow, "active" | "invited_by" | "last_login_at">>,
        Partial<Pick<ProfileRow, "full_name" | "role_id" | "active" | "last_login_at">>
      >;
      audit_logs: Table<
        AuditLogRow,
        Pick<AuditLogRow, "action"> &
          Partial<Pick<AuditLogRow, "actor_id" | "actor_email" | "entity" | "entity_id" | "details" | "ip_hash">>,
        never
      >;
      payments: Table<
        PaymentRow,
        Pick<PaymentRow, "order_id" | "provider" | "kind" | "provider_ref" | "amount_cents" | "status"> &
          Partial<Pick<PaymentRow, "method" | "failure_reason" | "created_by">>
      >;
      media: Table<
        MediaRow,
        Pick<MediaRow, "path" | "mime_type" | "size_bytes"> &
          Partial<Pick<MediaRow, "width" | "height" | "alt_nl" | "alt_en">>,
        Partial<Pick<MediaRow, "alt_nl" | "alt_en">>
      >;
      content_pages: Table<ContentPageRow, Pick<ContentPageRow, "key" | "label_nl" | "label_en"> & Partial<Pick<ContentPageRow, "sort_order">>>;
      content_entries: Table<
        ContentEntryRow,
        Pick<ContentEntryRow, "page_key" | "key" | "kind"> &
          Partial<
            Pick<ContentEntryRow, "locale" | "draft_value" | "draft_media_id" | "published_value" | "published_media_id">
          >,
        Partial<Pick<ContentEntryRow, "draft_value" | "draft_media_id" | "published_value" | "published_media_id">>
      >;
      content_revisions: Table<ContentRevisionRow, never, never>;
      site_settings: Table<
        SiteSettingRow,
        Pick<SiteSettingRow, "key" | "value"> & Partial<Pick<SiteSettingRow, "is_public">>,
        Partial<Pick<SiteSettingRow, "value" | "is_public">>
      >;
      analytics_events: Table<
        AnalyticsEventRow,
        Pick<AnalyticsEventRow, "type" | "path"> & Partial<Omit<AnalyticsEventRow, "id" | "created_at" | "type" | "path">>,
        never
      >;
      data_requests: Table<
        DataRequestRow,
        Pick<DataRequestRow, "email" | "type"> & Partial<Pick<DataRequestRow, "customer_id" | "notes" | "due_at">>,
        Partial<Pick<DataRequestRow, "status" | "completed_at" | "notes" | "handled_by" | "due_at">>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      session_has_mfa: { Args: Record<string, never>; Returns: boolean };
      has_permission: { Args: { p_permission: Permission }; Returns: boolean };
      my_permissions: { Args: Record<string, never>; Returns: Permission[] };
      log_admin_action: {
        Args: { p_action: string; p_entity?: string; p_entity_id?: string; p_details?: Json; p_ip_hash?: string };
        Returns: number;
      };
      published_content: { Args: Record<string, never>; Returns: PublishedContentRow[] };
      hit_rate_limit: { Args: { p_key: string; p_limit: number; p_window_seconds: number }; Returns: boolean };
    };
    Enums: { order_status: OrderStatus };
    CompositeTypes: Record<string, never>;
  };
};
