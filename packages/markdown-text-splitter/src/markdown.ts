import { RecursiveCharacterTextSplitter } from "./character.js";
import type { Document } from "./types.js";
import { Language } from "./types.js";

interface HeaderDefinition {
  level: number;
  name: string;
  data: string;
}

interface LineWithMetadata {
  content: string;
  metadata: Record<string, string>;
}

export interface MarkdownHeaderTextSplitterOptions {
  returnEachLine?: boolean;
  stripHeaders?: boolean;
  customHeaderPatterns?: Record<string, number>;
}

export interface ExperimentalMarkdownSyntaxTextSplitterOptions {
  headersToSplitOn?: Array<[string, string]>;
  returnEachLine?: boolean;
  stripHeaders?: boolean;
}

export class MarkdownTextSplitter extends RecursiveCharacterTextSplitter {
  public constructor(
    options: Omit<
      ConstructorParameters<typeof RecursiveCharacterTextSplitter>[0],
      "separators"
    > = {},
  ) {
    super({
      ...options,
      separators: RecursiveCharacterTextSplitter.getSeparatorsForLanguage(
        Language.MARKDOWN,
      ),
      isSeparatorRegex: true,
    });
  }
}

export class MarkdownHeaderTextSplitter {
  private readonly returnEachLine: boolean;
  private readonly headersToSplitOn: Array<[string, string]>;
  private readonly stripHeaders: boolean;
  private readonly customHeaderPatterns: Record<string, number>;

  public constructor(
    headersToSplitOn: Array<[string, string]>,
    options: MarkdownHeaderTextSplitterOptions = {},
  ) {
    const {
      returnEachLine = false,
      stripHeaders = true,
      customHeaderPatterns = {},
    } = options;

    this.returnEachLine = returnEachLine;
    this.headersToSplitOn = [...headersToSplitOn].sort(
      (left, right) => right[0].length - left[0].length,
    );
    this.stripHeaders = stripHeaders;
    this.customHeaderPatterns = customHeaderPatterns;
  }

  public splitText(text: string): Document<Record<string, string>>[] {
    const lines = text.split("\n");
    const linesWithMetadata: LineWithMetadata[] = [];
    const currentContent: string[] = [];
    let currentMetadata: Record<string, string> = {};
    const headerStack: HeaderDefinition[] = [];
    const initialMetadata: Record<string, string> = {};
    let inCodeBlock = false;
    let openingFence = "";

    for (const rawLine of lines) {
      const strippedLine = stripNonPrintable(rawLine.trim());

      if (!inCodeBlock) {
        if (strippedLine.startsWith("```") && countOccurrences(strippedLine, "```") === 1) {
          inCodeBlock = true;
          openingFence = "```";
        } else if (strippedLine.startsWith("~~~")) {
          inCodeBlock = true;
          openingFence = "~~~";
        }
      } else if (strippedLine.startsWith(openingFence)) {
        inCodeBlock = false;
        openingFence = "";
      }

      if (inCodeBlock) {
        currentContent.push(strippedLine);
        continue;
      }

      let matchedHeader = false;

      for (const [separator, name] of this.headersToSplitOn) {
        const isStandardHeader =
          strippedLine.startsWith(separator) &&
          (strippedLine.length === separator.length ||
            strippedLine[separator.length] === " ");
        const isCustomHeader = this.isCustomHeader(strippedLine, separator);

        if (!isStandardHeader && !isCustomHeader) {
          continue;
        }

        matchedHeader = true;

        const currentHeaderLevel =
          separator in this.customHeaderPatterns
            ? this.customHeaderPatterns[separator]
            : countOccurrences(separator, "#");

        while (
          headerStack.length > 0 &&
          headerStack[headerStack.length - 1].level >= currentHeaderLevel
        ) {
          const popped = headerStack.pop();
          if (popped && popped.name in initialMetadata) {
            delete initialMetadata[popped.name];
          }
        }

        const headerText = isCustomHeader
          ? strippedLine.slice(separator.length, strippedLine.length - separator.length).trim()
          : strippedLine.slice(separator.length).trim();

        headerStack.push({
          level: currentHeaderLevel,
          name,
          data: headerText,
        });
        initialMetadata[name] = headerText;

        if (currentContent.length > 0) {
          linesWithMetadata.push({
            content: currentContent.join("\n"),
            metadata: { ...currentMetadata },
          });
          currentContent.length = 0;
        }

        if (!this.stripHeaders) {
          currentContent.push(strippedLine);
        }

        break;
      }

      if (!matchedHeader) {
        if (strippedLine) {
          currentContent.push(strippedLine);
        } else if (currentContent.length > 0) {
          linesWithMetadata.push({
            content: currentContent.join("\n"),
            metadata: { ...currentMetadata },
          });
          currentContent.length = 0;
        }
      }

      currentMetadata = { ...initialMetadata };
    }

    if (currentContent.length > 0) {
      linesWithMetadata.push({
        content: currentContent.join("\n"),
        metadata: currentMetadata,
      });
    }

    return this.returnEachLine
      ? linesWithMetadata.map((chunk) => toDocument(chunk.content, chunk.metadata))
      : this.aggregateLinesToChunks(linesWithMetadata);
  }

  public aggregateLinesToChunks(
    lines: LineWithMetadata[],
  ): Document<Record<string, string>>[] {
    const aggregated: LineWithMetadata[] = [];

    for (const line of lines) {
      const previous = aggregated[aggregated.length - 1];

      if (previous && shallowEqual(previous.metadata, line.metadata)) {
        previous.content += "  \n" + line.content;
        continue;
      }

      if (
        previous &&
        !shallowEqual(previous.metadata, line.metadata) &&
        Object.keys(previous.metadata).length < Object.keys(line.metadata).length &&
        lastLine(previous.content)?.startsWith("#") &&
        !this.stripHeaders
      ) {
        previous.content += "  \n" + line.content;
        previous.metadata = line.metadata;
        continue;
      }

      aggregated.push({ ...line, metadata: { ...line.metadata } });
    }

    return aggregated.map((chunk) => toDocument(chunk.content, chunk.metadata));
  }

  private isCustomHeader(line: string, separator: string): boolean {
    if (!(separator in this.customHeaderPatterns)) {
      return false;
    }

    const escapedSeparator = escapeRegExp(separator);
    const pattern = new RegExp(
      `^${escapedSeparator}(?!${escapedSeparator})(.+?)(?<!${escapedSeparator})${escapedSeparator}$`,
    );
    const match = line.match(pattern);

    if (!match) {
      return false;
    }

    const content = match[1].trim();
    return Boolean(content) && !Array.from(removeSpaces(content)).every((char) => separator.includes(char));
  }
}

export class ExperimentalMarkdownSyntaxTextSplitter {
  private chunks: Document<Record<string, string>>[] = [];
  private currentChunk: Document<Record<string, string>> = toDocument("", {});
  private currentHeaderStack: Array<[number, string]> = [];
  private readonly stripHeaders: boolean;
  private readonly splittableHeaders: Record<string, string>;
  private readonly returnEachLine: boolean;

  public constructor(options: ExperimentalMarkdownSyntaxTextSplitterOptions = {}) {
    const {
      headersToSplitOn,
      returnEachLine = false,
      stripHeaders = true,
    } = options;

    this.stripHeaders = stripHeaders;
    this.splittableHeaders = Object.fromEntries(
      headersToSplitOn ?? [
        ["#", "Header 1"],
        ["##", "Header 2"],
        ["###", "Header 3"],
        ["####", "Header 4"],
        ["#####", "Header 5"],
        ["######", "Header 6"],
      ],
    );
    this.returnEachLine = returnEachLine;
  }

  public splitText(text: string): Document<Record<string, string>>[] {
    this.chunks = [];
    this.currentChunk = toDocument("", {});
    this.currentHeaderStack = [];

    const rawLines = text.split(/(?<=\n)/);

    while (rawLines.length > 0) {
      const rawLine = rawLines.shift() ?? "";
      const headerMatch = this.matchHeader(rawLine);
      const codeMatch = this.matchCode(rawLine);
      const horizontalRuleMatch = this.matchHorizontalRule(rawLine);

      if (headerMatch) {
        this.completeChunkDocument();
        if (!this.stripHeaders) {
          this.currentChunk.pageContent += rawLine;
        }

        const headerDepth = headerMatch[1].length;
        const headerText = headerMatch[2];
        this.resolveHeaderStack(headerDepth, headerText);
      } else if (codeMatch) {
        this.completeChunkDocument();
        this.currentChunk.pageContent = this.resolveCodeChunk(rawLine, rawLines);
        this.currentChunk.metadata.Code = codeMatch[1];
        this.completeChunkDocument();
      } else if (horizontalRuleMatch) {
        this.completeChunkDocument();
      } else {
        this.currentChunk.pageContent += rawLine;
      }
    }

    this.completeChunkDocument();

    if (!this.returnEachLine) {
      return this.chunks;
    }

    return this.chunks.flatMap((chunk) =>
      chunk.pageContent
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .map((line) => toDocument(line, { ...chunk.metadata })),
    );
  }

  private resolveHeaderStack(headerDepth: number, headerText: string): void {
    for (let index = 0; index < this.currentHeaderStack.length; index += 1) {
      if (this.currentHeaderStack[index][0] >= headerDepth) {
        this.currentHeaderStack = this.currentHeaderStack.slice(0, index);
        break;
      }
    }

    this.currentHeaderStack.push([headerDepth, headerText]);
  }

  private resolveCodeChunk(currentLine: string, rawLines: string[]): string {
    let chunk = currentLine;

    while (rawLines.length > 0) {
      const rawLine = rawLines.shift() ?? "";
      chunk += rawLine;

      if (this.matchCode(rawLine)) {
        return chunk;
      }
    }

    return "";
  }

  private completeChunkDocument(): void {
    const chunkContent = this.currentChunk.pageContent;

    if (chunkContent && chunkContent.trim().length > 0) {
      for (const [depth, value] of this.currentHeaderStack) {
        const headerKey = this.splittableHeaders["#".repeat(depth)];
        if (headerKey) {
          this.currentChunk.metadata[headerKey] = value;
        }
      }

      this.chunks.push(this.currentChunk);
    }

    this.currentChunk = toDocument("", {});
  }

  private matchHeader(line: string): RegExpMatchArray | null {
    const match = line.match(/^(#{1,6}) (.*)/);
    if (match && this.splittableHeaders[match[1]]) {
      return match;
    }

    return null;
  }

  private matchCode(line: string): RegExpMatchArray | null {
    return line.match(/^```(.*)/) ?? line.match(/^~~~(.*)/);
  }

  private matchHorizontalRule(line: string): RegExpMatchArray | null {
    return line.match(/^\*\*\*+\n/) ?? line.match(/^---+\n/) ?? line.match(/^___+\n/);
  }
}

function toDocument(
  pageContent: string,
  metadata: Record<string, string>,
): Document<Record<string, string>> {
  return {
    pageContent,
    metadata,
  };
}

function stripNonPrintable(value: string): string {
  return Array.from(value)
    .filter((char) => /\P{C}/u.test(char))
    .join("");
}

function countOccurrences(value: string, search: string): number {
  if (!search) {
    return 0;
  }

  return value.split(search).length - 1;
}

function shallowEqual(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === right[key]);
}

function lastLine(value: string): string | undefined {
  const lines = value.split("\n");
  return lines[lines.length - 1];
}

function removeSpaces(value: string): string {
  return value.split(" ").join("");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
