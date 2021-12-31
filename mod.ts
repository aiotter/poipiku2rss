import { Application, Router } from "https://deno.land/x/oak@v10.1.0/mod.ts";
import { Feed } from "https://jspm.dev/feed";
import MarkdownIt from "https://esm.sh/markdown-it@12.3.0";
import {
  DOMParser,
  HTMLDocument,
} from "https://deno.land/x/deno_dom@v0.1.13-alpha/deno-dom-wasm.ts";

const app = new Application();
const router = new Router();
const markdownIt = new MarkdownIt();

router.get("/:ids", async (ctx) => {
  const ids = ctx.params.ids.split(",");
  const items = await Promise.all(ids.map(async (id) => {
    const response = await fetch(`https://poipiku.com/${id}/`);
    const html = await response.text();
    const document = new DOMParser()
      .parseFromString(html, "text/html") as HTMLDocument;

    return document.getElementById("IllustThumbList")?.getElementsByClassName(
      "IllustThumb",
    )
      .map(
        (element) => {
          const title = element.getElementsByClassName("IllustInfoDesc")[0]
            ?.innerHTML;
          const link = "https://poipiku.com" +
            element.getElementsByClassName("IllustInfo")[0]?.attributes
              .href as string;
          const description = title;
          const category = element.getElementsByClassName("CategoryInfo")
            .map(
              (element) => {
                const name = element.getElementsByClassName("Category")[0]
                  ?.innerHTML;
                const domain = "https://poipiku.com" + element.attributes.href;
                return { name, domain };
              },
            );
          const authorId =
            element.getElementsByClassName("IllustUser")[0]?.attributes
              .href.match(/[0-9]+/g)?.pop() ?? "nobody";
          const author = [{
            email: authorId + "@example.com",
            name: element.getElementsByClassName("IllustUserName")[0]
              ?.innerHTML,
          }];
          return { title, description, id: link, link, category, author };
        },
      );
  }));

  const feed = new Feed({
    title: `ユーザーID: ${ids.join(", ")} のポイピクフィード`,
    favicon: "https://poipiku.com/favicon_2.ico",
    language: "ja",
    generator: "poipiku2rss",
    id: ctx.request.url.toString(),
    link: ctx.request.url.toString(),
    updated: new Date(),
  });

  items.flat().sort((firstEl, secondEl) =>
    Number(secondEl?.link.split("/").pop()?.replace(".html", "")) -
    Number(firstEl?.link.split("/").pop()?.replace(".html", ""))
  ).forEach(feed.addItem);
  ctx.response.body = feed.rss2();
  ctx.response.headers.set("Content-Type", "application/rss+xml");
});

router.get("/", async (ctx) => {
  const response = await fetch(
    "https://raw.githubusercontent.com/aiotter/poipiku2rss/master/README.md",
  );
  const markdown = await response.text();
  ctx.response.body = markdownIt.render(markdown);
  ctx.response.type = "html";
});

app.use(router.routes());
app.use(router.allowedMethods());
await app.listen({ port: 8000 });
