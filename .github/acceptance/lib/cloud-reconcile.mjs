import { runTitle } from './cloud.mjs';
import { REPO_NWO } from './util.mjs';

export function shouldDispatch(pr, runs, checks) {
  if (pr.state !== 'open' || pr.base?.ref !== 'master' || pr.base?.repo?.full_name !== REPO_NWO || pr.head?.repo?.full_name !== REPO_NWO) return false;
  if (checks.some((c) => c.name === 'preview-verified' && c.app?.slug === 'github-actions' && c.head_sha === pr.head.sha && c.conclusion === 'success')) return false;
  const matching = runs.filter((r) => r.display_title === runTitle(pr.number, pr.head.sha));
  // One durable fallback dispatch per head, not a retry loop. Failed builds remain visible.
  if (matching.some((r) => r.event === 'workflow_dispatch' && r.head_branch === 'master')) return false;
  return !matching.some((r) => ['queued', 'in_progress', 'requested', 'pending'].includes(r.status));
}
