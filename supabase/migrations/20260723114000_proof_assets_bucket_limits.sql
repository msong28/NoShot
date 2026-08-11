-- Security-review follow-up on 20260722110000_proof_assets.sql: the bucket
-- itself had no file_size_limit / allowed_mime_types, so upload_proof()'s
-- app-level checks (<=10MB, jpeg/png/webp) were the only enforcement -- a
-- client could upload straight to the Storage API, bypassing the RPC
-- entirely, and land an oversized or wrong-type object in the bucket with
-- no matching proof_assets row. Storage itself now rejects it too.
update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where
  id = 'proof-assets';
