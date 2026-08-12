export function randomString(length: number, alphabet: string) {
  if (!Number.isSafeInteger(length) || length < 0)
    throw new Error("Random string length must be a non-negative integer")
  if (!alphabet.length || alphabet.length > 256)
    throw new Error("Random string alphabet must contain 1 to 256 characters")

  const limit = 256 - (256 % alphabet.length)
  const result: string[] = []
  while (result.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length - result.length))
    result.push(
      ...Array.from(bytes)
        .filter((byte) => byte < limit)
        .map((byte) => alphabet[byte % alphabet.length]),
    )
  }
  return result.join("")
}
