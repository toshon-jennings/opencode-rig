type RecordValue = Record<string, unknown>

const isRecord = (value: unknown): value is RecordValue => {
  return typeof value === "object" && value !== null
}

export const isDisposable = (value: unknown): value is { dispose: () => void } => {
  return isRecord(value) && typeof value.dispose === "function"
}

export const disposeIfDisposable = (value: unknown) => {
  if (!isDisposable(value)) return
  value.dispose()
}

export const hasSetOption = (value: unknown): value is { setOption: (key: string, next: unknown) => void } => {
  return isRecord(value) && typeof value.setOption === "function"
}

export const setOptionIfSupported = (value: unknown, key: string, next: unknown) => {
  if (!hasSetOption(value)) return
  value.setOption(key, next)
}

export const hasGetMode = (value: unknown): value is { getMode: (mode: number, isAnsi?: boolean) => boolean } => {
  return isRecord(value) && typeof value.getMode === "function"
}

// ghostty's getMode asserts the terminal is open, so a terminal torn down before it ever
// rendered throws rather than reporting "off".
export const getModeIfSupported = (value: unknown, mode: number) => {
  if (!hasGetMode(value)) return false
  try {
    return value.getMode(mode, false) === true
  } catch {
    return false
  }
}

export const getHoveredLinkText = (value: unknown) => {
  if (!isRecord(value)) return
  const link = value.currentHoveredLink
  if (!isRecord(link)) return
  if (typeof link.text !== "string") return
  return link.text
}

export const getSpeechRecognitionCtor = <T>(value: unknown): (new () => T) | undefined => {
  if (!isRecord(value)) return
  const ctor =
    typeof value.webkitSpeechRecognition === "function" ? value.webkitSpeechRecognition : value.SpeechRecognition
  if (typeof ctor !== "function") return
  return ctor as new () => T
}
