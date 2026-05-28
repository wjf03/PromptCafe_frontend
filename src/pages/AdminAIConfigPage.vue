<template>
  <WorkspaceLayout title="系统 AI 配置" :toast-message="toastMessage">
    <div class="admin-page">
      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

      <section class="admin-card">
        <h2>游客默认 AI 服务</h2>
        <p class="muted">该配置供游客使用 AI 润色与 AI 测试时调用，API Key 仅加密保存在服务端。</p>

        <div class="form-grid compact-form">
          <label class="fg-label">服务商</label>
          <select v-model="form.provider" class="fg-input">
            <option value="openai">OpenAI</option>
            <option value="deepseek">DeepSeek</option>
            <option value="anthropic">Anthropic</option>
            <option value="custom">自定义</option>
          </select>

          <label class="fg-label">Base URL</label>
          <input v-model="form.baseUrl" class="fg-input" type="url" placeholder="留空则使用服务商默认地址" />

          <label class="fg-label">默认模型</label>
          <input v-model="form.defaultModel" class="fg-input" type="text" placeholder="例如 deepseek-chat" />

          <label class="fg-label">游客每日额度</label>
          <input v-model.number="form.dailyGuestLimit" class="fg-input" type="number" min="0" max="100000" step="1" />

          <label class="fg-label">启用</label>
          <label class="chk"><input v-model="form.isEnabled" type="checkbox" /> 允许游客调用 AI</label>

          <label class="fg-label">API Key</label>
          <input v-model="form.apiKey" class="fg-input" type="password" autocomplete="new-password" placeholder="不修改时留空" />
        </div>

        <div class="ai-status-row">
          <span>状态：{{ status?.configured && status?.isEnabled ? "已启用" : "未启用" }}</span>
          <span v-if="status?.maskedKey">密钥：{{ status.maskedKey }}</span>
          <span v-if="status?.updatedAt">更新时间：{{ formatChinaTime(status.updatedAt) }}</span>
        </div>

        <div class="bottom-actions inline-actions">
          <button type="button" class="primary" :disabled="loading" @click="save">保存系统配置</button>
          <button type="button" class="light" :disabled="loading" @click="load">刷新</button>
        </div>
      </section>
    </div>
  </WorkspaceLayout>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import * as admin from "../api/admin";
import { friendlyApiMessage } from "../api/errors";
import type { AdminSystemAIConfig } from "../api/admin";
import WorkspaceLayout from "../layouts/WorkspaceLayout.vue";
import { formatChinaTime } from "../util/time";

const loading = ref(false);
const errorMsg = ref("");
const toastMessage = ref("");
const status = ref<AdminSystemAIConfig | null>(null);

const form = reactive({
  provider: "deepseek" as "openai" | "deepseek" | "anthropic" | "custom",
  baseUrl: "https://api.deepseek.com/v1",
  defaultModel: "deepseek-chat",
  dailyGuestLimit: 10,
  isEnabled: true,
  apiKey: ""
});

function showToast(message: string) {
  toastMessage.value = message;
  window.setTimeout(() => (toastMessage.value = ""), 2400);
}

async function load() {
  loading.value = true;
  errorMsg.value = "";
  try {
    const data = await admin.getSystemAIConfig();
    status.value = data;
    if (data.provider) form.provider = data.provider;
    form.baseUrl = data.baseUrl ?? form.baseUrl;
    form.defaultModel = data.defaultModel ?? form.defaultModel;
    form.dailyGuestLimit = data.dailyGuestLimit ?? 10;
    form.isEnabled = data.isEnabled;
    form.apiKey = "";
  } catch (e) {
    errorMsg.value = friendlyApiMessage(e);
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!form.defaultModel.trim()) {
    errorMsg.value = "默认模型不能为空";
    return;
  }
  loading.value = true;
  errorMsg.value = "";
  try {
    status.value = await admin.saveSystemAIConfig({
      provider: form.provider,
      baseUrl: form.baseUrl.trim() || undefined,
      apiKey: form.apiKey.trim() || undefined,
      defaultModel: form.defaultModel.trim(),
      dailyGuestLimit: form.dailyGuestLimit,
      isEnabled: form.isEnabled
    });
    form.apiKey = "";
    showToast("系统 AI 配置已保存");
  } catch (e) {
    errorMsg.value = friendlyApiMessage(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.admin-page {
  padding: 18px;
}
.admin-card {
  max-width: 960px;
  padding: 16px;
  border: 1px solid #e2e6f0;
  border-radius: 14px;
  background: #fff;
}
.admin-card h2 {
  margin: 0 0 6px;
  font-size: 18px;
}
.compact-form {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 12px;
  margin-top: 16px;
}
.fg-label {
  padding-top: 8px;
  color: #6b7280;
  font-size: 13px;
}
.fg-input {
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid #e2e6f0;
  border-radius: 10px;
}
.chk {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ai-status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 14px;
  color: #5b6475;
  font-size: 13px;
}
.inline-actions {
  margin-top: 14px;
}
@media (max-width: 720px) {
  .compact-form {
    grid-template-columns: 1fr;
  }
}
</style>
