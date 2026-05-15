<template>
  <WorkspaceLayout title="个人中心" :toast-message="toastMessage">
    <template #actions>
      <button type="button" class="text-btn" :disabled="loading" @click="loadProfile">刷新</button>
    </template>

    <div class="admin-page">
      <section class="admin-panel profile-panel">
        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        <div v-if="loading" class="muted center-pad">加载个人资料…</div>
        <template v-else>
          <article class="user-profile-card">
            <header class="user-profile-hero">
              <div class="user-profile-avatar" aria-hidden="true">
                <img
                  v-if="showAvatarPreview"
                  :src="avatarPreviewSrc"
                  alt=""
                  class="user-profile-avatar-img"
                  @error="avatarPreviewFailed = true"
                />
                <span v-else class="user-profile-avatar-fallback">{{ avatarInitial }}</span>
              </div>
              <div class="user-profile-identity">
                <h2 class="user-profile-name">{{ displayName }}</h2>
                <div class="user-profile-chips">
                  <span v-if="profile?.email" class="user-chip user-chip--muted" :title="profile.email">{{ profile.email }}</span>
                  <span class="user-chip">{{ roleLabel(profile?.role) }}</span>
                  <span class="user-chip user-chip--accent">{{ userStatusLabel(profile?.status) }}</span>
                </div>
              </div>
            </header>

            <div class="user-profile-editor">
              <p class="user-profile-editor-title">编辑资料</p>
              <p class="user-profile-editor-hint">用户名由系统分配，不可修改；其余信息保存后立即生效。</p>

              <div class="user-profile-fields">
                <label class="user-field user-field--full">
                  <span class="user-field-label">用户名</span>
                  <input class="user-input user-input--readonly" :value="profile?.username || '—'" type="text" disabled />
                </label>

                <label class="user-field">
                  <span class="user-field-label">昵称</span>
                  <input v-model="form.nickname" class="user-input" type="text" maxlength="80" placeholder="展示名称" />
                </label>

                <label class="user-field">
                  <span class="user-field-label">头像 URL</span>
                  <input v-model="form.avatarUrl" class="user-input" type="url" placeholder="https://…" />
                </label>

                <label class="user-field user-field--full">
                  <span class="user-field-label">个人简介</span>
                  <textarea
                    v-model="form.bio"
                    class="user-textarea"
                    rows="4"
                    maxlength="500"
                    placeholder="一句话介绍自己，或常用模型、领域等（可选）"
                  />
                </label>
              </div>

              <footer class="user-profile-footer">
                <button type="button" class="user-save-btn" :disabled="saving" @click="saveProfile">
                  {{ saving ? "保存中…" : "保存资料" }}
                </button>
              </footer>
            </div>
          </article>
        </template>
      </section>

      <section class="admin-panel profile-panel ai-profile-panel">
        <div class="panel-title-row">
          <div>
            <h2>AI 配置</h2>
            <p class="meta">管理当前账号的 AI 服务商、API Key 与可用额度。</p>
          </div>
        </div>
        <AIConfigPanel @toast="showToast" />
      </section>
    </div>
  </WorkspaceLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { getMyProfile, updateMyProfile } from "../api/auth";
import { ApiError } from "../api/http";
import type { User } from "../api/types";
import { roleLabel, userStatusLabel } from "../api/userLabels";
import AIConfigPanel from "../components/AIConfigPanel.vue";
import WorkspaceLayout from "../layouts/WorkspaceLayout.vue";

const loading = ref(false);
const saving = ref(false);
const errorMsg = ref("");
const toastMessage = ref("");
const profile = ref<User | null>(null);
const form = reactive({ nickname: "", avatarUrl: "", bio: "" });

const displayName = computed(() => profile.value?.nickname?.trim() || profile.value?.username || "未命名用户");
const avatarInitial = computed(() => displayName.value.slice(0, 1).toUpperCase());

const avatarPreviewFailed = ref(false);
const avatarPreviewSrc = computed(() => form.avatarUrl.trim());
const showAvatarPreview = computed(() => {
  const u = avatarPreviewSrc.value;
  if (!u || avatarPreviewFailed.value) return false;
  return u.startsWith("https://") || u.startsWith("http://");
});

watch(
  () => form.avatarUrl,
  () => {
    avatarPreviewFailed.value = false;
  }
);

function fillForm(user: User) {
  form.nickname = user.nickname ?? "";
  form.avatarUrl = user.avatarUrl ?? "";
  form.bio = user.bio ?? "";
}

function showToast(message: string) {
  toastMessage.value = message;
  window.setTimeout(() => {
    toastMessage.value = "";
  }, 2400);
}

async function loadProfile() {
  loading.value = true;
  errorMsg.value = "";
  try {
    profile.value = await getMyProfile();
    fillForm(profile.value);
  } catch (e) {
    errorMsg.value = e instanceof ApiError ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function saveProfile() {
  saving.value = true;
  errorMsg.value = "";
  try {
    profile.value = await updateMyProfile({
      nickname: form.nickname.trim() || null,
      avatarUrl: form.avatarUrl.trim() || null,
      bio: form.bio.trim() || null
    });
    fillForm(profile.value);
    showToast("个人资料已保存");
  } catch (e) {
    errorMsg.value = e instanceof ApiError ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}

onMounted(loadProfile);
</script>

<style scoped>
.profile-panel {
  max-width: 720px;
}

.error-msg {
  margin: 0 0 12px;
  padding: 10px 12px;
  background: #fef2f2;
  color: #b91c1c;
  border-radius: 10px;
  font-size: 13px;
  border: 1px solid #fecaca;
}

.center-pad {
  padding: 28px 8px;
  text-align: center;
  font-size: 14px;
}

.muted {
  color: #9099ab;
}

.user-profile-card {
  min-width: 0;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 12px 32px rgba(15, 23, 42, 0.06);
}

.user-profile-hero {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px 22px 22px;
  background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 48%, #f0f9ff 100%);
  border-bottom: 1px solid rgba(226, 232, 240, 0.9);
}

.user-profile-avatar {
  flex-shrink: 0;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid #fff;
  box-shadow:
    0 4px 14px rgba(47, 103, 234, 0.18),
    0 0 0 1px rgba(15, 23, 42, 0.06);
  background: linear-gradient(145deg, #3b7cff 0%, #2f67ea 45%, #1d4ed8 100%);
}

.user-profile-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.user-profile-avatar-fallback {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}

.user-profile-identity {
  min-width: 0;
  flex: 1;
}

.user-profile-name {
  margin: 0 0 10px;
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.user-profile-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.user-chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(226, 232, 240, 0.95);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.user-chip--muted {
  font-weight: 500;
  color: #64748b;
  max-width: min(100%, 280px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-chip--accent {
  color: #1d4ed8;
  border-color: rgba(59, 130, 246, 0.35);
  background: rgba(239, 246, 255, 0.95);
}

.user-profile-editor {
  padding: 22px 22px 20px;
  background: #fff;
}

.user-profile-editor-title {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #94a3b8;
}

.user-profile-editor-hint {
  margin: 0 0 18px;
  font-size: 13px;
  line-height: 1.5;
  color: #64748b;
}

.user-profile-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 18px;
}

.user-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.user-field--full {
  grid-column: 1 / -1;
}

.user-field-label {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}

.user-input,
.user-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.45;
  color: #0f172a;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background-color 0.15s ease;
}

.user-input::placeholder,
.user-textarea::placeholder {
  color: #94a3b8;
}

.user-input:hover,
.user-textarea:hover {
  border-color: #cbd5e1;
  background: #fff;
}

.user-input:focus,
.user-textarea:focus {
  outline: none;
  border-color: #93b4f7;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(147, 180, 247, 0.25);
}

.user-input--readonly {
  color: #64748b;
  background: #f1f5f9;
  cursor: not-allowed;
}

.user-textarea {
  resize: vertical;
  min-height: 100px;
  font-family: inherit;
}

.user-profile-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid #f1f5f9;
}

.user-save-btn {
  min-width: 132px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(180deg, #4a7af0 0%, #2f67ea 100%);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(47, 103, 234, 0.35);
  transition:
    filter 0.15s ease,
    transform 0.12s ease,
    box-shadow 0.15s ease;
}

.user-save-btn:hover:not(:disabled) {
  filter: brightness(1.05);
  box-shadow: 0 4px 14px rgba(47, 103, 234, 0.4);
}

.user-save-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.user-save-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  box-shadow: none;
}

@media (max-width: 640px) {
  .user-profile-hero {
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
  }

  .user-profile-fields {
    grid-template-columns: 1fr;
  }
}
</style>
