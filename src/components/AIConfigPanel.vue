<template>
  <div class="ai-config-panel">
    <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
    <div class="form-grid ai-config-form">
      <label class="fg-label">服务商</label>
      <select v-model="aiConfig.provider" class="fg-input">
        <option value="openai">OpenAI</option>
        <option value="deepseek">DeepSeek</option>
        <option value="anthropic">Anthropic</option>
        <option value="custom">自定义</option>
      </select>

      <label class="fg-label">Base URL</label>
      <input v-model="aiConfig.baseUrl" class="fg-input" type="url" placeholder="可选" />

      <label class="fg-label">API Key</label>
      <input v-model="aiConfig.apiKey" class="fg-input" type="password" autocomplete="new-password" />
    </div>

    <div class="ai-status-row">
      <span>密钥：{{ aiKeyStatus?.configured ? "已配置" : "未配置" }}</span>
      <span v-if="aiKeyStatus?.maskedKey">{{ aiKeyStatus.maskedKey }}</span>
      <span v-if="guestQuota">游客额度：{{ guestQuota.remainingCount }} / {{ guestQuota.dailyLimit }}</span>
    </div>

    <div class="bottom-actions inline-actions">
      <button type="button" class="primary" :disabled="loading" @click="saveConfig">保存配置</button>
      <button type="button" class="light" :disabled="loading" @click="loadStatus">刷新状态</button>
      <button type="button" class="danger" :disabled="loading || !aiKeyStatus?.configured" @click="deleteConfig">
        删除密钥
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import * as ai from "../api/ai";
import { friendlyApiMessage } from "../api/errors";
import type { AIApiKeyStatus, AIGuestQuota } from "../api/ai";

const emit = defineEmits<{
  toast: [message: string];
}>();

const loading = ref(false);
const errorMsg = ref("");
const aiKeyStatus = ref<AIApiKeyStatus | null>(null);
const guestQuota = ref<AIGuestQuota | null>(null);

const aiConfig = reactive({
  provider: "openai" as ai.AIProvider,
  baseUrl: "",
  apiKey: ""
});

function apiMessage(e: unknown) {
  return friendlyApiMessage(e);
}

async function loadStatus() {
  loading.value = true;
  errorMsg.value = "";
  try {
    const [status, quota] = await Promise.allSettled([ai.getApiKeyStatus(), ai.getGuestQuota()]);
    if (status.status === "fulfilled") {
      aiKeyStatus.value = status.value;
      aiConfig.provider = status.value.provider ?? aiConfig.provider;
      aiConfig.baseUrl = status.value.baseUrl ?? "";
    }
    if (quota.status === "fulfilled") guestQuota.value = quota.value;
    if (status.status === "rejected" && quota.status === "rejected") throw status.reason;
  } catch (e) {
    errorMsg.value = apiMessage(e);
  } finally {
    loading.value = false;
  }
}

async function saveConfig() {
  if (!aiConfig.apiKey.trim()) {
    errorMsg.value = "API Key 不能为空";
    return;
  }
  loading.value = true;
  errorMsg.value = "";
  try {
    aiKeyStatus.value = await ai.saveApiKey({
      provider: aiConfig.provider,
      apiKey: aiConfig.apiKey.trim(),
      baseUrl: aiConfig.baseUrl.trim() || undefined
    });
    aiConfig.apiKey = "";
    emit("toast", "AI 配置已保存");
  } catch (e) {
    errorMsg.value = apiMessage(e);
  } finally {
    loading.value = false;
  }
}

async function deleteConfig() {
  if (!confirm("确定删除当前 AI API Key？")) return;
  loading.value = true;
  errorMsg.value = "";
  try {
    await ai.deleteApiKey();
    aiKeyStatus.value = null;
    aiConfig.apiKey = "";
    emit("toast", "AI 密钥已删除");
    await loadStatus();
  } catch (e) {
    errorMsg.value = apiMessage(e);
  } finally {
    loading.value = false;
  }
}

onMounted(loadStatus);
</script>

<style scoped>
.ai-config-panel {
  min-width: 0;
}
.ai-config-form {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 10px 12px;
  align-items: start;
}
.fg-label {
  font-size: 13px;
  color: #6b7280;
  padding-top: 8px;
}
.fg-input {
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid #e2e6f0;
  border-radius: 10px;
  background: #fff;
  color: #1f2937;
}
.fg-input:focus {
  outline: none;
  border-color: #93b4f7;
  box-shadow: 0 0 0 2px rgba(147, 180, 247, 0.2);
}
.ai-status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 12px;
  font-size: 13px;
  color: #5b6475;
}
.inline-actions {
  margin-top: 12px;
}
@media (max-width: 720px) {
  .ai-config-form {
    grid-template-columns: 1fr;
  }
}
</style>
