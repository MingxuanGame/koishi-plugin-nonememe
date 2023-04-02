import { Context, Schema, Time, h } from "koishi";
import {} from "@koishijs/cache";
import { AxiosError } from "axios";
import { fileTypeFromBuffer } from "file-type";

export const name = "nonememe";
export const using = ["cache"] as const;

export interface Config {
  PAT: string;
}

declare module "@koishijs/cache" {
  interface Tables {
    nonememe: string[];
  }
}

const MEME_CACHE_KEY = "nonememe_memes";
const ART_CACHE_KEY = "nonememe_arts";

export const Config: Schema<Config> = Schema.object({
  PAT: Schema.string().required().description("GitHub PAT"),
});

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger("nonememe");
  const cache = ctx.cache("nonememe");

  let username = "";
  let email = "";
  ctx
    .command("nonememe", "NoneBot 梗(nonememe.icu)")
    .alias("nbmeme")
    .alias("nb梗图")
    .action(({ session }) => session.execute("help nonememe"));

  ctx
    .command("nonememe.search <name:string>", "查询 NoneBot 梗图")
    .example("nonememe.search 谁有时间读你们这破文档")
    .alias("find")
    .alias("查梗")
    .action(async ({ session }, name) => {
      try {
        logger.debug(`Name: ${name}`);
        const memes = await getMemes();
        const result: string[] = memes.filter((meme) =>
          meme.toLowerCase().includes(name.toLowerCase()),
        );
        logger.debug(`Found ${result}.`);

        if (result.length === 0) {
          await session.send(`未搜索到梗图：${name}`);
        } else if (result.length === 1) {
          await session.send(makeMemeMessage(result[0]));
        } else {
          await session.send(
            <message forward>
              {makeMemeMessages(session.selfId, result.slice(0, 5))}
            </message>,
          );
        }
      } catch (err) {
        await session.send(`ERR：${(err as Error).message}`);
      }
    });

  ctx
    .command("nonememe.upload <name:string> <img>", "上传 NoneBot 梗图")
    .example(
      "nonememe.upload 叛变 <image url='https://raw.githubusercontent.com/NoneMeme/NoneMeme/main/meme/叛变.png'/>",
    )
    .alias("add")
    .alias("push")
    .alias("入典")
    .action(async ({ session }, name, img) => {
      try {
        let img_dom: string;
        if (img === undefined && session.quote === undefined) {
          logger.debug("No image.");
          // no image
          return;
        } else if (img !== undefined) {
          logger.debug("Find image from message.");
          img_dom = img;
        } else {
          logger.debug("Find image from reply.");
          img_dom = session.quote.content;
        }

        try {
          h.parse(img_dom);
        } catch (err) {
          // can't parse
          logger.debug(`Cannot parse image \`${img_dom}\``);
          return;
        }
        const images = h.parse(img);
        const image = images[0];
        if (image.type !== "image") {
          return;
        }
        const url = image.attrs.url;
        logger.info(`Downloading ${url}`);
        const data: Buffer = await ctx.http.get(url, {
          responseType: "arraybuffer",
        });

        const type = await fileTypeFromBuffer(data);
        logger.info(`Image MIME: ${type.mime}`);
        const sha = await uploadMeme(config.PAT, `${name}.${type.ext}`, data);
        await session.send(`[${sha}] 上传成功`);
      } catch (err) {
        await session.send(`ERR：${(err as Error).message}`);
      }
    });

  function makeMemeMessages(selfId: string, memes: string[]) {
    const messages = [];
    let meme: string;
    for (meme of memes) {
      messages.push(
        <message>
          <author
            user-id={selfId}
            nickname="NoneMeme"
            avatar="https://ghproxy.com/https://raw.githubusercontent.com/NoneMeme/NoneMeme/main/static/favicon.png"
          />
          {makeMemeMessage(meme)}
        </message>,
      );
    }
    return messages;
  }
  function makeMemeMessage(meme: string) {
    return (
      <message>
        {/* https://github.com/NoneMeme/NoneMeme/blob/main/static/scripts/index.js#L126 */}
        <p>{meme.replace(/\.(jpg|png|jfif|webp|gif)/, "")}</p>
        <image
          url={`https://ghproxy.com/https://raw.githubusercontent.com/NoneMeme/NoneMeme/main/meme/${meme}`}
        />

        {/* {encodeURI(`https://nonememe.icu/#${meme}`)} */}
      </message>
    );
  }

  async function getMemes(mode: "meme" | "art" = "meme"): Promise<string[]> {
    const key = mode === "meme" ? MEME_CACHE_KEY : ART_CACHE_KEY;
    if (cache) {
      const memes = await cache.get(key);
      if (memes) {
        return memes;
      }
    }
    const memes = await fetchMemes(config.PAT, mode);
    logger.info(`Fetched ${memes.length} ${mode}(s).`);
    if (cache) {
      await cache.set(key, memes, Time.minute * 10);
    }
    return memes;
  }
  async function fetchMemes(
    PAT: string,
    mode: "meme" | "art" = "meme",
  ): Promise<string[]> {
    const name = mode === "meme" ? "图片梗" : "文字梗";
    try {
      const memes = await ctx.http.get(
        `https://api.github.com/repos/NoneMeme/NoneMeme/contents/${mode}`,
        {
          headers: {
            Authorization: `token ${PAT}`,
            "Content-Type": "application/json",
          },
        },
      );
      return memes.map((meme) => meme.name);
    } catch (err) {
      if (err instanceof AxiosError) {
        switch (err.response.status) {
          case 401:
            throw new Error("PAT 无效");
          case 404:
            throw new Error("文件夹未找到，可能为仓库更新");
        }
      }
      logger.error(`获取${name}出现错误`);
      logger.error(err);
      throw new Error(`获取${name}出现错误`);
    }
  }
  async function uploadMeme(
    PAT: string,
    name: string,
    image: Buffer,
  ): Promise<string> {
    if (!email || !username) {
      try {
        // get the primary email address
        const emails = await ctx.http.get(
          "https://api.github.com/user/emails",
          {
            headers: {
              Authorization: `token ${PAT}`,
              "Content-Type": "application/json",
            },
          },
        );

        const emailObject = emails.filter((email) => email.primary)[0];
        email = emailObject.email;
        logger.info(`Email: ${email}`);
      } catch (err) {
        if (err instanceof AxiosError) {
          switch (err.response.status) {
            case 401:
              throw new Error("PAT 无效");
            case 403:
              throw new Error(
                "此 PAT 无权访问邮箱信息，请检查此 PAT 是否拥有 user:email 权限",
              );
          }
        }
        logger.error("获取当前 GitHub 账号的邮箱时出现错误");
        logger.error(err);
        throw new Error("获取当前 GitHub 账号的邮箱时出现错误");
      }

      // get the user name
      const user = await ctx.http.get("https://api.github.com/user", {
        headers: {
          Authorization: `token ${PAT}`,
          "Content-Type": "application/json",
        },
      });
      username = user.login;
      logger.info(`Username: ${username}`);
    }

    logger.info(`Uploading ${name} to NoneMeme...`);
    try {
      const resp = await ctx.http.put(
        `https://api.github.com/repos/NoneMeme/NoneMeme/contents/meme/${name}`,
        {
          message: `[nonememe bot] uploaded ${name}`,
          content: image.toString("base64"),
          committer: {
            name: username,
            email: email,
          },
        },
        {
          headers: {
            Authorization: `token ${PAT}`,
            "Content-Type": "application/json",
          },
        },
      );
      logger.success("Upload succeeded.");
      return resp.commit.sha.slice(0, 7);
    } catch (err) {
      if (err instanceof AxiosError) {
        console.log(err.response.status);
        switch (err.response.status) {
          case 401:
            throw new Error("PAT 无效");
          case 422:
            throw new Error("文件已存在");
        }
        logger.error("上传图片时发生错误");
        logger.error(err);
        throw new Error("上传图片时发生错误");
      }
    }
  }
}
