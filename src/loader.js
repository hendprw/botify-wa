/**
 * loadPlugins
 * -----------
 * Auto-scans a directory and dynamically imports every `.js` file as a
 * plugin. Each plugin file must export a default function that receives
 * the Bot instance and registers its commands/middlewares on it.
 *
 * Plugin file shape:
 *
 *   // plugins/ping.js
 *   export default function (bot) {
 *     bot.command("ping", async (ctx) => {
 *       await ctx.reply("pong 🏓");
 *     });
 *   }
 *
 * Usage:
 *
 *   import { Bot, loadPlugins } from "botify-wa";
 *   const bot = new Bot();
 *   await loadPlugins(bot, "./plugins");
 *   await bot.start();
 *
 * Files are loaded in alphabetical order so the load sequence is
 * predictable. Subdirectories are ignored — only the top-level `.js`
 * files are loaded. If the directory doesn't exist the function logs a
 * warning and returns without throwing.
 */

import { readdirSync, existsSync, statSync } from "fs";
import { resolve, join, extname } from "path";
import { pathToFileURL } from "url";

/**
 * @param {import('./Bot.js').Bot} bot
 * @param {string} [pluginsDir="./plugins"]  Path to the plugins directory,
 *   relative to process.cwd() or absolute.
 * @returns {Promise<{ loaded: string[], failed: Array<{ file: string, error: unknown }> }>}
 *   Summary of what was loaded and what failed (individual plugin errors
 *   never abort the whole scan).
 */
export async function loadPlugins(bot, pluginsDir = "./plugins") {
  const dir = resolve(process.cwd(), pluginsDir);

  if (!existsSync(dir)) {
    console.warn(`[botify] plugins directory not found: ${dir}`);
    return { loaded: [], failed: [] };
  }

  // Read only top-level .js files, sorted alphabetically.
  const files = readdirSync(dir)
    .filter((f) => extname(f) === ".js" && statSync(join(dir, f)).isFile())
    .sort();

  if (files.length === 0) {
    console.warn(`[botify] no plugins found in: ${dir}`);
    return { loaded: [], failed: [] };
  }

  const loaded = [];
  const failed = [];

  for (const file of files) {
    const filePath = join(dir, file);
    try {
      const mod = await import(pathToFileURL(filePath).href);

      if (typeof mod.default !== "function") {
        throw new TypeError(
          `Plugin must export a default function — got ${typeof mod.default}`
        );
      }

      await mod.default(bot);
      loaded.push(file);
    } catch (error) {
      console.error(`[botify] failed to load plugin "${file}":`, error);
      failed.push({ file, error });
    }
  }

  console.log(
    `[botify] loaded ${loaded.length} plugin(s): ${loaded.join(", ")}`
  );

  return { loaded, failed };
}
