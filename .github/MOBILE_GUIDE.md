# Mobile editing and review guide

Content locations: speaking in `_pages/talks.md` (`/talks/`), posts in `_posts/`, navigation in `_data/`.
PRs target `master` of `matthidinger/matthidinger.github.io`. Only Matt merges and publishes.

## Shortest GitHub Mobile sequence for a speaking link
1. Repo > Issues > New > **Speaking / content update**; paste the public URL and what to add (title/date only if known). Submit.
2. Review the public issue; apply the `copilotd-ready` label yourself to approve.
3. When the PR opens, check the **Build preview** run and download its `site-preview` artifact (a downloadable zip, not a hosted preview) to see the site and screenshots.
4. Merge only if satisfied.

Telegram submission is a separate integration and is not part of this setup.
