# Governance

University AI Policy Tracker is a maintainer-led public repository. The GitHub
repository is published under the `SciWhite` account; the project does not
currently publish a formal multi-person committee, named maintainer roster, or
separate foundation governance structure.

## Maintainer responsibilities

Maintainers are responsible for:

- reviewing code and data pull requests;
- protecting source attribution, licensing, privacy, and security boundaries;
- validating candidate data before it becomes part of a public release;
- maintaining the public API, dataset manifests, checksums, and documentation;
- managing releases and production operations through the documented runbooks.

Repository, deployment, and production-data permissions are not required for
ordinary contributions. The person representing the project in an external
program must select the role that matches their actual GitHub permissions and
must be able to verify repository affiliation and control if requested.

## Change and release decisions

Contributors propose changes through issues and pull requests. Issue templates
create review tasks; they do not publish canonical facts. Public data changes
must carry source URLs, source language, short original-language evidence,
snapshot hashes, review state, confidence, and source-rights caveats.

Automation may prepare candidates and review metadata, but it must not mark its
own output as `human_reviewed`, publish directly to the production database, or
push `main`. Release promotion is governed by the validators and release
manifest rules documented in [`docs/dataset-release-process.md`](docs/dataset-release-process.md).

## Security and conduct

Security reports should follow [`SECURITY.md`](SECURITY.md). Contributions must
also follow the evidence, privacy, copyright, and moderation rules in
[`CONTRIBUTING.md`](CONTRIBUTING.md). A separate code of conduct is not
published until the project has a named enforcement contact and process.
