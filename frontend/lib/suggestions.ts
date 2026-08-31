/** 主动建议：基于最后一条用户消息 + 助手回复的规则启发式，毫秒级生成，零额外成本。 */

export interface Suggestion {
  icon: string;
  label: string;
  prompt: string;
}

const FENCED_CODE_RE = /```[\s\S]+```/;
const ERROR_RE = /(Traceback|Exception|Error:|错误[:：]|报错|failed|FAILED|panic|Segmentation)/i;
const URL_RE = /https?:\/\/[^\s<>"')\]]+/;

/**
 * 根据上下文生成主动建议 chips（最多 3 条）。
 * 检测对象：最后一条用户消息（用户粘贴了什么）+ 最后一条助手回复。
 */
export function getContextSuggestions(lastUser: string, lastAssistant: string): Suggestion[] {
  const text = `${lastUser}\n${lastAssistant}`;
  const out: Suggestion[] = [];
  const push = (icon: string, label: string, prompt: string) => {
    if (out.length < 3 && !out.some((s) => s.label === label)) out.push({ icon, label, prompt });
  };

  // 1) 代码块：解释 / 优化 / 找 bug
  if (FENCED_CODE_RE.test(lastUser) || FENCED_CODE_RE.test(lastAssistant)) {
    push('🔍', '解释这段代码', '请逐行解释上面的代码，说明每部分的作用');
    push('⚡', '优化这段代码', '请优化上面的代码，说明改动点与收益');
    push('🐛', '找找有没有 bug', '请仔细检查上面的代码有没有 bug 或边界问题，给出修复建议');
  }

  // 2) 报错信息：分析 / 修复
  if (ERROR_RE.test(text)) {
    push('🩺', '分析这个报错', '请分析上面的报错信息，给出最可能的原因与修复方案');
    push('🛡️', '如何避免再发生', '以后如何避免出现同类问题？给出排查清单');
  }

  // 3) 长文本：总结 / 提炼
  if (lastUser.length > 2000 || lastAssistant.length > 2000) {
    push('📝', '总结要点', '请把上面的内容总结成要点清单');
    push('🎯', '提取行动项', '请从上面的内容中提取可执行的行动项');
  }

  // 4) 链接：解读
  if (URL_RE.test(lastUser)) {
    push('🔗', '解读这个链接', '请解读上面链接的内容，说明核心观点');
  }

  // 5) 兜底：通用追问
  if (!out.length) {
    push('📖', '展开讲讲', '请针对上面的回答展开讲讲，补充更多细节');
    push('🌰', '举个例子', '请举一个具体的例子帮助理解');
    push('🔄', '换个说法', '请用更简单通俗的方式重新说明一遍');
  }

  return out;
}
