<template>
  <div class="embedded-prompt-subpage">
    <div class="detail-scroll">
      <main class="detail-pane version-embed-pane">
        <div class="subpage-topbar">
          <h2 class="subpage-heading">历史版本</h2>
          <div class="subpage-topbar-actions">
            <button type="button" class="text-btn" :disabled="loading" @click="loadAll">刷新</button>
            <button type="button" class="text-btn" @click="goBack">← 返回</button>
          </div>
        </div>

        <p v-if="promptTitle" class="version-prompt-title">{{ promptTitle }}</p>

        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

        <div class="version-toolbar">
          <button
            type="button"
            class="text-btn sm primary-inline"
            :disabled="comparePick.length !== 2 || loading"
            @click="goCompare"
          >
            打开版本对比
          </button>
          <span class="muted version-hint">勾选两个版本号后，进入左右对比页。</span>
        </div>

        <div class="manual-snap-row">
          <input
            v-model="manualNoteDraft"
            class="manual-note-input"
            type="text"
            maxlength="200"
            placeholder="手动快照备注（可选）"
            :disabled="loading || manualSaving"
          />
          <button type="button" class="text-btn sm" :disabled="loading || manualSaving" @click="runManualSnapshot">
            手动保存版本
          </button>
        </div>

        <div v-if="loading" class="muted version-loading">加载中…</div>
        <div v-else-if="!rows.length" class="muted version-empty">暂无版本记录</div>
        <div v-else class="version-table-wrap">
          <table class="version-table">
            <thead>
              <tr>
                <th class="col-check" />
                <th>版本</th>
                <th>时间</th>
                <th>备注</th>
                <th class="col-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id">
                <td class="col-check">
                  <input
                    type="checkbox"
                    :checked="comparePick.includes(row.versionNumber)"
                    @change="onCompareCheck(row.versionNumber, ($event.target as HTMLInputElement).checked)"
                  />
                </td>
                <td class="td-version">
                  <span>v{{ row.versionNumber }}</span>
                  <span v-if="isCurrentVersionRow(row)" class="current-ver-tag">(当前版本)</span>
                </td>
                <td class="muted td-time">{{ formatTime(row.createdAt) }}</td>
                <td class="td-note">{{ row.note?.trim() || "—" }}</td>
                <td class="col-actions">
                  <button
                    v-if="!isCurrentVersionRow(row)"
                    type="button"
                    class="text-btn sm"
                    @click="runRollback(row)"
                  >
                    回溯
                  </button>
                  <span v-else class="muted td-no-action">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import * as api from "../api/prompts";
import { ApiError } from "../api/http";
import type { PromptVersionRecord } from "../api/types";
import { formatChinaTime } from "../util/time";

const route = useRoute();
const router = useRouter();

const promptCafeToast = inject<(message: string, durationMs?: number) => void>("promptCafeToast", () => {});

const promptId = computed(() => String(route.params.id ?? "").trim());

const promptTitle = ref("");
const promptCurrentVersion = ref<number | null>(null);
const rows = ref<PromptVersionRecord[]>([]);
const loading = ref(false);
const errorMsg = ref("");
const comparePick = ref<number[]>([]);
const manualNoteDraft = ref("");
const manualSaving = ref(false);

function formatTime(iso: string) {
  return formatChinaTime(iso);
}

function showToast(message: string) {
  promptCafeToast(message, 2400);
}

async function handleAuthzError(e: unknown): Promise<boolean> {
  if (!(e instanceof ApiError)) return false;
  if (e.status === 401) {
    await router.replace({ path: "/login", query: { redirect: route.fullPath } });
    return true;
  }
  if (e.status === 403) {
    showToast("无权限访问该 Prompt 的历史版本");
    await router.replace({ name: "home-main", query: { denied: "versions" } });
    return true;
  }
  return false;
}

function goBack() {
  const id = promptId.value;
  if (id) void router.push({ name: "home-main", query: { prompt: id } });
  else void router.push({ name: "home-main" });
}

async function loadPromptTitle() {
  const id = promptId.value;
  if (!id) return;
  try {
    const d = await api.getPrompt(id);
    promptTitle.value = d.title;
    promptCurrentVersion.value = d.currentVersion;
  } catch (e) {
    if (await handleAuthzError(e)) return;
    promptTitle.value = "";
    promptCurrentVersion.value = null;
  }
}

function isCurrentVersionRow(row: PromptVersionRecord): boolean {
  const cv = promptCurrentVersion.value;
  if (cv != null) return row.versionNumber === cv;
  if (!rows.value.length) return false;
  const maxV = Math.max(...rows.value.map((r) => r.versionNumber));
  return row.versionNumber === maxV;
}

async function loadVersions() {
  const id = promptId.value;
  if (!id) {
    errorMsg.value = "无效的 Prompt ID";
    return;
  }
  loading.value = true;
  errorMsg.value = "";
  try {
    const list = await api.listPromptVersions(id);
    rows.value = [...list].sort((a, b) => b.versionNumber - a.versionNumber);
  } catch (e) {
    if (await handleAuthzError(e)) return;
    errorMsg.value = e instanceof ApiError ? e.message : String(e);
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadAll() {
  await loadPromptTitle();
  await loadVersions();
}

function onCompareCheck(versionNumber: number, checked: boolean) {
  if (checked) {
    if (comparePick.value.includes(versionNumber)) return;
    if (comparePick.value.length >= 2) {
      comparePick.value = [comparePick.value[1]!, versionNumber];
    } else {
      comparePick.value = [...comparePick.value, versionNumber];
    }
  } else {
    comparePick.value = comparePick.value.filter((x) => x !== versionNumber);
  }
}

function goCompare() {
  const id = promptId.value;
  if (!id || comparePick.value.length !== 2) return;
  const [a, b] = comparePick.value;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  router.push({
    name: "prompt-versions-compare",
    params: { id },
    query: { from: String(lo), to: String(hi) }
  });
}

async function runRollback(row: PromptVersionRecord) {
  const id = promptId.value;
  if (!id) return;
  if (!confirm(`将当前 Prompt 回溯到 v${row.versionNumber} 的内容？会生成新版本号。`)) return;
  errorMsg.value = "";
  try {
    await api.rollbackPromptVersion(id, row.id);
    showToast("已回溯");
    await loadAll();
  } catch (e) {
    if (await handleAuthzError(e)) return;
    errorMsg.value = e instanceof ApiError ? e.message : String(e);
  }
}

async function runManualSnapshot() {
  const id = promptId.value;
  if (!id) return;
  manualSaving.value = true;
  errorMsg.value = "";
  try {
    const note = manualNoteDraft.value.trim();
    await api.createManualPromptVersion(id, note ? { note } : undefined);
    showToast("已保存版本快照");
    manualNoteDraft.value = "";
    await loadAll();
  } catch (e) {
    if (await handleAuthzError(e)) return;
    errorMsg.value = e instanceof ApiError ? e.message : String(e);
  } finally {
    manualSaving.value = false;
  }
}

onMounted(() => {
  loadAll();
});

watch(promptId, () => {
  comparePick.value = [];
  loadAll();
});
</script>

<style scoped>
.embedded-prompt-subpage {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.version-embed-pane {
  max-width: 960px;
}
.subpage-topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.subpage-heading {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}
.subpage-topbar-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
}
.version-prompt-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: #334155;
}
.version-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.version-hint {
  font-size: 12px;
}
.manual-snap-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
}
.manual-note-input {
  flex: 1;
  min-width: 200px;
  padding: 8px 10px;
  font-size: 13px;
  border: 1px solid #e2e6f0;
  border-radius: 8px;
  background: #fff;
}
.manual-note-input:focus {
  outline: none;
  border-color: #93b4f7;
  box-shadow: 0 0 0 2px rgba(147, 180, 247, 0.2);
}
.version-loading,
.version-empty {
  padding: 16px 0;
  font-size: 13px;
}
.version-table-wrap {
  overflow: auto;
  border: 1px solid #e7e9f0;
  border-radius: 10px;
}
.version-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  table-layout: fixed;
}
.version-table th,
.version-table td {
  padding: 10px 12px;
  min-height: 48px;
  text-align: left;
  border-bottom: 1px solid #f0f2f7;
  vertical-align: middle;
  line-height: 1.35;
  box-sizing: border-box;
}
.version-table th {
  background: #f8fafc;
  color: #64748b;
  font-weight: 600;
  font-size: 12px;
  vertical-align: middle;
}
.version-table tr:last-child td {
  border-bottom: none;
}
.col-check {
  width: 44px;
  text-align: center;
  padding: 10px 6px;
}
.col-check input[type="checkbox"] {
  margin: 0;
  vertical-align: middle;
}
.td-version {
  white-space: nowrap;
  width: 140px;
}
.current-ver-tag {
  margin-left: 2px;
  font-weight: 600;
  color: #0969da;
}
.td-no-action {
  font-size: 12px;
  display: inline-block;
  line-height: 1;
}
.td-time {
  white-space: nowrap;
  font-size: 12px;
  width: 168px;
}
.td-note {
  max-width: 0;
  word-break: break-word;
  overflow-wrap: anywhere;
  font-size: 13px;
}
.col-actions {
  width: 88px;
  text-align: center;
  white-space: nowrap;
  padding: 10px 8px;
}
.col-actions .text-btn {
  vertical-align: middle;
}
.muted {
  color: #9099ab;
}
.primary-inline {
  border-color: #2f67ea !important;
  color: #2f67ea !important;
  font-weight: 600;
}
</style>
