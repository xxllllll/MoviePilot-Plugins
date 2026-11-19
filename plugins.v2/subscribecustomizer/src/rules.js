export const MATCH_FIELDS = [
  ['type', '类型'],
  ['username', '订阅用户'],
  ['title_regex', '标题正则'],
]

export const MATCH_MULTI_FIELDS = [
  ['category_any', '分类'],
  ['genre_any', '风格'],
  ['country_any', '地区'],
  ['language_any', '语言'],
]

export const SET_TEXT_FIELDS = [
  ['quality', '质量'],
  ['resolution', '分辨率'],
  ['effect', '特效'],
  ['include', '包含关键词'],
  ['exclude', '排除关键词'],
  ['filter', '过滤规则'],
  ['downloader', '下载器'],
  ['save_path', '保存路径'],
  ['custom_words', '自定义识别词'],
  ['media_category', '媒体类别'],
]

export const DEFAULT_RULE = {
  name: '',
  enabled: true,
  priority: 10,
  match: {},
  set: {},
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value || {}))
}

export function cloneConfig(config) {
  const next = clone(config)
  return {
    enabled: Boolean(next.enabled),
    rules: Array.isArray(next.rules) ? next.rules : [],
  }
}

export function newRule(priority) {
  const rule = clone(DEFAULT_RULE)
  rule.priority = priority
  rule.name = `规则 ${priority}`
  return rule
}

export function normalizeRule(rule) {
  return {
    name: String(rule.name || '').trim() || '未命名规则',
    enabled: rule.enabled !== false,
    priority: Number(rule.priority || 1),
    match: cleanObject(rule.match || {}),
    set: cleanObject(rule.set || {}),
  }
}

export function cleanObject(source) {
  const next = {}
  Object.entries(source || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      const values = value.map(item => String(item || '').trim()).filter(Boolean)
      if (values.length) next[key] = values
    } else if (typeof value === 'boolean') {
      next[key] = value
    } else if (String(value || '').trim()) {
      next[key] = String(value).trim()
    }
  })
  return next
}

export function matchSummary(rule) {
  const match = rule.match || {}
  return summaryText([
    ...MATCH_FIELDS.map(([key, label]) => valueText(label, match[key])),
    ...MATCH_MULTI_FIELDS.map(([key, label]) => valueText(label, match[key])),
  ])
}

export function actionSummary(rule) {
  const action = rule.set || {}
  return summaryText([
    ...SET_TEXT_FIELDS.map(([key, label]) => valueText(label, action[key])),
    valueText('站点名', action.site_names),
    valueText('站点ID', action.sites),
    valueText('过滤组', action.filter_groups),
    action.search_imdbid === undefined ? '' : `IMDb搜索=${action.search_imdbid ? '开' : '关'}`,
  ])
}

export function valueText(label, value) {
  if (Array.isArray(value) && value.length) return `${label}=${value.join(' / ')}`
  if (String(value || '').trim()) return `${label}=${value}`
  return ''
}

export function summaryText(items) {
  const text = items.filter(Boolean).join('；')
  return text || '未设置'
}

export function unwrapResponse(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data') && response.success !== undefined) {
    return response.data
  }
  return response?.data ?? response
}
