# Mobile guide: request, review, merge

Agents follow [AGENTS.md](../AGENTS.md). PRs target `master` of `matthidinger/matthidinger.github.io`; only Matt merges/publishes.

## Request a change (GitHub Mobile)
1. Repo › Issues › New. Choose **Speaking / content update** if offered (forms exist only once this setup is merged, and GitHub Mobile may not show forms). Otherwise open a plain issue with the exact public URL and what to add; title/date only if known. Missing facts are asked for, never invented.
2. Review the public issue, then apply the `copilotd-ready` label yourself.
3. If the title/body is edited after labelling, review it again and remove/re-apply `copilotd-ready`; only approved text is used.

## Review the PR
- The PR stays **draft** until every readiness gate passes on its latest commit. Its body lists the acceptance criteria, a results table and embedded desktop/mobile screenshots labelled with route and commit.
- The **Readiness** table states READY, BLOCKED (with the exact missing approval) or NOT READY.
- Previews use the approved public origin `https://matthidingerpreviews.z5.web.core.windows.net`, one immutable path per commit: `/matthidinger.github.io/pr-N/FULL_SHA/`. Once [automatic previews](AUTOMATIC_PREVIEWS.md) are activated on `master`, same-repository PRs get a cloud build and **View deployment** link without a laptop or NAS build. Fork PRs get read-only checks, not published previews. The existing NAS/operator export path remains available.
- Once published, readiness checks `preview-revision.json` (repo, PR, full SHA, complete file list) and every served file, and Chromium re-runs the page checks (including copy code) on the hosted site. The PR then lists tap-ready page links in **Hosted preview checks**.
- A CI artifact is a seven-day download, not a hosted preview.
- Automatic `preview-verified` is not visual sign-off or NAS build evidence. NAS jobs can consume the cloud preview with `readiness.mjs RUN --pr N --cloud-run BUILD_RUN_ID` while retaining their own build, screenshot and review gates. Previews are retained after a PR closes; no cleanup is automated.
- Merge only when satisfied. Telegram submission is a separate integration and is not part of this setup.
