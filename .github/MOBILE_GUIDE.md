# Mobile editing and review guide

Content locations: speaking in `_pages/talks.md` (`/talks/`), posts in `_posts/`, data in `_data/`.
PRs target `master` of `matthidinger/matthidinger.github.io`. Only Matt merges and publishes.

## Shortest GitHub Mobile sequence for a speaking link
1. Repo > Issues > New. Choose **Speaking / content update** if offered (the form only exists after this setup is merged, and GitHub Mobile may not show forms). Otherwise create a plain issue with the exact public URL and what to add; title/date only if known.
2. Review the public issue, then apply the `copilotd-ready` label yourself to approve it.
3. If the title or body is edited after the label is applied, review it again and remove/reapply `copilotd-ready`; only the approved text is used.
4. When the PR opens, check the **Build preview** run and download its `site-preview` artifact from the run page. It is a downloadable zip (built site plus `/talks/` desktop/mobile screenshots), not a hosted preview, and expires after seven days.
5. Merge only if satisfied.

Telegram submission is a separate integration and is not part of this setup.
