import jsdom from "jsdom";
const { JSDOM } = jsdom;
import Showdown from "showdown";
const converter = new Showdown.Converter();
import { Page } from "puppeteer-core";
import githubMarkdownCss from "generate-github-markdown-css";

// source: src/static/style.css
const CSS = `
img {
  width: 20%;
}

#view {
  text-align: left;
}

#view > div {
  display: flex;
  justify-content: space-between;
}

#view a {
  color: var(--h3-color);
  text-decoration: none;
  cursor: default;
}

#view img {
  max-height: 70vh;
}

#gallery {
  display: flex;
  align-items: flex-start;
}

.column {
  margin-right: 10px;
  width: 33%;
}

.item {
  margin: 10px 0;
  padding: 50px 20px;
  animation: 1s fadeInUp;
}

.item a {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

article.item > a > span {
  color: var(--h3-color);
  font-size: 15px;
  text-align: center;
  background: var(--muted-border-color);
  border-bottom-right-radius: 5px;
  border-bottom-left-radius: 5px;
}

footer {
  text-align: center;
}

@keyframes fadeInUp {
  0% {
      opacity: 0;
      transform: translateY(50px);
  }
  100% {
      opacity: 1;
      transform: translateY(0);
  }
}

.generator {
  color: #41546296;
}
`;

function markdown2HTML(markdown: string): string {
  const html = converter.makeHtml(markdown);
  const { document } = new JSDOM(html).window;
  let img: HTMLImageElement;
  for (img of document.images) {
    img.src =
      "https://ghproxy.com/https://raw.githubusercontent.com/NoneMeme/NoneMeme/main" +
      img.src;
  }
  return document.body.innerHTML;
}

function makeHTML(content: string): string {
  // source: src/static/index.html
  return `
  <html lang="zh">
    <head>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@picocss/pico@1.5.0/css/pico.min.css"
      />
      <link rel="stylesheet" href="./style.css" />
      <style>${CSS}</style>
      <style>
        ${githubMarkdownCss({
          light: "light",
          dark: "dark",
          rootSelector: ".markdown",
        })}
      </style>
    </head>
    <body>
    <main class="container">
    <article id="view" class="markdown">
      ${content}
    </article>
        <footer id="footer">
          <p class="generator">generated by koishi-plugin-nonememe</p>
        </footer>
      </main>
    </body>
  </html>
  `;
}

async function render(page: Page, content: string): Promise<Buffer> {
  await page.setContent(content);
  const result = await page.screenshot({
    fullPage: true,
  });
  await page.close();
  return result;
}

export { makeHTML, markdown2HTML, render };
