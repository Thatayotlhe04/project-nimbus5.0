# Pandora Integration

Nimbus sends server-side events to Pandora when `PANDORA_URL`, `PANDORA_KEY`, and
`PANDORA_SECRET` are configured.

Tracked events:

- `listing.searched`
- `listing.viewed`
- `booking.requested`

`model_training` is enabled by default under the Terms. The one-time cookie
banner stores the visitor choice: Continue keeps training enabled, while Reject
sets `nimbus_pandora_model_training=off`. If a user opts out, Nimbus continues to
send internal `product_improvement` metadata only and avoids raw search text.

The browser never receives the Pandora secret. Browser preferences are posted to
`/api/pandora/preference`; the Express server signs ingestion requests.
