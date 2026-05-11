# Deployment guide

This guide is for private deployment notes only. Keep public documentation free of deployment-specific project URLs and credentials.

## Supabase placeholders

Configure the hosting environment with placeholder values like these, replacing them only in the private deployment system:

```html
<script>
  window.NIMBUSHABOR_SUPABASE_URL = 'https://<supabase-project-ref>.supabase.co';
  window.NIMBUSHABOR_SUPABASE_ANON_KEY = '<supabase-public-anon-key>';
</script>
```

Do not commit real Supabase project URLs, anon keys, service-role keys, or other secrets. The database schema to apply is `supabase/schema.sql`.
