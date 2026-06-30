import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")
const solidDir = path.join(rootDir, "node_modules/boxicons/svg/solid")
const outputPath = path.join(
  rootDir,
  "apps/web/src/data/boxicons-filled-catalog.json",
)

function parseSvg(svg) {
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/)
  const viewBox = viewBoxMatch?.[1] ?? "0 0 24 24"
  const content = svg
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .trim()

  return { viewBox, content }
}

function formatLabel(name) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

const files = (await readdir(solidDir)).filter((file) => file.endsWith(".svg"))
const catalog = []

for (const file of files.sort()) {
  const slug = file.replace(/^bxs-/, "").replace(/\.svg$/, "")
  const svg = await readFile(path.join(solidDir, file), "utf8")
  const { viewBox, content } = parseSvg(svg)

  catalog.push({
    name: slug,
    label: formatLabel(slug),
    viewBox,
    content,
  })
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8")
console.log(`Wrote ${catalog.length} filled boxicons to ${outputPath}`)