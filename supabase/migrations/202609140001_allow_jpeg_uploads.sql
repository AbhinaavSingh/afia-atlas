-- Safari cannot encode WebP, so those devices now upload JPEG instead.
-- Allow both formats in the memory buckets and give the size limit a little
-- headroom above the edge function's own 1.2 MB check.

update storage.buckets
set allowed_mime_types = array['image/webp', 'image/jpeg'],
    file_size_limit = 2097152
where id in ('pending-memories', 'approved-memories');
