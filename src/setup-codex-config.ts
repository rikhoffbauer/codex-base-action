import { homedir } from "os";
import { mkdir, readFile, writeFile } from "fs/promises";
import { parse as parseToml, stringify as stringifyToml } from "@iarna/toml";

type TomlRecord = Awaited<ReturnType<typeof parseToml>>;

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

export async function setupCodexConfig(
  configInput?: string,
  homeDir?: string,
) {
  const home = homeDir ?? homedir();
  const configDir = `${home}/.codex`;
  const configPath = `${configDir}/config.toml`;

  console.log(`Setting up Codex config at: ${configPath}`);

  await mkdir(configDir, { recursive: true });

  let config: TomlRecord = {};

  try {
    const existing = await readFile(configPath, "utf-8");
    if (existing.trim()) {
      config = parseToml(existing);
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
      inputConfig = parseToml(configInput);
      console.log(`Parsed config input as TOML`);
    } catch (parseError) {
      console.log(
        `Config input is not TOML, treating as file path: ${configInput}`,
      );
      try {
        const fileContent = await readFile(configInput, "utf-8");
        inputConfig = parseToml(fileContent);
        console.log(`Successfully read and parsed config from file`);
      } catch (fileError) {
        const errorMessage =
          fileError instanceof Error ? fileError.message : String(fileError);
        console.error(`Failed to read or parse config file: ${errorMessage}`);
        throw new Error(`Failed to process config input: ${errorMessage}`);
      }
    }

    config = deepMerge(config, inputConfig);
    console.log(`Merged config with input settings`);
  }

  const serialized = stringifyToml(config);
  await writeFile(configPath, serialized.endsWith("\n") ? serialized : `${serialized}\n`);
  console.log(`Config saved successfully`);
}
