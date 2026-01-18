-- Keep providers.rating and providers.review_count in sync with reviews
-- This ensures service cards show updated ratings after reviews are created/edited/deleted

create or replace function public.update_provider_rating_stats(provider_uuid uuid)
returns void
language plpgsql
as $$
begin
  update public.providers
  set
    review_count = coalesce((
      select count(*)
      from public.reviews r
      where r.provider_id = provider_uuid
    ), 0),
    rating = coalesce((
      select avg(r.rating)::numeric
      from public.reviews r
      where r.provider_id = provider_uuid
    ), 0)
  where id = provider_uuid;
end;
$$;

create or replace function public.reviews_provider_rating_trigger()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    perform public.update_provider_rating_stats(new.provider_id);
    return new;
  elsif (tg_op = 'UPDATE') then
    if (old.provider_id is distinct from new.provider_id) then
      perform public.update_provider_rating_stats(old.provider_id);
      perform public.update_provider_rating_stats(new.provider_id);
    else
      perform public.update_provider_rating_stats(new.provider_id);
    end if;
    return new;
  elsif (tg_op = 'DELETE') then
    perform public.update_provider_rating_stats(old.provider_id);
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists reviews_provider_rating_trigger on public.reviews;
create trigger reviews_provider_rating_trigger
after insert or update or delete on public.reviews
for each row execute function public.reviews_provider_rating_trigger();
