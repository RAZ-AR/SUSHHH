-- повторная отправка голоса (очередь без сети) перезаписывает файл: upsert требует select и update на своей папке
create policy "voices own select" on storage.objects for select to authenticated
  using (bucket_id = 'voices' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "voices own update" on storage.objects for update to authenticated
  using (bucket_id = 'voices' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'voices' and (storage.foldername(name))[1] = auth.uid()::text);
