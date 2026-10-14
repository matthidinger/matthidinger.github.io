# Automatic PR previews

This pipeline is for **open, same-repository PRs targeting `master`** in
`matthidinger/matthidinger.github.io`. It runs on GitHub-hosted Ubuntu, independently
of the author's laptop and of the NAS coding worker. Fork PRs receive read-only
build checks (subject to GitHub approval rules), **not published previews**.
It never publishes the production site, merges a PR, or marks one ready for review.

## Pipeline and trust boundaries

| Workflow/job | Work | Authority |
| --- | --- | --- |
| Build preview / `site-acceptance` | Exact PR head and merge-base Pages builds; baseline and strict final browser checks; before/after screenshots and candidate artifact | Read-only repository token; no environment, Azure identity, write permission or shared cache |
| Publish preview / `gate` | Validate the successful source run, attempt, open PR/head, workflow definition, trusted tooling, artifact ID/digest, complete manifests and screenshots | Read-only |
| Publish preview / `publish` | Revalidate, create immutable preview blobs, verify receipt and every served file | Protected `website-preview` environment; preview-container-only OIDC |
| Publish preview / `hosted` | Revalidate the public receipt/bytes; run every head route/viewport, navigation and copy-code interaction in Chromium | Separate runner; no Azure/environment/OIDC or GitHub write permission |
| Publish preview / `announce` | Revalidate the current head and served bytes; report `preview-verified`, an exact-head deployment and a PR link | GitHub checks, deployments and PR comments only; no browser or Azure identity |
| Reconcile previews | Dispatch a missing same-repository PR/head build from `master` | GitHub Actions dispatch permission; no deployment identity |
| Test acceptance tooling | Test proposed PR changes to acceptance helpers/workflows | Separate read-only workflow/artifact namespace; never a publication trigger |

All actions are pinned to full commit IDs. Builds use
`actions/jekyll-build-pages@44a6e6beabd48582f863aeeb6cb2151cc1716697` with
`PAGES_ENV=dotcom`, not the legacy root npm pipeline or historical Gemfile lock.
Source files are staged with `git archive`; source symlinks and submodules are
rejected. The original build must keep its production canonical/CSS URLs and
`CNAME`. Only the compiled output's URL attributes are prefix-rewritten.

The build workflow checks out approved `master` tooling, not PR tooling. The PR's
`routes.json` remains the final expectation source, with **strict overflow** and no
capture-only relaxation. The merge-base uses its own committed expectations;
newly added head routes receive report-only before captures. Both reports and
every screenshot hash must match the candidate.

`workflow_run` executes the publisher definition on the default branch. Every
publisher job checks out that trusted workflow revision, never PR code. Git
objects may be fetched to compare committed workflow/configuration data, but
are not checked out or executed. Downloaded artifacts are data only: ZIP paths,
file types, links, duplicates, expansion limits, unexpected files, manifests,
hashes and route/viewport coverage are checked before use. ZIP permissions are
never restored. Artifact-provided commands, executables and URLs are not run.

A PR-event workflow itself can be edited by a PR. Its source definition must
therefore match trusted master before its candidate can publish. A tooling-changing
PR can instead be built by a **master `workflow_dispatch`**, which still uses
approved tooling; proposed tooling changes need their own tests/review before
merge. `Test acceptance tooling` executes those proposed tests separately so they
cannot manufacture a candidate inside the publishable build's artifact namespace.
Run titles bind the PR number and full head SHA, including dispatches
whose GitHub `head_sha` refers to master. The API's `pull_requests` array is not
assumed to be populated. Stale/closed/cross-repository associations, failed or
rerun source evidence, expired artifacts and changed trusted tooling fail closed.

## Triggers and recovery

Normal `pull_request` opened, synchronized, reopened and ready-for-review events
start a build. Drafts are not excluded. There are no content path filters.
An old build can be canceled by its newer head; publication jobs do not cancel
one another. Each credential job serializes by PR, writes only its full-SHA
prefix, and rechecks the head before writing and before committing the receipt.
The announcer rechecks again before exposing a successful deployment link.

The default-branch reconciler runs at minutes 17 and 47 each hour and can also
be run manually. It checks open same-repository PRs and dispatches one fallback
build per head when normal events did not produce a verified preview. It skips
active builds and successful current-head preview checks. It does not keep
retrying a failed fallback dispatch or approve fork workflows. GitHub schedules
can be delayed/dropped and can be disabled after repository inactivity: this is
eventual recovery, not a 30-minute service guarantee.

After activation, manual recovery uses these workflows in this repository:

```sh
# Build the current head using the trusted default-branch definition.
gh workflow run build-preview.yml -R matthidinger/matthidinger.github.io --ref master -f pr=N -f head_sha=FULL_SHA

# Retry publication after access/network problems; reuse the original accepted build.
gh workflow run publish-preview.yml -R matthidinger/matthidinger.github.io --ref master -f run_id=BUILD_RUN_ID

# Check for missed heads now, without a laptop/NAS build.
gh workflow run reconcile-previews.yml -R matthidinger/matthidinger.github.io --ref master
```

GitHub currently documents approval-required PR runs for `opened`, `synchronize`
and `reopened` events caused by `GITHUB_TOKEN`; most other token-generated events
remain suppressed. An App/PAT-created PR has different trigger behavior. The
scheduled, unprivileged same-repository dispatch path avoids relying on the
authoring tool's token behavior. It does not create any additional credential.

## Preview identity, immutability and retries

The operator configures the `website-preview` environment with **only the master
branch**, no matching tags, and these non-secret variables:
`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`. No client secret is
used. The federation subject is
`repo:matthidinger/matthidinger.github.io:environment:website-preview`.
The identity needs container metadata read and blob read/write only, scoped to
`matthidingerpreviews/$web`: no delete, account keys, SAS delegation, account
configuration, or resource-management access. Missing variables or denied OIDC/
storage access fail explicitly; there is no key-based or production fallback.

The account and public origin are fixed in trusted code:
`https://matthidingerpreviews.z5.web.core.windows.net`. Each revision lives at
`/matthidinger.github.io/pr-N/FULL_SHA/`; `site` is not a URL component.
The publisher lists and hashes any existing prefix before writing. All writes
are conditional creates (`If-None-Match: *`), with explicit content types.
The receipt is written last. Partial identical uploads can resume, but an extra
file, changed byte or incomplete committed revision is an error. No blob is
ever overwritten or removed.

Cloud receipts use **schema 2** with the action builder, complete file manifest,
and `provenance`: repository, workflow, build run ID/attempt, trusted tooling SHA,
merge-base SHA, artifact ID and artifact digest. Existing NAS/operator receipts
remain schema 1. A cloud receipt is never presented as a NAS build.

Repeated builds of the same SHA can differ because of `site.time`, feeds and
run IDs. The first completed cloud preview remains immutable. A successful new
candidate may reuse that revision only after the original successful run attempt
and digest-verified artifact are independently reloaded and its receipt matches.
Hosted bytes and browser checks run again. If original evidence has expired or
cannot be verified, reuse fails closed; it does not overwrite the prefix or ask
for broader Azure permissions. Retrying the publication workflow, rather than
rebuilding, is the simplest access/network recovery.

**Previews are retained. There is no automatic close-PR cleanup or storage
retention/deletion policy in these workflows.** Downloadable Actions artifacts
retain the existing seven-day lifetime; a retained web preview is not a permanent
archive of acceptance evidence. Expired proof can require a new head revision
before readiness can be established again.

## Readiness and the NAS consumer

`preview-verified` means the cloud artifact, exact hosted bytes and hosted browser
checks passed for the current head. It is **not** visual sign-off, NAS acceptance
or permission to merge. The deployment API explicitly disables auto-merge and
production deployment, records the PR head (not master), and sets
`auto_inactive: false` so another PR does not hide a still-live preview. The
`website-preview` credential-environment job is not the PR-facing deployment;
the verified `website-preview-pr-N` deployment supplies **View deployment**.

NAS-origin jobs still execute their promised real `nas-pages-build` acceptance,
view every screenshot, record inspection, and embed evidence. To consume the
automatic preview without comparing NAS build timestamps to cloud build bytes:

```sh
node .github/acceptance/bin/readiness.mjs RUN --pr N --cloud-run BUILD_RUN_ID
# UX jobs also require their real before evidence and strict NAS acceptance:
node .github/acceptance/bin/readiness.mjs RUN --pr N --cloud-run BUILD_RUN_ID --ux --baseline BASE_RUN
```

Use the build run ID from the PR's **cloud build and screenshots** link. The
readiness reader uses existing `gh` authentication (or `GH_TOKEN`), sends it only
to GitHub, and never obtains Azure credentials. It independently checks the
source run/artifact, public receipt and files, final-head `preview-verified`
check, trusted successful publication run and digest-bound hosted screenshots/
navigation report. It keeps local NAS build, clean tree, head/PR association,
inspection, embedded screenshots and UX baseline gates. A cloud report cannot
substitute for any of them. Without `--cloud-run`, the existing NAS-export path
and schema-1 readiness contract are unchanged.

After this readiness check, the normal `upload-screenshots.mjs RUN --pr N`
(with `--baseline BASE_RUN` for UX jobs) refreshes the PR's readiness table and
verified cloud page links. It labels the Actions-built hosted evidence separately
from the NAS screenshots and does not fall back to stale hosted links when cloud
proof fails.

## Activation and validation

The workflow/tooling must first be merged to `master` by Matt. This bootstrap PR
cannot prove its own trusted-master deployment before that merge. OIDC/environment
configuration alone also does not prove token exchange. Activation is complete
only after a real open same-repository final-head build, publication, exact-byte
verification, hosted navigation checks and PR deployment link succeed, followed
by a NAS `--cloud-run` readiness invocation. Until then, report **activation
pending**, not “all PR previews are live.”

Run `npm --prefix .github/acceptance test` and lint the four workflow YAML files
with `actionlint`. Cloud contract tests include hostile archives, provenance/
association failures, immutable retries, failed access, exact-head deployments,
the NAS/cloud join, and a real-browser package/hosted-navigation fixture. These
fixtures are not a live Azure activation or a NAS site build.

## Primary sources and event choice

- [GitHub events: workflow_run, pull_request, pull_request_target, schedule and dispatch](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows):
  `workflow_run` uses default-branch code and can have elevated permissions after
  a read-only build; downloaded PR data must not become code. `pull_request_target`
  is intentionally not used to build PR code. Fork approval and schedule limits
  still apply.
- [GitHub token-trigger behavior](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow):
  dispatch exceptions and approval-required bot-created PR runs.
- [Workflow-run API](https://docs.github.com/en/rest/actions/workflow-runs) and
  [artifact API](https://docs.github.com/en/rest/actions/artifacts): run IDs,
  attempts, repository/head associations, immutable artifact IDs and digests.
- [Deployment API](https://docs.github.com/en/rest/deployments/deployments) and
  [environment branch rules](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments):
  explicit deployment defaults and environment protection matching `GITHUB_REF`.
- [Azure GitHub OIDC](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure-openid-connect)
  and [Put Blob](https://learn.microsoft.com/en-us/rest/api/storageservices/put-blob):
  federation, bearer-token data access and conditional create-only requests.
