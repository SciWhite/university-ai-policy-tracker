# Security Policy

This repository contains public data tooling, a crawler, release validators,
and public API surfaces. Please treat credentials, deployment access, source
snapshots, and private analytics as sensitive even when the related code is
public.

## Supported scope

Security fixes are currently coordinated against the `main` branch and the
latest public release. The project does not publish a separate supported-branch
matrix.

## Reporting a vulnerability

Please do not include secrets, credentials, private data, or exploit details in
a public issue. Use the repository's [GitHub Security Advisory reporting
route](https://github.com/SciWhite/university-ai-policy-tracker/security/advisories/new)
when it is available. If that route is unavailable, open a public issue with
only a request for a private security contact and no sensitive details.

Reports should include the affected component, a minimal reproduction summary,
the first known affected commit or release when available, and any safe
mitigation. Do not test production systems or third-party university sites
without authorization.

## Secret and data boundary

- Never commit `.env` files, service-account keys, API keys, private logs, or
  authenticated source material.
- Keep raw HTML, PDFs, screenshots, browser profiles, and private analytics out
  of public dataset releases unless their rights and publication scope are
  separately verified.
- Public API and crawler changes must preserve source-attribution, review-state,
  and candidate-to-public release boundaries.

See [`docs/security.md`](docs/security.md) for the project's operational
security rules.
