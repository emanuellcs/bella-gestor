-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.app_options (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  option_type text NOT NULL,
  label text NOT NULL,
  value text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT app_options_pkey PRIMARY KEY (id)
);
CREATE TABLE public.app_settings (
  key text NOT NULL,
  value text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT app_settings_pkey PRIMARY KEY (key)
);
CREATE TABLE public.appointment_services (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  appointment_id bigint NOT NULL,
  service_variant_id bigint NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT appointment_services_pkey PRIMARY KEY (id),
  CONSTRAINT appointment_services_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id),
  CONSTRAINT appointment_services_variant_id_fkey FOREIGN KEY (service_variant_id) REFERENCES public.service_variants(id)
);
CREATE TABLE public.appointments (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  client_id bigint NOT NULL,
  professional_id uuid NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'scheduled'::appointment_status,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  deleted_at timestamp with time zone,
  CONSTRAINT appointments_pkey PRIMARY KEY (id),
  CONSTRAINT appointments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT appointments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT appointments_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.professionals(user_id)
);
CREATE TABLE public.clients (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL UNIQUE,
  email text UNIQUE,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  services text,
  version integer DEFAULT 1,
  idempotency_key character varying UNIQUE,
  updated_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  birth_date date,
  service_location text,
  preferred_schedule text,
  referral_source text,
  marketing_consent boolean DEFAULT false,
  is_client boolean DEFAULT false,
  deleted_at timestamp with time zone,
  CONSTRAINT clients_pkey PRIMARY KEY (id),
  CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.payments (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  sale_id bigint NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  payment_method text,
  external_transaction_id text,
  payment_link_url text,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::payment_status,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  professional_id uuid,
  deleted_at timestamp with time zone,
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id),
  CONSTRAINT payments_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.professionals(user_id)
);
CREATE TABLE public.ping (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ping_pkey PRIMARY KEY (id)
);
CREATE TABLE public.professionals (
  user_id uuid NOT NULL DEFAULT gen_random_uuid(),
  role USER-DEFINED DEFAULT 'Professional'::app_role,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  full_name text,
  function_title text,
  email text,
  commission_pct numeric DEFAULT 70.00,
  deleted_at timestamp with time zone,
  CONSTRAINT professionals_pkey PRIMARY KEY (user_id)
);
CREATE TABLE public.sale_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  sale_id bigint NOT NULL,
  service_variant_id bigint NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0::numeric),
  subtotal numeric DEFAULT ((quantity)::numeric * unit_price),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  professional_id uuid,
  commission_pct numeric,
  commission_amount numeric,
  deleted_at timestamp with time zone,
  CONSTRAINT sale_items_pkey PRIMARY KEY (id),
  CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id),
  CONSTRAINT sale_items_variant_id_fkey FOREIGN KEY (service_variant_id) REFERENCES public.service_variants(id),
  CONSTRAINT sale_items_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.professionals(user_id)
);
CREATE TABLE public.sales (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  client_id bigint NOT NULL,
  appointment_id bigint,
  total_amount numeric NOT NULL CHECK (total_amount >= 0::numeric),
  status USER-DEFINED NOT NULL DEFAULT 'pending'::sale_status,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  professional_id uuid,
  deleted_at timestamp with time zone,
  CONSTRAINT sales_pkey PRIMARY KEY (id),
  CONSTRAINT sales_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT sales_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id),
  CONSTRAINT sales_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT sales_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.professionals(user_id)
);
CREATE TABLE public.service_variants (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  service_id bigint NOT NULL,
  variant_name text NOT NULL,
  price numeric NOT NULL CHECK (price >= 0::numeric),
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  commission_pct numeric,
  deleted_at timestamp with time zone,
  CONSTRAINT service_variants_pkey PRIMARY KEY (id),
  CONSTRAINT service_variants_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id)
);
CREATE TABLE public.services (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  deleted_at timestamp with time zone,
  CONSTRAINT services_pkey PRIMARY KEY (id),
  CONSTRAINT services_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_roles (
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'Secretary'::app_role,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  email text,
  full_name text,
  function_title text,
  deleted_at timestamp with time zone,
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);