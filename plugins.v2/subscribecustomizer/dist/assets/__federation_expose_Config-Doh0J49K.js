import { importShared } from './__federation_fn_import-JrT3xvdd.js';

const MATCH_FIELDS = [
  ['type', '类型'],
  ['username', '订阅用户'],
  ['title_regex', '标题正则'],
];

const MATCH_MULTI_FIELDS = [
  ['category_any', '分类'],
  ['genre_any', '风格'],
  ['country_any', '地区'],
  ['language_any', '语言'],
];

const SET_TEXT_FIELDS = [
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
];

const DEFAULT_RULE = {
  name: '',
  enabled: true,
  priority: 10,
  match: {},
  set: {},
};

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}))
}

function cloneConfig(config) {
  const next = clone(config);
  return {
    enabled: Boolean(next.enabled),
    rules: Array.isArray(next.rules) ? next.rules : [],
  }
}

function newRule(priority) {
  const rule = clone(DEFAULT_RULE);
  rule.priority = priority;
  rule.name = `规则 ${priority}`;
  return rule
}

function normalizeRule(rule) {
  return {
    name: String(rule.name || '').trim() || '未命名规则',
    enabled: rule.enabled !== false,
    priority: Number(rule.priority || 1),
    match: cleanObject(rule.match || {}),
    set: cleanObject(rule.set || {}),
  }
}

function cleanObject(source) {
  const next = {};
  Object.entries(source || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      const values = value.map(item => String(item || '').trim()).filter(Boolean);
      if (values.length) next[key] = values;
    } else if (typeof value === 'boolean') {
      next[key] = value;
    } else if (String(value || '').trim()) {
      next[key] = String(value).trim();
    }
  });
  return next
}

function matchSummary(rule) {
  const match = rule.match || {};
  return summaryText([
    ...MATCH_FIELDS.map(([key, label]) => valueText(label, match[key])),
    ...MATCH_MULTI_FIELDS.map(([key, label]) => valueText(label, match[key])),
  ])
}

function actionSummary(rule) {
  const action = rule.set || {};
  return summaryText([
    ...SET_TEXT_FIELDS.map(([key, label]) => valueText(label, action[key])),
    valueText('站点名', action.site_names),
    valueText('站点ID', action.sites),
    valueText('过滤组', action.filter_groups),
    action.search_imdbid === undefined ? '' : `IMDb搜索=${action.search_imdbid ? '开' : '关'}`,
  ])
}

function valueText(label, value) {
  if (Array.isArray(value) && value.length) return `${label}=${value.join(' / ')}`
  if (String(value || '').trim()) return `${label}=${value}`
  return ''
}

function summaryText(items) {
  const text = items.filter(Boolean).join('；');
  return text || '未设置'
}

function unwrapResponse(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data') && response.success !== undefined) {
    return response.data
  }
  return response?.data ?? response
}

const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};

const {createElementVNode:_createElementVNode,resolveComponent:_resolveComponent,createVNode:_createVNode,withCtx:_withCtx,toDisplayString:_toDisplayString,createTextVNode:_createTextVNode,openBlock:_openBlock,createBlock:_createBlock,createCommentVNode:_createCommentVNode,renderList:_renderList,Fragment:_Fragment,createElementBlock:_createElementBlock,unref:_unref} = await importShared('vue');


const _hoisted_1 = { class: "subscribe-customizer-config" };
const _hoisted_2 = { class: "pa-4 config-body" };
const _hoisted_3 = { class: "toolbar-row" };
const _hoisted_4 = { class: "summary-cell" };
const _hoisted_5 = { class: "summary-cell" };
const _hoisted_6 = { class: "text-right" };
const _hoisted_7 = { key: 0 };
const _hoisted_8 = { class: "preview-row" };

const {computed,onMounted,ref} = await importShared('vue');

const pluginBase = 'plugin/SubscribeCustomizer';

const _sfc_main = {
  __name: 'Config',
  props: {
  initialConfig: { type: Object, default: () => ({}) },
  api: { type: Object, default: () => ({}) },
},
  emits: ['save', 'close'],
  setup(__props, { emit: __emit }) {

const props = __props;
const emit = __emit;

const localConfig = ref(cloneConfig(props.initialConfig));
const sites = ref([]);
const sampleRules = ref([]);
const dialog = ref(false);
const editIndex = ref(-1);
const editor = ref(newRule(1));
const subscribeId = ref('');
const previewResult = ref(null);
const message = ref('');
const loading = ref(false);

const siteNameItems = computed(() => sites.value.map(site => site.name));
const rules = computed(() => localConfig.value.rules || []);

function nextPriority() {
  return Math.max(0, ...rules.value.map(rule => Number(rule.priority || 0))) + 10
}

function openNewRule() {
  editIndex.value = -1;
  editor.value = newRule(nextPriority());
  dialog.value = true;
}

function openEditRule(index) {
  editIndex.value = index;
  editor.value = normalizeRule(clone(rules.value[index]));
  dialog.value = true;
}

function commitRule() {
  const normalized = normalizeRule(editor.value);
  if (editIndex.value >= 0) {
    rules.value.splice(editIndex.value, 1, normalized);
  } else {
    rules.value.push(normalized);
  }
  sortRules();
  dialog.value = false;
}

function removeRule(index) {
  rules.value.splice(index, 1);
}

function sortRules() {
  localConfig.value.rules = [...rules.value].sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0));
}

function importSamples() {
  const samples = sampleRules.value.length ? sampleRules.value : [];
  const start = nextPriority();
  localConfig.value.rules.push(...samples.map((rule, index) => ({
    ...normalizeRule(rule),
    priority: Number(rule.priority || start + index * 10),
  })));
  sortRules();
}

function saveConfig() {
  localConfig.value.rules = rules.value.map(rule => normalizeRule(rule));
  emit('save', cloneConfig(localConfig.value));
}

async function loadStatus() {
  if (!props.api?.get) return
  loading.value = true;
  message.value = '';
  try {
    const data = unwrapResponse(await props.api.get(`${pluginBase}/status`)) || {};
    sites.value = data.sites || [];
    sampleRules.value = data.sample_rules || [];
  } catch (err) {
    message.value = err?.message || '加载状态失败';
  } finally {
    loading.value = false;
  }
}

async function previewSubscribe() {
  const id = String(subscribeId.value || '').trim();
  if (!id || !props.api?.get) return
  loading.value = true;
  message.value = '';
  try {
    previewResult.value = unwrapResponse(await props.api.get(`${pluginBase}/preview/${id}`));
  } catch (err) {
    message.value = err?.message || '预览失败';
  } finally {
    loading.value = false;
  }
}

async function applySubscribe() {
  const id = String(subscribeId.value || '').trim();
  if (!id || !props.api?.post) return
  loading.value = true;
  message.value = '';
  try {
    previewResult.value = unwrapResponse(await props.api.post(`${pluginBase}/apply/${id}`, {}));
    message.value = previewResult.value?.applied ? '已应用规则' : '没有需要更新的字段';
  } catch (err) {
    message.value = err?.message || '应用失败';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  localConfig.value = cloneConfig(props.initialConfig);
  loadStatus();
});

return (_ctx, _cache) => {
  const _component_VSpacer = _resolveComponent("VSpacer");
  const _component_VBtn = _resolveComponent("VBtn");
  const _component_VToolbar = _resolveComponent("VToolbar");
  const _component_VDivider = _resolveComponent("VDivider");
  const _component_VAlert = _resolveComponent("VAlert");
  const _component_VSwitch = _resolveComponent("VSwitch");
  const _component_VSheet = _resolveComponent("VSheet");
  const _component_VTable = _resolveComponent("VTable");
  const _component_VTextField = _resolveComponent("VTextField");
  const _component_VTextarea = _resolveComponent("VTextarea");
  const _component_VCardTitle = _resolveComponent("VCardTitle");
  const _component_VCol = _resolveComponent("VCol");
  const _component_VRow = _resolveComponent("VRow");
  const _component_VCombobox = _resolveComponent("VCombobox");
  const _component_VCardText = _resolveComponent("VCardText");
  const _component_VCardActions = _resolveComponent("VCardActions");
  const _component_VCard = _resolveComponent("VCard");
  const _component_VDialog = _resolveComponent("VDialog");

  return (_openBlock(), _createElementBlock("div", _hoisted_1, [
    _createVNode(_component_VToolbar, {
      density: "comfortable",
      color: "transparent"
    }, {
      default: _withCtx(() => [
        _cache[12] || (_cache[12] = _createElementVNode("div", { class: "text-h6 ms-3" }, "订阅参数定制", -1)),
        _createVNode(_component_VSpacer),
        _createVNode(_component_VBtn, {
          icon: "mdi-content-save",
          variant: "text",
          color: "primary",
          onClick: saveConfig
        }),
        _createVNode(_component_VBtn, {
          icon: "mdi-close",
          variant: "text",
          onClick: _cache[0] || (_cache[0] = $event => (emit('close')))
        })
      ]),
      _: 1
    }),
    _createVNode(_component_VDivider),
    _createElementVNode("div", _hoisted_2, [
      (message.value)
        ? (_openBlock(), _createBlock(_component_VAlert, {
            key: 0,
            type: "info",
            variant: "tonal",
            density: "compact"
          }, {
            default: _withCtx(() => [
              _createTextVNode(_toDisplayString(message.value), 1)
            ]),
            _: 1
          }))
        : _createCommentVNode("", true),
      _createVNode(_component_VSheet, {
        border: "",
        rounded: "",
        class: "pa-4"
      }, {
        default: _withCtx(() => [
          _createElementVNode("div", _hoisted_3, [
            _createVNode(_component_VSwitch, {
              modelValue: localConfig.value.enabled,
              "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((localConfig.value.enabled) = $event)),
              color: "primary",
              "hide-details": "",
              inset: "",
              label: "启用插件"
            }, null, 8, ["modelValue"]),
            _createVNode(_component_VSpacer),
            _createVNode(_component_VBtn, {
              "prepend-icon": "mdi-import",
              variant: "tonal",
              onClick: importSamples
            }, {
              default: _withCtx(() => [...(_cache[13] || (_cache[13] = [
                _createTextVNode("导入示例规则", -1)
              ]))]),
              _: 1
            }),
            _createVNode(_component_VBtn, {
              "prepend-icon": "mdi-plus",
              color: "primary",
              variant: "tonal",
              onClick: openNewRule
            }, {
              default: _withCtx(() => [...(_cache[14] || (_cache[14] = [
                _createTextVNode("新增规则", -1)
              ]))]),
              _: 1
            })
          ])
        ]),
        _: 1
      }),
      _createVNode(_component_VSheet, {
        border: "",
        rounded: "",
        class: "table-shell"
      }, {
        default: _withCtx(() => [
          _createVNode(_component_VTable, { density: "comfortable" }, {
            default: _withCtx(() => [
              _cache[16] || (_cache[16] = _createElementVNode("thead", null, [
                _createElementVNode("tr", null, [
                  _createElementVNode("th", null, "启用"),
                  _createElementVNode("th", null, "优先级"),
                  _createElementVNode("th", null, "规则名"),
                  _createElementVNode("th", null, "匹配摘要"),
                  _createElementVNode("th", null, "动作摘要"),
                  _createElementVNode("th", { class: "text-right" }, "操作")
                ])
              ], -1)),
              _createElementVNode("tbody", null, [
                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(rules.value, (rule, index) => {
                  return (_openBlock(), _createElementBlock("tr", {
                    key: `${rule.name}-${index}`
                  }, [
                    _createElementVNode("td", null, [
                      _createVNode(_component_VSwitch, {
                        modelValue: rule.enabled,
                        "onUpdate:modelValue": $event => ((rule.enabled) = $event),
                        color: "primary",
                        "hide-details": "",
                        density: "compact"
                      }, null, 8, ["modelValue", "onUpdate:modelValue"])
                    ]),
                    _createElementVNode("td", null, _toDisplayString(rule.priority), 1),
                    _createElementVNode("td", null, _toDisplayString(rule.name), 1),
                    _createElementVNode("td", _hoisted_4, _toDisplayString(_unref(matchSummary)(rule)), 1),
                    _createElementVNode("td", _hoisted_5, _toDisplayString(_unref(actionSummary)(rule)), 1),
                    _createElementVNode("td", _hoisted_6, [
                      _createVNode(_component_VBtn, {
                        icon: "mdi-pencil",
                        size: "small",
                        variant: "text",
                        onClick: $event => (openEditRule(index))
                      }, null, 8, ["onClick"]),
                      _createVNode(_component_VBtn, {
                        icon: "mdi-delete",
                        size: "small",
                        variant: "text",
                        color: "error",
                        onClick: $event => (removeRule(index))
                      }, null, 8, ["onClick"])
                    ])
                  ]))
                }), 128)),
                (!rules.value.length)
                  ? (_openBlock(), _createElementBlock("tr", _hoisted_7, [...(_cache[15] || (_cache[15] = [
                      _createElementVNode("td", {
                        colspan: "6",
                        class: "text-center text-medium-emphasis py-8"
                      }, "暂无规则", -1)
                    ]))]))
                  : _createCommentVNode("", true)
              ])
            ]),
            _: 1
          })
        ]),
        _: 1
      }),
      _createVNode(_component_VSheet, {
        border: "",
        rounded: "",
        class: "pa-4"
      }, {
        default: _withCtx(() => [
          _cache[19] || (_cache[19] = _createElementVNode("div", { class: "text-subtitle-1 mb-3" }, "单个已有订阅预览 / 应用", -1)),
          _createElementVNode("div", _hoisted_8, [
            _createVNode(_component_VTextField, {
              modelValue: subscribeId.value,
              "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((subscribeId).value = $event)),
              label: "订阅 ID",
              variant: "outlined",
              density: "comfortable",
              "hide-details": ""
            }, null, 8, ["modelValue"]),
            _createVNode(_component_VBtn, {
              loading: loading.value,
              variant: "tonal",
              onClick: previewSubscribe
            }, {
              default: _withCtx(() => [...(_cache[17] || (_cache[17] = [
                _createTextVNode("预览", -1)
              ]))]),
              _: 1
            }, 8, ["loading"]),
            _createVNode(_component_VBtn, {
              loading: loading.value,
              color: "primary",
              variant: "tonal",
              onClick: applySubscribe
            }, {
              default: _withCtx(() => [...(_cache[18] || (_cache[18] = [
                _createTextVNode("应用", -1)
              ]))]),
              _: 1
            }, 8, ["loading"])
          ]),
          (previewResult.value)
            ? (_openBlock(), _createBlock(_component_VTextarea, {
                key: 0,
                class: "mt-3",
                "model-value": JSON.stringify(previewResult.value, null, 2),
                label: "预览结果",
                variant: "outlined",
                readonly: "",
                "auto-grow": ""
              }, null, 8, ["model-value"]))
            : _createCommentVNode("", true)
        ]),
        _: 1
      })
    ]),
    _createVNode(_component_VDialog, {
      modelValue: dialog.value,
      "onUpdate:modelValue": _cache[11] || (_cache[11] = $event => ((dialog).value = $event)),
      "max-width": "980",
      "max-height": "90vh",
      scrollable: ""
    }, {
      default: _withCtx(() => [
        _createVNode(_component_VCard, null, {
          default: _withCtx(() => [
            _createVNode(_component_VCardTitle, null, {
              default: _withCtx(() => [
                _createTextVNode(_toDisplayString(editIndex.value >= 0 ? '编辑规则' : '新增规则'), 1)
              ]),
              _: 1
            }),
            _createVNode(_component_VCardText, null, {
              default: _withCtx(() => [
                _createVNode(_component_VRow, null, {
                  default: _withCtx(() => [
                    _createVNode(_component_VCol, {
                      cols: "12",
                      md: "7"
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_VTextField, {
                          modelValue: editor.value.name,
                          "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((editor.value.name) = $event)),
                          label: "规则名",
                          variant: "outlined"
                        }, null, 8, ["modelValue"])
                      ]),
                      _: 1
                    }),
                    _createVNode(_component_VCol, {
                      cols: "12",
                      md: "3"
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_VTextField, {
                          modelValue: editor.value.priority,
                          "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((editor.value.priority) = $event)),
                          modelModifiers: { number: true },
                          label: "优先级",
                          type: "number",
                          variant: "outlined"
                        }, null, 8, ["modelValue"])
                      ]),
                      _: 1
                    }),
                    _createVNode(_component_VCol, {
                      cols: "12",
                      md: "2"
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_VSwitch, {
                          modelValue: editor.value.enabled,
                          "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((editor.value.enabled) = $event)),
                          color: "primary",
                          label: "启用"
                        }, null, 8, ["modelValue"])
                      ]),
                      _: 1
                    })
                  ]),
                  _: 1
                }),
                _createVNode(_component_VDivider, { class: "my-3" }),
                _cache[20] || (_cache[20] = _createElementVNode("div", { class: "text-subtitle-1 mb-2" }, "匹配条件", -1)),
                _createVNode(_component_VRow, null, {
                  default: _withCtx(() => [
                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_unref(MATCH_FIELDS), ([key, label]) => {
                      return (_openBlock(), _createBlock(_component_VCol, {
                        key: key,
                        cols: "12",
                        md: "4"
                      }, {
                        default: _withCtx(() => [
                          _createVNode(_component_VTextField, {
                            modelValue: editor.value.match[key],
                            "onUpdate:modelValue": $event => ((editor.value.match[key]) = $event),
                            label: label,
                            variant: "outlined",
                            density: "comfortable"
                          }, null, 8, ["modelValue", "onUpdate:modelValue", "label"])
                        ]),
                        _: 2
                      }, 1024))
                    }), 128)),
                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_unref(MATCH_MULTI_FIELDS), ([key, label]) => {
                      return (_openBlock(), _createBlock(_component_VCol, {
                        key: key,
                        cols: "12",
                        md: "6"
                      }, {
                        default: _withCtx(() => [
                          _createVNode(_component_VCombobox, {
                            modelValue: editor.value.match[key],
                            "onUpdate:modelValue": $event => ((editor.value.match[key]) = $event),
                            label: `${label}（多值 OR）`,
                            multiple: "",
                            chips: "",
                            "closable-chips": "",
                            variant: "outlined"
                          }, null, 8, ["modelValue", "onUpdate:modelValue", "label"])
                        ]),
                        _: 2
                      }, 1024))
                    }), 128))
                  ]),
                  _: 1
                }),
                _createVNode(_component_VDivider, { class: "my-3" }),
                _cache[21] || (_cache[21] = _createElementVNode("div", { class: "text-subtitle-1 mb-2" }, "写入字段", -1)),
                _createVNode(_component_VRow, null, {
                  default: _withCtx(() => [
                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_unref(SET_TEXT_FIELDS), ([key, label]) => {
                      return (_openBlock(), _createBlock(_component_VCol, {
                        key: key,
                        cols: "12",
                        md: "6"
                      }, {
                        default: _withCtx(() => [
                          _createVNode(_component_VTextField, {
                            modelValue: editor.value.set[key],
                            "onUpdate:modelValue": $event => ((editor.value.set[key]) = $event),
                            label: label,
                            variant: "outlined",
                            density: "comfortable"
                          }, null, 8, ["modelValue", "onUpdate:modelValue", "label"])
                        ]),
                        _: 2
                      }, 1024))
                    }), 128)),
                    _createVNode(_component_VCol, {
                      cols: "12",
                      md: "6"
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_VCombobox, {
                          modelValue: editor.value.set.site_names,
                          "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => ((editor.value.set.site_names) = $event)),
                          items: siteNameItems.value,
                          label: "站点名",
                          multiple: "",
                          chips: "",
                          "closable-chips": "",
                          variant: "outlined"
                        }, null, 8, ["modelValue", "items"])
                      ]),
                      _: 1
                    }),
                    _createVNode(_component_VCol, {
                      cols: "12",
                      md: "6"
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_VCombobox, {
                          modelValue: editor.value.set.sites,
                          "onUpdate:modelValue": _cache[7] || (_cache[7] = $event => ((editor.value.set.sites) = $event)),
                          label: "站点 ID",
                          multiple: "",
                          chips: "",
                          "closable-chips": "",
                          variant: "outlined"
                        }, null, 8, ["modelValue"])
                      ]),
                      _: 1
                    }),
                    _createVNode(_component_VCol, {
                      cols: "12",
                      md: "6"
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_VCombobox, {
                          modelValue: editor.value.set.filter_groups,
                          "onUpdate:modelValue": _cache[8] || (_cache[8] = $event => ((editor.value.set.filter_groups) = $event)),
                          label: "过滤规则组",
                          multiple: "",
                          chips: "",
                          "closable-chips": "",
                          variant: "outlined"
                        }, null, 8, ["modelValue"])
                      ]),
                      _: 1
                    }),
                    _createVNode(_component_VCol, {
                      cols: "12",
                      md: "6"
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_VSwitch, {
                          modelValue: editor.value.set.search_imdbid,
                          "onUpdate:modelValue": _cache[9] || (_cache[9] = $event => ((editor.value.set.search_imdbid) = $event)),
                          color: "primary",
                          label: "使用 IMDb ID 搜索"
                        }, null, 8, ["modelValue"])
                      ]),
                      _: 1
                    })
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }),
            _createVNode(_component_VCardActions, null, {
              default: _withCtx(() => [
                _createVNode(_component_VSpacer),
                _createVNode(_component_VBtn, {
                  variant: "text",
                  onClick: _cache[10] || (_cache[10] = $event => (dialog.value = false))
                }, {
                  default: _withCtx(() => [...(_cache[22] || (_cache[22] = [
                    _createTextVNode("取消", -1)
                  ]))]),
                  _: 1
                }),
                _createVNode(_component_VBtn, {
                  color: "primary",
                  onClick: commitRule
                }, {
                  default: _withCtx(() => [...(_cache[23] || (_cache[23] = [
                    _createTextVNode("确定", -1)
                  ]))]),
                  _: 1
                })
              ]),
              _: 1
            })
          ]),
          _: 1
        })
      ]),
      _: 1
    }, 8, ["modelValue"])
  ]))
}
}

};
const Config = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-bb309e99"]]);

export { Config as default };
