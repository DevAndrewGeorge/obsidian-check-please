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
	constructor(containerEl: HTMLElement, checked: boolean) {
		super(containerEl);
		this.checked = checked;
	}

	onload() {
		const input = createEl("input");
		input.type = "checkbox";
		input.checked = this.checked;
		input.classList.add(CLASS_NAME);
		this.containerEl.textContent = "";
		this.containerEl.appendChild(input);
	}
}

const CLASS_NAME = "cp-checkbox";
const TEXT_CHECKED = "- [x]";
const TEXT_UNCHECKED = "- [ ]";
const MARKDOWN_CHECKED = `| ${TEXT_CHECKED} `;
const MARKDOWN_UNCHECKED = `| ${TEXT_UNCHECKED} `;

class VP implements PluginValue {
	update(update: ViewUpdate) {
		console.log(update);
	}
}

export default class CheckPlease extends Plugin {
	onload() {
		this.registerEditorExtension([ViewPlugin.fromClass(VP)]);
		this.registerMarkdownPostProcessor(this.postProcessMarkdown.bind(this));
	}

	postProcessMarkdown(element: HTMLElement, context: MarkdownPostProcessorContext) {
		element.querySelectorAll("td").forEach(
			(td: HTMLTableCellElement) => {
				const text = td.textContent || "";
				if (!text.startsWith(TEXT_CHECKED) && !text.startsWith(TEXT_UNCHECKED)) {
					return;
				}

				const checked = text.startsWith(TEXT_CHECKED);
				context.addChild(new Checkbox(td, checked));
			}
		);
	}
}