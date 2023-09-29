import {
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	Plugin,
	TAbstractFile,
	TFile
} from "obsidian";

import {
	EditorState,
	Transaction,
	StateField,
	RangeSetBuilder
} from "@codemirror/state";

import {
	syntaxTree
} from "@codemirror/language";

import {
	Decoration,
	DecorationSet,
	EditorView,
	PluginSpec,
	PluginValue,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from "@codemirror/view";


class Checkbox extends MarkdownRenderChild {
	checked: boolean;
	id: number;
	onclick: () => void;
	constructor(containerEl: HTMLElement, id: number, checked: boolean, onclick: () => void) {
		super(containerEl);
		this.checked = checked;
		this.id = id;
		this.onclick = onclick;
	}

	onload() {
		const input = createEl("input");
		input.type = "checkbox";
		input.checked = this.checked;
		input.onclick = this.onclick;
		input.classList.add(CLASS_NAME);
		input.dataset.cp_checkbox_id = this.id.toString();
		this.containerEl.textContent = "";
		this.containerEl.appendChild(input);
	}
}

const CLASS_NAME = "cp-checkbox";
const REGEXP_CHECKBOX = /- \[(?<check>[ x])\]/g
const REGEXP_ANNOTATION = /\{(?<id>[0-9]+)\}/g
const REGEXP_CELL_START = /\| /;
const REGEXP_UNANNOTATED = new RegExp(REGEXP_CHECKBOX.source + " ");
const REGEXP_ANNOTATED = new RegExp(REGEXP_CHECKBOX.source + REGEXP_ANNOTATION.source + " ");
const REGEXP_UNANNOTATED_CELL = new RegExp(REGEXP_CELL_START.source + REGEXP_UNANNOTATED.source);
const REGEXP_ANNOTATED_CELL = new RegExp(REGEXP_CELL_START.source + REGEXP_ANNOTATED.source);

class CheckboxWidget extends WidgetType {
	checked: boolean;
	id: number;
	onclick: () => void;
	constructor(id: number, checked: boolean, onclick: () => void) {
		super();
		this.id = id;
		this.checked = checked;
		this.onclick = onclick;
	}

	toDOM() {
		const input = document.createElement("input");
		input.type = "checkbox";
		input.checked = this.checked;
		input.onclick = this.onclick;
		input.classList.add(CLASS_NAME);
		return input;
	}
}

class VP implements PluginValue {
	checkboxes: Array<{ position: number, checked: boolean }> = [];
	decorations: DecorationSet;
	view: EditorView;
	constructor(view: EditorView) {
		this.decorations = this.buildDecorations(view);
		this.view = view;
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = this.buildDecorations(update.view);
		}
	}

	buildDecorations(view: EditorView) {
		const builder = new RangeSetBuilder<Decoration>();

		for (let { from, to } of view.visibleRanges) {
			syntaxTree(view.state).iterate({
				from,
				to,
				enter(node) {
					// console.log(node.type.name);
					if (node.type.name.startsWith("formatting_formatting-link_hmd-barelink_link")) {
						// Position of the '-' or the '*'.
						const start_idx = Math.max(0, node.from - 4);
						const end_idx = Math.min(view.state.doc.length - 1, node.to + 4);
						const text = view.state.sliceDoc(start_idx, end_idx);
						const result = text.match(REGEXP_ANNOTATED);
						if (!result) {
							return;
						}

						builder.add(
							start_idx,
							end_idx,
							Decoration.replace({
								widget: new CheckboxWidget(
									parseInt(result.groups!.id),
									result.groups!.check === "x",
									() => {
										console.log("clicked");
									}
								),
							})
						);
					}
				},
			});
		}

		return builder.finish();
	}
}

function enumerate(doc: string): string {
	let id = 0;
	return doc.replaceAll(
		new RegExp(REGEXP_ANNOTATED_CELL.source, "g"),
		match => match.trimEnd().replace(REGEXP_ANNOTATION, "") + "{" + id++ + "} "
	).replaceAll(
		new RegExp(REGEXP_UNANNOTATED_CELL, "g"),
		match => match.trimEnd() + "{" + id++ + "} "
	);
}

export default class CheckPlease extends Plugin {
	onload() {
		this.registerEditorExtension([ViewPlugin.fromClass(
			VP,
			{ decorations: (value: VP) => value.decorations }
		)]);
		// this.registerMarkdownPostProcessor(this.postProcessMarkdown.bind(this));

		this.registerEvent(
			this.app.vault.on(
				"modify",
				(file: TFile) => {
					this.app.vault.process(file, doc => enumerate(doc))
				}
			)
		);
	}

	postProcessMarkdown(element: HTMLElement, context: MarkdownPostProcessorContext) {
		element.querySelectorAll("td").forEach(
			(td: HTMLTableCellElement) => {
				const text = td.textContent || "";
				const result = text.match("^" + REGEXP_ANNOTATED_CELL);
				if (!result) {
					return;
				}

				context.addChild(
					new Checkbox(
						td,
						parseInt(result.groups!.id),
						result.groups!.check === "x"
					)
				);
			}
		);
	}
}