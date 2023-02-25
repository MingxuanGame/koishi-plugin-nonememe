import { Context, Schema, Time } from "koishi";
import {} from "@koishijs/cache";
import { AxiosError } from "axios";

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
// const ART_CACHE_KEY = "nonememe_arts";

export const Config: Schema<Config> = Schema.object({
  PAT: Schema.string().required().description("GitHub PAT"),
});

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger("nonememe");
  const cache = ctx.cache("nonememe");

  ctx
    .command("nonememe <name:string>", "NoneBot 梗(nonememe.icu)")
    .usage("查询 NoneBot 梗图")
    .example("nonememe 谁有时间读你们这破文档")
    .alias("nbmeme")
    .alias("nb梗图")
    .action(async ({ session }, name) => {
      try {
        logger.debug(`Name: ${name}`);
        const memes = await getMemes();
        const result: string[] = memes.filter((meme) =>
          meme.toLowerCase().includes(name.toLowerCase())
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
            </message>
          );
        }
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
        </message>
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

  async function getMemes(): Promise<string[]> {
    if (cache) {
      const memes = await cache.get(MEME_CACHE_KEY);
      if (memes) {
        return memes;
      }
    }
    const memes = await fetchMemes(config.PAT);
    logger.info(`Fetched ${memes.length} meme(s).`);
    if (cache) {
      await cache.set(MEME_CACHE_KEY, memes, Time.minute * 10);
    }
    return memes;
  }

  // request
  async function fetchMemes(PAT: string): Promise<string[]> {
    try {
      const resp = await ctx.http.get(
        "https://api.github.com/repos/NoneMeme/NoneMeme/contents/meme",
        {
          headers: {
            Authorization: `token ${PAT}`,
            "Content-Type": "application/json",
          },
        }
      );
      const memes = resp.data;
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
      logger.error("获取图片梗出现错误");
      logger.error(err);
      throw new Error("获取图片梗出现错误");
    }
  }
}
