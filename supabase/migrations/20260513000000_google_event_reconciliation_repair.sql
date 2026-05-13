begin;

alter table public.appointments
  add column if not exists google_event_id text;

create index if not exists idx_appointments_not_deleted_google_event_id
  on public.appointments (google_event_id)
  where deleted_at is null and google_event_id is not null;

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
  p_google_event_id text default null,
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
    google_event_id,
    start_time,
    end_time,
    status,
    notes
  )
  values (
    p_client_id,
    p_professional_id,
    p_google_event_id,
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
  text,
  jsonb
) to anon, authenticated, service_role;

create or replace function public.repair_appointment_financials(
  p_appointment_id bigint,
  p_client_id bigint default null,
  p_professional_id uuid default null,
  p_start_time timestamp with time zone default null,
  p_end_time timestamp with time zone default null,
  p_notes text default null,
  p_google_event_id text default null,
  p_service_variants jsonb default null
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments%rowtype;
  v_sale public.sales%rowtype;
  v_default_commission_pct numeric := 70;
  v_professional_commission_pct numeric;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
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
  if p_appointment_id is null then
    raise exception 'appointment_id is required';
  end if;

  perform pg_advisory_xact_lock(hashtext('repair_appointment_financials:' || p_appointment_id::text));

  select *
    into v_appointment
  from public.appointments
  where id = p_appointment_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'appointment not found';
  end if;

  if coalesce(p_end_time, v_appointment.end_time) <= coalesce(p_start_time, v_appointment.start_time) then
    raise exception 'end_time must be after start_time';
  end if;

  update public.appointments
  set
    client_id = coalesce(p_client_id, client_id),
    professional_id = coalesce(p_professional_id, professional_id),
    start_time = coalesce(p_start_time, start_time),
    end_time = coalesce(p_end_time, end_time),
    notes = coalesce(p_notes, notes),
    google_event_id = coalesce(p_google_event_id, google_event_id),
    updated_at = now()
  where id = p_appointment_id
    and deleted_at is null
  returning * into v_appointment;

  select *
    into v_sale
  from public.sales
  where appointment_id = p_appointment_id
    and deleted_at is null
    and status <> 'cancelled'::sale_status
  order by created_at asc
  limit 1
  for update;

  if found then
    return v_sale;
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
  where user_id = v_appointment.professional_id
    and deleted_at is null
  limit 1;

  if p_service_variants is not null then
    if jsonb_typeof(p_service_variants) <> 'array' then
      raise exception 'p_service_variants must be a JSON array';
    end if;

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
        and deleted_at is null
      limit 1;

      if not found then
        raise exception 'service variant % does not exist', v_variant_id;
      end if;

      if v_item ? 'unit_price' and nullif(v_item ->> 'unit_price', '') is not null then
        v_unit_price := (v_item ->> 'unit_price')::numeric;
      else
        v_unit_price := v_variant_price;
      end if;

      if v_unit_price < 0 then
        raise exception 'unit_price cannot be negative';
      end if;

      insert into public.appointment_services (
        appointment_id,
        service_variant_id,
        quantity
      )
      select
        p_appointment_id,
        v_variant_id,
        v_quantity
      where not exists (
        select 1
        from public.appointment_services existing
        where existing.appointment_id = p_appointment_id
          and existing.service_variant_id = v_variant_id
          and existing.deleted_at is null
      );

      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'service_variant_id', v_variant_id,
        'quantity', v_quantity,
        'unit_price', v_unit_price,
        'commission_pct', v_variant_commission_pct
      ));
    end loop;
  else
    for v_item in
      select jsonb_build_object(
        'service_variant_id', appointment_services.service_variant_id,
        'quantity', appointment_services.quantity,
        'unit_price', service_variants.price,
        'commission_pct', service_variants.commission_pct
      )
      from public.appointment_services
      join public.service_variants
        on service_variants.id = appointment_services.service_variant_id
      where appointment_services.appointment_id = p_appointment_id
        and appointment_services.deleted_at is null
    loop
      v_items := v_items || jsonb_build_array(v_item);
    end loop;
  end if;

  if jsonb_array_length(v_items) = 0 then
    raise exception 'appointment needs service details before checkout';
  end if;

  for v_item in
    select value from jsonb_array_elements(v_items)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;
    v_unit_price := (v_item ->> 'unit_price')::numeric;
    v_total_amount := v_total_amount + (v_quantity::numeric * v_unit_price);
  end loop;

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
    v_appointment.client_id,
    v_appointment.id,
    v_appointment.professional_id,
    v_total_amount,
    'pending'::sale_status,
    v_appointment.notes,
    v_appointment.start_time
  )
  returning * into v_sale;

  for v_item in
    select value from jsonb_array_elements(v_items)
  loop
    v_variant_id := (v_item ->> 'service_variant_id')::bigint;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_unit_price := (v_item ->> 'unit_price')::numeric;
    v_subtotal := v_quantity::numeric * v_unit_price;
    v_commission_pct := coalesce(
      nullif(v_item ->> 'commission_pct', '')::numeric,
      v_professional_commission_pct,
      v_default_commission_pct
    );
    v_commission_amount := (v_subtotal * v_commission_pct) / 100;

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
      v_sale.id,
      v_variant_id,
      v_quantity,
      v_unit_price,
      v_subtotal,
      v_appointment.professional_id,
      v_commission_pct,
      v_commission_amount
    );
  end loop;

  return v_sale;
end;
$$;

grant execute on function public.repair_appointment_financials(
  bigint,
  bigint,
  uuid,
  timestamp with time zone,
  timestamp with time zone,
  text,
  text,
  jsonb
) to anon, authenticated, service_role;

commit;
