<template>
  <div class="prompt-page">
    <aside class="left-nav">
      <div class="brand" title="PromptCafe">
        <span class="brand-line">Prompt</span>
        <span class="brand-line">Cafe</span>
      </div>
      <nav class="main-nav">
        <RouterLink to="/" class="nav-link" active-class="active">我的 Prompt</RouterLink>
        <RouterLink to="/community" class="nav-link" active-class="active">社区</RouterLink>
        <RouterLink to="/profile" class="nav-link" active-class="active">个人中心</RouterLink>
        <template v-if="currentUser?.role === 'admin'">
          <div class="nav-section">管理</div>
          <RouterLink to="/admin/reviews" class="nav-link" active-class="active">审核中心</RouterLink>
          <RouterLink to="/admin/users" class="nav-link" active-class="active">用户管理</RouterLink>
          <RouterLink to="/admin/prompts" class="nav-link" active-class="active">Prompt 管理</RouterLink>
          <RouterLink to="/admin/reports" class="nav-link" active-class="active">举报处理</RouterLink>
          <RouterLink to="/admin/audit-logs" class="nav-link" active-class="active">审计日志</RouterLink>
        </template>
      </nav>
      <div class="nav-bottom">{{ currentUser?.role === "admin" ? "管理员" : "用户" }}</div>
    </aside>

    <section class="main-shell">
      <div class="toast-anchor" aria-live="polite">
        <Transition name="toast-pop">
          <div v-if="toastMessage" class="toast-float" role="status">{{ toastMessage }}</div>
        </Transition>
      </div>
      <header class="top-bar">
        <div class="title">{{ title }}</div>
        <div class="top-actions">
          <div class="user-pill" :title="currentUser?.email">
            {{ displayName }}
            <span>{{ currentUser?.role === "admin" ? "管理员" : "用户" }}</span>
          </div>
          <slot name="actions" />
          <button type="button" class="text-btn" @click="handleLogout">退出登录</button>
        </div>
      </header>

      <slot />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { getAuthMe, getStoredUser, logout } from "../api/auth";
import type { User } from "../api/types";

defineProps<{
  title: string;
  toastMessage?: string;
}>();

const router = useRouter();
const currentUser = ref<User | null>(getStoredUser());

const displayName = computed(() => {
  const user = currentUser.value;
  return user?.nickname?.trim() || user?.username || "未命名用户";
});

async function handleLogout() {
  await logout();
  await router.push("/login");
}

onMounted(async () => {
  if (!currentUser.value) {
    try {
      currentUser.value = await getAuthMe();
    } catch {
      currentUser.value = null;
    }
  }
});
</script>

<style scoped>
/* 主内容区上方居中，与左侧栏宽度对齐（.left-nav 约 104px） */
.toast-anchor {
  position: fixed;
  top: 12px;
  left: 104px;
  right: 0;
  z-index: 2000;
  display: flex;
  justify-content: center;
  pointer-events: none;
  padding: 0 16px;
  box-sizing: border-box;
}
.toast-float {
  max-width: min(420px, 100%);
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  color: #166534;
  background: #ecfdf3;
  border: 1px solid #bbf7d0;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  text-align: center;
  line-height: 1.4;
}
.toast-pop-enter-active,
.toast-pop-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-pop-enter-from,
.toast-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
