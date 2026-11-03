import { lazy, onCleanup, Show } from "solid-js"
import { Icon } from "@opencode/ui/icon"
import { IconButton } from "@opencode/ui/icon-button"
import { Tooltip } from "@opencode/ui/tooltip"
import { Command, Panel, Slot, type Plugin, type SessionRef } from "@opencode/plugin/gui"
import { onIdle } from "@opencode/plugin/gui/builtin"
import type GitHub from "./index"

/** The GitHub overview: a side tab with the repository's local work, commits, checks, issues and pull requests. */
const setup: Plugin.Setup<typeof GitHub> = (ctx) => {
  const OverviewTab = lazy(() => import("./panel"))
  onCleanup(onIdle(() => void OverviewTab.preload()))

  const open = (session: SessionRef) => ctx.layout.open(`${ctx.id}:main`, session, { tab: "select" })

  // One tab object, so strip updates and session switches do not rebuild its trigger.
  const tab = {
    id: "main",
    get title() {
      return ctx.t("title")
    },
    label: () => (
      <div class="flex items-center gap-2">
        <Icon name="github" size="small" />
        <div>{ctx.t("title")}</div>
      </div>
    ),
  }

  ctx.add(Panel, {
    id: "main",
    region: "side",
    list: (input) => (input.open.includes("main") ? [tab] : []),
    render: (props) => <OverviewTab session={props.session} />,
  })

  ctx.add(Slot, {
    at: "session.panel.end",
    render: (input) => (
      <Show when={input.session.project?.vcs}>
        <Tooltip value={ctx.t("open")} placement="bottom" class="flex items-center">
          <IconButton
            icon={<Icon name="github" />}
            variant="ghost-muted"
            size="large"
            onClick={() => open(input.session)}
            aria-label={ctx.t("open")}
          />
        </Tooltip>
      </Show>
    ),
  })

  ctx.add(Command, {
    id: "open",
    get title() {
      return ctx.t("command.open")
    },
    get group() {
      return ctx.t("command.category.view")
    },
    keywords: "github repository checks issues pull requests commits",
    get enabled() {
      return ctx.sessions.current() !== undefined
    },
    run: () => {
      const session = ctx.sessions.current()

      if (session) open(session)
    },
  })
}

export default setup
