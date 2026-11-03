import { createMemo, For, Match, Show, Switch, type JSX } from "solid-js"
import { createQuery } from "@tanstack/solid-query"
import type {
  GithubOverviewCommit,
  GithubOverviewDependencySummary,
  GithubOverviewIssue,
  GithubOverviewLocalWork,
  GithubOverviewOverview,
  GithubOverviewPullRequest,
  GithubOverviewRemote,
  GithubOverviewRepoMeta,
  GithubOverviewRun,
} from "@opencode/client/promise"
import { useI18n } from "@opencode/ui/context/i18n"
import { Icon } from "@opencode/ui/icon"
import { IconButton } from "@opencode/ui/icon-button"
import { Tooltip } from "@opencode/ui/tooltip"
import { usePanel, usePlugin, type MountedSession } from "@opencode/plugin/gui"
import type GitHub from "./index"

// Ported from the fork's session GitHub tab. Section headings are sentence case and counts a dotted list, not pills.
export default function GithubOverviewTab(props: { session: MountedSession }) {
  const ctx = usePlugin<typeof GitHub>()
  const panel = usePanel()

  const query = createQuery(() => ({
    queryKey: [ctx.id, props.session.server.id, "github-overview", props.session.directory] as const,
    enabled: panel.visible() && props.session.server.connected,
    staleTime: 30_000,
    queryFn: () =>
      props.session.server.client.github
        .overview({ location: { directory: props.session.directory } })
        .then((result) => result.data),
  }))

  return (
    <div class="flex flex-col h-full overflow-hidden bg-v2-background-bg-base">
      <div class="shrink-0 flex items-center justify-end px-3 pt-2">
        <Tooltip value={ctx.t("refresh")} placement="bottom">
          <IconButton
            icon={<Icon name="outline-reset" size="small" />}
            variant="ghost-muted"
            size="large"
            onClick={() => void query.refetch()}
            aria-label={ctx.t("refresh")}
          />
        </Tooltip>
      </div>
      <div class="flex-1 min-h-0 overflow-auto">
        <div class="flex flex-col gap-5 px-4 pb-6">
          <Switch>
            <Match when={query.isPending}>
              <div class="py-10 text-center text-12-regular text-text-weak">{ctx.t("loading")}</div>
            </Match>
            <Match when={query.isError}>
              <div class="py-10 flex flex-col items-center gap-3 text-center">
                <div class="text-12-regular text-text-weak">{ctx.t("loadFailed")}</div>
                <button
                  type="button"
                  class="text-12-medium text-text-strong underline"
                  onClick={() => void query.refetch()}
                >
                  {ctx.t("retry")}
                </button>
              </div>
            </Match>
            <Match when={query.data} keyed>
              {(data) => <OverviewContent data={data} onOpen={(url) => ctx.system.openExternal(url)} />}
            </Match>
          </Switch>
        </div>
      </div>
    </div>
  )
}

function OverviewContent(props: { data: GithubOverviewOverview; onOpen: (url: string) => void }) {
  const ctx = usePlugin<typeof GitHub>()

  return (
    <Show
      when={props.data.isRepo}
      fallback={<EmptyState title={ctx.t("noGit")} description={ctx.t("noGit.description")} />}
    >
      <Show
        when={props.data.remote}
        fallback={<EmptyState title={ctx.t("noRemote")} description={ctx.t("noRemote.description")} />}
      >
        {(remote) => <RepoHeader remote={remote()} meta={props.data.github?.meta} onOpen={props.onOpen} />}
      </Show>
      <Show when={props.data.error}>{(error) => <div class="text-12-regular text-text-weak">{error()}</div>}</Show>
      <Show when={!props.data.tokenConfigured}>
        <div class="text-12-regular text-text-weak">{ctx.t("noToken")}</div>
      </Show>
      <Show when={props.data.local}>{(local) => <LocalWorkSection local={local()} />}</Show>
      <CommitsSection commits={props.data.commits} onOpen={props.onOpen} />
      <Show when={props.data.github}>
        {(github) => (
          <>
            <RunsSection runs={github().runs} onOpen={props.onOpen} />
            <DepsSection deps={github().deps} />
            <IssuesSection issues={github().issues} onOpen={props.onOpen} />
            <PullsSection pulls={github().pulls} onOpen={props.onOpen} />
          </>
        )}
      </Show>
    </Show>
  )
}

function EmptyState(props: { title: string; description: string }) {
  return (
    <div class="py-10 flex flex-col items-center gap-2 text-center">
      <div class="text-12-medium text-text-strong">{props.title}</div>
      <div class="text-12-regular text-text-weak">{props.description}</div>
    </div>
  )
}

function Section(props: { title: string; children: JSX.Element }) {
  return (
    <section class="flex flex-col gap-1">
      <h3 class="pb-1 text-12-medium text-text-strong border-b border-border-weaker-base">{props.title}</h3>
      {props.children}
    </section>
  )
}

function Note(props: { children: JSX.Element }) {
  return <div class="py-1 text-12-regular text-text-weak">{props.children}</div>
}

/** Counts as one line, `1 staged · 2 unstaged`; zero counts drop out. */
function Counts(props: { items: readonly (string | false)[] }) {
  return <div class="py-1 text-12-regular text-text-base">{props.items.filter(Boolean).join(" · ")}</div>
}

function ExternalRow(props: { url: string; onOpen: (url: string) => void; children: JSX.Element }) {
  return (
    <button
      type="button"
      class="w-full flex items-start gap-2 rounded-md -mx-2 px-2 py-1.5 text-left hover:bg-surface-base"
      onClick={() => props.onOpen(props.url)}
    >
      <span class="min-w-0 flex-1">{props.children}</span>
      <Icon name="outline-square-arrow" size="small" class="shrink-0 mt-0.5 text-text-weak" />
    </button>
  )
}

function RepoHeader(props: {
  remote: GithubOverviewRemote
  meta: GithubOverviewRepoMeta | undefined
  onOpen: (url: string) => void
}) {
  const ctx = usePlugin<typeof GitHub>()

  return (
    <div class="flex flex-col gap-1">
      <button
        type="button"
        class="self-start text-14-medium text-text-strong hover:underline"
        onClick={() => props.onOpen(props.remote.htmlUrl)}
        aria-label={ctx.t("openRepository")}
      >
        {props.remote.owner}/{props.remote.repo}
      </button>
      <Show when={props.meta}>
        {(meta) => (
          <>
            <Show when={meta().description}>
              {(description) => <div class="text-12-regular text-text-base">{description()}</div>}
            </Show>
            <div class="text-12-regular text-text-weak">
              {[ctx.plural("stars", meta().stars), ctx.plural("forks", meta().forks), meta().language]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </>
        )}
      </Show>
    </div>
  )
}

function LocalWorkSection(props: { local: GithubOverviewLocalWork }) {
  const ctx = usePlugin<typeof GitHub>()

  const clean = () =>
    props.local.staged === 0 && props.local.unstaged === 0 && props.local.untracked === 0 && props.local.ahead === 0

  return (
    <Section title={ctx.t("localWork")}>
      <Show when={props.local.branch}>
        {(branch) => (
          <div class="py-1 font-mono text-12-regular text-text-base">
            {branch()}
            <Show when={props.local.defaultBranch && props.local.defaultBranch !== branch()}>
              <span class="text-text-weak"> → {props.local.defaultBranch}</span>
            </Show>
          </div>
        )}
      </Show>
      <Show when={!clean()} fallback={<Note>{ctx.t("clean")}</Note>}>
        <Counts
          items={[
            props.local.staged > 0 && ctx.plural("staged", props.local.staged),
            props.local.unstaged > 0 && ctx.plural("unstaged", props.local.unstaged),
            props.local.untracked > 0 && ctx.plural("untracked", props.local.untracked),
            props.local.ahead > 0 && ctx.plural("unpushed", props.local.ahead),
            props.local.behind > 0 && ctx.plural("behind", props.local.behind),
          ]}
        />
      </Show>
    </Section>
  )
}

function CommitsSection(props: { commits: readonly GithubOverviewCommit[]; onOpen: (url: string) => void }) {
  const ctx = usePlugin<typeof GitHub>()

  return (
    <Section title={ctx.t("recentCommits")}>
      <For each={props.commits}>
        {(commit) => (
          <Show
            when={commit.htmlUrl}
            fallback={
              <div class="py-1.5">
                <CommitBody commit={commit} />
              </div>
            }
          >
            {(url) => (
              <ExternalRow url={url()} onOpen={props.onOpen}>
                <CommitBody commit={commit} />
              </ExternalRow>
            )}
          </Show>
        )}
      </For>
    </Section>
  )
}

function CommitBody(props: { commit: GithubOverviewCommit }) {
  return (
    <span class="flex flex-col gap-0.5">
      <span class="text-12-medium text-text-strong truncate">{props.commit.message}</span>
      <span class="text-11-regular text-text-weak">
        <span class="font-mono">{props.commit.sha.slice(0, 7)}</span> · {props.commit.author} ·{" "}
        <RelativeTime value={props.commit.committedAt} />
      </span>
    </span>
  )
}

function RunsSection(props: { runs: readonly GithubOverviewRun[]; onOpen: (url: string) => void }) {
  const ctx = usePlugin<typeof GitHub>()

  return (
    <Section title={ctx.t("checks")}>
      <Show when={props.runs.length > 0} fallback={<Note>{ctx.t("noRuns")}</Note>}>
        <For each={props.runs}>
          {(run) => (
            <ExternalRow url={run.htmlUrl} onOpen={props.onOpen}>
              <span class="flex items-center gap-2">
                <RunDot status={run.status} conclusion={run.conclusion} />
                <span class="min-w-0 flex-1 truncate text-12-medium text-text-strong">
                  {run.workflowName} #{run.runNumber}
                </span>
                <span class="shrink-0 text-11-regular text-text-weak">
                  <span class="font-mono">{run.branch}</span> · <RelativeTime value={run.updatedAt} />
                </span>
              </span>
            </ExternalRow>
          )}
        </For>
      </Show>
    </Section>
  )
}

function RunDot(props: { status: string; conclusion?: string }) {
  const color = () => {
    if (props.status === "queued" || props.status === "in_progress" || props.status === "waiting") {
      return "var(--icon-warning-active)"
    }

    if (props.conclusion === "success") return "var(--icon-success-active)"

    if (props.conclusion === "failure" || props.conclusion === "timed_out") return "var(--icon-critical-active)"

    return "var(--text-weak)"
  }

  return <span aria-hidden class="inline-block size-2 shrink-0 rounded-full" style={{ background: color() }} />
}

function DepsSection(props: { deps: GithubOverviewDependencySummary }) {
  const ctx = usePlugin<typeof GitHub>()

  const items = createMemo(() => [
    props.deps.critical > 0 && ctx.t("severity.critical", { count: props.deps.critical }),
    props.deps.high > 0 && ctx.t("severity.high", { count: props.deps.high }),
    props.deps.medium > 0 && ctx.t("severity.medium", { count: props.deps.medium }),
    props.deps.low > 0 && ctx.t("severity.low", { count: props.deps.low }),
    props.deps.updatePRs > 0 && ctx.plural("updatePRs", props.deps.updatePRs),
  ])

  return (
    <Section title={ctx.t("dependencies")}>
      <Show when={items().some(Boolean)} fallback={<Note>{ctx.t("noAlerts")}</Note>}>
        <Counts items={items()} />
      </Show>
      <Show when={!props.deps.alertsAvailable}>
        <div class="text-11-regular text-text-weak">{ctx.t("alertsUnavailable")}</div>
      </Show>
    </Section>
  )
}

function IssuesSection(props: { issues: readonly GithubOverviewIssue[]; onOpen: (url: string) => void }) {
  const ctx = usePlugin<typeof GitHub>()

  return (
    <Section title={ctx.t("issues")}>
      <Show when={props.issues.length > 0} fallback={<Note>{ctx.t("noIssues")}</Note>}>
        <For each={props.issues}>
          {(issue) => (
            <ExternalRow url={issue.htmlUrl} onOpen={props.onOpen}>
              <span class="flex flex-col gap-0.5">
                <span class="text-12-medium text-text-strong truncate">
                  <span class="font-mono text-text-weak">#{issue.number}</span> {issue.title}
                </span>
                <span class="text-11-regular text-text-weak">
                  {issue.author} · <RelativeTime value={issue.updatedAt} />
                </span>
              </span>
            </ExternalRow>
          )}
        </For>
      </Show>
    </Section>
  )
}

function PullsSection(props: { pulls: readonly GithubOverviewPullRequest[]; onOpen: (url: string) => void }) {
  const ctx = usePlugin<typeof GitHub>()

  return (
    <Section title={ctx.t("pulls")}>
      <Show when={props.pulls.length > 0} fallback={<Note>{ctx.t("noPulls")}</Note>}>
        <For each={props.pulls}>
          {(pull) => (
            <ExternalRow url={pull.htmlUrl} onOpen={props.onOpen}>
              <span class="flex flex-col gap-0.5">
                <span class="text-12-medium text-text-strong truncate">
                  <span class="font-mono text-text-weak">#{pull.number}</span> {pull.title}
                  <Show when={pull.draft}>
                    <span class="text-text-weak"> · {ctx.t("draft")}</span>
                  </Show>
                </span>
                <span class="text-11-regular text-text-weak">
                  {pull.author} · <RelativeTime value={pull.updatedAt} />
                </span>
              </span>
            </ExternalRow>
          )}
        </For>
      </Show>
    </Section>
  )
}

// Each unit's length in seconds, smallest first.
const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 1],
  ["minute", 60],
  ["hour", 3_600],
  ["day", 86_400],
  ["week", 604_800],
  ["month", 2_629_800],
  ["year", 31_557_600],
]

function RelativeTime(props: { value: string }) {
  const i18n = useI18n()

  const text = createMemo(() => {
    const seconds = (new Date(props.value).getTime() - Date.now()) / 1000

    if (!Number.isFinite(seconds)) return props.value

    // The largest unit the difference fills: 90 seconds is "2 minutes ago".
    const [unit, length] = units.findLast((entry) => Math.abs(seconds) >= entry[1]) ?? units[0]

    return new Intl.RelativeTimeFormat(i18n.locale(), { numeric: "auto" }).format(Math.round(seconds / length), unit)
  })

  return <time datetime={props.value}>{text()}</time>
}
