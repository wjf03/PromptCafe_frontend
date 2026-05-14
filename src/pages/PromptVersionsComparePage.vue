<template>
  <div class="embedded-prompt-subpage">
    <div class="detail-scroll">
      <main class="detail-pane compare-embed-pane">
        <div class="subpage-topbar">
          <h2 class="subpage-heading">版本对比</h2>
          <button type="button" class="text-btn" @click="goVersions">← 返回</button>
        </div>

        <p v-if="promptTitle" class="compare-prompt-title">{{ promptTitle }}</p>
        <p v-if="pairLabel" class="meta muted compare-pair">{{ pairLabel }}</p>

        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        <div v-if="loading" class="muted compare-loading">加载对比…</div>

        <div v-else-if="diffData" class="compare-merge-root">
          <p class="merge-legend muted">
            与编辑器合并视图类似：左侧为较旧版本行号与内容，右侧为较新版本；<span class="lg-del">删除</span>、<span class="lg-add">新增</span>、<span class="lg-chg">修改</span>以底色区分。
          </p>

          <section v-for="block in mergeBlocks" :key="block.key" class="merge-section">
            <div class="merge-section-title">{{ block.label }}</div>
            <div class="merge-editor">
              <div class="merge-header">
                <div class="merge-header-cell merge-header-left">
                  <span class="merge-header-badge">{{ block.leftHeader }}</span>
                  <span class="merge-header-hint">旧版</span>
                </div>
                <div class="merge-header-cell merge-header-right">
                  <span class="merge-header-badge merge-header-badge-new">{{ block.rightHeader }}</span>
                  <span class="merge-header-hint">新版</span>
                </div>
              </div>
              <div class="merge-body">
                <div
                  v-for="(item, i) in block.annotated"
                  :key="`${block.key}-${i}`"
                  class="merge-row"
                  :class="mergeRowClass(item.row)"
                >
                  <span class="merge-gutter merge-ln" aria-hidden="true">{{ item.leftNo }}</span>
                  <pre class="merge-line merge-line-left" tabindex="-1">{{ lineText(item.row.left) }}</pre>
                  <span class="merge-gutter merge-ln" aria-hidden="true">{{ item.rightNo }}</span>
                  <pre class="merge-line merge-line-right" tabindex="-1">{{ lineText(item.row.right) }}</pre>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import * as api from "../api/prompts";
import { ApiError } from "../api/http";
import type { PromptVersionDiffData } from "../api/types";
import { alignTextByLines, type AlignedLineRow } from "../util/lineDiff";

const route = useRoute();
const router = useRouter();

const promptId = computed(() => String(route.params.id ?? "").trim());
const fromVN = computed(() => parseInt(String(route.query.from ?? ""), 10));
const toVN = computed(() => parseInt(String(route.query.to ?? ""), 10));

const promptTitle = ref("");
const diffData = ref<PromptVersionDiffData | null>(null);
const loading = ref(false);
const errorMsg = ref("");

const pairLabel = computed(() => {
  if (!diffData.value) return "";
  const a = diffData.value.fromVersion.versionNumber;
  const b = diffData.value.toVersion.versionNumber;
  return `对比 v${a}（左）与 v${b}（右）`;
});

function lineText(s: string) {
  return s.length ? s : " ";
}

function annotateRows(rows: AlignedLineRow[]) {
  let l = 0;
  let r = 0;
  return rows.map((row) => {
    let leftNo = "";
    let rightNo = "";
    if (row.leftKind !== "blank") {
      l += 1;
      leftNo = String(l);
    }
    if (row.rightKind !== "blank") {
      r += 1;
      rightNo = String(r);
    }
    return { row, leftNo, rightNo };
  });
}

function mergeRowClass(row: AlignedLineRow): string {
  if (row.leftKind === "same" && row.rightKind === "same") return "merge-row--same";
  if (row.leftKind === "removed" && row.rightKind === "blank") return "merge-row--del";
  if (row.leftKind === "blank" && row.rightKind === "added") return "merge-row--add";
  if (row.leftKind === "changed" && row.rightKind === "changed") return "merge-row--chg";
  return "";
}

const mergeBlocks = computed(() => {
  const d = diffData.value;
  if (!d) return [];
  const from = d.fromVersion;
  const to = d.toVersion;
  const lH = `v${from.versionNumber}`;
  const rH = `v${to.versionNumber}`;
  return [
    {
      key: "title",
      label: "标题",
      leftHeader: lH,
      rightHeader: rH,
      annotated: annotateRows(alignTextByLines(from.title ?? "", to.title ?? ""))
    },
    {
      key: "desc",
      label: "简介",
      leftHeader: lH,
      rightHeader: rH,
      annotated: annotateRows(alignTextByLines(from.description ?? "", to.description ?? ""))
    },
    {
      key: "system",
      label: "系统提示词",
      leftHeader: lH,
      rightHeader: rH,
      annotated: annotateRows(alignTextByLines(from.systemPrompt ?? "", to.systemPrompt ?? ""))
    },
    {
      key: "user",
      label: "用户提示词",
      leftHeader: lH,
      rightHeader: rH,
      annotated: annotateRows(alignTextByLines(from.userPrompt ?? "", to.userPrompt ?? ""))
    }
  ];
});

function goVersions() {
  const id = promptId.value;
  if (id) router.push({ name: "prompt-versions", params: { id } });
  else router.push({ name: "home-main" });
}

async function loadPromptTitle() {
  const id = promptId.value;
  if (!id) return;
  try {
    const d = await api.getPrompt(id);
    promptTitle.value = d.title;
  } catch {
    promptTitle.value = "";
  }
}

async function loadDiff() {
  const id = promptId.value;
  const rawFrom = fromVN.value;
  const rawTo = toVN.value;
  errorMsg.value = "";
  diffData.value = null;
  if (!id) {
    errorMsg.value = "无效的 Prompt ID";
    return;
  }
  if (!Number.isFinite(rawFrom) || !Number.isFinite(rawTo)) {
    errorMsg.value = "请从「历史版本」页勾选两个版本后进入对比（缺少 from / to 版本号）。";
    return;
  }
  const lo = Math.min(rawFrom, rawTo);
  const hi = Math.max(rawFrom, rawTo);
  loading.value = true;
  try {
    diffData.value = await api.diffPromptVersions(id, lo, hi);
  } catch (e) {
    errorMsg.value = e instanceof ApiError ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function loadAll() {
  await loadPromptTitle();
  await loadDiff();
}

onMounted(() => {
  loadAll();
});

watch([promptId, () => route.query.from, () => route.query.to], () => {
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

.compare-embed-pane {
  max-width: min(1280px, 100%);
  width: 100%;
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

.compare-prompt-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: #334155;
}

.compare-pair {
  margin: 0 0 12px;
  font-size: 13px;
}

.compare-loading {
  padding: 20px 0;
  font-size: 13px;
}

.compare-merge-root {
  padding-top: 2px;
}

.merge-legend {
  font-size: 12px;
  margin: 0 0 14px;
  line-height: 1.5;
}

.lg-del {
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(197, 48, 48, 0.12);
  color: #b42318;
}

.lg-add {
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(26, 127, 55, 0.12);
  color: #116329;
}

.lg-chg {
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(154, 103, 0, 0.14);
  color: #7c4a00;
}

.merge-section {
  margin-bottom: 22px;
}

.merge-section-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #64748b;
  margin: 0 0 6px 2px;
}

.merge-editor {
  border: 1px solid #d0d7de;
  border-radius: 8px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.merge-header {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid #d0d7de;
  background: linear-gradient(180deg, #f6f8fa 0%, #eff2f5 100%);
  font-size: 12px;
  font-weight: 600;
  color: #24292f;
}

.merge-header-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  min-width: 0;
}

.merge-header-left {
  border-right: 1px solid #d0d7de;
}

.merge-header-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eaeef2;
  color: #24292f;
  font-variant-numeric: tabular-nums;
}

.merge-header-badge-new {
  background: #ddf4ff;
  color: #0969da;
}

.merge-header-hint {
  font-weight: 500;
  color: #656d76;
}

.merge-body {
  max-height: min(320px, 38vh);
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  line-height: 20px;
}

.merge-section:last-child .merge-body {
  max-height: min(420px, 48vh);
}

.merge-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px minmax(0, 1fr);
  border-bottom: 1px solid #f0f3f6;
  min-height: 22px;
}

.merge-row:last-child {
  border-bottom: none;
}

.merge-gutter {
  flex-shrink: 0;
  text-align: right;
  padding: 0 8px 0 6px;
  user-select: none;
  color: #656d76;
  background: #f6f8fa;
  border-right: 1px solid #eef1f4;
  font-variant-numeric: tabular-nums;
}

.merge-ln {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  min-width: 0;
}

.merge-line {
  margin: 0;
  padding: 0 10px 0 8px;
  white-space: pre-wrap;
  word-break: break-word;
  color: #24292f;
  background: #ffffff;
  border-right: 1px solid #f0f3f6;
  min-width: 0;
}

.merge-line-right {
  border-right: none;
}

.merge-row--same .merge-line {
  background: #ffffff;
}

.merge-row--del .merge-gutter:first-child,
.merge-row--del .merge-line-left {
  background: #ffebe9;
}

.merge-row--del .merge-line-left {
  box-shadow: inset 3px 0 0 0 #cf222e;
}

.merge-row--del .merge-gutter:nth-child(3),
.merge-row--del .merge-line-right {
  background: #f6f8fa;
  color: #8c959f;
}

.merge-row--add .merge-gutter:first-child,
.merge-row--add .merge-line-left {
  background: #f6f8fa;
  color: #8c959f;
}

.merge-row--add .merge-gutter:nth-child(3),
.merge-row--add .merge-line-right {
  background: #dafbe1;
}

.merge-row--add .merge-line-right {
  box-shadow: inset 3px 0 0 0 #1a7f37;
}

.merge-row--chg .merge-gutter:first-child,
.merge-row--chg .merge-line-left {
  background: #fff8c5;
  box-shadow: inset 3px 0 0 0 #9a6700;
}

.merge-row--chg .merge-gutter:nth-child(3),
.merge-row--chg .merge-line-right {
  background: #fff8c5;
  box-shadow: inset 3px 0 0 0 #9a6700;
}

.meta {
  color: #6b7280;
}

.muted {
  color: #9099ab;
}

@media (max-width: 720px) {
  .merge-row {
    grid-template-columns: 36px minmax(0, 1fr) 36px minmax(0, 1fr);
    font-size: 11px;
  }

  .merge-body {
    max-height: 55vh;
  }
}
</style>
