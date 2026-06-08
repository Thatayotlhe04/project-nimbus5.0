# Pandora Integration

Nimbus sends server-side events to Pandora when `PANDORA_URL`, `PANDORA_KEY`, and
`PANDORA_SECRET` are configured.

Tracked events:

- `listing.searched`
- `listing.viewed`
- `booking.requested`

`model_training` is enabled by default under the Terms and can be disabled with
the footer "Model-training opt-out" control. If a user opts out, Nimbus continues
to send internal `product_improvement` metadata only and avoids raw search text.

The browser never receives the Pandora secret. Browser preferences are posted to
`/api/pandora/preference`; the Express server signs ingestion requests.
