#!/usr/bin/env node
// claude-hud statusline launcher.
// Lives outside the versioned plugin install (copied to ~/.claude/scripts by
// /claude-hud:setup) so settings.json never hardcodes a plugin version dir:
// it resolves the newest installed version at every invocation, surviving
// plugin updates without re-running setup.

import { readdirSync, existsSync, statSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";

function getHomeDir() {
  const envHome = process.env.HOME?.trim();
  if (envHome && isAbsolute(envHome)) {
    try {
      if (statSync(envHome).isDirectory()) {
        return envHome;
      }
    } catch {
      // fall through to os.homedir()
    }
  }
  return homedir();
}

function getClaudeConfigDir() {
  const envConfigDir = process.env.CLAUDE_CONFIG_DIR?.trim();
  if (envConfigDir) {
    return envConfigDir;
  }
  return join(getHomeDir(), ".claude");
}

function compareVersions(a, b) {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function resolveHudEntry() {
  const claudeDir = getClaudeConfigDir();

  const cacheRoot = join(claudeDir, "plugins", "cache", "claude-hud", "claude-hud");
  try {
    const versions = readdirSync(cacheRoot)
      .filter((v) => existsSync(join(cacheRoot, v, "dist", "index.js")))
      .sort(compareVersions);
    if (versions.length > 0) {
      return join(cacheRoot, versions[versions.length - 1], "dist", "index.js");
    }
  } catch {
    // no cache install; try the marketplace clone below
  }

  const marketplaceEntry = join(
    claudeDir, "plugins", "marketplaces", "claude-hud", "dist", "index.js",
  );
  if (existsSync(marketplaceEntry)) {
    return marketplaceEntry;
  }
  return null;
}

const entry = resolveHudEntry();
if (!entry) {
  console.log("[claude-hud] No installed version found");
  process.exit(0);
}

const hud = await import(pathToFileURL(entry).href);
await hud.main();
