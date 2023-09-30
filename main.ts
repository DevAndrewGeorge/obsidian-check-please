import {
	Editor,
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	Plugin,
	TFile,
	MarkdownView,
	EditorChange
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
	static checkbox_checked = "- [x]";
	static checkbox_unchecked = "- [ ]";
	static regex_checkbox = /- \[(?<check>[ x])\]/g;
	
	static regex_annotation = /\{(?<id>[0-9]+)\}/g;
	
	static regex_checkbox_annotated = new RegExp(
		// there should be no unannotated cells in html 
		Regexer.regex_checkbox.source +
		Regexer.regex_annotation.source +
		"($| .*)"
	);

	static regex_markdown_cell_start = /\| */;

	static regex_post_checkbox = /( +|\||$)/;
	static regex_markdown_cell = new RegExp(
		Regexer.regex_markdown_cell_start.source +
		Regexer.regex_checkbox.source +
		"(" + Regexer.regex_annotation.source + ")?" +
		this.regex_post_checkbox.source
		
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
			`\\{${state_new.id}\\}` +
			Regexer.regex_post_checkbox.source
		);

		return document.replace(regex, match => {
			return match.replace(
				Regexer.regex_checkbox,
				state_new.checked ? Regexer.checkbox_checked : Regexer.checkbox_unchecked
			);
		});

	}
}

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
		if (update.docChanged || update.viewportChanged || update.selectionSet) {
			this.decorations = this.buildDecorations(update.view);
		}
	}

	static annotateCheckboxes(editor: Editor, view: EditorView) {
		let id = 0;
		const changes: EditorChange[] = [];

		syntaxTree(view.state).iterate({
			from: 0,
			enter(node) {
				// nothing to do if we're not in a table
				if (!node.type.name.startsWith("hmd-table-sep_hmd-table-sep-")) {
					return;
				}

				const candidate = view.state.doc.slice(node.from).iterLines().next().value;


				const result = candidate.match(new RegExp(`^${Regexer.regex_markdown_cell.source}`));

				// no checkbox to annotate
				if (!result) {
					return;
				}

				// no change needed if the existing annotation is already correct
				if (result.groups!.id === id.toString()) { 
					id++;
					return;
				}

				const annotation_start_idx = node.from + candidate.indexOf("-") + Regexer.checkbox_checked.length;
				const annotation_text = `{${id++}}`;

				changes.push({
					from: editor.offsetToPos(
						annotation_start_idx
					),
					to: editor.offsetToPos(
						// +1 to include the closing "}" since the "to" value is exclusive
						result.groups!.id ? node.from + candidate.indexOf("}") + 1 : annotation_start_idx
					),
					text: annotation_text
				});	
			}
		});

		editor.transaction({
			changes: changes
		});
	}

	buildDecorations(view: EditorView) {
		const builder = new RangeSetBuilder<Decoration>();
		for (let { from, to } of view.visibleRanges) {
			syntaxTree(view.state).iterate({
				from,
				to,
				enter(node) {
					if (node.type.name.startsWith("hmd-table-sep_hmd-table-sep-")) {
						// TODO: we're assuming all table rows are a single line, is this true?
						let candidate = view.state.doc.slice(node.from).iterLines().next().value;

						const result = candidate.match(new RegExp(`^${Regexer.regex_markdown_cell.source}`));

						// we don't continue if there's no annotated checkbox to decorate
						if (!result || result.groups!.id === undefined) { 
							return;
						}

						const start_idx = node.from + candidate.indexOf("-"); // inclusive location of -
						const end_idx = node.from + candidate.indexOf("}") + 1; // +1 to include the closing "}" since the ending index is exclusive

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

export default class CheckPlease extends Plugin {
	onload() {
		this.registerEditorExtension([
			ViewPlugin.fromClass(
				CheckPleaseViewPlugin,
				{
					decorations: (value: CheckPleaseViewPlugin) => value.decorations
				}
			)
		]);

		this.registerEvent(
			this.app.workspace.on(
				"file-open",
				(file: TFile) => {
					// do nothing if not editing a markdown file
					if (!file || file.extension !== "md") {
						return;
					}

					const editor = this.app.workspace.activeEditor?.editor;
					if (!editor) {
						return;
					}

					// @ts-expect-error, not typed
					const cm = editor.cm as EditorView;
					CheckPleaseViewPlugin.annotateCheckboxes(
						editor,
						cm
					);

					// TODO: this is a hack because editor changes aren't persisted to file
					this.app.vault.process(
						file,
						(_: string) => cm.state.doc.toString()
					);
				}
			)
		)
		this.registerEvent(
			this.app.workspace.on(
				"editor-change",
				(_: Editor, info: MarkdownView) => {
					CheckPleaseViewPlugin.annotateCheckboxes(
						info.editor,
						// @ts-expect-error, not typed
						info.editor.cm as EditorView
					);
				}
			)		
		);


		this.registerMarkdownPostProcessor(
			this.postProcessMarkdown.bind(this)
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