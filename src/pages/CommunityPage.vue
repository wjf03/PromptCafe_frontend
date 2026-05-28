<template>
  <WorkspaceLayout title="社区中心" :toast-message="toastMessage">
    <template #actions>
      <button v-if="isLoggedIn" type="button" class="text-btn" :class="{ active: listMode === 'favorites' }" @click="toggleFavorites">
        我的收藏
      </button>
      <button v-if="isLoggedIn" type="button" class="text-btn" @click="toggleMyShares">我的分享</button>
      <button type="button" class="text-btn" :disabled="listLoading" @click="refreshAll">刷新</button>
    </template>

    <div class="workspace community-workspace">
      <aside class="list-pane community-list-pane">
        <div class="list-header list-header-row">
          <span>共 {{ total }} 个{{ listMode === "favorites" ? "收藏" : "公开 Prompt" }}</span>
          <span v-if="listLoading" class="muted"> · 加载中...</span>
        </div>

        <div class="list-toolbar">
          <input
            v-model="keyword"
            class="list-filter-input"
            type="search"
            maxlength="200"
            :disabled="listMode === 'favorites'"
            :placeholder="listMode === 'favorites' ? '我的收藏中暂不支持搜索' : '搜索标题、描述或标签...'"
            enterkeyhint="search"
          />
          <label class="list-sort-label">
            <span>排序</span>
            <select v-model="sort" class="list-sort-select" :disabled="listMode === 'favorites'">
              <option value="latest">最新</option>
              <option value="favoriteCount">收藏数</option>
              <option value="hot">热度</option>
            </select>
          </label>
        </div>

        <div v-if="listMode === 'all' && tags.length" class="tag-cloud">
          <button
            v-for="tag in tags"
            :key="tag.name"
            type="button"
            class="tag-pill"
            :class="{ active: selectedTags.includes(tag.name) }"
            @click="toggleTag(tag.name)"
          >
            {{ tag.name }} · {{ tag.promptCount }}
          </button>
        </div>

        <article
          v-for="item in items"
          :key="item.id"
          class="community-card"
          :class="{ active: item.id === selectedId }"
          @click="openItem(item.id)"
        >
          <div class="community-card-head">
            <h3>{{ item.title }}</h3>
            <span>{{ item.favoriteCount }} 收藏</span>
          </div>
          <p>{{ item.description || item.contentPreview || "暂无描述" }}</p>
          <div v-if="item.tags.length" class="tag-row compact-tags">
            <span v-for="tag in item.tags" :key="`${item.id}-${tag}`" class="tag-chip">{{ tag }}</span>
          </div>
          <div class="prompt-card-meta muted">
            {{ item.authorName }} · {{ formatTime(item.publishedAt) }}
          </div>
        </article>

        <div v-if="!listLoading && items.length === 0" class="empty-list">
          {{ listMode === "favorites" ? "暂无收藏内容" : "暂无社区内容" }}
        </div>
        <div class="pager" v-if="totalPages > 1">
          <button type="button" class="text-btn sm" :disabled="page <= 1" @click="changePage(page - 1)">
            上一页
          </button>
          <span class="muted">{{ page }} / {{ totalPages }}</span>
          <button type="button" class="text-btn sm" :disabled="page >= totalPages" @click="changePage(page + 1)">
            下一页
          </button>
        </div>
      </aside>

      <div class="splitter-col static-splitter" />

      <div class="right-workspace">
        <div class="detail-scroll">
          <main class="detail-pane">
            <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

            <template v-if="detail && !detailLoading">
              <h2 class="detail-title-line">{{ detail.title }}</h2>
              <p class="meta">
                {{ detail.authorName }} · {{ formatTime(detail.publishedAt) }} · {{ detail.favoriteCount }} 收藏
              </p>
              <p class="detail-desc">{{ detail.description || "暂无描述" }}</p>

              <div v-if="detail.tags.length" class="tag-row">
                <span v-for="tag in detail.tags" :key="`d-${tag}`" class="tag-chip">{{ tag }}</span>
              </div>

              <div class="field">
                <div class="label">使用说明</div>
                <div class="value">{{ detail.usageGuide || "暂无使用说明" }}</div>
              </div>
              <div class="field">
                <div class="label">系统提示词</div>
                <div class="value pre">{{ detail.systemPrompt || "（空）" }}</div>
              </div>
              <div class="field">
                <div class="label">用户提示词</div>
                <div class="value pre">{{ detail.userPrompt }}</div>
              </div>

              <div v-if="detail.variables?.length" class="field">
                <div class="label">变量</div>
                <div class="community-vars">
                  <span v-for="v in detail.variables" :key="v.name" class="filter-tag-chip">
                    {{ v.label || v.name }} / {{ v.type }}{{ v.required ? " / 必填" : "" }}
                  </span>
                </div>
              </div>

              <footer class="bottom-actions">
                <button v-if="isLoggedIn" type="button" class="primary" :disabled="actionLoading" @click="toggleFavorite">
                  {{ detail.favorited ? "取消收藏" : "收藏" }}
                </button>
                <button v-if="isLoggedIn" type="button" class="light" :disabled="actionLoading" @click="forkCurrent">Fork 到我的 Prompt</button>
                <button v-if="isLoggedIn" type="button" class="light" :disabled="actionLoading" @click="openReportPanel">举报</button>
                <button v-if="!isLoggedIn" type="button" class="light" :disabled="actionLoading" @click="openAiPolish">AI 润色</button>
                <button v-if="!isLoggedIn" type="button" class="light" :disabled="actionLoading" @click="openAiTest">AI 测试</button>
                <button type="button" class="light" @click="copyPromptText">复制内容</button>
              </footer>
            </template>

            <div v-else-if="detailLoading" class="muted center-pad">加载详情...</div>
            <div v-else class="muted center-pad">请选择一条社区 Prompt。</div>

            <section v-if="aiPanel && detail" class="tool-panel">
              <div class="tool-panel-head">
                <h3>{{ aiPanel === "polish" ? "AI 润色" : "AI 测试" }}</h3>
                <button type="button" class="preview-close-btn" aria-label="关闭" @click="closeAiPanel">×</button>
              </div>
              <p v-if="!isLoggedIn" class="muted">游客模式将使用管理员配置的系统默认 API Key，今日剩余额度：{{ guestConfig?.remainingCount ?? "-" }} / {{ guestConfig?.dailyLimit ?? "-" }}</p>

              <template v-if="aiPanel === 'polish'">
                <div class="form-grid compact-form">
                  <label class="fg-label">语气</label>
                  <select v-model="polishForm.tone" class="fg-input">
                    <option value="formal">正式</option>
                    <option value="casual">自然</option>
                    <option value="concise">简洁</option>
                    <option value="academic">学术</option>
                    <option value="creative">创意</option>
                  </select>
                  <label class="fg-label">语言</label>
                  <select v-model="polishForm.language" class="fg-input">
                    <option value="zh-CN">中文</option>
                    <option value="en-US">英文</option>
                  </select>
                  <label class="fg-label">长度</label>
                  <select v-model="polishForm.lengthPreference" class="fg-input">
                    <option value="short">更短</option>
                    <option value="medium">适中</option>
                    <option value="long">更详细</option>
                  </select>
                </div>
                <div class="bottom-actions inline-actions">
                  <button type="button" class="primary" :disabled="aiLoading" @click="runPolish">开始润色</button>
                </div>
                <div v-if="polishResult" class="ai-result-grid">
                  <div>
                    <div class="label">优化结果</div>
                    <div class="value pre">{{ polishResult.optimized }}</div>
                  </div>
                  <div>
                    <div class="label">建议</div>
                    <ul class="suggestion-list">
                      <li v-for="(item, idx) in polishResult.suggestions" :key="idx">{{ item }}</li>
                    </ul>
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="form-grid compact-form">
                  <label class="fg-label">服务商</label>
                  <input class="fg-input" type="text" :value="providerLabel(testForm.provider)" disabled />
                  <label class="fg-label">模型</label>
                  <input v-model="testForm.model" class="fg-input" type="text" :disabled="!isLoggedIn" />
                  <label class="fg-label">Temperature</label>
                  <input v-model.number="testForm.temperature" class="fg-input" type="number" min="0" max="2" step="0.1" />
                  <label class="fg-label">Max Tokens</label>
                  <input v-model.number="testForm.maxTokens" class="fg-input" type="number" min="1" max="16384" step="1" />
                </div>
                <div v-if="detail.variables?.length" class="test-vars">
                  <div class="label">测试变量</div>
                  <div v-for="v in detail.variables" :key="v.name" class="test-var-row">
                    <span>{{ v.label || v.name }}</span>
                    <input v-model="testVariables[v.name]" class="fg-input" type="text" :placeholder="v.description || v.name" />
                  </div>
                </div>
                <div class="bottom-actions inline-actions">
                  <button type="button" class="primary" :disabled="aiLoading" @click="runAiTest">运行测试</button>
                </div>
                <div v-if="testResult" class="ai-result-grid">
                  <div>
                    <div class="label">模型输出</div>
                    <div class="value pre">{{ testResult.output }}</div>
                  </div>
                  <div>
                    <div class="label">渲染 Prompt</div>
                    <div class="value pre">{{ testResult.renderedPrompt }}</div>
                  </div>
                </div>
              </template>
            </section>

            <section v-if="reportPanelOpen && detail" class="tool-panel">
              <div class="tool-panel-head">
                <h3>举报社区 Prompt</h3>
                <button type="button" class="preview-close-btn" aria-label="关闭" @click="reportPanelOpen = false">×</button>
              </div>
              <div class="form-grid compact-form">
                <label class="fg-label">原因</label>
                <select v-model="reportForm.reason" class="fg-input">
                  <option value="unsafe_content">不安全内容</option>
                  <option value="copyright">版权问题</option>
                  <option value="spam">垃圾内容</option>
                  <option value="privacy">隐私问题</option>
                  <option value="other">其他</option>
                </select>
                <label class="fg-label">补充说明</label>
                <textarea v-model="reportForm.description" class="fg-textarea" rows="3" maxlength="1000" />
              </div>
              <div class="bottom-actions inline-actions">
                <button type="button" class="danger" :disabled="actionLoading" @click="submitReport">提交举报</button>
                <button type="button" class="light" :disabled="actionLoading" @click="reportPanelOpen = false">取消</button>
              </div>
            </section>

            <section v-if="mySharesOpen" class="tool-panel">
              <div class="tool-panel-head">
                <h3>我的分享</h3>
                <button type="button" class="preview-close-btn" aria-label="关闭" @click="mySharesOpen = false">×</button>
              </div>
              <div class="share-filter">
                <label class="list-sort-label">
                  <span>审核状态</span>
                  <select v-model="shareStatusFilter" class="list-sort-select" @change="loadMyShares">
                    <option value="">全部</option>
                    <option value="pending">待审核</option>
                    <option value="approved">已通过</option>
                    <option value="rejected">已驳回</option>
                    <option value="removed">已下架</option>
                  </select>
                </label>
                <button type="button" class="text-btn" :disabled="actionLoading" @click="loadMyShares">刷新</button>
              </div>
              <div v-if="myShares.length" class="record-list">
                <div v-for="share in myShares" :key="share.shareId" class="share-row">
                  <div>
                    <strong>{{ share.title }}</strong>
                    <p class="muted">{{ reviewStatusText(share.reviewStatus) }} · {{ formatTime(share.submittedAt) }}</p>
                    <p v-if="share.auditNote" class="muted">{{ share.auditNote }}</p>
                  </div>
                  <button
                    type="button"
                    class="text-btn sm"
                    :disabled="share.reviewStatus !== 'pending' || actionLoading"
                    @click="withdrawMyShare(share.shareId)"
                  >
                    撤回
                  </button>
                </div>
              </div>
              <div v-else class="muted">暂无分享记录</div>
            </section>
          </main>
        </div>
      </div>
    </div>
  </WorkspaceLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { isAuthenticated } from "../api/auth";
import * as ai from "../api/ai";
import * as community from "../api/community";
import { friendlyApiMessage } from "../api/errors";
import type { AIGuestConfig, AIPolishResult, AITestResult } from "../api/ai";
import type {
  CommunityPromptDetail,
  CommunityPromptListItem,
  CommunitySort,
  CommunityTagItem,
  MyShareItem,
  ReportReason,
  ReviewStatus
} from "../api/community";
import WorkspaceLayout from "../layouts/WorkspaceLayout.vue";
import { formatChinaTime } from "../util/time";

const items = ref<CommunityPromptListItem[]>([]);
const tags = ref<CommunityTagItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const keyword = ref("");
const selectedTags = ref<string[]>([]);
const sort = ref<CommunitySort>("latest");
const listMode = ref<"all" | "favorites">("all");
const listLoading = ref(false);
const detailLoading = ref(false);
const actionLoading = ref(false);
const errorMsg = ref("");
const selectedId = ref<string | null>(null);
const detail = ref<CommunityPromptDetail | null>(null);
const toastMessage = ref("");
const reportPanelOpen = ref(false);
const mySharesOpen = ref(false);
const aiPanel = ref<"polish" | "test" | null>(null);
const aiLoading = ref(false);
const guestConfig = ref<AIGuestConfig | null>(null);
const polishResult = ref<AIPolishResult | null>(null);
const testResult = ref<AITestResult | null>(null);
const myShares = ref<MyShareItem[]>([]);
const shareStatusFilter = ref<ReviewStatus | "">("");
const reportForm = reactive({
  reason: "unsafe_content" as ReportReason,
  description: ""
});
const polishForm = reactive({
  tone: "formal" as ai.AIPolishTone,
  language: "zh-CN" as ai.AILanguage,
  lengthPreference: "medium" as ai.AILengthPreference
});
const testForm = reactive({
  provider: "deepseek" as ai.AIProvider,
  model: "deepseek-chat",
  temperature: 0.7,
  maxTokens: 4096
});
const testVariables = reactive<Record<string, string>>({});

let listDebounce: ReturnType<typeof setTimeout> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));
const isLoggedIn = computed(() => isAuthenticated());

function showToast(message: string) {
  if (toastTimer) clearTimeout(toastTimer);
  toastMessage.value = message;
  toastTimer = setTimeout(() => {
    toastMessage.value = "";
    toastTimer = null;
  }, 2600);
}

function formatTime(iso: string) {
  return formatChinaTime(iso);
}

function apiMessage(e: unknown) {
  return friendlyApiMessage(e);
}

function providerLabel(provider?: string | null) {
  const labels: Record<string, string> = {
    openai: "OpenAI",
    deepseek: "DeepSeek",
    anthropic: "Anthropic",
    custom: "自定义"
  };
  return provider ? labels[provider] ?? provider : "-";
}

function scheduleReload() {
  if (listDebounce) clearTimeout(listDebounce);
  listDebounce = setTimeout(async () => {
    listDebounce = null;
    page.value = 1;
    await refreshList();
  }, 360);
}

async function refreshList() {
  errorMsg.value = "";
  listLoading.value = true;
  try {
    const data =
      listMode.value === "favorites"
        ? await community.listFavoriteCommunityPrompts({
            page: page.value,
            pageSize: pageSize.value
          })
        : selectedTags.value.length === 1 && !keyword.value.trim()
        ? await community.searchCommunityPromptsByTag({
            tag: selectedTags.value[0],
            page: page.value,
            pageSize: pageSize.value
          })
        : await community.listCommunityPrompts({
            keyword: keyword.value,
            tags: selectedTags.value,
            sort: sort.value,
            page: page.value,
            pageSize: pageSize.value
          });
    items.value = data.items;
    total.value = data.pagination.total;
    page.value = data.pagination.page;
    pageSize.value = data.pagination.pageSize;
    if (listMode.value === "favorites" && selectedId.value && !items.value.some((item) => item.id === selectedId.value)) {
      selectedId.value = null;
      detail.value = null;
      reportPanelOpen.value = false;
    }
  } catch (e) {
    errorMsg.value = apiMessage(e);
  } finally {
    listLoading.value = false;
  }
}

async function refreshTags() {
  try {
    const data = await community.listCommunityTags();
    tags.value = data.items;
  } catch {
    tags.value = [];
  }
}

async function refreshAll() {
  await Promise.all([refreshList(), refreshTags()]);
}

async function openItem(id: string) {
  selectedId.value = id;
  reportPanelOpen.value = false;
  closeAiPanel();
  detailLoading.value = true;
  errorMsg.value = "";
  try {
    detail.value = await community.getCommunityPrompt(id);
  } catch (e) {
    detail.value = null;
    errorMsg.value = apiMessage(e);
  } finally {
    detailLoading.value = false;
  }
}

function toggleTag(tag: string) {
  if (listMode.value === "favorites") {
    listMode.value = "all";
  }
  selectedTags.value = selectedTags.value.includes(tag)
    ? selectedTags.value.filter((x) => x !== tag)
    : [...selectedTags.value, tag];
  scheduleReload();
}

async function toggleFavorites() {
  if (!isLoggedIn.value) {
    errorMsg.value = "请先登录后查看我的收藏";
    return;
  }
  listMode.value = listMode.value === "favorites" ? "all" : "favorites";
  mySharesOpen.value = false;
  reportPanelOpen.value = false;
  page.value = 1;
  await refreshList();
}

async function changePage(next: number) {
  page.value = next;
  await refreshList();
}

async function toggleFavorite() {
  if (!detail.value) return;
  if (!isLoggedIn.value) {
    errorMsg.value = "请先登录后收藏社区 Prompt";
    return;
  }
  actionLoading.value = true;
  errorMsg.value = "";
  try {
    const r = detail.value.favorited
      ? await community.unfavoriteCommunityPrompt(detail.value.id)
      : await community.favoriteCommunityPrompt(detail.value.id);
    detail.value.favorited = r.favorited;
    detail.value.favoriteCount = r.favoriteCount;
    const current = items.value.find((x) => x.id === detail.value?.id);
    if (current) {
      current.favorited = r.favorited;
      current.favoriteCount = r.favoriteCount;
    }
    if (listMode.value === "favorites" && !r.favorited) {
      items.value = items.value.filter((x) => x.id !== detail.value?.id);
      total.value = Math.max(0, total.value - 1);
      selectedId.value = null;
      detail.value = null;
      reportPanelOpen.value = false;
      if (items.value.length === 0 && page.value > 1) {
        page.value -= 1;
        await refreshList();
      }
    }
    showToast(r.favorited ? "已收藏" : "已取消收藏");
  } catch (e) {
    errorMsg.value = apiMessage(e);
  } finally {
    actionLoading.value = false;
  }
}

async function forkCurrent() {
  if (!detail.value) return;
  if (!isLoggedIn.value) {
    errorMsg.value = "请先登录后 Fork 到我的 Prompt";
    return;
  }
  actionLoading.value = true;
  errorMsg.value = "";
  try {
    const r = await community.forkCommunityPrompt(detail.value.id);
    showToast(`已 Fork：${r.title}，可返回我的 Prompt 查看`);
  } catch (e) {
    errorMsg.value = apiMessage(e);
  } finally {
    actionLoading.value = false;
  }
}

function openReportPanel() {
  if (!detail.value) return;
  if (!isLoggedIn.value) {
    errorMsg.value = "请先登录后举报社区 Prompt";
    return;
  }
  reportForm.reason = "unsafe_content";
  reportForm.description = "";
  mySharesOpen.value = false;
  reportPanelOpen.value = true;
}

async function submitReport() {
  if (!detail.value) return;
  actionLoading.value = true;
  errorMsg.value = "";
  try {
    await community.reportCommunityPrompt(detail.value.id, {
      reason: reportForm.reason,
      description: reportForm.description.trim() || undefined
    });
    reportPanelOpen.value = false;
    showToast("举报已提交");
  } catch (e) {
    errorMsg.value = apiMessage(e);
  } finally {
    actionLoading.value = false;
  }
}

async function toggleMyShares() {
  if (!isLoggedIn.value) {
    errorMsg.value = "请先登录后查看我的分享";
    return;
  }
  mySharesOpen.value = !mySharesOpen.value;
  if (mySharesOpen.value) {
    reportPanelOpen.value = false;
    await loadMyShares();
  }
}

async function loadMyShares() {
  actionLoading.value = true;
  errorMsg.value = "";
  try {
    const data = await community.listMyShares({
      reviewStatus: shareStatusFilter.value,
      page: 1,
      pageSize: 20
    });
    myShares.value = data.items;
  } catch (e) {
    myShares.value = [];
    errorMsg.value = apiMessage(e);
  } finally {
    actionLoading.value = false;
  }
}

async function withdrawMyShare(shareId: string) {
  actionLoading.value = true;
  errorMsg.value = "";
  try {
    await community.withdrawShare(shareId);
    showToast("已撤回分享");
    await loadMyShares();
  } catch (e) {
    errorMsg.value = apiMessage(e);
  } finally {
    actionLoading.value = false;
  }
}

function reviewStatusText(status: ReviewStatus) {
  const map: Record<ReviewStatus, string> = {
    pending: "待审核",
    approved: "已通过",
    rejected: "已驳回",
    removed: "已下架"
  };
  return map[status];
}

function closeAiPanel() {
  aiPanel.value = null;
}

function communityPromptContent() {
  if (!detail.value) return "";
  return [
    detail.value.systemPrompt?.trim() ? `【系统提示词】\n${detail.value.systemPrompt.trim()}` : "",
    detail.value.userPrompt.trim() ? `【用户提示词】\n${detail.value.userPrompt.trim()}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function prepareGuestConfig() {
  if (isLoggedIn.value) return;
  guestConfig.value = await ai.getGuestConfig();
  if (!guestConfig.value.configured) {
    throw new Error("游客 AI 服务尚未配置，请联系管理员设置系统默认 API Key");
  }
  if (!guestConfig.value.allowed) {
    throw new Error("游客 AI 调用额度已用完，请明天再试或登录后使用个人 API Key");
  }
  if (guestConfig.value.provider) testForm.provider = guestConfig.value.provider;
  if (guestConfig.value.defaultModel) testForm.model = guestConfig.value.defaultModel;
}

async function prepareUserModel() {
  if (!isLoggedIn.value) return;
  const [status, models] = await Promise.all([ai.getApiKeyStatus(), ai.getModels()]);
  if (status.configured && status.provider) testForm.provider = status.provider;
  const options = models.items.find((item) => item.provider === testForm.provider)?.models ?? [];
  if (options.length && !options.includes(testForm.model)) {
    testForm.model = options[0];
  }
}

async function openAiPolish() {
  if (!detail.value) return;
  errorMsg.value = "";
  try {
    await prepareGuestConfig();
    polishResult.value = null;
    testResult.value = null;
    reportPanelOpen.value = false;
    mySharesOpen.value = false;
    aiPanel.value = "polish";
  } catch (e) {
    errorMsg.value = apiMessage(e);
  }
}

async function openAiTest() {
  if (!detail.value) return;
  errorMsg.value = "";
  try {
    await prepareGuestConfig();
    await prepareUserModel();
    for (const key of Object.keys(testVariables)) delete testVariables[key];
    for (const variable of detail.value.variables ?? []) {
      if (!variable.name?.trim()) continue;
      testVariables[variable.name.trim()] = (variable.value ?? "").toString();
    }
    polishResult.value = null;
    testResult.value = null;
    reportPanelOpen.value = false;
    mySharesOpen.value = false;
    aiPanel.value = "test";
  } catch (e) {
    errorMsg.value = apiMessage(e);
  }
}

async function runPolish() {
  if (!detail.value) return;
  aiLoading.value = true;
  errorMsg.value = "";
  try {
    await prepareGuestConfig();
    polishResult.value = await ai.polishPrompt({
      content: detail.value.userPrompt,
      tone: polishForm.tone,
      language: polishForm.language,
      lengthPreference: polishForm.lengthPreference
    });
    if (!isLoggedIn.value) guestConfig.value = await ai.getGuestConfig();
    showToast("润色完成");
  } catch (e) {
    errorMsg.value = apiMessage(e);
  } finally {
    aiLoading.value = false;
  }
}

async function runAiTest() {
  const content = communityPromptContent();
  if (!content.trim()) {
    errorMsg.value = "没有可测试的 Prompt 内容";
    return;
  }
  aiLoading.value = true;
  errorMsg.value = "";
  try {
    await prepareGuestConfig();
    testResult.value = await ai.testPrompt({
      content,
      variables: { ...testVariables },
      provider: testForm.provider,
      model: testForm.model.trim(),
      temperature: testForm.temperature,
      maxTokens: testForm.maxTokens
    });
    if (!isLoggedIn.value) guestConfig.value = await ai.getGuestConfig();
    showToast("AI 测试完成");
  } catch (e) {
    errorMsg.value = apiMessage(e);
  } finally {
    aiLoading.value = false;
  }
}

function copyPromptText() {
  if (!detail.value) return;
  const text = [
    detail.value.systemPrompt ? `【系统】\n${detail.value.systemPrompt}` : "",
    `【用户】\n${detail.value.userPrompt}`
  ]
    .filter(Boolean)
    .join("\n\n");
  navigator.clipboard.writeText(text).then(
    () => showToast("已复制到剪贴板"),
    () => {
      errorMsg.value = "复制失败，请检查浏览器权限";
    }
  );
}

watch(keyword, () => {
  if (listMode.value === "favorites") return;
  scheduleReload();
});
watch(sort, async () => {
  if (listMode.value === "favorites") return;
  page.value = 1;
  await refreshList();
});

onMounted(refreshAll);

onUnmounted(() => {
  if (listDebounce) clearTimeout(listDebounce);
  if (toastTimer) clearTimeout(toastTimer);
});
</script>

<style scoped>
.community-workspace {
  min-height: 0;
}
.community-list-pane {
  width: 360px;
}
.static-splitter {
  cursor: default;
}
.list-header-row,
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.list-toolbar {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
}
.list-filter-input,
.list-sort-select,
.fg-input,
.fg-textarea {
  width: 100%;
  border: 1px solid #e2e6f0;
  border-radius: 10px;
  padding: 8px 10px;
  background: #fff;
}
.list-filter-input:disabled,
.list-sort-select:disabled {
  background: #f4f6fb;
  color: #98a2b3;
  cursor: not-allowed;
}
.text-btn.active {
  color: #2f67ea;
  font-weight: 600;
  background: #eff3ff;
}
.fg-textarea {
  resize: vertical;
  min-height: 80px;
}
.list-sort-label {
  display: grid;
  gap: 5px;
  width: 100%;
  font-size: 12px;
  color: #6b7280;
}
.form-grid {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 10px 14px;
  align-items: start;
}
.fg-label {
  font-size: 13px;
  color: #6b7280;
  padding-top: 8px;
}
.muted {
  color: #9099ab;
}
.sm {
  padding: 4px 8px !important;
  font-size: 12px !important;
}
.error-msg {
  margin: 0 0 8px;
  padding: 8px 12px;
  background: #fef2f2;
  color: #b91c1c;
  border-radius: 8px;
  font-size: 13px;
}
.detail-title-line {
  margin: 0;
  font-size: 32px;
  line-height: 1.2;
}
.detail-desc {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.55;
  color: #4b5563;
  word-break: break-word;
}
.tag-row {
  margin-bottom: 12px;
}
.tag-chip {
  display: inline-block;
  font-size: 12px;
  padding: 2px 8px;
  margin-right: 6px;
  border-radius: 6px;
  background: #eef2fa;
  color: #3f4658;
}
.filter-tag-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: #eef2fa;
  color: #3f4658;
  padding: 4px 8px;
  font-size: 12px;
}
.pre {
  white-space: pre-wrap;
  word-break: break-word;
}
.empty-list,
.center-pad {
  font-size: 13px;
  color: #98a2b3;
  padding: 12px 4px;
}
.prompt-card-meta {
  font-size: 12px;
}
.preview-close-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #667085;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}
.preview-close-btn:hover {
  background: #eef2fa;
  color: #2f67ea;
}
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 12px 0;
}
.tag-pill {
  border: 1px solid #d8deea;
  background: #fff;
  color: #667085;
  border-radius: 999px;
  padding: 5px 9px;
  font-size: 12px;
  cursor: pointer;
}
.tag-pill.active {
  border-color: #2f67ea;
  background: #eef3ff;
  color: #2f67ea;
  font-weight: 600;
}
.community-card {
  border: 1px solid #e2e6f0;
  background: #fff;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 10px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.community-card:hover,
.community-card.active {
  border-color: #2f67ea;
  box-shadow: 0 2px 8px rgba(47, 103, 234, 0.14);
}
.community-card-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.community-card h3 {
  margin: 0;
  font-size: 15px;
  line-height: 1.35;
}
.community-card-head span {
  flex-shrink: 0;
  color: #667085;
  font-size: 12px;
}
.community-card p {
  margin: 8px 0;
  color: #4b5563;
  font-size: 13px;
  line-height: 1.5;
}
.compact-tags {
  margin: 0 0 8px;
}
.community-vars {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tool-panel {
  margin-top: 18px;
  border: 1px solid #e2e6f0;
  border-radius: 10px;
  background: #fff;
  padding: 14px;
}
.tool-panel-head,
.share-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.tool-panel-head {
  margin-bottom: 10px;
}
.tool-panel-head h3 {
  margin: 0;
  font-size: 16px;
}
.inline-actions {
  margin-top: 12px;
  flex-wrap: wrap;
}
.ai-result-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(240px, 0.8fr);
  gap: 12px;
  margin-top: 12px;
}
.suggestion-list {
  margin: 0;
  padding: 10px 12px 10px 28px;
  border: 1px solid #e2e6f0;
  border-radius: 10px;
  background: #fbfcff;
  color: #4b5563;
  line-height: 1.55;
}
.test-vars {
  margin-top: 12px;
}
.test-var-row {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  margin-top: 8px;
}
.test-var-row span {
  color: #5b6475;
  font-size: 13px;
  word-break: break-word;
}
.share-filter {
  display: flex;
  align-items: end;
  gap: 12px;
  margin-bottom: 12px;
}
.record-list {
  display: grid;
  gap: 8px;
}
.share-row {
  border: 1px solid #e2e6f0;
  border-radius: 10px;
  padding: 10px;
}
.share-row p {
  margin: 4px 0 0;
  font-size: 12px;
}
@media (max-width: 860px) {
  .form-grid,
  .ai-result-grid,
  .test-var-row {
    grid-template-columns: 1fr;
  }
}
</style>
