/**
 * GitHub PR comment integration. Uses the REST API via the global `fetch` and a
 * token from the environment. Comments are upserted: evalgate finds its own
 * previous comment by a hidden marker and edits it in place instead of stacking
 * new comments on every push.
 */

/** A hidden HTML marker used to locate and update evalgate's own comment. */
export const COMMENT_MARKER = "<!-- evalgate-report -->";

/** Everything needed to talk to the GitHub API for one PR. */
export interface GitHubContext {
  token: string;
  owner: string;
  repo: string;
  prNumber: number;
  apiUrl?: string;
}

/**
 * Resolve a {@link GitHubContext} from the standard GitHub Actions environment.
 * Returns null when not enough information is available (e.g. not a PR event).
 */
export function contextFromEnv(env: NodeJS.ProcessEnv = process.env): GitHubContext | null {
  const token = env.GITHUB_TOKEN ?? env.INPUT_GITHUB_TOKEN;
  const repo = env.GITHUB_REPOSITORY; // "owner/repo"
  if (!token || !repo) return null;
  const [owner, name] = repo.split("/");
  if (!owner || !name) return null;

  let prNumber: number | undefined;
  if (env.EVALGATE_PR) prNumber = Number(env.EVALGATE_PR);
  else if (env.GITHUB_REF) {
    const m = /refs\/pull\/(\d+)\/merge/.exec(env.GITHUB_REF);
    if (m) prNumber = Number(m[1]);
  }
  if (!prNumber || Number.isNaN(prNumber)) return null;

  return {
    token,
    owner,
    repo: name,
    prNumber,
    apiUrl: env.GITHUB_API_URL ?? "https://api.github.com",
  };
}

interface IssueComment {
  id: number;
  body: string;
}

function headers(ctx: GitHubContext): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${ctx.token}`,
    "x-github-api-version": "2022-11-28",
    "content-type": "application/json",
    "user-agent": "evalgate",
  };
}

/** Find evalgate's existing comment on the PR, if any. */
export async function findExistingComment(ctx: GitHubContext): Promise<IssueComment | null> {
  const base = ctx.apiUrl ?? "https://api.github.com";
  const url = `${base}/repos/${ctx.owner}/${ctx.repo}/issues/${ctx.prNumber}/comments?per_page=100`;
  const res = await fetch(url, { headers: headers(ctx) });
  if (!res.ok) throw new Error(`[evalgate] failed to list comments (${res.status})`);
  const comments = (await res.json()) as IssueComment[];
  return comments.find((c) => c.body.includes(COMMENT_MARKER)) ?? null;
}

/**
 * Upsert evalgate's PR comment. Creates a new comment or edits the existing one
 * so a PR only ever carries a single evalgate report.
 */
export async function upsertComment(ctx: GitHubContext, body: string): Promise<void> {
  const base = ctx.apiUrl ?? "https://api.github.com";
  const fullBody = `${COMMENT_MARKER}\n${body}`;
  const existing = await findExistingComment(ctx);

  if (existing) {
    const url = `${base}/repos/${ctx.owner}/${ctx.repo}/issues/comments/${existing.id}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: headers(ctx),
      body: JSON.stringify({ body: fullBody }),
    });
    if (!res.ok) throw new Error(`[evalgate] failed to update comment (${res.status})`);
  } else {
    const url = `${base}/repos/${ctx.owner}/${ctx.repo}/issues/${ctx.prNumber}/comments`;
    const res = await fetch(url, {
      method: "POST",
      headers: headers(ctx),
      body: JSON.stringify({ body: fullBody }),
    });
    if (!res.ok) throw new Error(`[evalgate] failed to create comment (${res.status})`);
  }
}
