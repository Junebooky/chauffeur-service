-- Apply before enabling Korean customer confirmations; no table changes.
-- Existing rows and queued snapshots default to English.
create or replace function chauffeur.confirmation_snapshot_v1(p_reservation_id uuid,p_payment_method text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'reference',r.reference,'name',r.customer_name,'email',r.customer_email,
    'total',r.quoted_total,'taxIncluded',r.tax_included,'quoteRequired',r.quote_required,'options',r.options,
    'paymentMethod',p_payment_method,'updatedAt',r.updated_at,
    'preferredLocale',case when r.request_payload->>'preferredLocale'='ko' then 'ko' else 'en' end,
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

