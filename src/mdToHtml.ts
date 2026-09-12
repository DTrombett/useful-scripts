import githubMarkdownCss from "generate-github-markdown-css";
import { readFile, writeFile } from "node:fs/promises";
import { join, parse } from "node:path";
import { argv, stdin, stdout } from "node:process";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeDocument from "rehype-document";
import rehypeExternalLinks from "rehype-external-links";
import rehypeFigure from "rehype-figure";
import rehypeMathjax from "rehype-mathjax";
import rehypePreventFaviconRequest from "rehype-prevent-favicon-request";
import rehypeSlug from "rehype-slug";
import rehypeStarryNight from "rehype-starry-night";
import rehypeStringify from "rehype-stringify";
import remarkEmbedImages from "remark-embed-images";
import remarkEmoji from "remark-gemoji";
import remarkGfm from "remark-gfm";
import remarkGithub from "remark-github";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { read } from "to-vfile";
import { unified } from "unified";

stdin.unref();
const file = await unified()
	.use(remarkParse)
	.use(remarkEmbedImages)
	.use(remarkEmoji)
	.use(remarkMath)
	.use(remarkGfm, {})
	.use(remarkGithub)
	.use(remarkRehype, {
		allowDangerousHtml: true,
		clobberPrefix: "",
	})
	.use(rehypeExternalLinks, {
		target: "_blank",
		rel: ["noopener", "noreferrer", "nofollow"],
	})
	.use(rehypeMathjax)
	.use(rehypeSlug)
	.use(rehypeAutolinkHeadings, {
		behavior: "append",
		headingProperties: (element) => ({
			className: ["heading-element"].concat(element.properties.className ?? []),
		}),
		properties: (element) => ({
			className: ["anchor"].concat(element.properties.className ?? []),
		}),
		content: () => ({
			type: "element",
			tagName: "span",
			properties: {
				className: ["octicon", "octicon-link"],
			},
			children: [],
		}),
	})
	.use(rehypeStarryNight)
	.use(rehypeFigure)
	.use(rehypeDocument, {
		style: (
			await Promise.all([
				githubMarkdownCss({ rootSelector: "body" }),
				readFile("node_modules/@wooorm/starry-night/style/both.css", "utf-8"),
				readFile("src/mdToHtml.css", "utf-8"),
			])
		).join("\n"),
	})
	.use(rehypePreventFaviconRequest)
	.use(rehypeStringify, { collapseEmptyAttributes: true })
	.process(await read(argv[0]));

if (argv[1]) stdout.write(file.toString());
else
	await writeFile(
		argv[1] || join(argv[0], "..", parse(argv[0]).name + ".html"),
		file.toString(),
	);
