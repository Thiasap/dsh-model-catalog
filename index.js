/**
 * 模型目录面板 — Host 半侧。
 *
 * 通用化设计：插件本身不内置任何网关地址、密钥引用或 provider 名。
 *  - 面板里选择/新建模型组（provider），从已有模型组引入地址与密钥引用；
 *  - 启动时（或点「刷新」时）拉取 `GET {baseURL}/models`；
 *  - 以 id 为基准，把 credits（按名称模板写入 name）与 reasoning_supported_efforts
 *    （写入 reasoningEfforts）同步到 `@deepseek-ai/dsh-llm-pi-ai` 的对应模型组；
 *  - 密钥只保存到 DSH 凭据服务，插件状态文件只保存凭据引用名，不保存密钥值。
 */

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

export const name = 'model-catalog';
export const inject = ['webServer', 'credentials', 'configEditor', 'agentDefaultModel'];

const ROUTE_PREFIX = '/model-catalog';
const LLM_PLUGIN = '@deepseek-ai/dsh-llm-pi-ai';
const API_TYPES = ['openai-completions', 'openai-responses', 'anthropic-messages'];

const DEFAULTS = {
  // 连接信息留空：由面板配置，或从已有模型组引入。插件不内置任何私有地址/密钥。
  baseURL: '',
  apiKeyEnv: '',
  provider: '',
  providerDisplayName: '',
  providerApi: 'openai-completions',
  createProvider: false,
  nameTemplate: '{prefix}{name} [{credits}]',
  syncOnStartup: true,
  syncMissingModels: false,
  syncReasoningEfforts: true,
  syncContextWindow: true,
  // 目录里不存在的旧模型是否删除；默认保留（手动勾选删除）。
  removeMissing: false,
  requestTimeoutMs: 30000,
};

/** 旧版默认模板：升级时自动迁移到带 id 前缀的新默认值。 */
const LEGACY_NAME_TEMPLATE = '{name} [{credits}]';

const EFFORT_ORDER = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function pickConfig(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of Object.keys(DEFAULTS)) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const value = raw[key];
    if (typeof value !== typeof DEFAULTS[key]) continue;
    out[key] = value;
  }
  if (!(Number(out.requestTimeoutMs) >= 1000)) delete out.requestTimeoutMs;
  return out;
}

function makeSerial() {
  let tail = Promise.resolve();
  return function serial(task) {
    const run = tail.then(task, task);
    tail = run.then(() => undefined, () => undefined);
    return run;
  };
}

/**
 * configEditor.edit() 内部走 HMR 独占事务。插件刚安装/升级时，外层 HMR 事务
 * 可能还没结束，此时会抛 “HMR transactions cannot be nested”。这里只对这个
 * 特定错误做退避重试；其他配置错误立即抛给调用方。
 */
async function withHmrRetry(task, attempts = 8) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (!/HMR transactions cannot be nested/i.test(errorMessage(error))) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 + attempt * 750));
    }
  }
  throw lastError;
}

function stateFilePath() {
  const home = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME.trim()
    ? process.env.DSH_HOME.trim()
    : join(homedir(), '.dsh');
  return join(home, 'model-catalog', 'state.json');
}

function emptyState() {
  return { version: 1, catalog: [], fetchedAt: 0, lastError: null, lastSync: null, settings: {} };
}

async function readState(path) {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return emptyState();
    return {
      ...emptyState(),
      ...parsed,
      catalog: Array.isArray(parsed.catalog) ? parsed.catalog : [],
      settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {},
    };
  } catch {
    return emptyState();
  }
}

async function writeState(path, state) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await rename(temp, path);
}

/** 插件配置 + 面板保存的设置；空字符串表示未配置。 */
function effectiveConfig(state, config) {
  const saved = state && state.settings && typeof state.settings === 'object' ? state.settings : {};
  const text = (key) => {
    const value = typeof saved[key] === 'string' ? saved[key] : config[key];
    return typeof value === 'string' ? value.trim() : '';
  };
  const bool = (key) => (typeof saved[key] === 'boolean' ? saved[key] : Boolean(config[key]));
  return {
    baseURL: text('baseURL'),
    apiKeyEnv: text('apiKeyEnv'),
    provider: text('provider'),
    providerDisplayName: text('providerDisplayName'),
    providerApi: text('providerApi') || 'openai-completions',
    createProvider: bool('createProvider'),
    nameTemplate: (() => {
      const savedTemplate = text('nameTemplate');
      if (savedTemplate === LEGACY_NAME_TEMPLATE) return DEFAULTS.nameTemplate;
      return savedTemplate || DEFAULTS.nameTemplate;
    })(),
    syncOnStartup: bool('syncOnStartup'),
    syncMissingModels: bool('syncMissingModels'),
    syncReasoningEfforts: bool('syncReasoningEfforts'),
    syncContextWindow: bool('syncContextWindow'),
    removeMissing: bool('removeMissing'),
    selectedIds: Array.isArray(saved.selectedIds) ? saved.selectedIds.filter((id) => typeof id === 'string') : null,
    keepMissingIds: Array.isArray(saved.keepMissingIds)
      ? saved.keepMissingIds.filter((id) => typeof id === 'string')
      : [],
    requestTimeoutMs: Number(config.requestTimeoutMs) >= 1000 ? Number(config.requestTimeoutMs) : DEFAULTS.requestTimeoutMs,
  };
}

function numberOrUndefined(value) {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

function cleanDescription(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/^\s*\[[^\]]*credit[^\]]*\]\s*/i, '').trim();
}

function normalizeModel(row) {
  if (!row || typeof row !== 'object') return null;
  const id = typeof row.id === 'string' ? row.id.trim() : '';
  if (!id) return null;
  const rawEfforts = Array.isArray(row.reasoning_supported_efforts) ? row.reasoning_supported_efforts : [];
  const efforts = [...new Set(rawEfforts.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()))];
  efforts.sort((a, b) => {
    const ai = EFFORT_ORDER.indexOf(a);
    const bi = EFFORT_ORDER.indexOf(b);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  const credits = typeof row.credits === 'string' ? row.credits.trim() : '';
  const creditValue = Number.parseFloat(credits.replace(/^x/i, ''));
  return {
    id,
    name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : id,
    credits,
    creditValue: Number.isFinite(creditValue) ? creditValue : undefined,
    description: typeof row.description === 'string' ? row.description : '',
    cleanDescription: cleanDescription(row.description),
    contextWindow: numberOrUndefined(row.context_length) ?? numberOrUndefined(
      Array.isArray(row.context_window?.supported)
        ? row.context_window.supported[row.context_window.supported.length - 1]
        : undefined,
    ),
    maxTokens: numberOrUndefined(row.max_output_tokens),
    supportsImages: row.supports_images === true,
    supportsReasoning: row.supports_reasoning !== false,
    onlyReasoning: row.only_reasoning === true,
    canDisableThinking: row.can_disable_thinking === true,
    efforts,
    defaultEffort: typeof row.reasoning_default_effort === 'string' ? row.reasoning_default_effort : undefined,
    vendor: typeof row.vendor === 'string' ? row.vendor : '',
    tier: typeof row.tier === 'string' ? row.tier : '',
    tags: Array.isArray(row.tags) ? row.tags.filter((item) => typeof item === 'string') : [],
  };
}

function formatCompact(value) {
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value >= 1000000) {
    const n = value / 1000000;
    return `${Number.isInteger(n) ? n : n.toFixed(1)}M`;
  }
  if (value >= 1000) {
    const n = value / 1000;
    return `${Number.isInteger(n) ? n : n.toFixed(1)}K`;
  }
  return String(value);
}

function applyTemplate(template, model) {
  const tpl = typeof template === 'string' && template.trim() ? template : DEFAULTS.nameTemplate;
  const text = tpl.replace(/\{([a-zA-Z][\w]*)\}/g, (_, rawKey) => {
    switch (rawKey.toLowerCase()) {
      case 'name':
        return model.name || model.id;
      case 'id':
        return model.id;
      case 'prefix':
      case 'idprefix': {
        const index = model.id.indexOf(':');
        return index >= 0 ? model.id.slice(0, index + 1) : '';
      }
      case 'group': {
        const index = model.id.indexOf(':');
        return index >= 0 ? model.id.slice(0, index) : '';
      }
      case 'credits':
      case 'credit':
        return model.credits || '';
      case 'description':
        return model.cleanDescription || model.description || '';
      case 'context':
      case 'contextwindow':
        return formatCompact(model.contextWindow);
      case 'maxtokens':
      case 'output':
        return formatCompact(model.maxTokens);
      case 'vendor':
        return model.vendor || '';
      case 'tier':
        return model.tier || '';
      default:
        return '';
    }
  });
  return text
    .replace(/\s*\[\s*\]/g, '')
    .replace(/\s*\(\s*\)/g, '')
    .replace(/\s*\{\s*\}/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || model.id;
}

function effortsFor(model, config) {
  if (!config.syncReasoningEfforts || !model.supportsReasoning) return false;
  if (!Array.isArray(model.efforts) || model.efforts.length === 0) return false;
  const result = {};
  for (const effort of model.efforts) result[effort] = effort;
  return result;
}

function mergeModel(existing, meta, config, template) {
  const next = { ...existing, name: applyTemplate(template, meta) };
  if (config.syncContextWindow && meta.contextWindow) next.contextWindow = meta.contextWindow;
  if (meta.maxTokens) next.maxTokens = meta.maxTokens;
  if (typeof meta.supportsImages === 'boolean') next.input = meta.supportsImages ? ['text', 'image'] : ['text'];
  if (config.syncReasoningEfforts) next.reasoningEfforts = effortsFor(meta, config);
  return next;
}

function newModel(meta, config, template) {
  const model = { id: meta.id, name: applyTemplate(template, meta) };
  if (meta.contextWindow) model.contextWindow = meta.contextWindow;
  if (meta.maxTokens) model.maxTokens = meta.maxTokens;
  model.input = meta.supportsImages ? ['text', 'image'] : ['text'];
  if (config.syncReasoningEfforts) model.reasoningEfforts = effortsFor(meta, config);
  return model;
}

function buildNextConfig(base, config, state, catalog, forceModelId) {
  if (!config.provider) throw new Error('还没有选择模型组');
  if (!config.baseURL) throw new Error('还没有填写接口地址');
  if (!config.apiKeyEnv) throw new Error('还没有填写 API Key 引用');

  const providers = { ...(base && base.providers ? base.providers : {}) };
  const existingProfile = providers[config.provider];
  let profile;
  if (existingProfile) {
    profile = { ...existingProfile };
    if (config.providerDisplayName) profile.displayName = config.providerDisplayName;
    if (config.baseURL) profile.baseURL = config.baseURL;
    if (config.apiKeyEnv) profile.apiKeyEnv = config.apiKeyEnv;
    // 已有模型组没有显式 api 时保留目录默认协议，不用面板默认值覆盖。
    if (config.providerApi && existingProfile.api) profile.api = config.providerApi;
  } else {
    if (!config.createProvider) {
      throw new Error(`模型组 ${config.provider} 不存在；请从已有模型组引入，或新建一个`);
    }
    profile = {
      displayName: config.providerDisplayName || config.provider,
      api: config.providerApi || 'openai-completions',
      baseURL: config.baseURL,
      apiKeyEnv: config.apiKeyEnv,
      models: [],
    };
  }

  const existing = Array.isArray(profile.models) ? profile.models : [];
  const byId = new Map(catalog.map((model) => [model.id, model]));
  const seen = new Set();
  const models = [];
  let changed = 0;

  // 目录里已经没有的旧模型默认保留：导入是「勾选」行为，同步不能悄悄删掉
  // 用户自己加的模型。只有 removeMissing 明确要求时才移除。
  let removed = 0;
  for (const model of existing) {
    if (!model || typeof model.id !== 'string') continue;
    const meta = byId.get(model.id);
    if (!meta) {
      if (config.removeMissing && !config.keepMissingIds.includes(model.id)) {
        removed += 1;
        continue;
      }
      models.push(model);
      continue;
    }
    seen.add(meta.id);
    const merged = mergeModel(model, meta, config, config.nameTemplate);
    if (!isDeepStrictEqual(merged, model)) changed += 1;
    models.push(merged);
  }

  let added = 0;
  const wanted = Array.isArray(config.selectedIds) ? config.selectedIds : null;
  for (const meta of catalog) {
    if (seen.has(meta.id)) continue;
    if (wanted) {
      // 有显式勾选集合时只按勾选导入；forceModelId（设为默认时）额外放行。
      if (!wanted.includes(meta.id) && meta.id !== forceModelId) continue;
    } else if (!config.syncMissingModels) {
      continue;
    }
    models.push(newModel(meta, config, config.nameTemplate));
    added += 1;
  }

  providers[config.provider] = { ...profile, models };
  return {
    next: { ...(base || {}), providers },
    summary: {
      provider: config.provider,
      created: !existingProfile,
      template: config.nameTemplate,
      total: models.length,
      matched: seen.size,
      added,
      removed,
      changed: changed + added + removed,
    },
  };
}

function findLlmEntry(ctx) {
  return ctx.configEditor.entries().find((entry) => entry?.options?.name === LLM_PLUGIN);
}

function listProviders(ctx) {
  const entry = findLlmEntry(ctx);
  const providers = entry?.options?.config?.providers;
  if (!providers || typeof providers !== 'object') return [];
  return Object.entries(providers).map(([id, profile]) => {
    const models = Array.isArray(profile?.models) ? profile.models : [];
    return {
      id,
      displayName: typeof profile?.displayName === 'string' && profile.displayName ? profile.displayName : id,
      baseURL: typeof profile?.baseURL === 'string' ? profile.baseURL : '',
      apiKeyEnv: typeof profile?.apiKeyEnv === 'string' ? profile.apiKeyEnv : '',
      api: typeof profile?.api === 'string' ? profile.api : '',
      modelCount: models.length,
      modelIds: models.map((model) => model?.id).filter((item) => typeof item === 'string'),
    };
  });
}

function providerModels(ctx, config) {
  const entry = findLlmEntry(ctx);
  const models = entry?.options?.config?.providers?.[config.provider]?.models;
  if (!Array.isArray(models)) return [];
  return models.map((model) => ({
    id: model.id,
    name: model.name,
    reasoningEfforts: model.reasoningEfforts ?? null,
  }));
}

/**
 * 把面板设置解析成可用的连接信息：选中已有模型组时，空着的地址/密钥引用/
 * 显示名/协议自动从该模型组带入。
 */
function resolveConnection(ctx, state, config) {
  const cfg = effectiveConfig(state, config);
  const providers = listProviders(ctx);
  const existing = providers.find((provider) => provider.id === cfg.provider);
  if (existing) {
    if (!cfg.baseURL) cfg.baseURL = existing.baseURL;
    if (!cfg.apiKeyEnv) cfg.apiKeyEnv = existing.apiKeyEnv;
    if (!cfg.providerDisplayName) cfg.providerDisplayName = existing.displayName;
    if (existing.api) cfg.providerApi = existing.api;
  }
  return { cfg, providers, existing };
}

function autoDetectProvider(ctx, state) {
  const ids = new Set((state.catalog || []).map((model) => model.id));
  if (ids.size === 0) return undefined;
  let best;
  for (const provider of listProviders(ctx)) {
    const hits = provider.modelIds.filter((id) => ids.has(id)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { provider, hits };
  }
  return best?.provider;
}

async function resolveApiKey(ctx, config) {
  const ref = config.apiKeyEnv;
  if (!ref) throw new Error('还没有填写 API Key 引用');
  try {
    const resolved = await ctx.credentials.resolve(ref);
    if (resolved && typeof resolved.value === 'string' && resolved.value.trim()) return resolved.value.trim();
  } catch {
    /* fall through to ambient environment */
  }
  const ambient = process.env[ref];
  if (typeof ambient === 'string' && ambient.trim()) return ambient.trim();
  throw new Error(`没有找到凭据 ${ref}；请在面板里保存 API Key，或配置同名环境变量`);
}

async function fetchCatalog(ctx, config) {
  if (!config.baseURL) throw new Error('还没有填写接口地址');
  const key = await resolveApiKey(ctx, config);
  const base = config.baseURL.replace(/\/+$/, '');
  const response = await fetch(`${base}/models`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${key}`,
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`模型接口 HTTP ${response.status}：${text.slice(0, 300)}`);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error('模型接口返回的不是 JSON');
  }
  const rows = Array.isArray(body?.data) ? body.data : Array.isArray(body?.models) ? body.models : [];
  const catalog = rows.map(normalizeModel).filter(Boolean);
  if (catalog.length === 0) throw new Error('模型接口没有返回任何模型（data[] 为空）');
  return catalog;
}

async function syncCatalog(ctx, config, state, reason, forceModelId) {
  const catalog = Array.isArray(state.catalog) ? state.catalog : [];
  if (catalog.length === 0) throw new Error('还没有模型目录，请先刷新');
  if (!config.provider) throw new Error('还没有选择模型组');
  const entry = findLlmEntry(ctx);
  if (!entry) throw new Error('找不到 llm-pi-ai 的配置行');

  let base = entry.options?.config || {};
  if (!base.providers?.[config.provider]) {
    try {
      const row = ctx.configEditor.configuration().find((item) => item.entry === entry);
      base = { ...(row?.inherited || {}), ...base };
    } catch {
      /* keep base as-is */
    }
  }
  if (!base.providers?.[config.provider] && !config.createProvider) {
    throw new Error(`模型组 ${config.provider} 不存在；请从已有模型组引入，或新建一个`);
  }

  const preview = buildNextConfig(base, config, state, catalog, forceModelId);
  if (isDeepStrictEqual(preview.next, base)) {
    state.lastSync = { at: Date.now(), reason, changed: false, ...preview.summary };
    state.lastError = null;
    await writeState(stateFilePath(), state);
    return { changed: false, ...preview.summary };
  }

  await withHmrRetry(() => ctx.configEditor.edit(entry, (current, inherited) => {
    const merged = {
      ...(inherited || {}),
      ...(current || {}),
      providers: { ...(inherited?.providers || {}), ...(current?.providers || {}) },
    };
    return buildNextConfig(merged, config, state, catalog, forceModelId).next;
  }));

  state.lastSync = { at: Date.now(), reason, changed: true, ...preview.summary };
  state.lastError = null;
  await writeState(stateFilePath(), state);
  return { changed: true, ...preview.summary };
}

/**
 * 按勾选集合改模型组分子集：
 *  - importIds：要导入（加入模型组）的目录模型 id；
 *  - removeIds：要从模型组删除的模型 id（含目录里已不存在的旧模型）。
 * 只动模型组里本插件管理的字段，保留用户手工加的其它字段。
 */
async function applySelection(ctx, config, state, importIds, removeIds) {
  const catalog = Array.isArray(state.catalog) ? state.catalog : [];
  if (catalog.length === 0) throw new Error('还没有模型目录，请先刷新');
  if (!config.provider) throw new Error('还没有选择模型组');
  const entry = findLlmEntry(ctx);
  if (!entry) throw new Error('找不到 llm-pi-ai 的配置行');

  let profile = entry.options?.config?.providers?.[config.provider];
  if (!profile) {
    try {
      const row = ctx.configEditor.configuration().find((item) => item.entry === entry);
      const inherited = row?.inherited?.providers?.[config.provider];
      if (inherited) profile = inherited;
    } catch {
      /* keep undefined */
    }
  }
  if (!profile && !config.createProvider) {
    throw new Error(`模型组 ${config.provider} 不存在；请从已有模型组引入，或新建一个`);
  }

  const byId = new Map(catalog.map((model) => [model.id, model]));
  const toRemoveSet = new Set(removeIds);
  const current = Array.isArray(profile?.models) ? profile.models : [];
  const currentIds = new Set(current.map((model) => model?.id));

  /** 只保留 keep 里的模型，并按目录元数据刷新名称/能力字段。 */
  const rebuild = (existingModels) => {
    const kept = [];
    let changed = 0;
    for (const model of existingModels) {
      if (!model || typeof model.id !== 'string') continue;
      if (toRemoveSet.has(model.id)) {
        changed += 1;
        continue;
      }
      const meta = byId.get(model.id);
      if (!meta) {
        kept.push(model);
        continue;
      }
      const merged = mergeModel(model, meta, config, config.nameTemplate);
      if (!isDeepStrictEqual(merged, model)) changed += 1;
      kept.push(merged);
    }
    let added = 0;
    for (const id of importIds) {
      if (currentIds.has(id) || toRemoveSet.has(id)) continue;
      const meta = byId.get(id);
      if (!meta) continue;
      kept.push(newModel(meta, config, config.nameTemplate));
      added += 1;
    }
    return { kept, changed, added };
  };

  const preview = rebuild(current);
  const nextProfile = { ...(profile || {
    displayName: config.providerDisplayName || config.provider,
    api: config.providerApi || 'openai-completions',
    baseURL: config.baseURL,
    apiKeyEnv: config.apiKeyEnv,
  }), models: preview.kept };

  const before = { ...(entry.options?.config?.providers?.[config.provider] || profile || {}), models: current };
  const changed = !isDeepStrictEqual(before, nextProfile) || preview.added > 0;

  if (changed) {
    await withHmrRetry(() => ctx.configEditor.edit(entry, (now, inherited) => {
      const providers = { ...(inherited?.providers || {}), ...(now?.providers || {}) };
      const liveProfile = providers[config.provider] || nextProfile;
      const result = rebuild(Array.isArray(liveProfile.models) ? liveProfile.models : []);
      return {
        ...(inherited || {}),
        ...(now || {}),
        providers: {
          ...providers,
          [config.provider]: { ...liveProfile, models: result.kept },
        },
      };
    }));
  }

  state.lastSync = {
    at: Date.now(),
    reason: 'selection',
    changed,
    provider: config.provider,
    template: config.nameTemplate,
    total: preview.kept.length,
    added: preview.added,
    removed: current.length + preview.added - preview.kept.length,
  };
  state.lastError = null;
  await writeState(stateFilePath(), state);
  return { changed, imported: preview.added, removed: current.length + preview.added - preview.kept.length };
}

async function statePayload(ctx, state, config) {
  const { cfg, providers, existing } = resolveConnection(ctx, state, config);
  const catalog = (Array.isArray(state.catalog) ? state.catalog : []).map((model) => ({
    ...model,
    displayName: applyTemplate(cfg.nameTemplate, model),
  }));
  const models = providerModels(ctx, cfg);
  const catalogIds = new Set(catalog.map((model) => model.id));
  // 目录里已经找不到、但还留在模型组里的模型：面板置顶标红，供手动删除。
  const staleModels = models
    .filter((model) => !catalogIds.has(model.id))
    .map((model) => ({ ...model, displayName: model.name || model.id }));
  let credential = null;
  if (cfg.apiKeyEnv) {
    try {
      const info = await ctx.credentials.describe(cfg.apiKeyEnv);
      credential = { ref: cfg.apiKeyEnv, ...info };
    } catch {
      credential = null;
    }
  }
  let selection;
  try {
    selection = ctx.agentDefaultModel.currentSelection();
  } catch {
    selection = undefined;
  }
  const providerConfig = existing
    ? (({ modelIds, ...rest }) => rest)(existing)
    : null;
  return {
    ok: true,
    catalog,
    fetchedAt: state.fetchedAt || 0,
    lastError: state.lastError || null,
    lastSync: state.lastSync || null,
    settings: cfg,
    providers: providers.map(({ modelIds, ...rest }) => rest),
    providerConfig,
    credential,
    configured: Boolean(cfg.provider && cfg.baseURL && cfg.apiKeyEnv),
    provider: cfg.provider,
    baseURL: cfg.baseURL,
    defaultSelection: selection,
    syncedIds: models.map((model) => model.id),
    syncedModels: models,
    staleModels,
  };
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  });
  res.end(text);
}

function readJsonBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('请求体不是 JSON'));
      }
    });
    req.on('error', reject);
  });
}

function originAllowed(ctx, origin) {
  try {
    const url = new URL(origin);
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1') return true;
  } catch {
    /* ignore */
  }
  try {
    return origin === ctx.webServer.getOrigin();
  } catch {
    return true;
  }
}

export function apply(ctx, rawConfig = {}) {
  const config = { ...DEFAULTS, ...pickConfig(rawConfig) };
  const serial = makeSerial();
  const statePath = stateFilePath();

  const handle = async (req, res) => {
    try {
      const origin = req.headers.origin;
      if (typeof origin === 'string' && origin && !originAllowed(ctx, origin)) {
        sendJson(res, 403, { ok: false, error: 'origin not allowed' });
        return;
      }
      const url = new URL(req.url || '/', 'http://localhost');
      const suffix = url.pathname.slice(ROUTE_PREFIX.length) || '/';

      if (req.method === 'GET' && suffix === '/state') {
        const state = await readState(statePath);
        sendJson(res, 200, await statePayload(ctx, state, config));
        return;
      }

      if (req.method === 'GET' && suffix === '/credential') {
        const ref = url.searchParams.get('ref') || '';
        if (!ref) {
          sendJson(res, 200, { ok: true, credential: null });
          return;
        }
        const info = await ctx.credentials.describe(ref);
        sendJson(res, 200, { ok: true, credential: { ref, ...info } });
        return;
      }

      if (req.method === 'POST' && suffix === '/credentials') {
        const body = await readJsonBody(req);
        const ref = typeof body.ref === 'string' ? body.ref.trim() : '';
        const value = typeof body.value === 'string' ? body.value : '';
        if (!ref) throw new Error('凭据引用不能为空');
        if (!value) throw new Error('密钥不能为空');
        await ctx.credentials.set(ref, value);
        const info = await ctx.credentials.describe(ref);
        sendJson(res, 200, { ok: true, credential: { ref, ...info } });
        return;
      }

      if (req.method === 'POST' && suffix === '/credentials/clear') {
        const body = await readJsonBody(req);
        const ref = typeof body.ref === 'string' ? body.ref.trim() : '';
        if (!ref) throw new Error('凭据引用不能为空');
        await ctx.credentials.unset(ref);
        const info = await ctx.credentials.describe(ref);
        sendJson(res, 200, { ok: true, credential: { ref, ...info } });
        return;
      }

      if (req.method === 'POST' && suffix === '/refresh') {
        const body = await readJsonBody(req);
        const result = await serial(async () => {
          const state = await readState(statePath);
          const { cfg } = resolveConnection(ctx, state, config);
          if (!cfg.provider || !cfg.baseURL || !cfg.apiKeyEnv) {
            throw new Error('请先在面板里选择模型组，并填写接口地址与 API Key 引用');
          }
          const catalog = await fetchCatalog(ctx, cfg);
          state.catalog = catalog;
          state.fetchedAt = Date.now();
          state.lastError = null;
          await writeState(statePath, state);
          const sync = body.sync === true ? await syncCatalog(ctx, cfg, state, 'manual') : null;
          return {
            ok: true,
            count: catalog.length,
            sync,
            state: await statePayload(ctx, state, config),
          };
        });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && suffix === '/sync') {
        const body = await readJsonBody(req);
        const result = await serial(async () => {
          const state = await readState(statePath);
          const { cfg } = resolveConnection(ctx, state, config);
          if (!cfg.provider || !cfg.baseURL || !cfg.apiKeyEnv) {
            throw new Error('请先在面板里选择模型组，并填写接口地址与 API Key 引用');
          }
          const importIds = Array.isArray(body.import) ? body.import.filter((id) => typeof id === 'string') : [];
          const removeIds = Array.isArray(body.remove) ? body.remove.filter((id) => typeof id === 'string') : [];
          // 面板传来显式的导入/移除清单时，按清单改正模型组；否则走旧的
          // 「只补名称与思考档位」同步。
          if (importIds.length > 0 || removeIds.length > 0) {
            const applied = await applySelection(ctx, cfg, state, importIds, removeIds);
            return {
              ok: true,
              sync: { changed: applied.changed, added: applied.imported, removed: applied.removed, total: undefined },
              applied,
              state: await statePayload(ctx, state, config),
            };
          }
          const sync = await syncCatalog(ctx, cfg, state, 'manual');
          return {
            ok: true,
            sync,
            state: await statePayload(ctx, state, config),
          };
        });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && suffix === '/import') {
        const body = await readJsonBody(req);
        const result = await serial(async () => {
          const state = await readState(statePath);
          const { cfg } = resolveConnection(ctx, state, config);
          if (!cfg.provider) throw new Error('请先在面板里选择模型组');
          const importIds = Array.isArray(body.import) ? body.import.filter((id) => typeof id === 'string') : [];
          const removeIds = Array.isArray(body.remove) ? body.remove.filter((id) => typeof id === 'string') : [];
          if (importIds.length === 0 && removeIds.length === 0) throw new Error('没有选择任何模型');
          const applied = await applySelection(ctx, cfg, state, importIds, removeIds);
          return {
            ok: true,
            applied,
            state: await statePayload(ctx, state, config),
          };
        });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && suffix === '/select') {
        const body = await readJsonBody(req);
        const result = await serial(async () => {
          const state = await readState(statePath);
          const { cfg } = resolveConnection(ctx, state, config);
          if (!cfg.provider) throw new Error('请先在面板里选择模型组');
          const meta = (state.catalog || []).find((model) => model.id === body.model);
          if (!meta) throw new Error('目录里没有这个模型，请先刷新');
          const efforts = Array.isArray(meta.efforts) ? meta.efforts : [];
          let effort = typeof body.reasoningEffort === 'string' ? body.reasoningEffort : '';
          if (effort && !efforts.includes(effort)) throw new Error(`模型 ${meta.id} 不支持思考档位 ${effort}`);
          if (!effort) {
            effort = meta.defaultEffort && efforts.includes(meta.defaultEffort) ? meta.defaultEffort : efforts[0] || '';
          }
          const live = providerModels(ctx, cfg).find((model) => model.id === meta.id);
          const liveEfforts = live && live.reasoningEfforts && typeof live.reasoningEfforts === 'object'
            ? Object.keys(live.reasoningEfforts)
            : [];
          if (needsSync) await syncCatalog(ctx, cfg, state, 'select', meta.id);
          await ctx.agentDefaultModel.saveSelection({
            provider: cfg.provider,
            model: meta.id,
            ...(effort ? { reasoningEffort: effort } : {}),
          });
          return {
            ok: true,
            selection: ctx.agentDefaultModel.currentSelection(),
            state: await statePayload(ctx, state, config),
          };
        });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && suffix === '/settings') {
        const body = await readJsonBody(req);
        const result = await serial(async () => {
          const state = await readState(statePath);
          state.settings = state.settings || {};
          for (const key of ['baseURL', 'apiKeyEnv', 'provider', 'providerDisplayName', 'providerApi']) {
            if (typeof body[key] === 'string') state.settings[key] = body[key].trim();
          }
          if (typeof body.createProvider === 'boolean') state.settings.createProvider = body.createProvider;
          if (typeof body.nameTemplate === 'string') {
            state.settings.nameTemplate = body.nameTemplate.trim() || DEFAULTS.nameTemplate;
          }
          for (const key of ['syncMissingModels', 'syncReasoningEfforts', 'syncContextWindow', 'syncOnStartup']) {
            if (typeof body[key] === 'boolean') state.settings[key] = body[key];
          }

          const { cfg } = resolveConnection(ctx, state, config);
          // 只改开关类设置（例如启动刷新）时不做连接校验，避免被没填完的连接配置挡住。
          const touchedConnection = ['baseURL', 'apiKeyEnv', 'provider', 'providerDisplayName', 'providerApi', 'createProvider']
            .some((key) => Object.prototype.hasOwnProperty.call(body, key));
          if (touchedConnection || body.apply === true) {
            if (cfg.provider && !cfg.createProvider) {
              const exists = listProviders(ctx).some((provider) => provider.id === cfg.provider);
              if (!exists) throw new Error(`模型组 ${cfg.provider} 不存在；请从列表中选择或新建`);
            }
            if (cfg.createProvider && !cfg.provider) throw new Error('新建模型组需要填写模型组 ID');
            if (cfg.provider && (!cfg.baseURL || !cfg.apiKeyEnv)) {
              throw new Error('请填写接口地址和 API Key 引用');
            }
          }

          await writeState(statePath, state);
          let sync = null;
          if (body.apply === true && cfg.provider) {
            try {
              state.catalog = await fetchCatalog(ctx, cfg);
              state.fetchedAt = Date.now();
              state.lastError = null;
              await writeState(statePath, state);
            } catch (error) {
              state.lastError = errorMessage(error);
              await writeState(statePath, state);
              throw error;
            }
            sync = await syncCatalog(ctx, cfg, state, 'settings');
            if (cfg.createProvider && listProviders(ctx).some((provider) => provider.id === cfg.provider)) {
              state.settings.createProvider = false;
              await writeState(statePath, state);
            }
          }
          return {
            ok: true,
            sync,
            state: await statePayload(ctx, state, config),
          };
        });
        sendJson(res, 200, result);
        return;
      }

      sendJson(res, 404, { ok: false, error: 'not found' });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: errorMessage(error) });
    }
  };

  ctx.effect(
    () => ctx.webServer.register({
      kind: 'prefix',
      path: ROUTE_PREFIX,
      handler: (req, res) => handle(req, res),
    }),
    'model-catalog: HTTP routes',
  );

  // 一次性迁移：旧默认模板没有 id 前缀，升级后改为 {prefix}{name} [{credits}]。
  ctx.effect(() => {
    void serial(async () => {
      try {
        const state = await readState(statePath);
        if (state.settings && state.settings.nameTemplate === LEGACY_NAME_TEMPLATE) {
          state.settings.nameTemplate = DEFAULTS.nameTemplate;
          await writeState(statePath, state);
        }
      } catch (error) {
        console.warn(`[model-catalog] template migration failed: ${errorMessage(error)}`);
      }
    });
    return () => {};
  }, 'model-catalog: template migration');

  ctx.effect(() => {
    const timer = setTimeout(() => {
      void serial(async () => {
        try {
          let state = await readState(statePath);
          let { cfg } = resolveConnection(ctx, state, config);

          // 面板里可关闭「启动刷新」。关闭时连连接信息迁移也跳过，不做任何写入。
          if (!cfg.syncOnStartup) {
            console.log('[model-catalog] startup sync disabled in settings');
            return;
          }

          // 升级迁移：旧版本没有连接字段；如果已有目录，自动匹配包含这些模型 id 的模型组。
          const hasProviderSetting = state.settings && Object.prototype.hasOwnProperty.call(state.settings, 'provider');
          if ((!cfg.provider || !cfg.baseURL || !cfg.apiKeyEnv) && !hasProviderSetting) {
            const detected = autoDetectProvider(ctx, state);
            if (detected) {
              state.settings = {
                ...state.settings,
                provider: detected.id,
                baseURL: detected.baseURL,
                apiKeyEnv: detected.apiKeyEnv,
                providerDisplayName: detected.displayName,
                providerApi: detected.api || 'openai-completions',
                createProvider: false,
              };
              await writeState(statePath, state);
              ({ cfg } = resolveConnection(ctx, state, config));
              console.log(`[model-catalog] auto-detected provider ${detected.id}`);
            }
          }

          if (!cfg.provider || !cfg.baseURL || !cfg.apiKeyEnv) {
            console.log('[model-catalog] startup sync skipped: configure a model group in the panel');
            return;
          }

          const catalog = await fetchCatalog(ctx, cfg);
          state.catalog = catalog;
          state.fetchedAt = Date.now();
          state.lastError = null;
          await writeState(statePath, state);
          const sync = await syncCatalog(ctx, cfg, state, 'startup');
          console.log(
            `[model-catalog] startup: ${catalog.length} models, provider ${cfg.provider}, `
            + `sync ${sync.changed ? `applied (+${sync.added || 0} / -${sync.removed || 0})` : 'unchanged'}`,
          );
        } catch (error) {
          const message = errorMessage(error);
          const state = await readState(statePath);
          state.lastError = message;
          await writeState(statePath, state);
          console.warn(`[model-catalog] startup sync failed: ${message}`);
        }
      });
    }, 2500);
    return () => clearTimeout(timer);
  }, 'model-catalog: startup sync');
}
