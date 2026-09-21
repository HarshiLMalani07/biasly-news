-- biasly source seed.
--
-- The five outlets AGENTS.md section 11 names, as homepage entry pages only
-- (section 9). Run this in Supabase Dashboard -> SQL Editor after schema.sql.
-- Re-running is safe: `listing_url` is unique and conflicts are ignored.
--
-- `parser_strategy` is the key the scraping task switches on when generic
-- homepage extraction is not enough. Deactivate a source by setting
-- `is_active = false` rather than deleting the row - articles reference it.

insert into public.sources (name, listing_url, parser_strategy, is_active)
values
  ('Reuters', 'https://www.reuters.com/', 'reuters', true),
  ('NPR', 'https://www.npr.org/', 'npr', true),
  ('BBC News', 'https://www.bbc.com/news', 'bbc', true),
  ('Fox News', 'https://www.foxnews.com/', 'fox', true),
  ('The Guardian', 'https://www.theguardian.com/us', 'guardian', true)
on conflict (listing_url) do nothing;
