/**
 * Command registry - auto-discovers command modules.
 */

import { readdirSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import type { CommandClass } from "./base.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface CommandModule {
  COMMANDS: Record<string, CommandClass>;
}

/**
 * Discover all command modules in the commands directory.
 * Returns a map of module name -> COMMANDS object.
 */
export async function discoverCommands(): Promise<
  Map<string, Record<string, CommandClass>>
> {
  const commands = new Map<string, Record<string, CommandClass>>();

  const files = readdirSync(__dirname).filter(
    (f) =>
      f.endsWith(".ts") &&
      !f.startsWith("base") &&
      !f.startsWith("index")
  );

  for (const file of files) {
    const moduleName = file.replace(".ts", "");
    try {
      const module = (await import(`./${moduleName}.js`)) as CommandModule;
      if (module.COMMANDS && Object.keys(module.COMMANDS).length > 0) {
        commands.set(moduleName, module.COMMANDS);
      }
    } catch (e) {
      // Skip modules with missing dependencies or errors
      console.error(`Warning: Could not load ${moduleName}: ${e}`);
    }
  }

  return commands;
}

