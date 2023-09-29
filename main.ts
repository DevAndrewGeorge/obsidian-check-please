import {
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	Plugin,
	TFile
} from "obsidian";

import {
	RangeSetBuilder
} from "@codemirror/state";

import {
	syntaxTree
} from "@codemirror/language";

import {
	Decoration,
	DecorationSet,
	EditorView,
	PluginValue,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from "@codemirror/view";

type CheckboxState = {
	id: number,
	checked: boolean
}

type CheckboxCallback = (state: CheckboxState) => void;

// TODO: remove contstants
class Checkbox extends MarkdownRenderChild {
	state: CheckboxState;
	onclick: CheckboxCallback;
	constructor(containerEl: HTMLElement, state: CheckboxState, onclick: CheckboxCallback) {
		super(containerEl);
		this.state = state;
		this.onclick = onclick;
	}

	onload() {
		// wrapper element to container checkbox followed by remaining content
		const span_container = createEl("span");

		// checkbox
		const input = createEl("input");
		input.type = "checkbox";
		input.checked = this.state.checked;
		input.classList.add(CLASS_NAME);
		input.dataset.cp_id = this.state.id.toString();
		input.onclick = () => this.onclick({checked: input.checked, id: this.state.id});

		// remaining content
		const span_inner = createEl("span");
		span_inner.textContent = Regexer.removeCheckboxFromHtmlContent(this.containerEl.textContent || "");

		// apply new content
		span_container.appendChild(input);
		span_container.appendChild(span_inner);
		this.containerEl.textContent = "";
		this.containerEl.appendChild(span_container);
	}
}


const CLASS_NAME = "cp-checkbox";

// TODO: turn all regex into class
class Regexer {
	static regex_checkbox = /- \[(?<check>[ x])\]/g;
	
	static regex_annotation = /\{(?<id>[0-9]+)\}/g;
	
	static regex_checkbox_annotated = new RegExp(
		// there should be no unannotated cells in html 
		Regexer.regex_checkbox.source + Regexer.regex_annotation.source + " ?"
	);

	static regex_markdown_cell_start = /\| /;
	
	static regex_markdown_cell_unannotated = new RegExp(
		Regexer.regex_markdown_cell_start.source + Regexer.regex_checkbox.source + " "
	);
	static regex_markdown_cell_annotated = new RegExp(
		Regexer.regex_markdown_cell_start.source + Regexer.regex_checkbox.source + Regexer.regex_annotation.source + " "
	);
	
	static parseAnnoatedCheckbox(content: string): CheckboxState | null {
		const result = content.match(
			new RegExp("^" + Regexer.regex_checkbox_annotated.source)
		);

		if (!result) {
			return null;
		}

		return {
			id: parseInt(result.groups!.id),
			checked: result.groups!.check === "x"
		};
	}

	static removeCheckboxFromHtmlContent(content: string): string {
		return content.replace(
			new RegExp("^" + Regexer.regex_checkbox_annotated.source),
			""
		);
	}

	static updateCheckboxInMarkdownContent(document: string, state_new: CheckboxState): string {
		const regex = new RegExp(
			Regexer.regex_markdown_cell_start.source +
			Regexer.regex_checkbox.source +
			`\{${state_new.id}\} `
		);

		return document.replace(regex, match => {
			return match.replace(
				Regexer.regex_checkbox,
				state_new.checked ? "- [x]" : "- [ ]"
			);
		});

	}
}
const REGEXP_CHECKBOX = /- \[(?<check>[ x])\]/g
const REGEXP_ANNOTATION = /\{(?<id>[0-9]+)\}/g
const REGEXP_CELL_START = /\| /;
const REGEXP_UNANNOTATED = new RegExp(REGEXP_CHECKBOX.source + " ");
const REGEXP_ANNOTATED = new RegExp(REGEXP_CHECKBOX.source + REGEXP_ANNOTATION.source + " ");
const REGEXP_UNANNOTATED_CELL = new RegExp(REGEXP_CELL_START.source + REGEXP_UNANNOTATED.source);
const REGEXP_ANNOTATED_CELL = new RegExp(REGEXP_CELL_START.source + REGEXP_ANNOTATED.source);

// TODO: find a way to merge with Checkbox
class CheckboxWidget extends WidgetType {
	state: CheckboxState;
	onclick: CheckboxCallback;
	constructor(state: CheckboxState, onclick: CheckboxCallback) {
		super();
		this.state = state;
		this.onclick = onclick;
	}

	toDOM() {
		const input = document.createElement("input");
		input.type = "checkbox";
		input.checked = this.state.checked;
		input.classList.add(CLASS_NAME);
		input.onclick = () => this.onclick({checked: input.checked, id: this.state.id});
		return input;
	}
}

class CheckPleaseViewPlugin implements PluginValue {
	checkboxes: Array<{ position: number, checked: boolean }> = [];
	decorations: DecorationSet;
	view: EditorView;
	constructor(view: EditorView) {
		this.decorations = this.buildDecorations(view);
		this.view = view;
	}

	update(update: ViewUpdate) {
		this.decorations = this.buildDecorations(update.view);	
		if (update.docChanged || update.viewportChanged) {
			
		}
	}

	annotateCheckboxes() {
	}

	buildDecorations(view: EditorView) {
		const builder = new RangeSetBuilder<Decoration>();
		for (let { from, to } of view.visibleRanges) {
			syntaxTree(view.state).iterate({
				from,
				to,
				enter(node) {
					// console.log(node.type.name)
					if (node.type.name.startsWith("hmd-table-sep_hmd-table-sep-")) {
						// TODO: we're assuming all table rows are a single line, is this true?
						const candidate = view.state.doc.slice(node.from).iterLines().next().value;
						const result = candidate.match(
							new RegExp(`^${Regexer.regex_markdown_cell_annotated.source}`)
						);

						console.log(result);
						// we do continue if there's no annotated checkbox to decorate
						if (!result) { 
							return;
						}

						const start_idx = node.from + 2; // inclusive location of -
						const end_idx = node.from + candidate.indexOf("}") + 1; // exclusive location of }

						console.log(start_idx, end_idx);
						// do not add decoration if cursor/selection overlaps the annotated checkbox
						if (!(start_idx > view.state.selection.main.to || end_idx < view.state.selection.main.from)) {
							return;
						}

						builder.add(
							start_idx,
							end_idx,
							Decoration.replace({
								widget: new CheckboxWidget(
									{ id: parseInt(result.groups!.id), checked: result.groups!.check === "x" },
									(state: CheckboxState) => {
										view.dispatch(
											view.state.update({
												changes: {
													from: start_idx + 3,
													to: start_idx + 4,
													insert: state.checked ? "x" : " "
												}
											})
										);
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
		this.registerEditorExtension([
			ViewPlugin.fromClass(
				CheckPleaseViewPlugin,
				{ decorations: (value: CheckPleaseViewPlugin) => value.decorations }
			)
		]);

		this.registerMarkdownPostProcessor(this.postProcessMarkdown.bind(this));

		// TODO: edit file from view plugin
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
				const checkbox = Regexer.parseAnnoatedCheckbox(td.innerText);
				if (!checkbox) {
					return;
				}

				context.addChild(
					new Checkbox(
						td,
						{ id: checkbox.id, checked: checkbox.checked },
						(state_new: CheckboxState) => {
							this.app.vault.process(
								this.app.workspace.getActiveFile()!,
								document => Regexer.updateCheckboxInMarkdownContent(document, state_new)
							)
							
						}
					)
				);
			}
		);
	}
}