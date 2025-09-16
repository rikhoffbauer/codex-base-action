import { $ } from "bun";
import { homedir } from "os";
import { readFile, writeFile } from "fs/promises";
import { parse as parseToml, stringify as stringifyToml } from "@iarna/toml";

type TomlRecord = Record<string, unknown>;

/**
 * Recursively merges two TOML-like objects, returning a new merged object.
 *
 * Performs a deep, non-destructive merge: nested plain objects (non-array, non-Date)
 * are merged recursively while primitives, arrays, and Date instances from `override`
 * replace the corresponding values in `base`.
 *
 * @param base - The base configuration object (not mutated).
 * @param override - The overriding object whose values take precedence.
 * @returns A new object containing the merged result.
 */
function deepMerge(base: TomlRecord, override: TomlRecord): TomlRecord {
  const result: TomlRecord = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      const existing = result[key];
      if (existing && typeof existing === "object" && !Array.isArray(existing)) {
        result[key] = deepMerge(existing as TomlRecord, value as TomlRecord);
      } else {
        result[key] = deepMerge({}, value as TomlRecord);
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Initialize and persist the Codex TOML configuration at `~/.codex/config.toml`.
 *
 * If an existing config file is present it is loaded and then optionally merged
 * with `configInput`. `configInput` may be a TOML string or a path to a TOML
 * file; parsed values are merged into the existing configuration (deep merge of
 * nested table objects, non-object values overwrite). The resulting config is
 * serialized to TOML and written to `~/.codex/config.toml` (creates `~/.codex`
 * if needed).
 *
 * @param configInput - Optional TOML content or path to a TOML file to merge into the existing config.
 * @param homeDir - Optional home directory override (defaults to the current user's home directory).
 *
 * @throws Error If `configInput` is treated as a file path but that file cannot be read or parsed as TOML.
 */
export async function setupCodexConfig(
  configInput?: string,
  homeDir?: string,
) {
  const home = homeDir ?? homedir();
  const configDir = `${home}/.codex`;
  const configPath = `${configDir}/config.toml`;

  console.log(`Setting up Codex config at: ${configPath}`);

  await $`mkdir -p ${configDir}`.quiet();

  let config: TomlRecord = {};

  try {
    const existing = await readFile(configPath, "utf-8");
    if (existing.trim()) {
      config = parseToml(existing) as TomlRecord;
      console.log(
        `Found existing Codex config:`,
        JSON.stringify(config, null, 2),
      );
    } else {
      console.log(`Config file exists but is empty`);
    }
  } catch (error) {
    console.log(`No existing config file found, creating a new one`);
  }

  if (configInput && configInput.trim()) {
    console.log(`Processing config input...`);
    let inputConfig: TomlRecord = {};

    try {
      inputConfig = parseToml(configInput) as TomlRecord;
      console.log(`Parsed config input as TOML`);
    } catch (parseError) {
      console.log(
        `Config input is not TOML, treating as file path: ${configInput}`,
      );
      try {
        const fileContent = await readFile(configInput, "utf-8");
        inputConfig = parseToml(fileContent) as TomlRecord;
        console.log(`Successfully read and parsed config from file`);
      } catch (fileError) {
        console.error(`Failed to read or parse config file: ${fileError}`);
        throw new Error(`Failed to process config input: ${fileError}`);
      }
    }

    config = deepMerge(config, inputConfig);
    console.log(`Merged config with input settings`);
  }

  const serialized = stringifyToml(config as any);
  await writeFile(configPath, serialized.endsWith("\n") ? serialized : `${serialized}\n`);
  console.log(`Config saved successfully`);
}
