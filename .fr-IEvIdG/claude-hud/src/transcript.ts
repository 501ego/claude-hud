import * as fs from 'fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { createHash } from 'node:crypto';
import { getHudPluginDir, getHomeDir } from './claude-config-dir.js';
import type { TranscriptData, ToolEntry, AgentEntry, TodoItem, SessionTokenUsage } from './types.js';

interface TokenUsageIteration {
  type?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  iterations?: TokenUsageIteration[];
}

interface TranscriptLine {
  timestamp?: string;
  type?: string;
  slug?: string;
  customTitle?: string;
  message?: {
    model?: string;
    content?: ContentBlock[];
    usage?: TokenUsage;
  };
  toolUseResult?: {
    usage?: TokenUsage;
  };
}

interface ContentBlock {
  type: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  is_error?: boolean;
}

interface TranscriptFileState {
  mtimeMs: number;
  size: number;
}

interface SerializedToolEntry extends Omit<ToolEntry, 'startTime' | 'endTime'> {
  startTime: string;
  endTime?: string;
}

interface SerializedAgentEntry extends Omit<AgentEntry, 'startTime' | 'endTime'> {
  startTime: string;
  endTime?: string;
}

interface SerializedTranscriptData {
  tools: SerializedToolEntry[];
  agents: SerializedAgentEntry[];
  todos: TodoItem[];
  sessionStart?: string;
  sessionName?: string;
  sessionTokens?: SessionTokenUsage;
  modelUsage?: Record<string, SessionTokenUsage>;
}

interface ParseState {
  toolMap: Map<string, ToolEntry>;
  agentMap: Map<string, AgentEntry>;
  latestTodos: TodoItem[];
  taskIdToIndex: Map<string, number>;
  latestSlug?: string;
  customTitle?: string;
  sessionStart?: Date;
  sessionTokens: SessionTokenUsage;
  modelUsage: Record<string, SessionTokenUsage>;
  agentToolModel: Map<string, string>;
}

interface SerializedParseState {
  tools: SerializedToolEntry[];
  agents: SerializedAgentEntry[];
  todos: TodoItem[];
  taskIdToIndex: Array<[string, number]>;
  agentToolModel: Array<[string, string]>;
  latestSlug?: string;
  customTitle?: string;
  sessionStart?: string;
  sessionTokens: SessionTokenUsage;
  modelUsage: Record<string, SessionTokenUsage>;
}

interface TranscriptCacheFile {
  version: number;
  transcriptPath: string;
  transcriptState: TranscriptFileState;
  offset: number;
  state: SerializedParseState;
  data: SerializedTranscriptData;
}

const CACHE_VERSION = 2;
const MAX_CACHED_TOOLS = 100;
const MAX_CACHED_AGENTS = 50;
const MAX_CACHED_AGENT_MODELS = 200;

let createReadStreamImpl: typeof fs.createReadStream = fs.createReadStream;

function normalizeTokenCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

function normalizeSessionTokens(tokens: unknown): SessionTokenUsage | undefined {
  if (!tokens || typeof tokens !== 'object') {
    return undefined;
  }

  const raw = tokens as Record<string, unknown>;
  return {
    inputTokens: normalizeTokenCount(raw.inputTokens),
    outputTokens: normalizeTokenCount(raw.outputTokens),
    cacheCreationTokens: normalizeTokenCount(raw.cacheCreationTokens),
    cacheReadTokens: normalizeTokenCount(raw.cacheReadTokens),
  };
}

function getTranscriptCachePath(transcriptPath: string, homeDir: string): string {
  const hash = createHash('sha256').update(path.resolve(transcriptPath)).digest('hex');
  return path.join(getHudPluginDir(homeDir), 'transcript-cache', `${hash}.json`);
}

function readTranscriptFileState(transcriptPath: string): TranscriptFileState | null {
  try {
    const stat = fs.statSync(transcriptPath);
    if (!stat.isFile()) {
      return null;
    }
    return {
      mtimeMs: stat.mtimeMs,
      size: stat.size,
    };
  } catch {
    return null;
  }
}

function serializeTools(tools: ToolEntry[]): SerializedToolEntry[] {
  return tools.map((tool) => ({
    ...tool,
    startTime: tool.startTime.toISOString(),
    endTime: tool.endTime?.toISOString(),
  }));
}

function serializeAgents(agents: AgentEntry[]): SerializedAgentEntry[] {
  return agents.map((agent) => ({
    ...agent,
    startTime: agent.startTime.toISOString(),
    endTime: agent.endTime?.toISOString(),
  }));
}

function deserializeTools(tools: SerializedToolEntry[]): ToolEntry[] {
  return tools.map((tool) => ({
    ...tool,
    startTime: new Date(tool.startTime),
    endTime: tool.endTime ? new Date(tool.endTime) : undefined,
  }));
}

function deserializeAgents(agents: SerializedAgentEntry[]): AgentEntry[] {
  return agents.map((agent) => ({
    ...agent,
    startTime: new Date(agent.startTime),
    endTime: agent.endTime ? new Date(agent.endTime) : undefined,
  }));
}

function serializeTranscriptData(data: TranscriptData): SerializedTranscriptData {
  return {
    tools: serializeTools(data.tools),
    agents: serializeAgents(data.agents),
    todos: data.todos.map((todo) => ({ ...todo })),
    sessionStart: data.sessionStart?.toISOString(),
    sessionName: data.sessionName,
    sessionTokens: data.sessionTokens,
    modelUsage: data.modelUsage,
  };
}

function deserializeTranscriptData(data: SerializedTranscriptData): TranscriptData {
  return {
    tools: deserializeTools(data.tools),
    agents: deserializeAgents(data.agents),
    todos: data.todos.map((todo) => ({ ...todo })),
    sessionStart: data.sessionStart ? new Date(data.sessionStart) : undefined,
    sessionName: data.sessionName,
    sessionTokens: normalizeSessionTokens(data.sessionTokens),
    modelUsage: data.modelUsage,
  };
}

function createParseState(): ParseState {
  return {
    toolMap: new Map(),
    agentMap: new Map(),
    latestTodos: [],
    taskIdToIndex: new Map(),
    sessionTokens: {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    },
    modelUsage: {},
    agentToolModel: new Map(),
  };
}

function serializeParseState(state: ParseState): SerializedParseState {
  const tools = [...state.toolMap.values()].slice(-MAX_CACHED_TOOLS);
  const agents = [...state.agentMap.values()].slice(-MAX_CACHED_AGENTS);
  const agentToolModel = [...state.agentToolModel.entries()].slice(-MAX_CACHED_AGENT_MODELS);
  return {
    tools: serializeTools(tools),
    agents: serializeAgents(agents),
    todos: state.latestTodos.map((todo) => ({ ...todo })),
    taskIdToIndex: [...state.taskIdToIndex.entries()],
    agentToolModel,
    latestSlug: state.latestSlug,
    customTitle: state.customTitle,
    sessionStart: state.sessionStart?.toISOString(),
    sessionTokens: state.sessionTokens,
    modelUsage: state.modelUsage,
  };
}

function deserializeParseState(raw: SerializedParseState): ParseState | null {
  try {
    if (!raw || !Array.isArray(raw.tools) || !Array.isArray(raw.agents) || !Array.isArray(raw.todos)) {
      return null;
    }
    const state = createParseState();
    for (const tool of deserializeTools(raw.tools)) {
      state.toolMap.set(tool.id, tool);
    }
    for (const agent of deserializeAgents(raw.agents)) {
      state.agentMap.set(agent.id, agent);
    }
    state.latestTodos.push(...raw.todos.map((todo) => ({ ...todo })));
    if (Array.isArray(raw.taskIdToIndex)) {
      for (const [taskId, index] of raw.taskIdToIndex) {
        if (typeof taskId === 'string' && typeof index === 'number') {
          state.taskIdToIndex.set(taskId, index);
        }
      }
    }
    if (Array.isArray(raw.agentToolModel)) {
      for (const [id, model] of raw.agentToolModel) {
        if (typeof id === 'string' && typeof model === 'string') {
          state.agentToolModel.set(id, model);
        }
      }
    }
    state.latestSlug = typeof raw.latestSlug === 'string' ? raw.latestSlug : undefined;
    state.customTitle = typeof raw.customTitle === 'string' ? raw.customTitle : undefined;
    state.sessionStart = raw.sessionStart ? new Date(raw.sessionStart) : undefined;
    const sessionTokens = normalizeSessionTokens(raw.sessionTokens);
    if (sessionTokens) {
      state.sessionTokens = sessionTokens;
    }
    if (raw.modelUsage && typeof raw.modelUsage === 'object') {
      for (const [model, tokens] of Object.entries(raw.modelUsage)) {
        const normalized = normalizeSessionTokens(tokens);
        if (normalized) {
          state.modelUsage[model] = normalized;
        }
      }
    }
    return state;
  } catch {
    return null;
  }
}

function readTranscriptCacheFile(transcriptPath: string): TranscriptCacheFile | null {
  try {
    const cachePath = getTranscriptCachePath(transcriptPath, getHomeDir());
    const raw = fs.readFileSync(cachePath, 'utf8');
    const parsed = JSON.parse(raw) as TranscriptCacheFile;
    if (
      parsed.version !== CACHE_VERSION
      || parsed.transcriptPath !== path.resolve(transcriptPath)
      || typeof parsed.transcriptState?.mtimeMs !== 'number'
      || typeof parsed.transcriptState?.size !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeTranscriptCache(
  transcriptPath: string,
  state: TranscriptFileState,
  offset: number,
  parseState: ParseState,
  data: TranscriptData,
): void {
  try {
    const cachePath = getTranscriptCachePath(transcriptPath, getHomeDir());
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    const payload: TranscriptCacheFile = {
      version: CACHE_VERSION,
      transcriptPath: path.resolve(transcriptPath),
      transcriptState: state,
      offset,
      state: serializeParseState(parseState),
      data: serializeTranscriptData(data),
    };
    fs.writeFileSync(cachePath, JSON.stringify(payload), 'utf8');
  } catch {
  }
}

/**
 * Read complete (newline-terminated) lines from `startOffset`, invoking
 * `onLine` per line. Returns the byte offset just past the last complete
 * line consumed plus any unterminated trailing text — the caller decides
 * whether the tail is a finished line (no trailing newline in the file)
 * or a partial line still being written.
 */
async function readLinesFrom(
  transcriptPath: string,
  startOffset: number,
  onLine: (line: string) => void,
): Promise<{ offset: number; tail: string }> {
  const stream = createReadStreamImpl(
    transcriptPath,
    startOffset > 0 ? { start: startOffset } : undefined,
  );
  const decoder = new StringDecoder('utf8');
  let pending = '';
  let consumed = startOffset;

  for await (const chunk of stream) {
    pending += typeof chunk === 'string' ? chunk : decoder.write(chunk as Buffer);
    let newlineIndex = pending.indexOf('\n');
    while (newlineIndex !== -1) {
      const rawLine = pending.slice(0, newlineIndex);
      pending = pending.slice(newlineIndex + 1);
      consumed += Buffer.byteLength(rawLine, 'utf8') + 1;
      onLine(rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine);
      newlineIndex = pending.indexOf('\n');
    }
  }
  pending += decoder.end();

  return { offset: consumed, tail: pending };
}

function deriveResult(state: ParseState): TranscriptData {
  return {
    tools: [...state.toolMap.values()].slice(-20),
    agents: [...state.agentMap.values()].slice(-10),
    todos: state.latestTodos.map((todo) => ({ ...todo })),
    sessionStart: state.sessionStart,
    sessionName: state.customTitle ?? state.latestSlug,
    sessionTokens: { ...state.sessionTokens },
    modelUsage: state.modelUsage,
  };
}

function resolveAgentModelAlias(alias: string): string | null {
  if (alias.includes('fable')) return 'claude-fable-5';
  if (alias.includes('haiku')) return 'claude-haiku-4-5-20251001';
  if (alias.includes('opus')) return 'claude-opus-4-8';
  if (alias.includes('sonnet')) return 'claude-sonnet-4-6';
  return null;
}

function addUsage(target: SessionTokenUsage, inp: number, out: number, cacheCreate: number, cacheRead: number): void {
  target.inputTokens += inp;
  target.outputTokens += out;
  target.cacheCreationTokens += cacheCreate;
  target.cacheReadTokens += cacheRead;
}

function ensureModelUsage(state: ParseState, modelId: string): SessionTokenUsage {
  if (!state.modelUsage[modelId]) {
    state.modelUsage[modelId] = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 };
  }
  return state.modelUsage[modelId];
}

function processLine(line: string, state: ParseState): void {
  const entry = JSON.parse(line) as TranscriptLine;

  if (entry.type === 'custom-title' && typeof entry.customTitle === 'string') {
    state.customTitle = entry.customTitle;
  } else if (typeof entry.slug === 'string') {
    state.latestSlug = entry.slug;
  }

  if (entry.type === 'assistant' && entry.message?.content) {
    for (const block of entry.message.content) {
      if (block.type === 'tool_use' && block.id && block.name === 'Agent' && block.input?.model) {
        const resolved = resolveAgentModelAlias(String(block.input.model).toLowerCase());
        if (resolved) state.agentToolModel.set(block.id, resolved);
      }
    }
  }

  if (entry.type === 'assistant' && entry.message?.usage) {
    const usage = entry.message.usage;
    const inp = normalizeTokenCount(usage.input_tokens);
    const out = normalizeTokenCount(usage.output_tokens);
    const cacheCreate = normalizeTokenCount(usage.cache_creation_input_tokens);
    const cacheRead = normalizeTokenCount(usage.cache_read_input_tokens);
    addUsage(state.sessionTokens, inp, out, cacheCreate, cacheRead);
    const modelId = entry.message.model;
    if (modelId) {
      addUsage(ensureModelUsage(state, modelId), inp, out, cacheCreate, cacheRead);
    }
    if (Array.isArray(usage.iterations)) {
      for (const iter of usage.iterations) {
        if (iter.type === 'advisor_message' && iter.model) {
          const iInp = normalizeTokenCount(iter.input_tokens);
          const iOut = normalizeTokenCount(iter.output_tokens);
          const iCreate = normalizeTokenCount(iter.cache_creation_input_tokens);
          const iRead = normalizeTokenCount(iter.cache_read_input_tokens);
          addUsage(ensureModelUsage(state, iter.model), iInp, iOut, iCreate, iRead);
          addUsage(state.sessionTokens, iInp, iOut, iCreate, iRead);
        }
      }
    }
  }

  if (entry.type === 'user' && entry.toolUseResult?.usage && entry.message?.content) {
    for (const block of entry.message.content) {
      if (block.type === 'tool_result' && block.tool_use_id) {
        const agentModel = state.agentToolModel.get(block.tool_use_id);
        if (agentModel) {
          const usage = entry.toolUseResult.usage;
          const inp = normalizeTokenCount(usage.input_tokens);
          const out = normalizeTokenCount(usage.output_tokens);
          const cacheCreate = normalizeTokenCount(usage.cache_creation_input_tokens);
          const cacheRead = normalizeTokenCount(usage.cache_read_input_tokens);
          addUsage(ensureModelUsage(state, agentModel), inp, out, cacheCreate, cacheRead);
          addUsage(state.sessionTokens, inp, out, cacheCreate, cacheRead);
        }
      }
    }
  }

  processEntry(entry, state);
}

export async function parseTranscript(transcriptPath: string): Promise<TranscriptData> {
  const empty: TranscriptData = {
    tools: [],
    agents: [],
    todos: [],
  };

  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return empty;
  }

  const transcriptState = readTranscriptFileState(transcriptPath);
  if (!transcriptState) {
    return empty;
  }

  const cached = readTranscriptCacheFile(transcriptPath);

  if (
    cached
    && cached.transcriptState.mtimeMs === transcriptState.mtimeMs
    && cached.transcriptState.size === transcriptState.size
  ) {
    return deserializeTranscriptData(cached.data);
  }

  let state: ParseState | null = null;
  let startOffset = 0;
  if (
    cached
    && typeof cached.offset === 'number'
    && cached.offset > 0
    && cached.offset <= transcriptState.size
    && transcriptState.size >= cached.transcriptState.size
  ) {
    state = deserializeParseState(cached.state);
    if (state) {
      startOffset = cached.offset;
    }
  }
  if (!state) {
    state = createParseState();
    startOffset = 0;
  }

  let parsedCleanly = false;
  let newOffset = startOffset;

  try {
    const { offset, tail } = await readLinesFrom(transcriptPath, startOffset, (line) => {
      if (!line.trim()) return;
      try {
        processLine(line, state!);
      } catch {
      }
    });
    newOffset = offset;

    if (tail) {
      const trimmed = tail.trim();
      if (!trimmed) {
        newOffset += Buffer.byteLength(tail, 'utf8');
      } else {
        try {
          processLine(trimmed, state);
          newOffset += Buffer.byteLength(tail, 'utf8');
        } catch {
        }
      }
    }

    parsedCleanly = true;
  } catch {
  }

  const result = deriveResult(state);
  if (parsedCleanly) {
    writeTranscriptCache(transcriptPath, transcriptState, newOffset, state, result);
  }

  return result;
}

export function _setCreateReadStreamForTests(impl: typeof fs.createReadStream | null): void {
  createReadStreamImpl = impl ?? fs.createReadStream;
}

function processEntry(entry: TranscriptLine, state: ParseState): void {
  const timestamp = entry.timestamp ? new Date(entry.timestamp) : new Date();

  if (!state.sessionStart && entry.timestamp) {
    state.sessionStart = timestamp;
  }

  const content = entry.message?.content;
  if (!content || !Array.isArray(content)) return;

  const { toolMap, agentMap, taskIdToIndex, latestTodos } = state;

  for (const block of content) {
    if (block.type === 'tool_use' && block.id && block.name) {
      const toolEntry: ToolEntry = {
        id: block.id,
        name: block.name,
        target: extractTarget(block.name, block.input),
        status: 'running',
        startTime: timestamp,
      };

      if (block.name === 'Task' || block.name === 'Agent') {
        const input = block.input as Record<string, unknown>;
        const agentEntry: AgentEntry = {
          id: block.id,
          type: (input?.subagent_type as string) ?? 'unknown',
          model: (input?.model as string) ?? undefined,
          description: (input?.description as string) ?? undefined,
          status: 'running',
          startTime: timestamp,
        };
        agentMap.set(block.id, agentEntry);
      } else if (block.name === 'TodoWrite') {
        const input = block.input as { todos?: TodoItem[] };
        if (input?.todos && Array.isArray(input.todos)) {
          const contentToTaskIds = new Map<string, string[]>();
          for (const [taskId, idx] of taskIdToIndex) {
            if (idx < latestTodos.length) {
              const content = latestTodos[idx].content;
              const ids = contentToTaskIds.get(content) ?? [];
              ids.push(taskId);
              contentToTaskIds.set(content, ids);
            }
          }

          latestTodos.length = 0;
          taskIdToIndex.clear();
          latestTodos.push(...input.todos);

          for (let i = 0; i < latestTodos.length; i++) {
            const ids = contentToTaskIds.get(latestTodos[i].content);
            if (ids) {
              for (const taskId of ids) {
                taskIdToIndex.set(taskId, i);
              }
              contentToTaskIds.delete(latestTodos[i].content);
            }
          }
        }
      } else if (block.name === 'TaskCreate') {
        const input = block.input as Record<string, unknown>;
        const subject = typeof input?.subject === 'string' ? input.subject : '';
        const description = typeof input?.description === 'string' ? input.description : '';
        const content = subject || description || 'Untitled task';
        const status = normalizeTaskStatus(input?.status) ?? 'pending';
        latestTodos.push({ content, status });

        const rawTaskId = input?.taskId;
        const taskId = typeof rawTaskId === 'string' || typeof rawTaskId === 'number'
          ? String(rawTaskId)
          : block.id;
        if (taskId) {
          taskIdToIndex.set(taskId, latestTodos.length - 1);
        }
      } else if (block.name === 'TaskUpdate') {
        const input = block.input as Record<string, unknown>;
        const index = resolveTaskIndex(input?.taskId, taskIdToIndex, latestTodos);
        if (index !== null) {
          const status = normalizeTaskStatus(input?.status);
          if (status) {
            latestTodos[index].status = status;
          }

          const subject = typeof input?.subject === 'string' ? input.subject : '';
          const description = typeof input?.description === 'string' ? input.description : '';
          const content = subject || description;
          if (content) {
            latestTodos[index].content = content;
          }
        }
      } else {
        toolMap.set(block.id, toolEntry);
      }
    }

    if (block.type === 'tool_result' && block.tool_use_id) {
      const tool = toolMap.get(block.tool_use_id);
      if (tool) {
        tool.status = block.is_error ? 'error' : 'completed';
        tool.endTime = timestamp;
      }

      const agent = agentMap.get(block.tool_use_id);
      if (agent) {
        agent.status = 'completed';
        agent.endTime = timestamp;
      }
    }
  }
}

function extractTarget(toolName: string, input?: Record<string, unknown>): string | undefined {
  if (!input) return undefined;

  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return (input.file_path as string) ?? (input.path as string);
    case 'Glob':
      return input.pattern as string;
    case 'Grep':
      return input.pattern as string;
    case 'Bash': {
      const cmd = input.command;
      if (typeof cmd !== 'string' || cmd.length === 0) return undefined;
      return cmd.slice(0, 30) + (cmd.length > 30 ? '...' : '');
    }
  }
  return undefined;
}

function resolveTaskIndex(
  taskId: unknown,
  taskIdToIndex: Map<string, number>,
  latestTodos: TodoItem[]
): number | null {
  if (typeof taskId === 'string' || typeof taskId === 'number') {
    const key = String(taskId);
    const mapped = taskIdToIndex.get(key);
    if (typeof mapped === 'number') {
      return mapped;
    }

    if (/^\d+$/.test(key)) {
      const numericIndex = Number.parseInt(key, 10) - 1;
      if (numericIndex >= 0 && numericIndex < latestTodos.length) {
        return numericIndex;
      }
    }
  }

  return null;
}

function normalizeTaskStatus(status: unknown): TodoItem['status'] | null {
  if (typeof status !== 'string') return null;

  switch (status) {
    case 'pending':
    case 'not_started':
      return 'pending';
    case 'in_progress':
    case 'running':
      return 'in_progress';
    case 'completed':
    case 'complete':
    case 'done':
      return 'completed';
    default:
      return null;
  }
}
