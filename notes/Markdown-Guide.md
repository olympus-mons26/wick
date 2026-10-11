# Markdown Guide

Write plain text with Markdown marks to add structure and formatting. Wick renders the result in the live preview.

## Headings

Start a line with one to six `#` characters. More characters make a smaller heading.

```md
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
```

## Paragraphs and line breaks

Write a paragraph as one or more consecutive lines. Leave a blank line to start a new paragraph.

```md
This is the first paragraph.
It can continue on another line.

This is a second paragraph.
```

## Emphasis

```md
*italic*
**bold**
***bold and italic***
~~strikethrough~~
==highlight==
`inline code`
<u>underline</u>
```

## Lists

Use `-`, `*`, or `+` for bullets. Start ordered items with a number and a period.

```md
- First bullet
- Second bullet

1. First step
2. Second step
```

For task lists, use `[ ]` for an unchecked item and `[x]` for a checked item.

```md
- [ ] To do
- [x] Done
```

## Block quotes

Start a line with `>` to make a quote.

```md
> This is a quoted passage.
> A quote can continue on another line.
```

## Links and images

Put the link text in square brackets and the address in parentheses.

```md
[Visit example.com](https://example.com)
![Description of image](picture.png)
```

## Code blocks

Start a line with three backtick characters, optionally followed by a language label such as `js`. Put another line of three backtick characters after the code to close the block.

## Horizontal rules

Put three or more hyphens, asterisks, or underscores on a line by themselves.

```md
---
```

## Tables

Separate cells with `|`. The row of hyphens separates the headings from the table contents.

```md
| Syntax | Meaning |
| --- | --- |
| `#` | Heading |
| `**text**` | Bold text |
```
