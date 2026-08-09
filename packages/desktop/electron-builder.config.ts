import { execFile } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import type { AfterPackContext, Configuration } from "electron-builder"

import { FORK_OWNER, FORK_REPO } from "./fork"

const execFileAsync = promisify(execFile)
const packageDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(packageDir, "../..")
const signScript = path.join(rootDir, "script", "sign-windows.ps1")
// The Electron 42 packaging update briefly installed Linux launchers/icons under
// "opencode-desktop". Keep that hidden desktop entry around so existing GNOME/KDE
// pins still resolve after the canonical app id changes back to ai.opencode.desktop.
const legacyDesktopEntry = path.join(packageDir, "resources", "linux", "opencode-desktop.desktop")
const legacyDesktopEntryFpm = `${legacyDesktopEntry}=/usr/share/applications/opencode-desktop.desktop`

const metainfoFpm = (appId: string) =>
  `${path.join(packageDir, "resources", `${appId}.metainfo.xml`)}=/usr/share/metainfo/${appId}.metainfo.xml`

async function signWindows(configuration: { path: string }) {
  if (process.platform !== "win32") return
  if (process.env.GITHUB_ACTIONS !== "true") return

  await execFileAsync(
    "pwsh",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", signScript, configuration.path],
    { cwd: rootDir },
  )
}

const channel = (() => {
  const raw = process.env.OPENCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  return "dev"
})()

// Signing is opt-in: a fork without Apple credentials still produces a working DMG,
// it just cannot be notarized. Notarizing unconditionally would fail the whole build.
const signed = Boolean(process.env.CSC_LINK || process.env.CSC_KEYCHAIN || process.env.APPLE_API_KEY)

// Without a Developer ID, electron-builder skips macOS signing altogether, which ships the
// stock Electron linker signature with no sealed resources. macOS rejects that bundle as
// "damaged and can't be opened" and offers NO Gatekeeper override — an invalid signature is
// a different class from an unrecognised one, so "Open Anyway" never appears in Privacy &
// Security. Ad-hoc signing seals the bundle, making an unsigned build merely unidentified
// rather than corrupt. Notarized builds skip this: electron-builder signs them for real.
async function adhocSignMac(context: AfterPackContext) {
  if (signed || context.electronPlatformName !== "darwin") return
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  await execFileAsync("codesign", ["--force", "--deep", "--sign", "-", app])
  // Verify in CI so a broken bundle fails the build instead of every user's download.
  await execFileAsync("codesign", ["--verify", "--deep", "--strict", app])
}

const APP_IDS = {
  dev: "ai.opencode.desktop.dev",
  beta: "ai.opencode.desktop.beta",
  prod: "ai.opencode.desktop",
} as const

const getBase = (appId: string): Configuration => ({
  artifactName: "opencode-desktop-${os}-${arch}.${ext}",
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  // Linux launchers are .desktop files, so this is the desktop file name,
  // not just the app id. For prod, app id "ai.opencode.desktop" becomes
  // "ai.opencode.desktop.desktop".
  // https://developer.gnome.org/documentation/guidelines/maintainer/integrating.html
  // https://www.electron.build/docs/linux/
  extraMetadata: {
    desktopName: `${appId}.desktop`,
  },
  files: ["out/**/*", "resources/**/*", "!resources/opencode-cli*", "!resources/opencode-usage"],
  extraResources: [
    ...(channel === "dev"
      ? [
          {
            from: "resources/",
            to: "",
            filter: ["opencode-cli*"],
          },
        ]
      : []),
    // Must stay outside app.asar: the usage panel spawns this as a process, and
    // executables inside an asar archive cannot be run.
    {
      from: "resources/",
      to: "",
      filter: ["opencode-usage"],
    },
    {
      from: "native/",
      to: "native/",
      filter: ["index.js", "index.d.ts", "build/Release/mac_window.node", "swift-build/**"],
    },
  ],
  mac: {
    category: "public.app-category.developer-tools",
    icon: `resources/icons/icon.icns`,
    hardenedRuntime: signed,
    gatekeeperAssess: false,
    entitlements: "resources/entitlements.plist",
    entitlementsInherit: "resources/entitlements.plist",
    notarize: signed,
    // null tells electron-builder to skip signing outright rather than hunt for an
    // identity and emit a warning per artifact. `adhocSignMac` then seals the bundle
    // itself — see the note there for why skipping signing entirely ships a broken app.
    identity: signed ? undefined : null,
    target: ["dmg", "zip"],
  },
  afterPack: adhocSignMac,
  dmg: {
    sign: signed,
  },
  protocols: {
    name: "OpenCode Rig",
    schemes: ["opencode"],
  },
  win: {
    icon: `resources/icons/icon.ico`,
    signtoolOptions: {
      sign: signWindows,
    },
    target: ["nsis"],
    verifyUpdateCodeSignature: false,
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    installerIcon: `resources/icons/icon.ico`,
    installerHeaderIcon: `resources/icons/icon.ico`,
  },
  linux: {
    icon: `resources/icons`,
    category: "Development",
    executableName: appId,
    desktop: {
      entry: {
        // Match the installed .desktop file and hicolor icon basename so
        // Linux shells can associate the running Electron window with its launcher.
        StartupWMClass: appId,
      },
    },
    target: ["AppImage", "deb", "rpm"],
  },
})

function getConfig() {
  const appId = APP_IDS[channel]
  const base = getBase(appId)

  switch (channel) {
    case "dev": {
      return {
        ...base,
        appId,
        productName: "OpenCode Rig Dev",
        deb: { fpm: [metainfoFpm(appId)] },
        rpm: { packageName: "opencode-dev", fpm: [metainfoFpm(appId)] },
      }
    }
    case "beta": {
      return {
        ...base,
        appId,
        productName: "OpenCode Rig Beta",
        protocols: { name: "OpenCode Rig Beta", schemes: ["opencode"] },
        publish: { provider: "github", owner: FORK_OWNER, repo: FORK_REPO, channel: "beta", releaseType: "release" },
        deb: { fpm: [metainfoFpm(appId)] },
        rpm: { packageName: "opencode-beta", fpm: [metainfoFpm(appId)] },
      }
    }
    case "prod": {
      return {
        ...base,
        appId,
        productName: "OpenCode Rig",
        protocols: { name: "OpenCode Rig", schemes: ["opencode"] },
        // Not a draft: the updater cannot read latest-mac.yml from an unpublished release.
        publish: { provider: "github", owner: FORK_OWNER, repo: FORK_REPO, channel: "latest", releaseType: "release" },
        deb: { fpm: [metainfoFpm(appId), legacyDesktopEntryFpm] },
        rpm: { packageName: "opencode", fpm: [metainfoFpm(appId), legacyDesktopEntryFpm] },
      }
    }
  }
}

export default getConfig()
