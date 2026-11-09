/**
 * 模型目录面板 — Client 半侧。
 *
 * 左侧栏新增「模型目录」图标（main key = model-catalog），
 * 设置 → 模型目录 复用同一个面板。
 * 数据来自 Host 的同源路由 /model-catalog/state。
 */

window.__ModuleLoader__.load({
  id: 'dsh-model-catalog',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    const NS = 'model-catalog';
    const PANEL_ID = 'model-catalog';
    const EFFORT_LABELS = {
      off: 'effort.off',
      minimal: 'effort.minimal',
      low: 'effort.low',
      medium: 'effort.medium',
      high: 'effort.high',
      xhigh: 'effort.xhigh',
      max: 'effort.max',
    };
    const API_TYPES = ['openai-completions', 'openai-responses', 'anthropic-messages'];

    const zh = {
      'panel.title': '模型目录',
      'panel.subtitle': '积分倍率、描述与思考强度',
      'panel.models': '个模型',
      'panel.refresh': '刷新目录',
      'panel.refreshing': '刷新中…',
      'panel.sync': '同步到 DSH',
      'panel.syncing': '同步中…',
      'panel.saving': '保存中…',
      'panel.applying': '设置中…',
      'panel.lastFetch': '上次拉取',
      'panel.lastSync': '上次同步',
      'panel.never': '从未',
      'panel.neverSynced': '尚未同步到 DSH',
      'panel.refreshed': '目录已刷新',
      'panel.synced': '已同步到 DSH',
      'panel.changed': '已更新',
      'panel.unchanged': '无变化',
      'panel.default': '默认',
      'panel.defaultSet': '已设为默认模型',
      'panel.setDefault': '设为默认',
      'panel.setDefaultAgain': '重新应用',
      'panel.setDefaultNeedsImport': '先勾选并同步到 DSH，才能设为默认',
      'panel.unsynced': '未加入 DSH',
      'panel.free': '免费',
      'panel.context': '上下文',
      'panel.output': '输出',
      'panel.vision': '视觉',
      'panel.reasoning': '思考强度',
      'panel.apiDefault': '接口默认档位',
      'panel.noReasoning': '不可调档',
      'panel.template.title': '显示名称模板',
      'panel.template.hint': '变量：{prefix} {group} {name} {id} {credits} {description} {context} {maxTokens} {vendor} {tier}',
      'panel.template.save': '保存并应用',
      'panel.template.saved': '模板已保存并重新同步',
      'panel.template.preview': '预览：',
      'panel.startup.title': '启动 DSH 时自动刷新名称与积分',
      'panel.startup.hint': '每次打开 DSH 拉取一次模型目录，只改写已导入模型的 name、思考档位、上下文与输出，不会新增或删除模型。',
      'panel.startup.on': '已开启：下次启动 DSH 时自动刷新',
      'panel.startup.off': '已关闭：启动时不再刷新模型名称',
      'panel.search': '搜索模型、id、描述…',
      'panel.filter.all': '全部',
      'panel.filter.synced': '已导入',
      'panel.filter.unsynced': '未导入',
      'panel.filter.stale': '已下架',
      'panel.filter.cn': '国内',
      'panel.filter.global': '国际',
      'panel.empty': '没有匹配的模型',
      'panel.pick.select': '选择',
      'panel.pick.all': '全选当前',
      'panel.pick.none': '取消选择',
      'panel.pick.count': '已选',
      'panel.pick.beforeSync': '点右上角「同步到 DSH」生效',
      'panel.pick.noneSelected': '先勾选要处理的模型',
      'panel.pick.done': '已更新模型组',
      'panel.toImport': '将导入',
      'panel.toRemove': '将移除',
      'panel.staleKeep': '保留',
      'panel.staleDrop': '删掉',
      'panel.stale': '云端已无此模型',
      'panel.deleteOne': '从模型组删除',
      'panel.importOne': '导入',
      'panel.imported': '已导入',
      'panel.group.stale': '需要处理',
      'panel.group.imported': '已导入',
      'panel.group.other': '可导入',
      'panel.loading': '正在读取模型目录…',
      'panel.error': '出错了',
      'panel.retry': '重试',
      'panel.note':
        '勾选的模型就是 DSH 里保留的模型：点右上角「同步到 DSH」后，勾选项会被导入/刷新，未勾选项从模型组移除。目录里已下架的旧模型默认保留并置顶标红，取消勾选或点「删掉」再同步即可清除。',
      'panel.connection.title': '连接配置',
      'panel.connection.hint': '从已有模型组引入，或新建一个模型组。接口地址和密钥引用只保存在本机，密钥写入 DSH 凭据。',
      'panel.connection.provider': '模型组',
      'panel.connection.providerPlaceholder': '选择已有模型组…',
      'panel.connection.newProvider': '＋ 新建模型组…',
      'panel.connection.providerId': '模型组 ID',
      'panel.connection.displayName': '显示名称',
      'panel.connection.api': '接口协议',
      'panel.connection.baseURL': '接口地址',
      'panel.connection.baseURLPlaceholder': 'https://your-gateway.example/v1',
      'panel.connection.apiKeyEnv': 'API Key 引用',
      'panel.connection.apiKeyEnvPlaceholder': 'MY_API_KEY（凭据名，不是密钥）',
      'panel.connection.apiKey': 'API Key',
      'panel.connection.apiKeyPlaceholder': '粘贴密钥，保存到 DSH 凭据',
      'panel.connection.saveKey': '保存密钥',
      'panel.connection.clearKey': '清除密钥',
      'panel.connection.keyConfigured': '密钥已配置',
      'panel.connection.keyMissing': '密钥未配置',
      'panel.connection.save': '保存并同步',
      'panel.connection.saved': '连接配置已保存',
      'panel.connection.configured': '已配置',
      'panel.connection.unconfigured': '未配置',
      'panel.connection.importHint': '选择已有模型组会自动带出地址和密钥引用。',
      'panel.connection.noProviders': '还没有可引入的模型组；可以新建一个。',
      'panel.connection.modelCount': '个模型',
      'panel.connection.keySaved': '密钥已保存到 DSH 凭据',
      'panel.connection.keyCleared': '密钥已清除',
      'panel.connection.keyRequired': '先填写 API Key',
      'panel.connection.refRequired': '先填写 API Key 引用',
      'panel.connection.syncSkipped': '已保存；未选择模型组，暂未同步',
      'panel.apiDefaultMark': '接口默认',
      'effort.off': '关闭',
      'effort.minimal': '极低',
      'effort.low': '低',
      'effort.medium': '中',
      'effort.high': '高',
      'effort.xhigh': '极高',
      'effort.max': '最高',
    };

    const en = {
      'panel.title': 'Model Catalog',
      'panel.subtitle': 'Credits, descriptions, and reasoning levels',
      'panel.models': 'models',
      'panel.refresh': 'Refresh catalog',
      'panel.refreshing': 'Refreshing…',
      'panel.sync': 'Sync to DSH',
      'panel.syncing': 'Syncing…',
      'panel.saving': 'Saving…',
      'panel.applying': 'Applying…',
      'panel.lastFetch': 'Fetched',
      'panel.lastSync': 'Synced',
      'panel.never': 'never',
      'panel.neverSynced': 'Not synced to DSH yet',
      'panel.refreshed': 'Catalog refreshed',
      'panel.synced': 'Synced to DSH',
      'panel.changed': 'updated',
      'panel.unchanged': 'no changes',
      'panel.default': 'Default',
      'panel.defaultSet': 'Default model updated',
      'panel.setDefault': 'Set default',
      'panel.setDefaultAgain': 'Apply again',
      'panel.setDefaultNeedsImport': 'Import it to DSH first, then set it as default',
      'panel.unsynced': 'Not in DSH',
      'panel.free': 'Free',
      'panel.context': 'Context',
      'panel.output': 'Output',
      'panel.vision': 'Vision',
      'panel.reasoning': 'Reasoning',
      'panel.apiDefault': 'API default level',
      'panel.noReasoning': 'fixed',
      'panel.template.title': 'Display name template',
      'panel.template.hint': 'Variables: {prefix} {group} {name} {id} {credits} {description} {context} {maxTokens} {vendor} {tier}',
      'panel.template.save': 'Save & apply',
      'panel.template.saved': 'Template saved and re-synced',
      'panel.template.preview': 'Preview: ',
      'panel.startup.title': 'Refresh names and credits on DSH startup',
      'panel.startup.hint': 'Fetches the catalog once per start and rewrites the name, reasoning levels, context and output of models already in the group. It never adds or removes models.',
      'panel.startup.on': 'On: names refresh on the next DSH start',
      'panel.startup.off': 'Off: startup no longer refreshes model names',
      'panel.search': 'Search model, id, description…',
      'panel.filter.all': 'All',
      'panel.filter.synced': 'Imported',
      'panel.filter.unsynced': 'Not imported',
      'panel.filter.stale': 'Delisted',
      'panel.filter.cn': 'China',
      'panel.filter.global': 'Global',
      'panel.empty': 'No matching models',
      'panel.pick.select': 'Select',
      'panel.pick.all': 'Select all shown',
      'panel.pick.none': 'Clear selection',
      'panel.pick.count': 'selected',
      'panel.pick.beforeSync': 'click “Sync to DSH” to apply',
      'panel.pick.noneSelected': 'Select at least one model first',
      'panel.pick.done': 'Model group updated',
      'panel.toImport': 'will import',
      'panel.toRemove': 'will remove',
      'panel.staleKeep': 'Keep',
      'panel.staleDrop': 'Drop',
      'panel.stale': 'No longer in catalog',
      'panel.deleteOne': 'Remove from model group',
      'panel.importOne': 'Import',
      'panel.imported': 'Imported',
      'panel.group.stale': 'Needs attention',
      'panel.group.imported': 'Imported',
      'panel.group.other': 'Available',
      'panel.loading': 'Loading the model catalog…',
      'panel.error': 'Something went wrong',
      'panel.retry': 'Retry',
      'panel.note':
        'Checked models are the ones kept in DSH. “Sync to DSH” imports/refreshes the checked models and removes the unchecked ones from the model group. Models that dropped out of the catalog stay pinned and highlighted in red; uncheck them (or use “Drop”) and sync to remove them.',
      'panel.connection.title': 'Connection',
      'panel.connection.hint': 'Import an existing model group, or create one. The URL and credential reference stay local; the key is stored in DSH credentials.',
      'panel.connection.provider': 'Model group',
      'panel.connection.providerPlaceholder': 'Choose an existing model group…',
      'panel.connection.newProvider': '+ New model group…',
      'panel.connection.providerId': 'Model group ID',
      'panel.connection.displayName': 'Display name',
      'panel.connection.api': 'API protocol',
      'panel.connection.baseURL': 'Base URL',
      'panel.connection.baseURLPlaceholder': 'https://your-gateway.example/v1',
      'panel.connection.apiKeyEnv': 'API key reference',
      'panel.connection.apiKeyEnvPlaceholder': 'MY_API_KEY (credential name, not the key)',
      'panel.connection.apiKey': 'API key',
      'panel.connection.apiKeyPlaceholder': 'Paste the key; it is stored in DSH credentials',
      'panel.connection.saveKey': 'Save key',
      'panel.connection.clearKey': 'Clear key',
      'panel.connection.keyConfigured': 'Key configured',
      'panel.connection.keyMissing': 'Key not configured',
      'panel.connection.save': 'Save & sync',
      'panel.connection.saved': 'Connection saved',
      'panel.connection.configured': 'Configured',
      'panel.connection.unconfigured': 'Not configured',
      'panel.connection.importHint': 'Choosing an existing group fills in its URL and key reference.',
      'panel.connection.noProviders': 'No existing model groups; create one below.',
      'panel.connection.modelCount': 'models',
      'panel.connection.keySaved': 'Key saved to DSH credentials',
      'panel.connection.keyCleared': 'Key cleared',
      'panel.connection.keyRequired': 'Enter an API key first',
      'panel.connection.refRequired': 'Enter an API key reference first',
      'panel.connection.syncSkipped': 'Saved; no model group selected, so nothing was synced',
      'panel.apiDefaultMark': 'API default',
      'effort.off': 'off',
      'effort.minimal': 'minimal',
      'effort.low': 'low',
      'effort.medium': 'medium',
      'effort.high': 'high',
      'effort.xhigh': 'xhigh',
      'effort.max': 'max',
    };

    const CSS = `
.mc-root{height:100%;overflow:auto;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;}
.mc-root *{box-sizing:border-box;}
.mc-inner{max-width:1040px;margin:0 auto;padding:26px 26px 56px;}
.mc-root.mc-embedded{height:auto;overflow:visible;background:transparent;}
.mc-root.mc-embedded .mc-inner{max-width:900px;padding:0 0 40px;}
.mc-hero{display:flex;gap:14px;align-items:flex-start;margin-bottom:18px;}
.mc-hero-icon{width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#2f7cf6,#7b3ff2);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:21px;flex:0 0 auto;}
.mc-hero h1{font-size:21px;line-height:1.25;margin:0 0 4px;font-weight:650;}
.mc-hero p{margin:0;color:var(--dsw-alias-label-secondary);font-size:12.5px;}
.mc-hero-actions{margin-left:auto;display:flex;gap:8px;flex:0 0 auto;}
.mc-btn{appearance:none;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:9px;padding:7px 12px;font-size:12.5px;cursor:pointer;line-height:1.2;white-space:nowrap;}
.mc-btn:hover{background:var(--dsw-alias-bg-layer-2);}
.mc-btn:disabled{opacity:.55;cursor:not-allowed;}
.mc-btn-primary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#fff;}
.mc-btn-primary:hover{filter:brightness(1.06);}
.mc-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:14px;padding:15px 17px;margin-bottom:14px;}
.mc-card-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;margin-bottom:9px;}
.mc-card-head h2{font-size:13.5px;margin:0 0 3px;font-weight:600;}
.mc-card-head p{margin:0;font-size:11.5px;color:var(--dsw-alias-label-secondary);line-height:1.5;}
.mc-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px;}
.mc-field{display:flex;flex-direction:column;gap:5px;font-size:11.5px;color:var(--dsw-alias-label-secondary);min-width:0;}
.mc-field-wide{grid-column:1/-1;}
.mc-field .mc-input,.mc-field .mc-select{font-size:13px;}
.mc-select{width:100%;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:9px;padding:8px 11px;outline:none;}
.mc-select:focus{border-color:var(--dsw-alias-brand-primary);}
.mc-key-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px;}
.mc-key-row .mc-input{flex:1 1 220px;min-width:180px;}
.mc-key-status{font-size:11.5px;color:var(--dsw-alias-label-secondary);}
.mc-key-status[data-ok="true"]{color:var(--dsw-alias-state-success-primary);}
.mc-key-status[data-ok="false"]{color:var(--dsw-alias-state-warn-primary);}
.mc-form-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px;}
.mc-form-actions .mc-note{margin:0;}
.mc-input{width:100%;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:9px;padding:8px 11px;font-size:13px;outline:none;}
.mc-input:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent);}
.mc-preview{margin-top:8px;font-size:11.5px;color:var(--dsw-alias-label-secondary);word-break:break-word;}
.mc-preview strong{color:var(--dsw-alias-label-primary);font-weight:600;}
.mc-toggle-row{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-top:13px;padding-top:13px;border-top:1px solid var(--dsw-alias-border-l1);}
.mc-toggle{display:flex;gap:7px;align-items:center;font-size:12.5px;color:var(--dsw-alias-label-primary);cursor:pointer;white-space:nowrap;}
.mc-toggle input{width:15px;height:15px;margin:0;accent-color:var(--dsw-alias-brand-primary);cursor:pointer;}
.mc-toggle-row .mc-note{margin:0;flex:1 1 260px;}
.mc-banner{border-radius:10px;padding:9px 12px;font-size:12.5px;margin-bottom:12px;line-height:1.5;word-break:break-word;}
.mc-banner-error{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);color:var(--dsw-alias-state-error-primary);border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 26%,transparent);}
.mc-banner-ok{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 10%,transparent);color:var(--dsw-alias-state-success-primary);border:1px solid color-mix(in srgb,var(--dsw-alias-state-success-primary) 24%,transparent);}
.mc-banner-warn{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 12%,transparent);color:var(--dsw-alias-state-warn-primary);border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary) 26%,transparent);}
.mc-toolbar{display:flex;gap:10px;align-items:center;margin:4px 0 13px;flex-wrap:wrap;}
.mc-toolbar .mc-input{flex:1 1 220px;min-width:180px;}
.mc-seg{display:flex;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;overflow:hidden;background:var(--dsw-alias-bg-layer-1);}
.mc-seg button{border:0;background:transparent;color:var(--dsw-alias-label-secondary);padding:7px 10px;font-size:11.5px;cursor:pointer;white-space:nowrap;}
.mc-seg button[data-active="true"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:600;}
.mc-count{font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap;}
.mc-list{display:flex;flex-direction:column;gap:10px;}
.mc-row{display:flex;gap:14px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:14px;padding:13px 15px;}
.mc-row[data-default="true"]{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 55%,var(--dsw-alias-border-l1));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent);}
.mc-row-main{min-width:0;flex:1;}
.mc-row-title{display:flex;gap:7px;align-items:center;flex-wrap:wrap;}
.mc-name{font-size:14px;font-weight:600;}
.mc-id{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:2px;word-break:break-all;}
.mc-badge{font-size:10px;line-height:1;padding:4px 6px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);white-space:nowrap;}
.mc-badge-default{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 42%,transparent);}
.mc-badge-unsynced{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 42%,transparent);}
.mc-badge-free{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 36%,transparent);}
.mc-credit{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border-radius:6px;padding:4px 7px;white-space:nowrap;}
.mc-desc{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:7px;line-height:1.55;word-break:break-word;}
.mc-meta{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:7px;}
.mc-efforts{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:9px;}
.mc-efforts-label{font-size:11px;color:var(--dsw-alias-label-secondary);margin-right:2px;}
.mc-chip{border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:999px;padding:3px 9px;font-size:11px;cursor:pointer;line-height:1.5;}
.mc-chip:hover{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);}
.mc-chip[data-active="true"]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 13%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 46%,transparent);color:var(--dsw-alias-brand-primary);font-weight:600;}
.mc-chip[data-default="true"]{border-style:dashed;}
.mc-row-actions{display:flex;flex-direction:column;justify-content:center;align-items:flex-end;gap:7px;flex:0 0 auto;}
.mc-pick{display:flex;align-items:flex-start;padding-top:2px;flex:0 0 auto;}
.mc-pick input{width:16px;height:16px;margin:0;cursor:pointer;accent-color:var(--dsw-alias-brand-primary);}
.mc-row[data-stale="true"]{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 55%,var(--dsw-alias-border-l1));background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 7%,var(--dsw-alias-bg-layer-1));}
.mc-row[data-stale="true"] .mc-name{color:var(--dsw-alias-state-error-primary);}
.mc-row[data-selected="true"]{box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-brand-primary) 38%,transparent);}
.mc-badge-stale{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 42%,transparent);}
.mc-badge-imported{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 36%,transparent);}
.mc-group-title{display:flex;align-items:center;gap:8px;margin:16px 0 8px;font-size:11.5px;color:var(--dsw-alias-label-secondary);}
.mc-group-title:first-child{margin-top:0;}
.mc-group-title::after{content:"";flex:1;height:1px;background:var(--dsw-alias-border-l1);}
.mc-bulk{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 12px;}
.mc-bulk .mc-count{margin-left:auto;}
.mc-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 42%,transparent);}
.mc-btn-danger:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);}
.mc-empty,.mc-loading{padding:42px 20px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:12.5px;}
.mc-note{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:14px;line-height:1.65;}
`;

    function api(path, body) {
      const init = body === undefined
        ? { headers: { accept: 'application/json' } }
        : {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify(body),
          };
      return fetch(`/model-catalog${path}`, init).then(async (response) => {
        let json = null;
        try {
          json = await response.json();
        } catch {
          json = null;
        }
        if (!response.ok || !json || json.ok === false) {
          throw new Error((json && json.error) || `HTTP ${response.status}`);
        }
        return json;
      });
    }

    function fmt(value) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—';
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

    function time(ts) {
      if (!ts) return '—';
      try {
        return new Date(ts).toLocaleTimeString();
      } catch {
        return '—';
      }
    }

    /** 与 Host 侧一致：模型 id 自然序（数字段按数值比较）。 */
    function compareModelId(left, right) {
      const a = String(left == null ? '' : left);
      const b = String(right == null ? '' : right);
      const hint = a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
      if (hint !== 0) return hint;
      return a < b ? -1 : a > b ? 1 : 0;
    }

    function formatName(template, model) {
      const tpl = typeof template === 'string' && template.trim() ? template : '{prefix}{name} [{credits}]';
      const text = tpl.replace(/\{([a-zA-Z][\w]*)\}/g, (_, rawKey) => {
        switch (rawKey.toLowerCase()) {
          case 'name':
            return model.name || model.id;
          case 'id':
            return model.id;
          case 'prefix':
          case 'idprefix': {
            const index = String(model.id || '').indexOf(':');
            return index >= 0 ? String(model.id).slice(0, index + 1) : '';
          }
          case 'group': {
            const index = String(model.id || '').indexOf(':');
            return index >= 0 ? String(model.id).slice(0, index) : '';
          }
          case 'credits':
          case 'credit':
            return model.credits || '';
          case 'description':
            return model.cleanDescription || model.description || '';
          case 'context':
          case 'contextwindow':
            return fmt(model.contextWindow) === '—' ? '' : fmt(model.contextWindow);
          case 'maxtokens':
          case 'output':
            return fmt(model.maxTokens) === '—' ? '' : fmt(model.maxTokens);
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

    function effortLabel(t, effort) {
      const key = EFFORT_LABELS[effort];
      if (!key) return effort;
      const label = t(key);
      return label && label !== key ? label : effort;
    }

    function useCatalog() {
      const [data, setData] = useState(null);
      const [error, setError] = useState('');
      const [loading, setLoading] = useState(true);
      const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
          setData(await api('/state'));
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setLoading(false);
        }
      }, []);
      useEffect(() => {
        void load();
      }, [load]);
      return { data, error, loading, reload: load, setData };
    }

    function ModelRow(props) {
      const { m, t, imported, stale, isDefault, defaultEffort, busy, checked, onToggle, onSelect } = props;
      const efforts = Array.isArray(m.efforts) ? m.efforts : [];
      const [effort, setEffort] = useState(
        isDefault ? defaultEffort || '' : m.defaultEffort || efforts[0] || '',
      );
      useEffect(() => {
        if (isDefault) setEffort(defaultEffort || '');
      }, [isDefault, defaultEffort]);
      const selected = effort || (isDefault ? defaultEffort : '') || '';

      return h(
        'div',
        {
          className: 'mc-row',
          'data-default': isDefault ? 'true' : 'false',
          'data-stale': stale ? 'true' : 'false',
          'data-selected': checked ? 'true' : 'false',
        },
        h(
          'label',
          { className: 'mc-pick', title: t('panel.pick.select') },
          h('input', {
            type: 'checkbox',
            checked: Boolean(checked),
            onChange: () => onToggle(m.id),
            'aria-label': `${t('panel.pick.select')} ${m.id}`,
          }),
        ),
        h(
          'div',
          { className: 'mc-row-main' },
          h(
            'div',
            { className: 'mc-row-title' },
            h('span', { className: 'mc-name' }, m.displayName || m.name),
            isDefault ? h('span', { className: 'mc-badge mc-badge-default' }, t('panel.default')) : null,
            stale
              ? h('span', { className: 'mc-badge mc-badge-stale' }, t('panel.stale'))
              : imported === checked
                ? h(
                    'span',
                    { className: 'mc-badge mc-badge-imported' },
                    checked ? t('panel.imported') : t('panel.toRemove'),
                  )
                : h(
                    'span',
                    { className: 'mc-badge mc-badge-unsynced' },
                    checked ? t('panel.toImport') : t('panel.toRemove'),
                  ),
            !stale && m.creditValue === 0 ? h('span', { className: 'mc-badge mc-badge-free' }, t('panel.free')) : null,
            !stale && m.credits ? h('span', { className: 'mc-credit' }, m.credits) : null,
          ),
          h('div', { className: 'mc-id' }, m.id),
          !stale && (m.cleanDescription || m.description)
            ? h('div', { className: 'mc-desc' }, m.cleanDescription || m.description)
            : null,
          stale
            ? null
            : h(
                'div',
                { className: 'mc-meta' },
                h('span', null, `${t('panel.context')} ${fmt(m.contextWindow)}`),
                h('span', null, `${t('panel.output')} ${fmt(m.maxTokens)}`),
                m.supportsImages ? h('span', null, t('panel.vision')) : null,
                m.vendor ? h('span', null, `vendor ${m.vendor}`) : null,
                m.tier ? h('span', null, m.tier) : null,
              ),
          stale
            ? null
            : efforts.length > 0
              ? h(
                  'div',
                  { className: 'mc-efforts' },
                  h('span', { className: 'mc-efforts-label' }, t('panel.reasoning')),
                  efforts.map((item) =>
                    h(
                      'button',
                      {
                        key: item,
                        type: 'button',
                        className: 'mc-chip',
                        'data-active': selected === item ? 'true' : 'false',
                        'data-default': m.defaultEffort === item ? 'true' : 'false',
                        title: m.defaultEffort === item ? t('panel.apiDefault') : undefined,
                        onClick: () => setEffort(item),
                      },
                      effortLabel(t, item),
                    ),
                  ),
                )
              : h(
                  'div',
                  { className: 'mc-efforts' },
                  h('span', { className: 'mc-efforts-label' }, t('panel.reasoning')),
                  h('span', { className: 'mc-id' }, t('panel.noReasoning')),
                ),
        ),
        h(
          'div',
          { className: 'mc-row-actions' },
          stale
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'mc-btn mc-btn-danger',
                  disabled: busy,
                  onClick: () => onToggle(m.id),
                },
                checked ? t('panel.staleKeep') : t('panel.staleDrop'),
              )
            : h(
                'button',
                {
                  type: 'button',
                  className: 'mc-btn',
                  disabled: busy,
                  onClick: () => onToggle(m.id),
                },
                imported ? t('panel.deleteOne') : t('panel.importOne'),
              ),
          stale
            ? null
            : h(
                'button',
                {
                  type: 'button',
                  className: isDefault ? 'mc-btn' : 'mc-btn mc-btn-primary',
                  disabled: busy || !imported,
                  title: imported ? undefined : t('panel.setDefaultNeedsImport'),
                  onClick: () => onSelect(m, selected),
                },
                busy ? t('panel.applying') : isDefault ? t('panel.setDefaultAgain') : t('panel.setDefault'),
              ),
        ),
      );
    }

    function Panel(props) {
      const { t, embedded } = props;
      const { data, error, loading, reload, setData } = useCatalog();
      const [busy, setBusy] = useState('');
      const [query, setQuery] = useState('');
      const [filter, setFilter] = useState('all');
      const [template, setTemplate] = useState('');
      const [notice, setNotice] = useState('');
      const [fail, setFail] = useState('');
      const templateInitialized = useRef(false);
      const connInitialized = useRef(false);
      const [conn, setConn] = useState({
        provider: '',
        providerDisplayName: '',
        providerApi: 'openai-completions',
        baseURL: '',
        apiKeyEnv: '',
        createProvider: false,
      });
      const [providerChoice, setProviderChoice] = useState('');
      const [apiKey, setApiKey] = useState('');
      const [credential, setCredential] = useState(null);
      const [picked, setPicked] = useState(() => new Set());
      const pickedInitialized = useRef(false);
      const [startup, setStartup] = useState(true);
      const startupInitialized = useRef(false);

      // 勾选集合 = 「DSH 里应该有的模型」。首次拿到数据时按当前模型组预勾选，
      // 之后由用户自己改；换个模型组或刷新后重新对齐。
      useEffect(() => {
        if (!data) return;
        if (pickedInitialized.current) return;
        pickedInitialized.current = true;
        setPicked(new Set(data.syncedIds || []));
      }, [data]);

      // 切模型组时重新按新模型组的已导入集合对齐。
      const lastProvider = useRef('');
      useEffect(() => {
        const provider = (data && data.provider) || '';
        const signature = `${provider}|${data ? data.fetchedAt : 0}`;
        if (!data || lastProvider.current === signature) return;
        lastProvider.current = signature;
        if (pickedInitialized.current) setPicked(new Set(data.syncedIds || []));
      }, [data]);

      useEffect(() => {
        if (data && !templateInitialized.current) {
          templateInitialized.current = true;
          setTemplate(data.settings?.nameTemplate || '{prefix}{name} [{credits}]');
        }
        if (!data) return;
        setCredential(data.credential || null);
        if (!startupInitialized.current) {
          startupInitialized.current = true;
          setStartup(data.settings?.syncOnStartup !== false);
        }
        if (!connInitialized.current) {
          connInitialized.current = true;
          const settings = data.settings || {};
          setConn({
            provider: settings.provider || '',
            providerDisplayName: settings.providerDisplayName || '',
            providerApi: settings.providerApi || 'openai-completions',
            baseURL: settings.baseURL || '',
            apiKeyEnv: settings.apiKeyEnv || '',
            createProvider: Boolean(settings.createProvider),
          });
          setProviderChoice(settings.provider || (settings.createProvider ? '__new__' : ''));
        }
      }, [data]);

      const providers = (data && data.providers) || [];

      const checkCredential = useCallback(async (ref) => {
        const value = typeof ref === 'string' ? ref.trim() : '';
        if (!value) {
          setCredential(null);
          return;
        }
        try {
          const result = await api(`/credential?ref=${encodeURIComponent(value)}`);
          setCredential(result.credential || null);
        } catch {
          setCredential(null);
        }
      }, []);

      const onProviderChange = useCallback(
        (event) => {
          const value = event.target.value;
          setProviderChoice(value);
          if (value === '__new__') {
            setConn({
              provider: '',
              providerDisplayName: '',
              providerApi: 'openai-completions',
              baseURL: '',
              apiKeyEnv: '',
              createProvider: true,
            });
            setCredential(null);
            return;
          }
          if (!value) {
            setConn({
              provider: '',
              providerDisplayName: '',
              providerApi: 'openai-completions',
              baseURL: '',
              apiKeyEnv: '',
              createProvider: false,
            });
            setCredential(null);
            return;
          }
          const provider = providers.find((item) => item.id === value);
          if (!provider) return;
          setConn({
            provider: provider.id,
            providerDisplayName: provider.displayName,
            providerApi: provider.api || 'openai-completions',
            baseURL: provider.baseURL,
            apiKeyEnv: provider.apiKeyEnv,
            createProvider: false,
          });
          void checkCredential(provider.apiKeyEnv);
        },
        [providers, checkCredential],
      );

      const saveApiKey = useCallback(async () => {
        const ref = conn.apiKeyEnv.trim();
        if (!ref) {
          setFail(t('panel.connection.refRequired'));
          return;
        }
        if (!apiKey.trim()) {
          setFail(t('panel.connection.keyRequired'));
          return;
        }
        setBusy('key');
        setFail('');
        setNotice('');
        try {
          const result = await api('/credentials', { ref, value: apiKey });
          setCredential(result.credential || null);
          setApiKey('');
          setNotice(t('panel.connection.keySaved'));
        } catch (err) {
          setFail(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy('');
        }
      }, [apiKey, conn.apiKeyEnv, t]);

      const clearApiKey = useCallback(async () => {
        const ref = conn.apiKeyEnv.trim();
        if (!ref) {
          setFail(t('panel.connection.refRequired'));
          return;
        }
        setBusy('key');
        setFail('');
        setNotice('');
        try {
          const result = await api('/credentials/clear', { ref });
          setCredential(result.credential || null);
          setNotice(t('panel.connection.keyCleared'));
        } catch (err) {
          setFail(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy('');
        }
      }, [conn.apiKeyEnv, t]);

      const saveConnection = useCallback(async () => {
        setBusy('conn');
        setFail('');
        setNotice('');
        try {
          const ref = conn.apiKeyEnv.trim();
          if (apiKey.trim() && ref) {
            const keyResult = await api('/credentials', { ref, value: apiKey });
            setCredential(keyResult.credential || null);
            setApiKey('');
          }
          const result = await api('/settings', {
            provider: conn.provider,
            providerDisplayName: conn.providerDisplayName,
            providerApi: conn.providerApi,
            baseURL: conn.baseURL,
            apiKeyEnv: conn.apiKeyEnv,
            createProvider: conn.createProvider,
            nameTemplate: template,
            syncMissingModels: data?.settings?.syncMissingModels ?? true,
            syncReasoningEfforts: data?.settings?.syncReasoningEfforts ?? true,
            syncContextWindow: data?.settings?.syncContextWindow ?? true,
            apply: true,
          });
          setData(result.state);
          const settings = result.state.settings || {};
          setConn({
            provider: settings.provider || '',
            providerDisplayName: settings.providerDisplayName || '',
            providerApi: settings.providerApi || 'openai-completions',
            baseURL: settings.baseURL || '',
            apiKeyEnv: settings.apiKeyEnv || '',
            createProvider: Boolean(settings.createProvider),
          });
          setProviderChoice(settings.provider || (settings.createProvider ? '__new__' : ''));
          setCredential(result.state.credential || null);
          setNotice(result.sync ? t('panel.connection.saved') : t('panel.connection.syncSkipped'));
        } catch (err) {
          setFail(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy('');
        }
      }, [conn, data, setData, t, template]);

      const models = (data && data.catalog) || [];
      const syncedIds = useMemo(() => new Set((data && data.syncedIds) || []), [data]);
      const staleModels = (data && data.staleModels) || [];
      const staleIds = useMemo(() => new Set(staleModels.map((model) => model.id)), [staleModels]);
      const defaultSelection = data && data.defaultSelection;
      const isDefault = useCallback(
        (model) =>
          Boolean(defaultSelection) &&
          defaultSelection.provider === (data && data.provider) &&
          defaultSelection.model === model.id,
        [data, defaultSelection],
      );

      const togglePick = useCallback((id) => {
        setPicked((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      }, []);

      const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const match = (model) => {
          if (filter === 'synced' && !syncedIds.has(model.id)) return false;
          if (filter === 'unsynced' && syncedIds.has(model.id)) return false;
          if (filter === 'stale' && !staleIds.has(model.id)) return false;
          if (filter === 'cn' && !String(model.id).startsWith('cn:')) return false;
          if (filter === 'global' && !String(model.id).startsWith('global:')) return false;
          if (!q) return true;
          return [model.id, model.name, model.displayName, model.credits, model.description, model.vendor, model.tier]
            .some((value) => String(value || '').toLowerCase().includes(q));
        };
        const catalogRows = models.filter(match).map((model) => ({
          model,
          stale: false,
          imported: syncedIds.has(model.id),
        }));
        // 已下架的旧模型单独标红置顶，方便一次性清掉。
        const staleRows =
          filter === 'unsynced' || filter === 'cn' || filter === 'global'
            ? []
            : staleModels.filter(match).map((model) => ({ model, stale: true, imported: true }));
        // 顺序：需处理（已下架）→ 已导入 → 可导入，组内按 id 排序。
        const orderById = (rows) => rows
          .slice()
          .sort((left, right) => compareModelId(left.model.id, right.model.id));
        const importedRows = orderById(catalogRows.filter((row) => row.imported));
        const otherRows = orderById(catalogRows.filter((row) => !row.imported));
        return [...orderById(staleRows), ...importedRows, ...otherRows];
      }, [models, staleModels, staleIds, syncedIds, filter, query]);

      const visibleIds = useMemo(() => filtered.map((row) => row.model.id), [filtered]);

      const pickAll = useCallback(() => {
        setPicked((prev) => {
          const next = new Set(prev);
          for (const id of visibleIds) next.add(id);
          return next;
        });
      }, [visibleIds]);

      const pickNone = useCallback(() => {
        setPicked((prev) => {
          const next = new Set(prev);
          for (const id of visibleIds) next.delete(id);
          return next;
        });
      }, [visibleIds]);

      const previewModel = models.find((model) => isDefault(model)) || models[0];
      const preview = previewModel ? formatName(template, previewModel) : '—';

      const doRefresh = useCallback(async () => {
        setBusy('refresh');
        setFail('');
        setNotice('');
        try {
          const result = await api('/refresh', { sync: false });
          setData(result.state);
          setNotice(`${t('panel.refreshed')} · ${result.count}`);
        } catch (err) {
          setFail(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy('');
        }
      }, [setData, t]);

      // 勾选 = DSH 里应有的模型集合：勾选的补齐/更新，取消勾选的移除；
      // 已下架的旧模型默认保留，除非显式勾掉。
      const doSync = useCallback(async () => {
        setBusy('sync');
        setFail('');
        setNotice('');
        try {
          const keep = [...picked];
          const importIds = keep.filter((id) => !syncedIds.has(id) && !staleIds.has(id));
          const removeIds = [
            ...models.map((model) => model.id).filter((id) => !picked.has(id)),
            ...[...staleIds].filter((id) => !picked.has(id)),
          ];
          const result = await api('/sync', {
            ...(keep.length > 0 ? { keep } : {}),
            import: importIds,
            remove: removeIds,
          });
          setData(result.state);
          const sync = result.sync || {};
          setNotice(
            `${t('panel.synced')} · ${sync.changed ? t('panel.changed') : t('panel.unchanged')}${
              sync.added ? ` · +${sync.added}` : ''
            }${sync.removed ? ` · -${sync.removed}` : ''}`,
          );
        } catch (err) {
          setFail(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy('');
        }
      }, [models, picked, setData, staleIds, syncedIds, t]);

      // 启动刷新开关：只写设置，不触发同步；下次启动 DSH 生效。
      const toggleStartup = useCallback(
        async (next) => {
          setStartup(next);
          setBusy('startup');
          setFail('');
          setNotice('');
          try {
            const result = await api('/settings', { syncOnStartup: next });
            setData(result.state);
            setStartup(result.state?.settings?.syncOnStartup !== false);
            setNotice(next ? t('panel.startup.on') : t('panel.startup.off'));
          } catch (err) {
            setStartup(!next);
            setFail(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy('');
          }
        },
        [setData, t],
      );

      const saveTemplate = useCallback(async () => {
        setBusy('template');
        setFail('');
        setNotice('');
        try {
          const result = await api('/settings', { nameTemplate: template, apply: true });
          setData(result.state);
          setNotice(t('panel.template.saved'));
        } catch (err) {
          setFail(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy('');
        }
      }, [setData, t, template]);

      const selectModel = useCallback(
        async (model, effort) => {
          setBusy(`select:${model.id}`);
          setFail('');
          setNotice('');
          try {
            const result = await api('/select', { model: model.id, reasoningEffort: effort });
            setData(result.state);
            setNotice(`${t('panel.defaultSet')} · ${model.displayName || model.name}`);
          } catch (err) {
            setFail(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy('');
          }
        },
        [setData, t],
      );

      if (loading && !data) {
        return h(
          'div',
          { className: `mc-root${embedded ? ' mc-embedded' : ''}` },
          h('style', null, CSS),
          h('div', { className: 'mc-loading' }, t('panel.loading')),
        );
      }

      if (error && !data) {
        return h(
          'div',
          { className: `mc-root${embedded ? ' mc-embedded' : ''}` },
          h('style', null, CSS),
          h(
            'div',
            { className: 'mc-inner' },
            h('div', { className: 'mc-banner mc-banner-error' }, `${t('panel.error')}: ${error}`),
            h('button', { className: 'mc-btn', type: 'button', onClick: reload }, t('panel.retry')),
          ),
        );
      }

      const fetched = data && data.fetchedAt ? time(data.fetchedAt) : t('panel.never');
      const synced = data && data.lastSync ? time(data.lastSync.at) : t('panel.never');
      const syncLine = data && data.lastSync
        ? `${t('panel.lastSync')} ${synced} · ${data.lastSync.changed ? t('panel.changed') : t('panel.unchanged')}${
            data.lastSync.added ? ` · +${data.lastSync.added}` : ''
          }`
        : t('panel.neverSynced');

      return h(
        'div',
        { className: `mc-root${embedded ? ' mc-embedded' : ''}` },
        h('style', null, CSS),
        h(
          'div',
          { className: 'mc-inner' },
          h(
            'div',
            { className: 'mc-hero' },
            embedded ? null : h('div', { className: 'mc-hero-icon' }, 'M'),
            h(
              'div',
              null,
              h('h1', null, t('panel.title')),
              h(
                'p',
                null,
                `${models.length} ${t('panel.models')} · ${t('panel.lastFetch')} ${fetched} · ${syncLine}`,
              ),
            ),
            h(
              'div',
              { className: 'mc-hero-actions' },
              h(
                'button',
                { type: 'button', className: 'mc-btn', disabled: Boolean(busy) || !(data && data.configured), onClick: doRefresh },
                busy === 'refresh' ? t('panel.refreshing') : t('panel.refresh'),
              ),
              h(
                'button',
                { type: 'button', className: 'mc-btn mc-btn-primary', disabled: Boolean(busy) || !(data && data.configured), onClick: doSync },
                busy === 'sync' ? t('panel.syncing') : t('panel.sync'),
              ),
            ),
          ),
          data && data.lastError
            ? h('div', { className: 'mc-banner mc-banner-warn' }, `${t('panel.error')}: ${data.lastError}`)
            : null,
          error ? h('div', { className: 'mc-banner mc-banner-error' }, `${t('panel.error')}: ${error}`) : null,
          fail ? h('div', { className: 'mc-banner mc-banner-error' }, fail) : null,
          notice ? h('div', { className: 'mc-banner mc-banner-ok' }, notice) : null,
          h(
            'div',
            { className: 'mc-card' },
            h(
              'div',
              { className: 'mc-card-head' },
              h(
                'div',
                null,
                h('h2', null, t('panel.connection.title')),
                h('p', null, t('panel.connection.hint')),
              ),
              h(
                'span',
                {
                  className:
                    'mc-badge ' + (data && data.configured ? 'mc-badge-default' : 'mc-badge-unsynced'),
                },
                data && data.configured
                  ? t('panel.connection.configured')
                  : t('panel.connection.unconfigured'),
              ),
            ),
            h(
              'div',
              { className: 'mc-form-grid' },
              h(
                'label',
                { className: 'mc-field mc-field-wide' },
                h('span', null, t('panel.connection.provider')),
                h(
                  'select',
                  { className: 'mc-select', value: providerChoice, onChange: onProviderChange },
                  h('option', { value: '' }, t('panel.connection.providerPlaceholder')),
                  providers.map((provider) =>
                    h(
                      'option',
                      { key: provider.id, value: provider.id },
                      `${provider.displayName} (${provider.id}) · ${provider.modelCount} ${t(
                        'panel.connection.modelCount',
                      )}`,
                    ),
                  ),
                  h('option', { value: '__new__' }, t('panel.connection.newProvider')),
                ),
              ),
              conn.createProvider
                ? h(
                    'label',
                    { className: 'mc-field' },
                    h('span', null, t('panel.connection.providerId')),
                    h('input', {
                      className: 'mc-input',
                      value: conn.provider,
                      onChange: (event) => setConn({ ...conn, provider: event.target.value }),
                    }),
                  )
                : null,
              conn.createProvider
                ? h(
                    'label',
                    { className: 'mc-field' },
                    h('span', null, t('panel.connection.displayName')),
                    h('input', {
                      className: 'mc-input',
                      value: conn.providerDisplayName,
                      onChange: (event) =>
                        setConn({ ...conn, providerDisplayName: event.target.value }),
                    }),
                  )
                : null,
              conn.createProvider
                ? h(
                    'label',
                    { className: 'mc-field' },
                    h('span', null, t('panel.connection.api')),
                    h(
                      'select',
                      {
                        className: 'mc-select',
                        value: conn.providerApi,
                        onChange: (event) => setConn({ ...conn, providerApi: event.target.value }),
                      },
                      API_TYPES.map((api) => h('option', { key: api, value: api }, api)),
                    ),
                  )
                : null,
              h(
                'label',
                { className: 'mc-field' },
                h('span', null, t('panel.connection.baseURL')),
                h('input', {
                  className: 'mc-input',
                  value: conn.baseURL,
                  placeholder: t('panel.connection.baseURLPlaceholder'),
                  onChange: (event) => setConn({ ...conn, baseURL: event.target.value }),
                }),
              ),
              h(
                'label',
                { className: 'mc-field' },
                h('span', null, t('panel.connection.apiKeyEnv')),
                h('input', {
                  className: 'mc-input',
                  value: conn.apiKeyEnv,
                  placeholder: t('panel.connection.apiKeyEnvPlaceholder'),
                  onChange: (event) => setConn({ ...conn, apiKeyEnv: event.target.value }),
                }),
              ),
            ),
            providers.length === 0 && !conn.createProvider
              ? h('div', { className: 'mc-note' }, t('panel.connection.noProviders'))
              : null,
            h(
              'div',
              { className: 'mc-key-row' },
              h('input', {
                className: 'mc-input',
                type: 'password',
                value: apiKey,
                placeholder: t('panel.connection.apiKeyPlaceholder'),
                autoComplete: 'off',
                'aria-label': t('panel.connection.apiKey'),
                onChange: (event) => setApiKey(event.target.value),
              }),
              h(
                'button',
                { type: 'button', className: 'mc-btn', disabled: Boolean(busy), onClick: saveApiKey },
                busy === 'key' ? t('panel.saving') : t('panel.connection.saveKey'),
              ),
              h(
                'button',
                { type: 'button', className: 'mc-btn', disabled: Boolean(busy), onClick: clearApiKey },
                t('panel.connection.clearKey'),
              ),
              h(
                'span',
                {
                  className: 'mc-key-status',
                  'data-ok': credential && credential.configured ? 'true' : 'false',
                },
                credential && credential.configured
                  ? `${t('panel.connection.keyConfigured')}${
                      credential.source ? ` · ${credential.source}` : ''
                    }`
                  : t('panel.connection.keyMissing'),
              ),
            ),
            h(
              'div',
              { className: 'mc-form-actions' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'mc-btn mc-btn-primary',
                  disabled: Boolean(busy),
                  onClick: saveConnection,
                },
                busy === 'conn' ? t('panel.syncing') : t('panel.connection.save'),
              ),
              h('span', { className: 'mc-note' }, t('panel.connection.importHint')),
            ),
          ),
          h(
            'div',
            { className: 'mc-card' },
            h(
              'div',
              { className: 'mc-card-head' },
              h(
                'div',
                null,
                h('h2', null, t('panel.template.title')),
                h('p', null, t('panel.template.hint')),
              ),
              h(
                'button',
                { type: 'button', className: 'mc-btn', disabled: Boolean(busy), onClick: saveTemplate },
                busy === 'template' ? t('panel.saving') : t('panel.template.save'),
              ),
            ),
            h('input', {
              className: 'mc-input',
              value: template,
              spellCheck: false,
              'aria-label': t('panel.template.title'),
              onChange: (event) => setTemplate(event.target.value),
            }),
            h('div', { className: 'mc-preview' }, t('panel.template.preview'), h('strong', null, preview)),
            h(
              'div',
              { className: 'mc-toggle-row' },
              h(
                'label',
                { className: 'mc-toggle' },
                h('input', {
                  type: 'checkbox',
                  checked: startup,
                  disabled: Boolean(busy),
                  onChange: (event) => void toggleStartup(event.target.checked),
                }),
                h('span', null, t('panel.startup.title')),
              ),
              h('span', { className: 'mc-note' }, t('panel.startup.hint')),
            ),
          ),
          h(
            'div',
            { className: 'mc-toolbar' },
            h('input', {
              className: 'mc-input',
              value: query,
              placeholder: t('panel.search'),
              'aria-label': t('panel.search'),
              onChange: (event) => setQuery(event.target.value),
            }),
            h(
              'div',
              { className: 'mc-seg' },
              ['all', 'synced', 'unsynced', 'stale', 'cn', 'global'].map((key) =>
                h(
                  'button',
                  {
                    key,
                    type: 'button',
                    'data-active': filter === key ? 'true' : 'false',
                    onClick: () => setFilter(key),
                  },
                  key === 'stale' && staleIds.size > 0
                    ? `${t(`panel.filter.${key}`)} ${staleIds.size}`
                    : t(`panel.filter.${key}`),
                ),
              ),
            ),
            h('span', { className: 'mc-count' }, `${filtered.length} / ${models.length + staleIds.size}`),
          ),
          h(
            'div',
            { className: 'mc-bulk' },
            h(
              'button',
              {
                type: 'button',
                className: 'mc-btn',
                disabled: Boolean(busy) || visibleIds.length === 0,
                onClick: pickAll,
              },
              t('panel.pick.all'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'mc-btn',
                disabled: Boolean(busy) || picked.size === 0,
                onClick: pickNone,
              },
              t('panel.pick.none'),
            ),
            h('span', { className: 'mc-count' }, `${t('panel.pick.count')} ${picked.size} · ${t('panel.pick.beforeSync')}`),
          ),
          filtered.length === 0
            ? h('div', { className: 'mc-empty' }, t('panel.empty'))
            : h(
                'div',
                { className: 'mc-list' },
                filtered.map((row) => {
                  const model = row.model;
                  const rowBusy = busy === `select:${model.id}`;
                  return h(ModelRow, {
                    key: model.id,
                    m: model,
                    t,
                    imported: row.imported,
                    stale: row.stale,
                    checked: picked.has(model.id),
                    onToggle: togglePick,
                    isDefault: isDefault(model),
                    defaultEffort: isDefault(model) ? defaultSelection?.reasoningEffort || '' : '',
                    busy: rowBusy,
                    onSelect: selectModel,
                  });
                }),
              ),
          h('div', { className: 'mc-note' }, t('panel.note')),
        ),
      );
    }

    function Icon(props) {
      const size = typeof props.size === 'number' ? props.size : 20;
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          'aria-hidden': 'true',
          style: { display: 'block' },
        },
        h('circle', {
          cx: 12,
          cy: 12,
          r: 10.4,
          stroke: 'currentColor',
          strokeWidth: 1.2,
          opacity: 0.32,
        }),
        h('path', {
          d: 'M4.2 7.2l2.2 9.4L12 9.6l5.6 7 2.2-9.4',
          stroke: 'currentColor',
          strokeWidth: 2.1,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      );
    }

    return {
      name: 'model-catalog',
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'model-catalog: locale');
        const t = ctx.locale.bind(NS);

        const MainPanel = (props) => h(Panel, { ...props, t });
        const SettingsPanel = (props) => h(Panel, { ...props, t, embedded: true });

        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, MainPanel),
        );
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 5,
              label: () => t('panel.title'),
              locale: NS,
            },
            Icon,
          ),
        );
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: PANEL_ID,
              order: 25,
              label: () => t('panel.title'),
              locale: NS,
            },
            SettingsPanel,
          ),
        );
      },
    };
  },
});
