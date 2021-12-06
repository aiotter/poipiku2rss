import { Application, Router } from "https://deno.land/x/oak@v10.0.0/mod.ts";
import { Feed } from "https://jspm.dev/feed";
import {
  DOMParser,
  Element,
  HTMLDocument,
} from "https://deno.land/x/deno_dom@v0.1.13-alpha/deno-dom-wasm.ts";

const app = new Application();
const router = new Router();

router.get("/:ids", async (ctx) => {
  const ids = ctx.params.ids.split(",");
  const items = await Promise.all(ids.map(async (id) => {
    const response = await fetch(`https://poipiku.com/${id}/`);
    const html = await response.text();
    const document = new DOMParser()
      .parseFromString(html, "text/html") as HTMLDocument;

    return Array.from(
      document.querySelectorAll?.("#IllustThumbList .IllustThumb"),
    )
      .map(
        // FIXME: querySelectorAll actually returns a NodeList which contains Elements.
        // However, deno-dom assumes that the return type is Node.
        // Needs upstream bug fix.
        (node) => {
          const element = node as Element;
          const title = element.querySelector(".IllustInfoDesc")?.innerHTML;
          const link = "https://poipiku.com" +
            element.querySelector("a.IllustInfo")?.attributes.href as string;
          const description = title;
          const category = Array.from(element.querySelectorAll(".CategoryInfo"))
            .map(
              (node) => {
                const element = node as Element;
                const name = element.querySelector(".Category")?.innerHTML;
                const domain = "https://poipiku.com" + element.attributes.href;
                return { name, domain };
              },
            );
          const authorId = element.querySelector(".IllustUser")?.attributes
            .href.match(/[0-9]+/g)?.pop() ?? "nobody";
          const author = [{
            email: authorId + "@example.com",
            name: element.querySelector(".IllustUserName")?.innerHTML,
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
    Number(secondEl.link.split("/").pop()?.replace(".html", "")) -
    Number(firstEl.link.split("/").pop()?.replace(".html", ""))
  ).forEach(feed.addItem);
  ctx.response.body = feed.rss2();
  ctx.response.headers.set("Content-Type", "application/rss+xml");
});

app.use(router.routes());
app.use(router.allowedMethods());
await app.listen({ port: 8000 });
