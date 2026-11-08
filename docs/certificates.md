# Certificates

Attendees use the dialog on `/myid`. Administrators use `/staff/certificates`.
The PNG and font are private R2 objects; neither they nor generated PDFs belong in Git.
The school field is optional, starts from registration, and is reviewed and locked with the name.
Changes do not update registration. Names and school are attendee declared and publicly visible on verification.

## Assets and configuration

The template is pinned by SHA-256 in `src/lib/features/certificates/template.ts`.
Keep the supplied 2000 × 1414 PNG at `เกียรติบัตร.png`, and Sarabun Regular at
`certificate-assets/Sarabun-Regular.ttf` (Sarabun is distributed under SIL OFL).
Obtain the exact font whose checksum is committed; changing an asset requires a new template version,
new immutable R2 keys, and retaining the old version. The name cover uses x=300,y=600,w=1400,h=160;
the school sits within this cover below the name. The separator at y=784 and signature remain intact.
QR uses x=80,y=1110,size=248 with a four-module quiet zone and error correction M.
The full signed URL must produce modules >=0.3 mm at A4 landscape. Oversized names/schools are rejected,
never truncated. The renderer validates actual font glyph coverage and Chromium text fit before issuing.

Create separate private R2 buckets `openhouse-certificates-production` and `openhouse-certificates-preview`
in the intended Cloudflare account, with no public access or shared cache rule.
Local testing uses `openhouse-certificates-local`. Upload the pinned assets with:

```sh
bun scripts/certificate-assets.ts local
bun scripts/certificate-assets.ts preview
bun scripts/certificate-assets.ts production
```

Generate each environment's independent keys locally:

```sh
bun scripts/certificate-keygen.ts preview
bun scripts/certificate-keygen.ts prod
```

Store the private JSON as Worker secret `CERTIFICATE_PRIVATE_JWK`. Store the array of public JWKs
as `CERTIFICATE_PUBLIC_KEYS` (configuration or secret). Never commit a private key or paste it into logs.
Public entries require `kid`, `kty: EC`, `crv: P-256`, `x`, `y`; an optional `disabled: true`
rejects a compromised key. Public JWKs must not contain `d`. Production key IDs start with `prod-`;
preview IDs start with `preview-`. Keep historical public keys in the array during rotation.
Publish the new public key before using its private key. `/.well-known/jwks.json` excludes disabled keys.

Set `CERTIFICATE_EVENT_ORIGIN` to the exact event origin and `CERTIFICATE_ISSUER` to the exact
verification origin. Production uses `https://scichulaopenhouse.com` and `https://verify.vidyachula.org`.
Preview must use separate hosts and independent key material; replace the placeholder preview origins
in Wrangler with the actual preview hosts before deployment. The private bucket and D1 binding are
also separate in preview. Issuance remains unavailable when signing keys/bindings are missing.
The production verification custom-domain route is enabled after provisioning keys and assets.
Enable the Browser binding. Apply the certificate migration to preview before deploying the application.
Do not alter production records to test this flow.

## Token format and verification

New certificates use an ES256 compact JWS with `typ: cert+deflate` and `kid`. Its payload is raw DEFLATE-compressed JSON containing `ver: 1`, `iss`, `aud: sci-cert`, `iat`, and `jti`
(the public certificate issuance ID). There is no expiry. It contains no account ID, email or survey answers.
It remains self-contained. Compression happens before signing, so the signature authenticates the compressed bytes. Verification checks the signature first, then decompresses with a strict 4 KiB output limit and validates every claim. Existing uncompressed `typ: cert+jwt` issuances remain supported and are never rewritten. To keep printed QR codes readable, compact tuples encode claims:

- `n`: title label, first name, last name, school (empty string when absent).
- `e`: event ID, event title, start, end, award date, certificate type.

The display name is the exact join of the three name fields with spaces. Entitlement IDs stay internal;
`jti` identifies each independently verifiable issued certificate. Event title includes 2027, while event dates
come from the existing schedule and the PNG award date is 2026-11-01.
Verification rejects oversized tokens (>4 KiB), unknown/disabled keys, extra claims or header URLs,
wrong algorithm/type/issuer/audience/version/schema, unknown issuance IDs and stored-token mismatches.
A storage failure displays status unavailable, never valid. The exact immutable stored token is used for QR.
Offline verification of new tokens requires compact-JWS signature verification followed by raw DEFLATE decompression and claim validation. Offline signature checks cannot establish current revocation. Downloaded files cannot be erased by revocation.

No verification URL should reach analytics or application logs. Automatic invocation logging is disabled
in Wrangler; apply the same exclusions to zone access logs, external analytics and any downstream log sinks.
Verification skips session lookups and exposes only verification, keys and required public app assets
on the verification host. Responses use no-store, no-referrer and noindex. Downloads remain authenticated,
owner scoped and private/no-store; GET never generates a PDF.

## Operations, retries and backups

D1 batches atomically create an eligible entitlement and immutable issuance. The attendee/event unique
constraint remains after revocation. Concurrent confirmations recover the winner; differing snapshots stay locked.
Administrator replacement uses the expected current issuance and records actor, reason, time and predecessor,
revokes the old issuance and updates the entitlement in one transaction. Name, school, event, JWT and template
snapshots cannot be updated/deleted. Later attendance changes do not silently revoke a certificate.

PDF rendering has a 45-second timeout and an atomic 90-second lease. A different owner cannot complete
a lease, and expiry permits retries. Render/storage failures leave the issuance locked and retryable.
The immutable PDF key includes issuance and template. Revocation is rechecked before ready and serving.
A missing R2 output can be prepared again. Close/cancel cannot undo a committed issuance.

Back up D1 (including both certificate tables and its migration history), all template versions and fonts,
and the complete public key history. Keep encrypted private-key backups with restricted access.
Use `wrangler d1 export`/D1 Time Travel and private bucket copies according to the organization's backup policy;
restore to a separate preview account/bucket/database before a restore drill. Never drop the permanent entitlement
or reuse issuance IDs. Retain historical template versions and public keys for the lifetime of certificates.

## Validation

Run `bun test tests/certificates.test.js`, `bun run check`, and `bun run build`.
Use the certificate browser tests for Thai shaping, single-page A4 output, sample-name removal,
long-name rejection and real QR decoding. Before production, exercise the complete flow in preview:
check-in + evaluation → correction review → confirmation → prepare → owner download → public verification;
then revoke and replace as admin. Check keyboard trapping/return, short mobile scrolling, reduced motion,
closing during requests, reopening, retry after storage/browser failures, cross-user downloads,
lease expiry and revocation during generation. Measure a modest burst of three render requests using preview
keys and storage. Printed-scanner testing on physical A4 output is still required before distribution.

## Production rollout (2026-11-08)

- Worker: `openhouse-production`, deployed version `29648698-ef4a-44ef-b38e-e55758054c80`.
- Attendee flow: `https://scichulaopenhouse.com/myid`.
- Administrator screen: `https://scichulaopenhouse.com/staff/certificates`.
- Verification: `https://verify.vidyachula.org/c/<token>`; public keys at `/.well-known/jwks.json`.
- Private R2 bucket: `openhouse-certificates-production`, public development URL disabled.
- Current artwork: `openhouse-2027-v2`; v1 remains recognized for existing local/preview issuances.
- Signing key ID: `prod-9f9f04db`. Public key history is recorded in `production-jwks.json` beside the certificate implementation. Private material stays in Worker secrets and the ignored, permission-restricted certificate-assets directory.
- Production migration `20261108120000_certificates` applied; existing login secret preserved.
- D1 recovery bookmark and previous Worker version recorded in ignored `certificate-assets/backups/production-certificate-rollout.json`; no attendee data was exported locally.
- Verified public endpoints, hostname separation, no-store/no-referrer/noindex verification headers, signing-key publication, private download authentication, and production Browser PDF generation. No test attendees or certificate issuances were inserted into production.

### Registration-role compatibility fix

Production version `cfc571cf-872e-495b-8917-3f2d50ed4836` allows registered attendees
with a legacy `staff` account role to access and download their own certificates.
Eligibility and issuance ownership are enforced by the certificate service; administrator
operations retain their permission checks. The evaluation completion screen now directs
attendees to name review and download instead of asking them to wait for a later release.

### Fine-print layout preview

Layout `openhouse-2027-v3` reuses the pinned v2 artwork and adds the complete signed
verification URL in a selectable, clickable fine-print band beside the QR at the bottom rim.
The PDF hyperlink target and visible text match the QR exactly. Footer overflow is checked
during Chromium preflight. Existing v1/v2 issuances retain their layouts and cached PDFs.
This layout is prepared locally; production remains on the previously deployed layout until
its next deployment. The local preview is `certificate-output/fineprint-preview.pdf`.

Generated PDFs include document title, faculty author, subject, keywords, creation time
from the immutable issuance, and rendering modification time. Custom document properties
record the certificate ID, recipient, school, event snapshot, award date, template version,
and exact verification URL. No account ID, email, or survey responses are added. Metadata
is applied after Chromium rendering; the one-page layout, QR, and hyperlink are verified
on the resulting PDF. Existing cached PDFs are not rewritten.
