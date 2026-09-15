import type { Element, Root } from "hast";
import { select } from "hast-util-select";
import { visit } from "unist-util-visit";

export default () => (tree: Root) => {
	const ol = select(".footnotes > ol", tree);

	if (!ol) return;
	visit(tree, "element", (node) => {
		const a = node.children.find(
			(el): el is Element =>
				el.type === "element" && el.properties.dataFootnoteRef != null,
		);
		if (!a) return;
		const { children } =
			ol.children
				.find(
					(n): n is Element =>
						n.type === "element" &&
						n.properties.id === a.properties.href?.slice(1),
				)
				?.children.find(
					(n): n is Element => n.type === "element" && n.tagName === "p",
				) ?? {};

		if (!children) return;
		node.children.push({
			type: "element",
			children: [
				{
					type: "element",
					children: [],
					properties: { className: ["note-hover-area"] },
					tagName: "div",
				},
				{
					type: "element",
					children: [],
					properties: { className: ["note-tooltip"] },
					tagName: "div",
				},
				{ type: "element", children, properties: {}, tagName: "span" },
			],
			tagName: "div",
			properties: { className: ["note-popup"] },
		});
	});
};
