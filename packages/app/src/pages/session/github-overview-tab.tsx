import { For, Match, Show, Switch, createMemo, type JSX } from "solid-js"
import { createQuery } from "@tanstack/solid-query"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import type {
  GithubOverviewCommit,
  GithubOverviewDependencySummary,
  GithubOverviewIssue,
  GithubOverviewLocalWork,
  GithubOverviewOverview,
  GithubOverviewPullRequest,
  GithubOverviewRepoMeta,
  GithubOverviewRun,
} from "@opencode-ai/sdk/v2/client"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useSDK } from "@/context/sdk"

export function GithubOverviewTab(props: { active: () => boolean }) {
  const sdk = useSDK()
  const platform = usePlatform()
  const language = useLanguage()

  const query = createQuery(() => ({
    queryKey: ["github-overview", sdk().directory] as const,
    enabled: props.active(),
    staleTime: 30_000,
    queryFn: () =>
      sdk()
        .client.v2.githubOverview.get({ location: { directory: sdk().directory } })
        .then((result) => result.data!.data),
  }))
  const overview = createMemo(() => query.data)

  return (
    <div class="flex flex-col h-full overflow-hidden contain-strict">
      <div class="shrink-0 flex items-center justify-end px-3 pt-2">
        <TooltipV2 value={language.t("session.github.refresh")} placement="bottom">
          <IconButtonV2
            icon={<IconV2 name="outline-reset" size="small" />}
            variant="ghost-muted"
            size="large"
            onClick={() => void query.refetch()}
            aria-label={language.t("session.github.refresh")}
          />
        </TooltipV2>
      </div>
      <ScrollView class="flex-1 min-h-0">
        <div class="flex flex-col gap-5 px-4 pb-6">
          <Switch>
            <Match when={query.isPending}>
              <div class="py-10 text-center text-12-regular text-text-weak">{language.t("session.github.loading")}</div>
            </Match>
            <Match when={query.isError}>
              <div class="py-10 flex flex-col items-center gap-3 text-center">
                <div class="text-12-regular text-text-weak">{language.t("session.github.loadFailed")}</div>
                <button
                  type="button"
                  class="text-12-medium text-text-strong underline"
                  onClick={() => void query.refetch()}
                >
                  {language.t("session.github.retry")}
                </button>
              </div>
            </Match>
            <Match when={overview()} keyed>
              {(data) => <OverviewContent data={data} onOpen={(url) => platform.openExternal(url)} />}
            </Match>
          </Switch>
        </div>
      </ScrollView>
    </div>
  )
}

function OverviewContent(props: { data: GithubOverviewOverview; onOpen: (url: string) => void }) {
  const language = useLanguage()
  const data = createMemo(() => props.data)

  return (
    <>
      <Show when={!data().isRepo}>
        <EmptyState title={language.t("session.github.noGit")} description={language.t("session.github.noGit.description")} />
      </Show>
      <Show when={data().isRepo}>
        <Show when={data().remote} fallback={<RemoteMissing />}>
          {(remote) => <RepoHeader remote={remote()} meta={data().github?.meta} onOpen={props.onOpen} />}
        </Show>
        <Show when={data().error}>
          {(error) => <div class="text-12-regular text-text-weak">{error()}</div>}
        </Show>
        <Show when={!data().tokenConfigured}>
          <div class="text-12-regular text-text-weak">{language.t("session.github.noToken")}</div>
        </Show>
        <Show when={data().local}>{(local) => <LocalWorkSection local={local()} />}</Show>
        <CommitsSection commits={data().commits} onOpen={props.onOpen} />
        <Show when={data().github}>
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
    </>
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

function RemoteMissing() {
  const language = useLanguage()
  return <EmptyState title={language.t("session.github.noRemote")} description={language.t("session.github.noRemote.description")} />
}

function SectionTitle(props: { children: JSX.Element }) {
  return <div class="text-11-regular text-text-weak uppercase tracking-wide">{props.children}</div>
}

function count(value: number | string | undefined) {
  return typeof value === "number" ? value : 0
}

function Chip(props: { children: JSX.Element }) {
  return (
    <span class="inline-flex items-center rounded-md border border-border-weaker-base px-1.5 py-0.5 text-11-regular text-text-base">
      {props.children}
    </span>
  )
}

function ExternalRow(props: { url: string; onOpen: (url: string) => void; children: JSX.Element }) {
  return (
    <button
      type="button"
      class="w-full flex items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-background-stronger"
      onClick={() => props.onOpen(props.url)}
    >
      <span class="min-w-0 flex-1">{props.children}</span>
      <IconV2 name="outline-square-arrow" size="small" class="shrink-0 mt-0.5 text-text-weak" />
    </button>
  )
}

function RepoHeader(props: {
  remote: { owner: string; repo: string; htmlUrl: string }
  meta: GithubOverviewRepoMeta | undefined
  onOpen: (url: string) => void
}) {
  const language = useLanguage()
  return (
    <div class="flex flex-col gap-1.5">
      <button
        type="button"
        class="self-start text-14-medium text-text-strong hover:underline"
        onClick={() => props.onOpen(props.remote.htmlUrl)}
        aria-label={language.t("session.github.openRepository")}
      >
        {props.remote.owner}/{props.remote.repo}
      </button>
      <Show when={props.meta}>
        {(meta) => (
          <div class="flex flex-wrap items-center gap-1.5">
            <Chip>{language.plural("session.github.stars", count(meta().stars))}</Chip>
            <Chip>{language.plural("session.github.forks", count(meta().forks))}</Chip>
            <Show when={meta().language}>
              {(name) => <Chip>{name()}</Chip>}
            </Show>
          </div>
        )}
      </Show>
    </div>
  )
}

function LocalWorkSection(props: { local: GithubOverviewLocalWork }) {
  const language = useLanguage()
  const clean = createMemo(
    () =>
      count(props.local.staged) === 0 &&
      count(props.local.unstaged) === 0 &&
      count(props.local.untracked) === 0 &&
      count(props.local.ahead) === 0,
  )
  return (
    <section class="flex flex-col gap-2">
      <SectionTitle>{language.t("session.github.localWork")}</SectionTitle>
      <Show when={props.local.branch}>
        {(branch) => (
          <div class="text-12-regular text-text-base">
            {branch()}
            <Show when={props.local.defaultBranch && props.local.defaultBranch !== branch()}>
              <span class="text-text-weak"> → {props.local.defaultBranch}</span>
            </Show>
          </div>
        )}
      </Show>
      <Show
        when={!clean()}
        fallback={<div class="text-12-regular text-text-weak">{language.t("session.github.clean")}</div>}
      >
        <div class="flex flex-wrap gap-1.5">
          <Show when={count(props.local.staged) > 0}>
            <Chip>{language.plural("session.github.staged", count(props.local.staged))}</Chip>
          </Show>
          <Show when={count(props.local.unstaged) > 0}>
            <Chip>{language.plural("session.github.unstaged", count(props.local.unstaged))}</Chip>
          </Show>
          <Show when={count(props.local.untracked) > 0}>
            <Chip>{language.plural("session.github.untracked", count(props.local.untracked))}</Chip>
          </Show>
          <Show when={count(props.local.ahead) > 0}>
            <Chip>{language.plural("session.github.unpushed", count(props.local.ahead))}</Chip>
          </Show>
          <Show when={count(props.local.behind) > 0}>
            <Chip>{language.plural("session.github.behind", count(props.local.behind))}</Chip>
          </Show>
        </div>
      </Show>
    </section>
  )
}

function CommitsSection(props: { commits: GithubOverviewCommit[]; onOpen: (url: string) => void }) {
  const language = useLanguage()
  return (
    <section class="flex flex-col gap-1">
      <SectionTitle>{language.t("session.github.recentCommits")}</SectionTitle>
      <For each={props.commits}>
        {(commit) => (
          <Show
            when={commit.htmlUrl}
            fallback={
              <div class="px-2 py-1.5">
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
    </section>
  )
}

function CommitBody(props: { commit: GithubOverviewCommit }) {
  return (
    <span class="flex flex-col gap-0.5">
      <span class="text-12-medium text-text-strong truncate">{props.commit.message}</span>
      <span class="text-11-regular text-text-weak">
        {props.commit.sha.slice(0, 7)} • {props.commit.author} • <RelativeTime value={props.commit.committedAt} />
      </span>
    </span>
  )
}

function RunsSection(props: { runs: GithubOverviewRun[]; onOpen: (url: string) => void }) {
  const language = useLanguage()
  return (
    <section class="flex flex-col gap-1">
      <SectionTitle>{language.t("session.github.checks")}</SectionTitle>
      <Show when={props.runs.length > 0} fallback={<div class="text-12-regular text-text-weak">{language.t("session.github.noRuns")}</div>}>
        <For each={props.runs}>
          {(run) => (
            <ExternalRow url={run.htmlUrl} onOpen={props.onOpen}>
              <span class="flex items-center gap-2">
                <RunDot status={run.status} conclusion={run.conclusion} />
                <span class="min-w-0 flex-1 truncate text-12-medium text-text-strong">
                  {run.workflowName} #{run.runNumber}
                </span>
                <span class="shrink-0 text-11-regular text-text-weak">
                  {run.branch} • <RelativeTime value={run.updatedAt} />
                </span>
              </span>
            </ExternalRow>
          )}
        </For>
      </Show>
    </section>
  )
}

function RunDot(props: { status: string; conclusion?: string }) {
  const color = createMemo(() => {
    if (props.status === "queued" || props.status === "in_progress" || props.status === "waiting") {
      return "var(--syntax-warning)"
    }
    if (props.conclusion === "success") return "var(--syntax-success)"
    if (props.conclusion === "failure" || props.conclusion === "timed_out") return "var(--syntax-error)"
    return "var(--text-weak)"
  })
  return <span aria-hidden class="inline-block size-2 shrink-0 rounded-full" style={{ background: color() }} />
}

function DepsSection(props: { deps: GithubOverviewDependencySummary }) {
  const language = useLanguage()
  const empty = createMemo(
    () =>
      count(props.deps.critical) === 0 &&
      count(props.deps.high) === 0 &&
      count(props.deps.medium) === 0 &&
      count(props.deps.low) === 0 &&
      count(props.deps.updatePRs) === 0,
  )
  return (
    <section class="flex flex-col gap-2">
      <SectionTitle>{language.t("session.github.dependencies")}</SectionTitle>
      <Show when={!empty()} fallback={<div class="text-12-regular text-text-weak">{language.t("session.github.noAlerts")}</div>}>
        <div class="flex flex-wrap gap-1.5">
          <Show when={count(props.deps.critical) > 0}>
            <Chip>{count(props.deps.critical)} crit</Chip>
          </Show>
          <Show when={count(props.deps.high) > 0}>
            <Chip>{count(props.deps.high)} high</Chip>
          </Show>
          <Show when={count(props.deps.medium) > 0}>
            <Chip>{count(props.deps.medium)} med</Chip>
          </Show>
          <Show when={count(props.deps.low) > 0}>
            <Chip>{count(props.deps.low)} low</Chip>
          </Show>
          <Show when={count(props.deps.updatePRs) > 0}>
            <Chip>{language.plural("session.github.updatePRs", count(props.deps.updatePRs))}</Chip>
          </Show>
        </div>
      </Show>
      <Show when={!props.deps.alertsAvailable}>
        <div class="text-11-regular text-text-weaker">{language.t("session.github.alertsUnavailable")}</div>
      </Show>
    </section>
  )
}

function IssuesSection(props: { issues: GithubOverviewIssue[]; onOpen: (url: string) => void }) {
  const language = useLanguage()
  return (
    <section class="flex flex-col gap-1">
      <SectionTitle>{language.t("session.github.issues")}</SectionTitle>
      <Show when={props.issues.length > 0} fallback={<div class="text-12-regular text-text-weak">{language.t("session.github.noIssues")}</div>}>
        <For each={props.issues}>
          {(issue) => (
            <ExternalRow url={issue.htmlUrl} onOpen={props.onOpen}>
              <span class="flex flex-col gap-0.5">
                <span class="text-12-medium text-text-strong truncate">
                  #{issue.number} {issue.title}
                </span>
                <span class="text-11-regular text-text-weak">
                  {issue.author} • <RelativeTime value={issue.updatedAt} />
                </span>
              </span>
            </ExternalRow>
          )}
        </For>
      </Show>
    </section>
  )
}

function PullsSection(props: { pulls: GithubOverviewPullRequest[]; onOpen: (url: string) => void }) {
  const language = useLanguage()
  return (
    <section class="flex flex-col gap-1">
      <SectionTitle>{language.t("session.github.pulls")}</SectionTitle>
      <Show when={props.pulls.length > 0} fallback={<div class="text-12-regular text-text-weak">{language.t("session.github.noPulls")}</div>}>
        <For each={props.pulls}>
          {(pull) => (
            <ExternalRow url={pull.htmlUrl} onOpen={props.onOpen}>
              <span class="flex flex-col gap-0.5">
                <span class="text-12-medium text-text-strong truncate">
                  #{pull.number} {pull.title}
                  <Show when={pull.draft}>
                    <span class="text-text-weak"> • {language.t("session.github.draft")}</span>
                  </Show>
                </span>
                <span class="text-11-regular text-text-weak">
                  {pull.author} • <RelativeTime value={pull.updatedAt} />
                </span>
              </span>
            </ExternalRow>
          )}
        </For>
      </Show>
    </section>
  )
}

function RelativeTime(props: { value: string }) {  const language = useLanguage()
  const text = createMemo(() => {
    const target = new Date(props.value).getTime()
    if (!Number.isFinite(target)) return props.value
    const diff = target - Date.now()
    const formatter = new Intl.RelativeTimeFormat(language.locale(), { numeric: "auto" })
    const divisions: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
      { amount: 60, unit: "second" },
      { amount: 60, unit: "minute" },
      { amount: 24, unit: "hour" },
      { amount: 7, unit: "day" },
      { amount: 4.34524, unit: "week" },
      { amount: 12, unit: "month" },
      { amount: Number.POSITIVE_INFINITY, unit: "year" },
    ]
    let duration = diff / 1000
    for (const division of divisions) {
      if (Math.abs(duration) < division.amount) return formatter.format(Math.round(duration), division.unit)
      duration /= division.amount
    }
    return props.value
  })
  return <>{text()}</>
}
