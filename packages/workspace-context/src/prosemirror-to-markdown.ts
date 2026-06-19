type ProseMirrorNode = {
  attrs?: Record<string, unknown>
  content?: ProseMirrorNode[]
  marks?: Array<{ attrs?: Record<string, unknown>; type: string }>
  text?: string
  type?: string
}

export function prosemirrorToMarkdown(content: unknown): string {
  if (content === null || content === undefined) {
    return ""
  }

  if (typeof content === "string") {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => prosemirrorToMarkdown(item))
      .filter(Boolean)
      .join("\n\n")
      .trim()
  }

  if (typeof content !== "object") {
    return ""
  }

  const node = content as ProseMirrorNode

  if (node.type === "doc") {
    return serializeBlocks(node.content ?? [])
  }

  return serializeBlocks([node]).trim()
}

function serializeBlocks(nodes: ProseMirrorNode[]) {
  const parts: string[] = []

  for (const node of nodes) {
    const serialized = serializeBlock(node)

    if (serialized) {
      parts.push(serialized)
    }
  }

  return parts.join("\n\n").trim()
}

function serializeBlock(node: ProseMirrorNode): string {
  switch (node.type) {
    case "paragraph":
      return serializeInline(node.content ?? [])
    case "heading": {
      const level =
        typeof node.attrs?.level === "number"
          ? Math.min(Math.max(node.attrs.level, 1), 6)
          : 1
      return `${"#".repeat(level)} ${serializeInline(node.content ?? [])}`.trim()
    }
    case "blockquote":
      return (node.content ?? [])
        .map((child) => `> ${serializeBlock(child)}`)
        .join("\n")
    case "bulletList":
      return serializeList(node.content ?? [], "- ")
    case "orderedList":
      return serializeOrderedList(node.content ?? [])
    case "taskList":
      return serializeTaskList(node.content ?? [])
    case "codeBlock": {
      const language =
        typeof node.attrs?.language === "string" ? node.attrs.language : ""
      const code = serializeInline(node.content ?? [])
      return `\`\`\`${language}\n${code}\n\`\`\``.trim()
    }
    case "horizontalRule":
      return "---"
    case "databaseBlock": {
      const databaseId =
        typeof node.attrs?.databaseId === "string" ? node.attrs.databaseId : ""
      const label = databaseId ? `Database (${databaseId})` : "Database"
      return `[${label}]`
    }
    case "pageBlock": {
      const pageId =
        typeof node.attrs?.pageId === "string" ? node.attrs.pageId : ""
      const title =
        typeof node.attrs?.title === "string" && node.attrs.title.trim()
          ? node.attrs.title.trim()
          : "Untitled page"
      return pageId
        ? `[Page: ${title} (${pageId})]`
        : `[Page: ${title}]`
    }
    case "imageBlock": {
      const src = typeof node.attrs?.src === "string" ? node.attrs.src : ""
      const alt =
        typeof node.attrs?.alt === "string" && node.attrs.alt.trim()
          ? node.attrs.alt.trim()
          : "image"
      return src ? `![${alt}](${src})` : `![${alt}]`
    }
    case "videoBlock": {
      const src = typeof node.attrs?.src === "string" ? node.attrs.src : ""
      return src ? `[Video](${src})` : "[Video]"
    }
    case "embedBlock": {
      const url = typeof node.attrs?.url === "string" ? node.attrs.url : ""
      const title =
        typeof node.attrs?.title === "string" && node.attrs.title.trim()
          ? node.attrs.title.trim()
          : "Embed"
      return url ? `[${title}](${url})` : `[${title}]`
    }
    case "fileBlock": {
      const name =
        typeof node.attrs?.name === "string" && node.attrs.name.trim()
          ? node.attrs.name.trim()
          : "File"
      const url = typeof node.attrs?.url === "string" ? node.attrs.url : ""
      return url ? `[File: ${name}](${url})` : `[File: ${name}]`
    }
    case "bookmarkBlock": {
      const url = typeof node.attrs?.url === "string" ? node.attrs.url : ""
      const title =
        typeof node.attrs?.title === "string" && node.attrs.title.trim()
          ? node.attrs.title.trim()
          : url || "Bookmark"
      return url ? `[${title}](${url})` : `[${title}]`
    }
    case "linkMention": {
      const href = typeof node.attrs?.href === "string" ? node.attrs.href : ""
      const title =
        typeof node.attrs?.title === "string" && node.attrs.title.trim()
          ? node.attrs.title.trim()
          : href || "Link"
      return href ? `[${title}](${href})` : title
    }
    case "table":
      return serializeTable(node.content ?? [])
    case "columnBlock":
    case "columnsExtension":
      return serializeBlocks(node.content ?? [])
    case "column":
      return serializeBlocks(node.content ?? [])
    case "details":
      return serializeBlocks(node.content ?? [])
    case "detailsSummary": {
      const summary = serializeInline(node.content ?? [])
      const body = serializeBlocks(
        (node as ProseMirrorNode & { parentContent?: ProseMirrorNode[] })
          .content ?? [],
      )
      return summary ? `**${summary}**\n${body}`.trim() : body
    }
    case "detailsContent":
      return serializeBlocks(node.content ?? [])
    case "text":
      return applyMarks(node.text ?? "", node.marks ?? [])
    default:
      if (node.content?.length) {
        return serializeBlocks(node.content)
      }

      return serializeInline(node.content ?? [])
  }
}

function serializeList(nodes: ProseMirrorNode[], marker: string) {
  return nodes
    .map((node) => {
      if (node.type !== "listItem" && node.type !== "taskItem") {
        return serializeBlock(node)
      }

      const content = serializeBlocks(node.content ?? [])
      return `${marker}${content}`
    })
    .join("\n")
}

function serializeOrderedList(nodes: ProseMirrorNode[]) {
  return nodes
    .map((node, index) => {
      if (node.type !== "listItem") {
        return serializeBlock(node)
      }

      const content = serializeBlocks(node.content ?? [])
      return `${index + 1}. ${content}`
    })
    .join("\n")
}

function serializeTaskList(nodes: ProseMirrorNode[]) {
  return nodes
    .map((node) => {
      const checked = node.attrs?.checked === true
      const content = serializeBlocks(node.content ?? [])
      return `- [${checked ? "x" : " "}] ${content}`
    })
    .join("\n")
}

function serializeTable(rows: ProseMirrorNode[]) {
  const tableRows = rows
    .filter((row) => row.type === "tableRow")
    .map((row) =>
      (row.content ?? [])
        .filter((cell) => cell.type === "tableCell" || cell.type === "tableHeader")
        .map((cell) => serializeInline(cell.content ?? []).replace(/\|/g, "\\|")),
    )

  if (tableRows.length === 0) {
    return ""
  }

  const header = tableRows[0]
  const divider = header.map(() => "---")
  const body = tableRows.slice(1)

  return [
    `| ${header.join(" | ")} |`,
    `| ${divider.join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n")
}

function serializeInline(nodes: ProseMirrorNode[]) {
  return nodes
    .map((node) => {
      if (node.type === "hardBreak") {
        return "\n"
      }

      if (node.type === "text") {
        return applyMarks(node.text ?? "", node.marks ?? [])
      }

      if (node.type === "emoji") {
        return typeof node.attrs?.emoji === "string" ? node.attrs.emoji : ""
      }

      return serializeBlock(node)
    })
    .join("")
}

function applyMarks(
  text: string,
  marks: Array<{ attrs?: Record<string, unknown>; type: string }>,
) {
  return marks.reduce((current, mark) => {
    switch (mark.type) {
      case "bold":
      case "strong":
        return `**${current}**`
      case "italic":
      case "em":
        return `*${current}*`
      case "strike":
        return `~~${current}~~`
      case "code":
        return `\`${current}\``
      case "link": {
        const href =
          typeof mark.attrs?.href === "string" ? mark.attrs.href : undefined
        return href ? `[${current}](${href})` : current
      }
      default:
        return current
    }
  }, text)
}