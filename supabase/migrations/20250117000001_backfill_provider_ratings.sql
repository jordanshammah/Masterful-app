-- Backfill provider rating and review_count from existing reviews

update public.providers p
set
  review_count = coalesce(r.review_count, 0),
  rating = coalesce(r.avg_rating, 0)
from (
  select
    provider_id,
    count(*) as review_count,
    avg(rating)::numeric as avg_rating
  from public.reviews
  group by provider_id
) r
where p.id = r.provider_id;

-- Ensure providers with no reviews have 0 values instead of nulls
update public.providers
set
  review_count = 0,
  rating = 0
where id not in (select provider_id from public.reviews)
  and (review_count is null or rating is null);
