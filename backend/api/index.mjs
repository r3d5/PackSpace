import crypto from "node:crypto"
import {list, put} from "@vercel/blob"

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/

function send(response, status, body, extraHeaders = {}) {
  response.statusCode = status
  response.setHeader("Content-Type", "application/json; charset=utf-8")
  response.setHeader("Access-Control-Allow-Origin", "*")
  response.setHeader("Access-Control-Allow-Headers", "Content-Type")
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value)
  response.end(JSON.stringify(body))
}

const clean = (value, max = 28) => typeof value === "string" ? value.trim().slice(0, max) : ""

function normalizePreset(body) {
  const name = clean(body?.name)
  if (!name) throw new Error("Preset name is required")
  if (!Array.isArray(body?.categories) || body.categories.length < 1 || body.categories.length > 6) {
    throw new Error("Use 1–6 categories")
  }
  const categories = body.categories.map((category, categoryIndex) => {
    const categoryName = clean(category?.name)
    if (!categoryName) throw new Error(`Category ${categoryIndex + 1} needs a name`)
    if (!Array.isArray(category?.items) || category.items.length < 1 || category.items.length > 8) {
      throw new Error(`Category ${categoryIndex + 1} needs 1–8 items`)
    }
    const items = category.items.map(item => clean(item)).filter(Boolean)
    if (items.length !== category.items.length) throw new Error(`Category ${categoryIndex + 1} contains an empty item`)
    return {name: categoryName, items}
  })
  return {name, categories}
}

function createCode() {
  const bytes = crypto.randomBytes(6)
  let code = ""
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  return code
}

async function readBody(request) {
  if (request.body && typeof request.body === "object") return request.body
  let raw = ""
  for await (const chunk of request) {
    raw += chunk
    if (raw.length > 32768) throw new Error("Request body is too large")
  }
  return raw ? JSON.parse(raw) : {}
}

async function findPreset(code) {
  const pathname = `lists/${code}.json`
  const result = await list({prefix: pathname, limit: 1})
  const blob = result.blobs.find(item => item.pathname === pathname)
  if (!blob) return null
  const stored = await fetch(blob.url, {cache: "no-store"})
  if (!stored.ok) throw new Error(`Stored list could not be read (${stored.status})`)
  return stored.json()
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") return send(response, 204, {})

  const url = new URL(request.url, "https://packspace.invalid")
  const path = url.pathname.replace(/\/$/, "") || "/"

  try {
    if (request.method === "GET" && (path === "/" || path === "/health")) {
      return send(response, 200, {ok: true, service: "packspace-share-api"})
    }

    if (request.method === "POST" && path === "/v1/lists") {
      let preset
      try { preset = normalizePreset(await readBody(request)) }
      catch (error) { return send(response, 400, {error: String(error.message || error)}) }

      for (let attempt = 0; attempt < 8; attempt++) {
        const code = createCode()
        try {
          await put(`lists/${code}.json`, JSON.stringify(preset), {
            access: "public",
            addRandomSuffix: false,
            allowOverwrite: false,
            contentType: "application/json",
            cacheControlMaxAge: 60,
          })
          return send(response, 201, {code, preset})
        } catch (error) {
          if (error?.name !== "BlobError" || !String(error.message).toLowerCase().includes("already")) throw error
        }
      }
      return send(response, 503, {error: "Could not allocate a share code"})
    }

    const match = path.match(/^\/v1\/lists\/([^/]+)$/)
    if (request.method === "GET" && match) {
      const code = decodeURIComponent(match[1]).trim().toUpperCase()
      if (!CODE_PATTERN.test(code)) return send(response, 400, {error: "Code must be six letters or numbers"})
      const preset = await findPreset(code)
      if (!preset) return send(response, 404, {error: "Pack list not found"})
      return send(response, 200, {code, preset}, {"Cache-Control": "public, max-age=60"})
    }

    return send(response, 404, {error: "Not found"})
  } catch (error) {
    console.error(error)
    return send(response, 500, {error: "Internal server error"})
  }
}
