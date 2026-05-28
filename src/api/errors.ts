import { ApiError } from "./http";

const AI_ERROR_MESSAGES: Array<[RegExp, string | ((message: string) => string)]> = [
  [/Please configure a verified API Key first/i, "请先配置并验证有效的 API Key"],
  [/Guest AI service is not configured/i, "游客 AI 服务尚未配置"],
  [
    /Selected provider does not match configured API Key/i,
    "所选服务商与已配置的 API Key 不匹配，请切换为已配置的服务商或重新保存配置"
  ],
  [/baseUrl is required when provider is custom/i, "自定义服务商必须填写 Base URL"],
  [
    /API Key verification failed:\s*(.+)/i,
    (message) => `API Key 验证失败：${message.replace(/API Key verification failed:\s*/i, "").trim()}`
  ],
  [
    /AI service request failed:\s*(.+)/i,
    (message) => `AI 服务请求失败：${message.replace(/AI service request failed:\s*/i, "").trim()}`
  ],
  [/This prompt already has an active community share/i, "该 Prompt 已存在待审核或已通过的社区分享，不能重复提交"],
  [/You have already reported this prompt/i, "你已经举报过该社区 Prompt，请勿重复提交"],
  [/title, description and usageGuide are required/i, "标题、简介和使用说明不能为空"],
  [/apiKey is required when creating config or changing provider\/baseUrl/i, "首次配置或修改服务商/Base URL 时必须填写 API Key"],
  [
    /System API Key verification failed:\s*(.+)/i,
    (message) => `系统 API Key 验证失败：${message.replace(/System API Key verification failed:\s*/i, "").trim()}`
  ]
];

export function friendlyApiMessage(error: unknown): string {
  const message = error instanceof ApiError || error instanceof Error ? error.message : String(error);
  for (const [pattern, replacement] of AI_ERROR_MESSAGES) {
    if (!pattern.test(message)) continue;
    return typeof replacement === "function" ? replacement(message) : replacement;
  }
  return message;
}
