import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { getHudPluginDir, getHomeDir } from './claude-config-dir.js';

export type LineLayoutType = 'compact' | 'expanded';

export type AutocompactBufferMode = 'enabled' | 'disabled';
export type ContextValueMode = 'percent' | 'tokens' | 'remaining' | 'both';

/**
 * Controls how the model name is displayed in the HUD badge.
 *
 *   full:    Show the raw display name as-is (e.g. "Opus 4.6 (1M context)")
 *   compact: Strip redundant context-window suffix (e.g. "Opus 4.6")
 *   short:   Strip context suffix AND "Claude " prefix (e.g. "Opus 4.6")
 */
export type ModelFormatMode = 'full' | 'compact' | 'short';
export type HudElement = 'project' | 'context' | 'usage' | 'session' | 'memory' | 'environment' | 'tools' | 'agents' | 'todos';
export type HudColorName =
  | 'dim'
  | 'red'
  | 'green'
  | 'yellow'
  | 'magenta'
  | 'cyan'
  | 'brightBlue'
  | 'brightMagenta';

/** A color value: named preset, 256-color index (0-255), or hex string (#rrggbb). */
export type HudColorValue = HudColorName | number | string;

export interface HudColorOverrides {
  context: HudColorValue;
  usage: HudColorValue;
  warning: HudColorValue;
  usageWarning: HudColorValue;
  critical: HudColorValue;
  model: HudColorValue;
  project: HudColorValue;
  git: HudColorValue;
  gitBranch: HudColorValue;
  label: HudColorValue;
  custom: HudColorValue;
  tools: HudColorValue;
  burnLow: HudColorValue;
  burnHigh: HudColorValue;
}

export const DEFAULT_ELEMENT_ORDER: HudElement[] = [
  'project',
  'context',
  'usage',
  'session',
  'memory',
  'environment',
  'tools',
  'agents',
  'todos',
];

const KNOWN_ELEMENTS = new Set<HudElement>(DEFAULT_ELEMENT_ORDER);

export interface PetConfig {
  enabled: boolean;
  style: 'cat' | 'claude';
  /** Which side of the HUD the pet column anchors to */
  position: 'left' | 'right';
  /** Hide the pet when the terminal is narrower than this many columns */
  minWidth: number;
  /**
   * Safety columns kept free at the terminal's right edge when right-anchored.
   * Claude Code indents the statusline and truncates overflow with an
   * ellipsis, so anchoring at the exact width gets the sprite cut off.
   */
  rightMargin: number;
  /**
   * Width of the strip the pet lives in. Anything beyond the 12-col sprite
   * is patrol room: in idle states the pet walks back and forth across it.
   */
  roamWidth: number;
  /** Append a diagnostic line with detected width / anchor / pet state */
  debug: boolean;
}

export interface NotificationsConfig {
  enabled: boolean;
  onUsageReset: boolean;
  methods: Array<'notify-send' | 'warp' | 'bell'>;
  minutesBefore: number;
  resumeCommand: string;
  soundFile: string | null;
}

export interface HudConfig {
  lineLayout: LineLayoutType;
  showSeparators: boolean;
  pathLevels: 1 | 2 | 3;
  terminalWidth?: number;
  elementOrder: HudElement[];
  notifications: NotificationsConfig;
  pet: PetConfig;
  gitStatus: {
    enabled: boolean;
    showDirty: boolean;
    showAheadBehind: boolean;
    showFileStats: boolean;
    pushWarningThreshold: number;
    pushCriticalThreshold: number;
  };
  display: {
    showModel: boolean;
    showProject: boolean;
    showContextBar: boolean;
    contextValue: ContextValueMode;
    showConfigCounts: boolean;
    showCost: boolean;
    showDuration: boolean;
    showTokenBreakdown: boolean;
    showUsage: boolean;
    usageBarEnabled: boolean;
    showTools: boolean;
    showAgents: boolean;
    showTodos: boolean;
    showMemoryUsage: boolean;
    showSessionTokens: boolean;
    showOutputStyle: boolean;
    autocompactBuffer: AutocompactBufferMode;
    usageThreshold: number;
    sevenDayThreshold: number;
    environmentThreshold: number;
    modelFormat: ModelFormatMode;
    modelOverride: string;
    customLine: string;
    showBurnHeat: boolean;
    showCacheGlyph: boolean;
    showAutocompactMarker: boolean;
    showSparkline: boolean;
    showApiEquivCost: boolean;
    showEffort: boolean;
    showCompactEta: boolean;
    showUsageForecast: boolean;
  };
  colors: HudColorOverrides;
}

export const DEFAULT_CONFIG: HudConfig = {
  lineLayout: 'expanded',
  showSeparators: false,
  pathLevels: 2,
  elementOrder: [...DEFAULT_ELEMENT_ORDER],
  pet: {
    enabled: true,
    style: 'cat',
    position: 'right',
    minWidth: 80,
    rightMargin: 8,
    roamWidth: 26,
    debug: false,
  },
  notifications: {
    enabled: false,
    onUsageReset: true,
    methods: ['notify-send', 'bell'],
    minutesBefore: 0,
    resumeCommand: '',
    soundFile: null,
  },
  gitStatus: {
    enabled: true,
    showDirty: true,
    showAheadBehind: true,
    showFileStats: false,
    pushWarningThreshold: 0,
    pushCriticalThreshold: 0,
  },
  display: {
    showModel: true,
    showProject: true,
    showContextBar: true,
    contextValue: 'percent',
    showConfigCounts: true,
    showCost: true,
    showDuration: false,
    showTokenBreakdown: true,
    showUsage: true,
    usageBarEnabled: true,
    showTools: true,
    showAgents: true,
    showTodos: true,
    showMemoryUsage: false,
    showSessionTokens: false,
    showOutputStyle: false,
    autocompactBuffer: 'enabled',
    usageThreshold: 0,
    sevenDayThreshold: 80,
    environmentThreshold: 0,
    modelFormat: 'full',
    modelOverride: '',
    customLine: '',
    showBurnHeat: false,
    showCacheGlyph: false,
    showAutocompactMarker: false,
    showSparkline: false,
    showApiEquivCost: false,
    showEffort: false,
    showCompactEta: false,
    showUsageForecast: true,
  },
  colors: {
    context: '#f4a7b9',
    usage: '#c9a0c0',
    warning: '#f5c87a',
    usageWarning: '#e8a0b4',
    critical: '#f07090',
    model: '#f4a7b9',
    project: '#f9c4d4',
    git: '#e8a0b4',
    gitBranch: '#d98aa0',
    label: 'dim',
    custom: 208,
    tools: '#a8d4f5',
    burnLow: '#f4a7b9',
    burnHigh: '#f07090',
  },
};

export function getConfigPath(): string {
  const homeDir = getHomeDir();
  return path.join(getHudPluginDir(homeDir), 'config.json');
}

function validatePathLevels(value: unknown): value is 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3;
}

function validateLineLayout(value: unknown): value is LineLayoutType {
  return value === 'compact' || value === 'expanded';
}

function validateAutocompactBuffer(value: unknown): value is AutocompactBufferMode {
  return value === 'enabled' || value === 'disabled';
}

function validateContextValue(value: unknown): value is ContextValueMode {
  return value === 'percent' || value === 'tokens' || value === 'remaining' || value === 'both';
}

function validateModelFormat(value: unknown): value is ModelFormatMode {
  return value === 'full' || value === 'compact' || value === 'short';
}

function validateColorName(value: unknown): value is HudColorName {
  return value === 'dim'
    || value === 'red'
    || value === 'green'
    || value === 'yellow'
    || value === 'magenta'
    || value === 'cyan'
    || value === 'brightBlue'
    || value === 'brightMagenta';
}

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function validateColorValue(value: unknown): value is HudColorValue {
  if (validateColorName(value)) return true;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255) return true;
  if (typeof value === 'string' && HEX_COLOR_PATTERN.test(value)) return true;
  return false;
}

function validateElementOrder(value: unknown): HudElement[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [...DEFAULT_ELEMENT_ORDER];
  }

  const seen = new Set<HudElement>();
  const elementOrder: HudElement[] = [];

  for (const item of value) {
    if (typeof item !== 'string' || !KNOWN_ELEMENTS.has(item as HudElement)) {
      continue;
    }

    const element = item as HudElement;
    if (seen.has(element)) {
      continue;
    }

    seen.add(element);
    elementOrder.push(element);
  }

  return elementOrder.length > 0 ? elementOrder : [...DEFAULT_ELEMENT_ORDER];
}

interface LegacyConfig {
  layout?: 'default' | 'separators' | Record<string, unknown>;
}

function migrateConfig(userConfig: Partial<HudConfig> & LegacyConfig): Partial<HudConfig> {
  const migrated = { ...userConfig } as Partial<HudConfig> & LegacyConfig;

  if ('layout' in userConfig && !('lineLayout' in userConfig)) {
    if (typeof userConfig.layout === 'string') {
      if (userConfig.layout === 'separators') {
        migrated.lineLayout = 'compact';
        migrated.showSeparators = true;
      } else {
        migrated.lineLayout = 'compact';
        migrated.showSeparators = false;
      }
    } else if (typeof userConfig.layout === 'object' && userConfig.layout !== null) {
      const obj = userConfig.layout as Record<string, unknown>;
      if (typeof obj.lineLayout === 'string') migrated.lineLayout = obj.lineLayout as any;
      if (typeof obj.showSeparators === 'boolean') migrated.showSeparators = obj.showSeparators;
      if (typeof obj.pathLevels === 'number') migrated.pathLevels = obj.pathLevels as any;
    }
    delete migrated.layout;
  }

  return migrated;
}

function validateThreshold(value: unknown, max = 100): number {
  if (typeof value !== 'number') return 0;
  return Math.max(0, Math.min(max, value));
}

function validateCountThreshold(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

export function mergeConfig(userConfig: Partial<HudConfig>): HudConfig {
  const migrated = migrateConfig(userConfig);

  const lineLayout = validateLineLayout(migrated.lineLayout)
    ? migrated.lineLayout
    : DEFAULT_CONFIG.lineLayout;

  const showSeparators = typeof migrated.showSeparators === 'boolean'
    ? migrated.showSeparators
    : DEFAULT_CONFIG.showSeparators;

  const pathLevels = validatePathLevels(migrated.pathLevels)
    ? migrated.pathLevels
    : DEFAULT_CONFIG.pathLevels;

  const elementOrder = validateElementOrder(migrated.elementOrder);

  const gitStatus = {
    enabled: typeof migrated.gitStatus?.enabled === 'boolean'
      ? migrated.gitStatus.enabled
      : DEFAULT_CONFIG.gitStatus.enabled,
    showDirty: typeof migrated.gitStatus?.showDirty === 'boolean'
      ? migrated.gitStatus.showDirty
      : DEFAULT_CONFIG.gitStatus.showDirty,
    showAheadBehind: typeof migrated.gitStatus?.showAheadBehind === 'boolean'
      ? migrated.gitStatus.showAheadBehind
      : DEFAULT_CONFIG.gitStatus.showAheadBehind,
    showFileStats: typeof migrated.gitStatus?.showFileStats === 'boolean'
      ? migrated.gitStatus.showFileStats
      : DEFAULT_CONFIG.gitStatus.showFileStats,
    pushWarningThreshold: validateCountThreshold(migrated.gitStatus?.pushWarningThreshold),
    pushCriticalThreshold: validateCountThreshold(migrated.gitStatus?.pushCriticalThreshold),
  };

  const display = {
    showModel: typeof migrated.display?.showModel === 'boolean'
      ? migrated.display.showModel
      : DEFAULT_CONFIG.display.showModel,
    showProject: typeof migrated.display?.showProject === 'boolean'
      ? migrated.display.showProject
      : DEFAULT_CONFIG.display.showProject,
    showContextBar: typeof migrated.display?.showContextBar === 'boolean'
      ? migrated.display.showContextBar
      : DEFAULT_CONFIG.display.showContextBar,
    contextValue: validateContextValue(migrated.display?.contextValue)
      ? migrated.display.contextValue
      : DEFAULT_CONFIG.display.contextValue,
    showConfigCounts: typeof migrated.display?.showConfigCounts === 'boolean'
      ? migrated.display.showConfigCounts
      : DEFAULT_CONFIG.display.showConfigCounts,
    showCost: typeof migrated.display?.showCost === 'boolean'
      ? migrated.display.showCost
      : DEFAULT_CONFIG.display.showCost,
    showDuration: typeof migrated.display?.showDuration === 'boolean'
      ? migrated.display.showDuration
      : DEFAULT_CONFIG.display.showDuration,
    showTokenBreakdown: typeof migrated.display?.showTokenBreakdown === 'boolean'
      ? migrated.display.showTokenBreakdown
      : DEFAULT_CONFIG.display.showTokenBreakdown,
    showUsage: typeof migrated.display?.showUsage === 'boolean'
      ? migrated.display.showUsage
      : DEFAULT_CONFIG.display.showUsage,
    usageBarEnabled: typeof migrated.display?.usageBarEnabled === 'boolean'
      ? migrated.display.usageBarEnabled
      : DEFAULT_CONFIG.display.usageBarEnabled,
    showTools: typeof migrated.display?.showTools === 'boolean'
      ? migrated.display.showTools
      : DEFAULT_CONFIG.display.showTools,
    showAgents: typeof migrated.display?.showAgents === 'boolean'
      ? migrated.display.showAgents
      : DEFAULT_CONFIG.display.showAgents,
    showTodos: typeof migrated.display?.showTodos === 'boolean'
      ? migrated.display.showTodos
      : DEFAULT_CONFIG.display.showTodos,
    showMemoryUsage: typeof migrated.display?.showMemoryUsage === 'boolean'
      ? migrated.display.showMemoryUsage
      : DEFAULT_CONFIG.display.showMemoryUsage,
    showSessionTokens: typeof migrated.display?.showSessionTokens === 'boolean'
      ? migrated.display.showSessionTokens
      : DEFAULT_CONFIG.display.showSessionTokens,
    showOutputStyle: typeof migrated.display?.showOutputStyle === 'boolean'
      ? migrated.display.showOutputStyle
      : DEFAULT_CONFIG.display.showOutputStyle,
    autocompactBuffer: validateAutocompactBuffer(migrated.display?.autocompactBuffer)
      ? migrated.display.autocompactBuffer
      : DEFAULT_CONFIG.display.autocompactBuffer,
    usageThreshold: validateThreshold(migrated.display?.usageThreshold, 100),
    sevenDayThreshold: validateThreshold(migrated.display?.sevenDayThreshold, 100),
    environmentThreshold: validateThreshold(migrated.display?.environmentThreshold, 100),
    modelFormat: validateModelFormat(migrated.display?.modelFormat)
      ? migrated.display.modelFormat
      : DEFAULT_CONFIG.display.modelFormat,
    modelOverride: typeof migrated.display?.modelOverride === 'string'
      ? migrated.display.modelOverride.slice(0, 80)
      : DEFAULT_CONFIG.display.modelOverride,
    customLine: typeof migrated.display?.customLine === 'string'
      ? migrated.display.customLine.slice(0, 80)
      : DEFAULT_CONFIG.display.customLine,
    showBurnHeat: typeof migrated.display?.showBurnHeat === 'boolean' ? migrated.display.showBurnHeat : DEFAULT_CONFIG.display.showBurnHeat,
    showCacheGlyph: typeof migrated.display?.showCacheGlyph === 'boolean' ? migrated.display.showCacheGlyph : DEFAULT_CONFIG.display.showCacheGlyph,
    showAutocompactMarker: typeof migrated.display?.showAutocompactMarker === 'boolean' ? migrated.display.showAutocompactMarker : DEFAULT_CONFIG.display.showAutocompactMarker,
    showSparkline: typeof migrated.display?.showSparkline === 'boolean' ? migrated.display.showSparkline : DEFAULT_CONFIG.display.showSparkline,
    showApiEquivCost: typeof migrated.display?.showApiEquivCost === 'boolean' ? migrated.display.showApiEquivCost : DEFAULT_CONFIG.display.showApiEquivCost,
    showEffort: typeof migrated.display?.showEffort === 'boolean' ? migrated.display.showEffort : DEFAULT_CONFIG.display.showEffort,
    showCompactEta: typeof migrated.display?.showCompactEta === 'boolean' ? migrated.display.showCompactEta : DEFAULT_CONFIG.display.showCompactEta,
    showUsageForecast: typeof migrated.display?.showUsageForecast === 'boolean' ? migrated.display.showUsageForecast : DEFAULT_CONFIG.display.showUsageForecast,
  };

  const colors = {
    context: validateColorValue(migrated.colors?.context)
      ? migrated.colors.context
      : DEFAULT_CONFIG.colors.context,
    usage: validateColorValue(migrated.colors?.usage)
      ? migrated.colors.usage
      : DEFAULT_CONFIG.colors.usage,
    warning: validateColorValue(migrated.colors?.warning)
      ? migrated.colors.warning
      : DEFAULT_CONFIG.colors.warning,
    usageWarning: validateColorValue(migrated.colors?.usageWarning)
      ? migrated.colors.usageWarning
      : DEFAULT_CONFIG.colors.usageWarning,
    critical: validateColorValue(migrated.colors?.critical)
      ? migrated.colors.critical
      : DEFAULT_CONFIG.colors.critical,
    model: validateColorValue(migrated.colors?.model)
      ? migrated.colors.model
      : DEFAULT_CONFIG.colors.model,
    project: validateColorValue(migrated.colors?.project)
      ? migrated.colors.project
      : DEFAULT_CONFIG.colors.project,
    git: validateColorValue(migrated.colors?.git)
      ? migrated.colors.git
      : DEFAULT_CONFIG.colors.git,
    gitBranch: validateColorValue(migrated.colors?.gitBranch)
      ? migrated.colors.gitBranch
      : DEFAULT_CONFIG.colors.gitBranch,
    label: validateColorValue(migrated.colors?.label)
      ? migrated.colors.label
      : DEFAULT_CONFIG.colors.label,
    custom: validateColorValue(migrated.colors?.custom)
      ? migrated.colors.custom
      : DEFAULT_CONFIG.colors.custom,
    tools: validateColorValue(migrated.colors?.tools)
      ? migrated.colors.tools
      : DEFAULT_CONFIG.colors.tools,
    burnLow: validateColorValue(migrated.colors?.burnLow)
      ? migrated.colors.burnLow
      : DEFAULT_CONFIG.colors.burnLow,
    burnHigh: validateColorValue(migrated.colors?.burnHigh)
      ? migrated.colors.burnHigh
      : DEFAULT_CONFIG.colors.burnHigh,
  };

  const terminalWidth = (typeof migrated.terminalWidth === 'number' && migrated.terminalWidth > 0)
    ? migrated.terminalWidth
    : undefined;

  const p = (migrated as any).pet ?? {};
  const pet: PetConfig = {
    enabled: typeof p.enabled === 'boolean' ? p.enabled : DEFAULT_CONFIG.pet.enabled,
    style: p.style === 'cat' || p.style === 'claude' ? p.style : DEFAULT_CONFIG.pet.style,
    position: p.position === 'left' || p.position === 'right' ? p.position : DEFAULT_CONFIG.pet.position,
    minWidth: typeof p.minWidth === 'number' && Number.isFinite(p.minWidth) && p.minWidth >= 0
      ? Math.floor(p.minWidth)
      : DEFAULT_CONFIG.pet.minWidth,
    rightMargin: typeof p.rightMargin === 'number' && Number.isFinite(p.rightMargin) && p.rightMargin >= 0
      ? Math.floor(p.rightMargin)
      : DEFAULT_CONFIG.pet.rightMargin,
    roamWidth: typeof p.roamWidth === 'number' && Number.isFinite(p.roamWidth) && p.roamWidth >= 13
      ? Math.floor(p.roamWidth)
      : DEFAULT_CONFIG.pet.roamWidth,
    debug: typeof p.debug === 'boolean' ? p.debug : DEFAULT_CONFIG.pet.debug,
  };

  const n = (migrated as any).notifications ?? {};
  const notifications: NotificationsConfig = {
    enabled: typeof n.enabled === 'boolean' ? n.enabled : DEFAULT_CONFIG.notifications.enabled,
    onUsageReset: typeof n.onUsageReset === 'boolean' ? n.onUsageReset : DEFAULT_CONFIG.notifications.onUsageReset,
    methods: Array.isArray(n.methods) ? n.methods : DEFAULT_CONFIG.notifications.methods,
    minutesBefore: typeof n.minutesBefore === 'number' ? n.minutesBefore : DEFAULT_CONFIG.notifications.minutesBefore,
    resumeCommand: typeof n.resumeCommand === 'string' ? n.resumeCommand : DEFAULT_CONFIG.notifications.resumeCommand,
    soundFile: typeof n.soundFile === 'string' && n.soundFile.trim() !== '' ? n.soundFile : DEFAULT_CONFIG.notifications.soundFile,
  };

  return { lineLayout, showSeparators, pathLevels, elementOrder, gitStatus, display, colors, terminalWidth, notifications, pet };
}

export async function loadConfig(): Promise<HudConfig> {
  const configPath = getConfigPath();

  try {
    if (!fs.existsSync(configPath)) {
      return mergeConfig({});
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    const userConfig = JSON.parse(content) as Partial<HudConfig>;
    return mergeConfig(userConfig);
  } catch {
    return mergeConfig({});
  }
}
