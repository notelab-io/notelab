# markdown-text-splitter

Standalone TypeScript markdown text splitters inspired by LangChain's `markdown.py`.

## Exports

- `MarkdownTextSplitter`
- `MarkdownHeaderTextSplitter`
- `ExperimentalMarkdownSyntaxTextSplitter`
- `RecursiveCharacterTextSplitter`
- `TextSplitter`
- `Language`
- `Document`

## Example

```ts
import {
  MarkdownHeaderTextSplitter,
  MarkdownTextSplitter,
} from "markdown-text-splitter";

const markdown = `# Title

## Intro
Hello world

## Details
More text`;

const recursive = new MarkdownTextSplitter({ chunkSize: 40 });
const chunks = recursive.splitText(markdown);

const byHeader = new MarkdownHeaderTextSplitter([
  ["#", "h1"],
  ["##", "h2"],
]);

const docs = byHeader.splitText(markdown);
```
