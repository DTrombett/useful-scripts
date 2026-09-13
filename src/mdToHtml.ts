import { build } from "esbuild";
import generateGithubMarkdownCss from "generate-github-markdown-css";
import { writeFile } from "node:fs/promises";
import { join, parse } from "node:path";
import { argv, stdin, stdout } from "node:process";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeDocument from "rehype-document";
import rehypeExternalLinks from "rehype-external-links";
import rehypeKatex from "rehype-katex";
import rehypePreventFaviconRequest from "rehype-prevent-favicon-request";
import rehypeSlug from "rehype-slug";
import rehypeStarryNight from "rehype-starry-night";
import rehypeStringify from "rehype-stringify";
import rehypeUrls from "rehype-urls";
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
	.use(rehypeUrls, (url) => {
		if (url.pathname?.endsWith(".md") && url.hash)
			url.pathname = url.pathname.replace(/md$/, "html");
		return url;
	})
	.use(rehypeExternalLinks, {
		target: "_blank",
		rel: ["noopener", "noreferrer", "nofollow"],
	})
	.use(rehypeKatex, { trust: true })
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
	.use(rehypeDocument, {
		style: await Promise.all([
			generateGithubMarkdownCss({ rootSelector: "body" }),
			build({
				entryPoints: ["src/mdToHtml.css"],
				bundle: true,
				loader: {
					".woff": "dataurl",
					".woff2": "dataurl",
					".ttf": "dataurl",
					".otf": "dataurl",
					".eot": "dataurl",
					".png": "dataurl",
					".jpg": "dataurl",
					".svg": "dataurl",
				},
				minify: true,
				write: false,
			}).then(({ outputFiles: [{ text }] }) => text),
		]),
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
