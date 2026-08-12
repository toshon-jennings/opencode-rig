import { randomInt } from "node:crypto"

export function randomString(length: number, alphabet: string) {
  if (!Number.isSafeInteger(length) || length < 0)
    throw new Error("Random string length must be a non-negative integer")
  if (!alphabet.length || alphabet.length > 256)
    throw new Error("Random string alphabet must contain 1 to 256 characters")

  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join("")
}
