# Check, please!

`Check, please!` is an [Obsidian](https://obsidian.md) plugin that adds support for stateful, in-table checkboxes.

## usage
Simply add a Markdown checkbox (`- [ ]`) at the beginning of your table cell while in Edit Mode. Be sure not to remove the annotation applied (i.e. `{0}`) to in-table checkboxes.

A simple example:
```markdown
| Item | Packed? | Comments |
|---|---|---|
| Backpack |- [x]| Osprey Skarab 30L |
```

A video example:
![Video preview of plugin. Shows how to create a checkbox and how to interact with it.](./demo.gif)

## how it works
When you open or edit a Markdown file, `Check, Please!` does the following:
- Finds all checkboxes present in table cells.
- "Annotates" these checkboxes with a unique identifier. An annotated cell will appear in your Markdown as `- [ ]{0}` with `{0}` being the full annotation and `0` being its unique identifier.
- Whenever the checkbox is toggled (in both Edit and Reading mode), the Markdown is updated to reflect the checkbox's new state by using an `onClick` event listener.

## limitations and wonky behavior
### current limitations
- Only one checkbox per table cell is supported.
- The checkbox **MUST** occur at the beginning of your Markdown table cell.

### wonky behavior: phantom table rows
In Edit mode, every line of the following is interpreted as a table row:
```
| Item | Packed? | Comments |
|---|---|---|
| Backpack | - [x]{0} | Osprey Skarab 30L |
| Tent | - [ ]{1}
| - [ ]{2}
```

However, the last line (`| - [ ] `) in Reading mode appears as a normal paragraph. So while this plugin will present you a checkbox in Edit mode, Reading mode will show the literal text of `| - [ ]{2}`. This is caused by how Obsidian parses tables rather than an issue with this plugin. You can avoid this behavior by ending all table rows with the pipe character `|`.

## syntax decisions
As with a number of Obsidian plugins, there is a tradeoff between portability of Markdown files and usefulness in Obsidian. `Check, Please!` also must tow this line.

First, the syntax for declaring a checkbox within a table is very similar to declaring a normal Markdown checkbox, but an in-table checkbox does not need to fully match the format of a normal Markdown checkbox which is normally declared by writing `- [ ] `; notably, there must be a space after the closing bracket `]`. However, this space becomes visible when Obsidian presents a table in Reading mode, so `Check, Please!` makes that space optional for formatting reasons if the content of the cell is only a checkbox.

Additionally, Obsidian does not seem to provide API functionality needed by this plugin to meaningfully communicate state between Edit and Reading mode. For this reason, this plugin annotates within the Markdown each in-table checkbox with a unique identifier. When it makes sense to, this plugin obscures the source Markdown (annotation and all) in Edit mode through the use of decorations.

Ultimately, `Check, Please!` extends the Markdown specification to provide some functionality in Obsidian, so this plugin is Obsidian-first, but this plugin allows for _some_ portability. Mainly, when previewed elsewhere, tables cells with checkboxes will appear as `- [ ]{1234}` (unchecked) or `- [x]{5678}` (checked). While this isn't the cleanest presentation, at least it is still identifiable as checked or not.

