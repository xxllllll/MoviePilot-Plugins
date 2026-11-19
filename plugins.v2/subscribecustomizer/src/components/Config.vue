<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  MATCH_FIELDS,
  MATCH_MULTI_FIELDS,
  SET_TEXT_FIELDS,
  actionSummary,
  clone,
  cloneConfig,
  matchSummary,
  newRule,
  normalizeRule,
  unwrapResponse,
} from '../rules'

const props = defineProps({
  initialConfig: { type: Object, default: () => ({}) },
  api: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['save', 'close'])

const pluginBase = 'plugin/SubscribeCustomizer'
const localConfig = ref(cloneConfig(props.initialConfig))
const sites = ref([])
const sampleRules = ref([])
const dialog = ref(false)
const editIndex = ref(-1)
const editor = ref(newRule(1))
const subscribeId = ref('')
const previewResult = ref(null)
const message = ref('')
const loading = ref(false)

const siteNameItems = computed(() => sites.value.map(site => site.name))
const rules = computed(() => localConfig.value.rules || [])

function nextPriority() {
  return Math.max(0, ...rules.value.map(rule => Number(rule.priority || 0))) + 10
}

function openNewRule() {
  editIndex.value = -1
  editor.value = newRule(nextPriority())
  dialog.value = true
}

function openEditRule(index) {
  editIndex.value = index
  editor.value = normalizeRule(clone(rules.value[index]))
  dialog.value = true
}

function commitRule() {
  const normalized = normalizeRule(editor.value)
  if (editIndex.value >= 0) {
    rules.value.splice(editIndex.value, 1, normalized)
  } else {
    rules.value.push(normalized)
  }
  sortRules()
  dialog.value = false
}

function removeRule(index) {
  rules.value.splice(index, 1)
}

function sortRules() {
  localConfig.value.rules = [...rules.value].sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0))
}

function importSamples() {
  const samples = sampleRules.value.length ? sampleRules.value : []
  const start = nextPriority()
  localConfig.value.rules.push(...samples.map((rule, index) => ({
    ...normalizeRule(rule),
    priority: Number(rule.priority || start + index * 10),
  })))
  sortRules()
}

function saveConfig() {
  localConfig.value.rules = rules.value.map(rule => normalizeRule(rule))
  emit('save', cloneConfig(localConfig.value))
}

async function loadStatus() {
  if (!props.api?.get) return
  loading.value = true
  message.value = ''
  try {
    const data = unwrapResponse(await props.api.get(`${pluginBase}/status`)) || {}
    sites.value = data.sites || []
    sampleRules.value = data.sample_rules || []
  } catch (err) {
    message.value = err?.message || '加载状态失败'
  } finally {
    loading.value = false
  }
}

async function previewSubscribe() {
  const id = String(subscribeId.value || '').trim()
  if (!id || !props.api?.get) return
  loading.value = true
  message.value = ''
  try {
    previewResult.value = unwrapResponse(await props.api.get(`${pluginBase}/preview/${id}`))
  } catch (err) {
    message.value = err?.message || '预览失败'
  } finally {
    loading.value = false
  }
}

async function applySubscribe() {
  const id = String(subscribeId.value || '').trim()
  if (!id || !props.api?.post) return
  loading.value = true
  message.value = ''
  try {
    previewResult.value = unwrapResponse(await props.api.post(`${pluginBase}/apply/${id}`, {}))
    message.value = previewResult.value?.applied ? '已应用规则' : '没有需要更新的字段'
  } catch (err) {
    message.value = err?.message || '应用失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  localConfig.value = cloneConfig(props.initialConfig)
  loadStatus()
})
</script>

<template>
  <div class="subscribe-customizer-config">
    <VToolbar density="comfortable" color="transparent">
      <div class="text-h6 ms-3">订阅参数定制</div>
      <VSpacer />
      <VBtn icon="mdi-content-save" variant="text" color="primary" @click="saveConfig" />
      <VBtn icon="mdi-close" variant="text" @click="emit('close')" />
    </VToolbar>
    <VDivider />

    <div class="pa-4 config-body">
      <VAlert v-if="message" type="info" variant="tonal" density="compact">{{ message }}</VAlert>

      <VSheet border rounded class="pa-4">
        <div class="toolbar-row">
          <VSwitch v-model="localConfig.enabled" color="primary" hide-details inset label="启用插件" />
          <VSpacer />
          <VBtn prepend-icon="mdi-import" variant="tonal" @click="importSamples">导入示例规则</VBtn>
          <VBtn prepend-icon="mdi-plus" color="primary" variant="tonal" @click="openNewRule">新增规则</VBtn>
        </div>
      </VSheet>

      <VSheet border rounded class="table-shell">
        <VTable density="comfortable">
          <thead>
            <tr>
              <th>启用</th>
              <th>优先级</th>
              <th>规则名</th>
              <th>匹配摘要</th>
              <th>动作摘要</th>
              <th class="text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(rule, index) in rules" :key="`${rule.name}-${index}`">
              <td><VSwitch v-model="rule.enabled" color="primary" hide-details density="compact" /></td>
              <td>{{ rule.priority }}</td>
              <td>{{ rule.name }}</td>
              <td class="summary-cell">{{ matchSummary(rule) }}</td>
              <td class="summary-cell">{{ actionSummary(rule) }}</td>
              <td class="text-right">
                <VBtn icon="mdi-pencil" size="small" variant="text" @click="openEditRule(index)" />
                <VBtn icon="mdi-delete" size="small" variant="text" color="error" @click="removeRule(index)" />
              </td>
            </tr>
            <tr v-if="!rules.length">
              <td colspan="6" class="text-center text-medium-emphasis py-8">暂无规则</td>
            </tr>
          </tbody>
        </VTable>
      </VSheet>

      <VSheet border rounded class="pa-4">
        <div class="text-subtitle-1 mb-3">单个已有订阅预览 / 应用</div>
        <div class="preview-row">
          <VTextField v-model="subscribeId" label="订阅 ID" variant="outlined" density="comfortable" hide-details />
          <VBtn :loading="loading" variant="tonal" @click="previewSubscribe">预览</VBtn>
          <VBtn :loading="loading" color="primary" variant="tonal" @click="applySubscribe">应用</VBtn>
        </div>
        <VTextarea
          v-if="previewResult"
          class="mt-3"
          :model-value="JSON.stringify(previewResult, null, 2)"
          label="预览结果"
          variant="outlined"
          readonly
          auto-grow
        />
      </VSheet>
    </div>

    <VDialog v-model="dialog" max-width="980" max-height="90vh" scrollable>
      <VCard>
        <VCardTitle>{{ editIndex >= 0 ? '编辑规则' : '新增规则' }}</VCardTitle>
        <VCardText>
          <VRow>
            <VCol cols="12" md="7"><VTextField v-model="editor.name" label="规则名" variant="outlined" /></VCol>
            <VCol cols="12" md="3"><VTextField v-model.number="editor.priority" label="优先级" type="number" variant="outlined" /></VCol>
            <VCol cols="12" md="2"><VSwitch v-model="editor.enabled" color="primary" label="启用" /></VCol>
          </VRow>

          <VDivider class="my-3" />
          <div class="text-subtitle-1 mb-2">匹配条件</div>
          <VRow>
            <VCol v-for="[key, label] in MATCH_FIELDS" :key="key" cols="12" md="4">
              <VTextField v-model="editor.match[key]" :label="label" variant="outlined" density="comfortable" />
            </VCol>
            <VCol v-for="[key, label] in MATCH_MULTI_FIELDS" :key="key" cols="12" md="6">
              <VCombobox v-model="editor.match[key]" :label="`${label}（多值 OR）`" multiple chips closable-chips variant="outlined" />
            </VCol>
          </VRow>

          <VDivider class="my-3" />
          <div class="text-subtitle-1 mb-2">写入字段</div>
          <VRow>
            <VCol v-for="[key, label] in SET_TEXT_FIELDS" :key="key" cols="12" md="6">
              <VTextField v-model="editor.set[key]" :label="label" variant="outlined" density="comfortable" />
            </VCol>
            <VCol cols="12" md="6">
              <VCombobox v-model="editor.set.site_names" :items="siteNameItems" label="站点名" multiple chips closable-chips variant="outlined" />
            </VCol>
            <VCol cols="12" md="6">
              <VCombobox v-model="editor.set.sites" label="站点 ID" multiple chips closable-chips variant="outlined" />
            </VCol>
            <VCol cols="12" md="6">
              <VCombobox v-model="editor.set.filter_groups" label="过滤规则组" multiple chips closable-chips variant="outlined" />
            </VCol>
            <VCol cols="12" md="6">
              <VSwitch v-model="editor.set.search_imdbid" color="primary" label="使用 IMDb ID 搜索" />
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="dialog = false">取消</VBtn>
          <VBtn color="primary" @click="commitRule">确定</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
.config-body { display: flex; flex-direction: column; gap: 16px; }
.toolbar-row, .preview-row { display: flex; align-items: center; gap: 12px; }
.table-shell { overflow-x: auto; }
.table-shell :deep(table) { min-width: 980px; }
.summary-cell { max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 700px) { .toolbar-row, .preview-row { align-items: stretch; flex-direction: column; } }
</style>
