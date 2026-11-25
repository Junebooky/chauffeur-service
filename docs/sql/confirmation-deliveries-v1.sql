-- Additive migration: existing operator notifications and historical payment data remain untouched.
create table if not exists chauffeur.confirmation_deliveries (
  reservation_id uuid primary key references chauffeur.reservations(id) on delete cascade,
  snapshot jsonb not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','uncertain')),
  attempts integer not null default 0 check (attempts>=0),
  message_id text,
  pdf_base64 text,
  last_error_code text,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table chauffeur.confirmation_deliveries enable row level security;
revoke all on chauffeur.confirmation_deliveries from public,anon,authenticated;
grant select,insert,update on chauffeur.confirmation_deliveries to service_role;

create or replace function chauffeur.confirmation_snapshot_v1(p_reservation_id uuid,p_payment_method text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'reference',r.reference,'name',r.customer_name,'email',r.customer_email,
    'total',r.quoted_total,'taxIncluded',r.tax_included,'quoteRequired',r.quote_required,'options',r.options,
    'paymentMethod',p_payment_method,'updatedAt',r.updated_at,
    'journeys',coalesce((select jsonb_agg(jsonb_build_object(
      'date',d.service_date,'time',to_char(d.pickup_time,'HH24:MI'),'service',d.service_code,
      'vehicle',d.vehicle_class,'pickup',d.pickup_address,'destination',d.destination_address,
      'pickupPlace',d.pickup_place,'destinationPlace',d.destination_place,'stops',d.stops,
      'flight',d.flight_number,'total',d.quoted_amount
    ) order by d.position) from chauffeur.reservation_days d where d.reservation_id=r.id),'[]'::jsonb)
  ) from chauffeur.reservations r where r.id=p_reservation_id;
$$;
revoke all on function chauffeur.confirmation_snapshot_v1(uuid,text) from public,anon,authenticated;
grant execute on function chauffeur.confirmation_snapshot_v1(uuid,text) to service_role;

create or replace function chauffeur.confirm_and_queue_v1(
 p_reservation_id uuid,p_expected_status text,p_expected_updated_at timestamptz,
 p_payment_method text,p_actor_user_id uuid
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r chauffeur.reservations%rowtype; snap jsonb; moved jsonb;
begin
  if not exists(select 1 from chauffeur.staff_members where user_id=p_actor_user_id and active and role in ('owner','admin','operator'))
    then return jsonb_build_object('ok',false,'reason','forbidden'); end if;
  if p_payment_method is null or p_payment_method not in ('on_site','separate') then return jsonb_build_object('ok',false,'reason','payment_method'); end if;
  select * into r from chauffeur.reservations where id=p_reservation_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  if exists(select 1 from chauffeur.confirmation_deliveries where reservation_id=r.id) then
    return jsonb_build_object('ok',false,'reason','already_queued');
  end if;
  if r.status is distinct from p_expected_status or r.updated_at is distinct from p_expected_updated_at
    then return jsonb_build_object('ok',false,'reason','stale'); end if;
  if r.status not in ('requested','reviewing','quoted','awaiting_deposit','confirmed')
    then return jsonb_build_object('ok',false,'reason','invalid_transition'); end if;
  if r.quoted_total is null or r.quote_required or r.tax_included is null
    then return jsonb_build_object('ok',false,'reason','quote_required'); end if;
  if r.customer_email !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$'
    then return jsonb_build_object('ok',false,'reason','invalid_email'); end if;
  snap:=chauffeur.confirmation_snapshot_v1(r.id,p_payment_method);
  if jsonb_array_length(snap->'journeys')=0 then return jsonb_build_object('ok',false,'reason','no_days'); end if;
  if r.status<>'confirmed' then
    moved:=chauffeur.advance_reservation_v1(r.id,r.status,'confirmed',p_actor_user_id);
    if not coalesce((moved->>'ok')::boolean,false) then return moved; end if;
  end if;
  insert into chauffeur.confirmation_deliveries(reservation_id,snapshot) values(r.id,snap);
  insert into chauffeur.audit_events(reservation_id,actor_user_id,event_type,metadata)
  values(r.id,p_actor_user_id,'confirmation.queued',jsonb_build_object('payment_method',p_payment_method,'document_version',1));
  return jsonb_build_object('ok',true,'status','confirmed');
end;
$$;
revoke all on function chauffeur.confirm_and_queue_v1(uuid,text,timestamptz,text,uuid) from public,anon,authenticated;
grant execute on function chauffeur.confirm_and_queue_v1(uuid,text,timestamptz,text,uuid) to service_role;

-- Serialize dispatch with cancellation/status changes. No automatic resend after
-- ambiguous provider results or an interrupted send.
create or replace function chauffeur.claim_confirmation_v1(p_reservation_id uuid,p_actor_user_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d chauffeur.confirmation_deliveries%rowtype; v_status text;
begin
  if not exists(select 1 from chauffeur.staff_members where user_id=p_actor_user_id and active and role in ('owner','admin','operator'))
    then return jsonb_build_object('ok',false,'reason','forbidden'); end if;
  select status into v_status from chauffeur.reservations where id=p_reservation_id for update;
  if v_status is null or v_status not in ('confirmed','in_progress','completed') then
    return jsonb_build_object('ok',false,'reason','invalid_transition'); end if;
  update chauffeur.confirmation_deliveries set status='sending',attempts=attempts+1,
    claimed_at=now(),updated_at=now(),last_error_code=null
    where reservation_id=p_reservation_id and status in ('pending','failed') returning * into d;
  if not found then return jsonb_build_object('ok',false,'reason','not_claimable'); end if;
  return jsonb_build_object('ok',true,'snapshot',d.snapshot,'pdf_base64',d.pdf_base64);
end;
$$;
revoke all on function chauffeur.claim_confirmation_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function chauffeur.claim_confirmation_v1(uuid,uuid) to service_role;
