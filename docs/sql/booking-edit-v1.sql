-- Pre-confirmation editing and private notes. Existing confirmed documents remain immutable.
create or replace function chauffeur.edit_booking_v1(
 p_reservation_id uuid,p_expected_updated_at timestamptz,p_actor_user_id uuid,p_patch jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r chauffeur.reservations%rowtype; d chauffeur.reservation_days%rowtype;
  v_date date; v_time time; v_start timestamptz; v_end timestamptz; v_service text; v_vehicle text;
  v_pickup text; v_destination text; v_amount numeric; v_duration int; v_tax boolean;
  v_total numeric; v_missing boolean;
begin
  if not exists(select 1 from chauffeur.staff_members where user_id=p_actor_user_id and active and role in ('owner','admin','operator'))
    then return jsonb_build_object('ok',false,'reason','forbidden'); end if;
  select * into r from chauffeur.reservations where id=p_reservation_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  if r.updated_at is distinct from p_expected_updated_at then return jsonb_build_object('ok',false,'reason','stale'); end if;
  if p_patch->>'kind'='note' then
    if length(coalesce(p_patch->>'note',''))>4000 then return jsonb_build_object('ok',false,'reason','invalid'); end if;
    update chauffeur.reservations set internal_note=nullif(trim(p_patch->>'note'),''),updated_at=now() where id=r.id;
    insert into chauffeur.audit_events(reservation_id,actor_user_id,event_type)
      values(r.id,p_actor_user_id,'reservation.note_updated');
    return jsonb_build_object('ok',true);
  end if;
  if r.status not in ('requested','reviewing','quoted','awaiting_deposit')
    or exists(select 1 from chauffeur.confirmation_deliveries where reservation_id=r.id)
    then return jsonb_build_object('ok',false,'reason','locked'); end if;
  if p_patch->>'kind'='contact' then
    if length(trim(coalesce(p_patch->>'name','')) ) not between 2 and 100
      or length(coalesce(p_patch->>'email',''))>180
      or coalesce(p_patch->>'email','') !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$'
      or length(coalesce(p_patch->>'phone',''))>40
      or length(regexp_replace(coalesce(p_patch->>'phone',''),'[^0-9]','','g'))<7
      then return jsonb_build_object('ok',false,'reason','invalid'); end if;
    update chauffeur.reservations set customer_name=trim(p_patch->>'name'),customer_email=trim(p_patch->>'email'),
      customer_phone=trim(p_patch->>'phone'),updated_at=now() where id=r.id;
    insert into chauffeur.audit_events(reservation_id,actor_user_id,event_type)
      values(r.id,p_actor_user_id,'reservation.contact_updated');
    return jsonb_build_object('ok',true);
  end if;
  if p_patch->>'kind' is distinct from 'day' then return jsonb_build_object('ok',false,'reason','invalid'); end if;
  select * into d from chauffeur.reservation_days where id=(p_patch->>'day_id')::uuid and reservation_id=r.id for update;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  v_date:=(p_patch->>'date')::date; v_time:=(p_patch->>'time')::time;
  v_service:=p_patch->>'service'; v_vehicle:=p_patch->>'vehicle';
  v_duration:=case v_service when 'airport' then 3 when 'day' then 9 when 'hourly' then 4 else null end;
  v_pickup:=trim(p_patch->>'pickup'); v_destination:=trim(p_patch->>'destination');
  v_amount:=(p_patch->>'amount')::numeric; v_tax:=(p_patch->>'tax_included')::boolean;
  if v_date is null or v_time is null or v_duration is null or v_vehicle is null
    or v_vehicle not in ('g90','staria','carnival_limousine','sprinter_319','sprinter_519')
    or coalesce(length(v_pickup),0) not between 1 and 500
    or coalesce(length(v_destination),0) not between 1 and 500
    or v_amount is null or v_amount<0 or v_amount>=1000000000000 or trunc(v_amount)<>v_amount
    or v_tax is null or length(coalesce(p_patch->>'flight',''))>30
    then return jsonb_build_object('ok',false,'reason','invalid'); end if;
  v_start:=(v_date+v_time) at time zone 'Asia/Seoul'; v_end:=v_start+make_interval(hours=>v_duration);
  if exists(select 1 from chauffeur.reservation_days x where x.reservation_id=r.id and x.id<>d.id
     and ((x.position<d.position and (x.service_date>=v_date or coalesce(x.estimated_end_at,(x.service_date+x.pickup_time) at time zone 'Asia/Seoul')>v_start))
       or (x.position>d.position and (x.service_date<=v_date or coalesce(x.pickup_at,(x.service_date+x.pickup_time) at time zone 'Asia/Seoul')<v_end))))
     then return jsonb_build_object('ok',false,'reason','overlap'); end if;
  update chauffeur.reservation_days set service_date=v_date,pickup_time=v_time,pickup_at=v_start,estimated_end_at=v_end,
    service_code=v_service,vehicle_class=v_vehicle,pickup_address=v_pickup,destination_address=v_destination,
    pickup_place=case when d.pickup_address=v_pickup then d.pickup_place else '{}'::jsonb end,
    destination_place=case when d.destination_address=v_destination then d.destination_place else '{}'::jsonb end,
    flight_number=nullif(trim(p_patch->>'flight'),''),quoted_amount=v_amount,updated_at=now() where id=d.id;
  select sum(quoted_amount),bool_or(quoted_amount is null) into v_total,v_missing
    from chauffeur.reservation_days where reservation_id=r.id;
  update chauffeur.reservations set quoted_total=case when v_missing then null else v_total end,
    quote_required=v_missing,tax_included=v_tax,updated_at=now() where id=r.id;
  insert into chauffeur.audit_events(reservation_id,actor_user_id,event_type,metadata)
    values(r.id,p_actor_user_id,'reservation.day_updated',jsonb_build_object('day_id',d.id,'position',d.position));
  return jsonb_build_object('ok',true);
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range
  then return jsonb_build_object('ok',false,'reason','invalid');
end;
$$;
revoke all on function chauffeur.edit_booking_v1(uuid,timestamptz,uuid,jsonb) from public,anon,authenticated;
grant execute on function chauffeur.edit_booking_v1(uuid,timestamptz,uuid,jsonb) to service_role;
