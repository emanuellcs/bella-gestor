begin;

-- System-wide logical deletion marker. Keep this distinct from business states
-- such as is_active=false, status='cancelled', or status='paid'.
alter table public.app_options add column if not exists deleted_at timestamp with time zone;
alter table public.app_settings add column if not exists deleted_at timestamp with time zone;
alter table public.appointment_services add column if not exists deleted_at timestamp with time zone;
alter table public.appointments add column if not exists deleted_at timestamp with time zone;
alter table public.clients add column if not exists deleted_at timestamp with time zone;
alter table public.payments add column if not exists deleted_at timestamp with time zone;
alter table public.professionals add column if not exists deleted_at timestamp with time zone;
alter table public.sale_items add column if not exists deleted_at timestamp with time zone;
alter table public.sales add column if not exists deleted_at timestamp with time zone;
alter table public.service_variants add column if not exists deleted_at timestamp with time zone;
alter table public.services add column if not exists deleted_at timestamp with time zone;
alter table public.user_roles add column if not exists deleted_at timestamp with time zone;

create index if not exists idx_app_options_not_deleted_type_order
  on public.app_options (option_type, display_order)
  where deleted_at is null;

create index if not exists idx_appointment_services_not_deleted_appointment
  on public.appointment_services (appointment_id)
  where deleted_at is null;

create index if not exists idx_appointments_not_deleted_start_time
  on public.appointments (start_time)
  where deleted_at is null;

create index if not exists idx_appointments_not_deleted_status_start_time
  on public.appointments (status, start_time)
  where deleted_at is null;

create index if not exists idx_clients_not_deleted_active_created
  on public.clients (is_active, created_at desc)
  where deleted_at is null;

create index if not exists idx_payments_not_deleted_sale
  on public.payments (sale_id)
  where deleted_at is null;

create index if not exists idx_professionals_not_deleted_role_created
  on public.professionals (role, created_at desc)
  where deleted_at is null;

create index if not exists idx_sale_items_not_deleted_sale
  on public.sale_items (sale_id)
  where deleted_at is null;

create index if not exists idx_sales_not_deleted_created
  on public.sales (created_at desc)
  where deleted_at is null;

create index if not exists idx_sales_not_deleted_status_created
  on public.sales (status, created_at desc)
  where deleted_at is null;

create index if not exists idx_service_variants_not_deleted_service_active
  on public.service_variants (service_id, is_active)
  where deleted_at is null;

create index if not exists idx_services_not_deleted_active_created
  on public.services (is_active, created_at desc)
  where deleted_at is null;

-- Remove old overloads before recreating the RPC. Supabase/PostgREST resolves RPC
-- calls by argument names and overloads can become ambiguous after a signature change.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as identity
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_appointment_with_sale'
  loop
    execute format('drop function if exists %s', fn.identity);
  end loop;
end $$;

create function public.create_appointment_with_sale(
  p_client_id bigint,
  p_professional_id uuid,
  p_start_time timestamp with time zone,
  p_end_time timestamp with time zone,
  p_notes text default null,
  p_service_variants jsonb default '[]'::jsonb
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments%rowtype;
  v_sale_id bigint;
  v_default_commission_pct numeric := 70;
  v_professional_commission_pct numeric;
  v_item jsonb;
  v_variant_id bigint;
  v_quantity integer;
  v_variant_price numeric;
  v_variant_commission_pct numeric;
  v_unit_price numeric;
  v_subtotal numeric;
  v_total_amount numeric := 0;
  v_commission_pct numeric;
  v_commission_amount numeric;
begin
  if p_client_id is null then
    raise exception 'client_id is required';
  end if;

  if p_professional_id is null then
    raise exception 'professional_id is required';
  end if;

  if p_start_time is null or p_end_time is null then
    raise exception 'start_time and end_time are required';
  end if;

  if p_end_time <= p_start_time then
    raise exception 'end_time must be after start_time';
  end if;

  if p_service_variants is null or jsonb_typeof(p_service_variants) <> 'array' then
    raise exception 'p_service_variants must be a JSON array';
  end if;

  if jsonb_array_length(p_service_variants) = 0 then
    raise exception 'at least one service variant is required';
  end if;

  select nullif(value, '')::numeric
    into v_default_commission_pct
  from public.app_settings
  where key = 'default_commission_pct'
    and deleted_at is null
  limit 1;

  v_default_commission_pct := coalesce(v_default_commission_pct, 70);

  select commission_pct
    into v_professional_commission_pct
  from public.professionals
  where user_id = p_professional_id
    and deleted_at is null
  limit 1;

  -- Validate and calculate the sale total before inserting anything.
  for v_item in
    select value from jsonb_array_elements(p_service_variants)
  loop
    v_variant_id := nullif(v_item ->> 'service_variant_id', '')::bigint;
    v_quantity := coalesce(nullif(v_item ->> 'quantity', '')::integer, 1);

    if v_variant_id is null then
      raise exception 'service_variant_id is required for each item';
    end if;

    if v_quantity <= 0 then
      raise exception 'quantity must be greater than zero';
    end if;

    select price, commission_pct
      into v_variant_price, v_variant_commission_pct
    from public.service_variants
    where id = v_variant_id
      and is_active = true
      and deleted_at is null
    limit 1;

    if not found then
      raise exception 'service variant % does not exist or is inactive', v_variant_id;
    end if;

    if v_item ? 'unit_price' and nullif(v_item ->> 'unit_price', '') is not null then
      v_unit_price := (v_item ->> 'unit_price')::numeric;
    else
      v_unit_price := v_variant_price;
    end if;

    if v_unit_price < 0 then
      raise exception 'unit_price cannot be negative';
    end if;

    v_total_amount := v_total_amount + (v_quantity::numeric * v_unit_price);
  end loop;

  insert into public.appointments (
    client_id,
    professional_id,
    start_time,
    end_time,
    status,
    notes
  )
  values (
    p_client_id,
    p_professional_id,
    p_start_time,
    p_end_time,
    'scheduled'::appointment_status,
    p_notes
  )
  returning * into v_appointment;

  insert into public.sales (
    client_id,
    appointment_id,
    professional_id,
    total_amount,
    status,
    notes,
    created_at
  )
  values (
    p_client_id,
    v_appointment.id,
    p_professional_id,
    v_total_amount,
    'pending'::sale_status,
    p_notes,
    p_start_time
  )
  returning id into v_sale_id;

  for v_item in
    select value from jsonb_array_elements(p_service_variants)
  loop
    v_variant_id := nullif(v_item ->> 'service_variant_id', '')::bigint;
    v_quantity := coalesce(nullif(v_item ->> 'quantity', '')::integer, 1);

    select price, commission_pct
      into v_variant_price, v_variant_commission_pct
    from public.service_variants
    where id = v_variant_id
      and is_active = true
      and deleted_at is null
    limit 1;

    if v_item ? 'unit_price' and nullif(v_item ->> 'unit_price', '') is not null then
      v_unit_price := (v_item ->> 'unit_price')::numeric;
    else
      v_unit_price := v_variant_price;
    end if;

    v_subtotal := v_quantity::numeric * v_unit_price;
    v_commission_pct := coalesce(
      v_variant_commission_pct,
      v_professional_commission_pct,
      v_default_commission_pct
    );
    v_commission_amount := (v_subtotal * v_commission_pct) / 100;

    insert into public.appointment_services (
      appointment_id,
      service_variant_id,
      quantity
    )
    values (
      v_appointment.id,
      v_variant_id,
      v_quantity
    );

    insert into public.sale_items (
      sale_id,
      service_variant_id,
      quantity,
      unit_price,
      subtotal,
      professional_id,
      commission_pct,
      commission_amount
    )
    values (
      v_sale_id,
      v_variant_id,
      v_quantity,
      v_unit_price,
      v_subtotal,
      p_professional_id,
      v_commission_pct,
      v_commission_amount
    );
  end loop;

  return v_appointment;
end;
$$;

grant execute on function public.create_appointment_with_sale(
  bigint,
  uuid,
  timestamp with time zone,
  timestamp with time zone,
  text,
  jsonb
) to anon, authenticated, service_role;

commit;
