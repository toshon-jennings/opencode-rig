import path from "path"
import * as Process from "./process"

export async function extractZip(zipPath: string, destDir: string) {
  if (process.platform === "win32") {
    const winZipPath = path.resolve(zipPath)
    const winDestDir = path.resolve(destDir)
    // $global:ProgressPreference suppresses PowerShell's blue progress bar popup
    await Process.run(
      [
        "powershell",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$global:ProgressPreference = 'SilentlyContinue'; Expand-Archive -LiteralPath $env:OPENCODE_ZIP_PATH -DestinationPath $env:OPENCODE_ZIP_DEST -Force",
      ],
      { env: { OPENCODE_ZIP_PATH: winZipPath, OPENCODE_ZIP_DEST: winDestDir } },
    )
    return
  }

  await Process.run(["unzip", "-o", "-q", zipPath, "-d", destDir])
}

export * as Archive from "./archive"
