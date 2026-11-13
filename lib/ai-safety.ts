export type SafetyLevel = "routine" | "caution" | "emergency";

export type SafetyAssessment = {
  level: SafetyLevel;
  reasons: string[];
  directive: string;
};

type SafetyRule = { id: string; pattern: RegExp };

const EMERGENCY_RULES: SafetyRule[] = [
  { id: "self_harm", pattern: /自杀|轻生|不想活|活不下去|结束生命|伤害自己|割腕|跳楼|自伤/ },
  { id: "chest_pain", pattern: /胸(?:口|部|前区)?[^，。；！？,.;!?]{0,4}(?:疼|痛|闷|压迫)/ },
  { id: "breathing", pattern: /呼吸困难|喘不上气|喘不过气|窒息|喉咙(?:发紧|水肿)/ },
  { id: "consciousness", pattern: /昏厥|晕倒|昏迷|意识不清|抽搐|癫痫(?:发作)?/ },
  { id: "stroke", pattern: /口角歪斜|半身不遂|一侧肢体无力|言语不清|说话含糊/ },
  { id: "bleeding", pattern: /大出血|血流不止|呕血|咯血/ },
  { id: "anaphylaxis", pattern: /过敏性休克/ },
  { id: "poisoning", pattern: /中毒|误服|喝农药|药物过量|过量服药/ },
  { id: "severe_pain", pattern: /剧烈(?:腹|头)(?:痛|疼)|腹部剧痛|突发剧烈头痛/ },
];

const CAUTION_RULES: SafetyRule[] = [
  { id: "pregnancy", pattern: /怀孕|妊娠|孕期|备孕|哺乳|产妇/ },
  { id: "chronic_disease", pattern: /糖尿病|高血压|高血糖|高血脂|痛风|肾病|肾脏|心脏病|冠心病|脂肪肝|甲亢|甲减|多囊|慢性病|慢病/ },
  { id: "medical_treatment", pattern: /处方|用药|吃药|服药|药物|剂量|停药|诊断|治疗|手术|化疗|透析|检查报告|化验单/ },
  { id: "eating_disorder", pattern: /暴食|厌食|催吐|饮食失调|进食障碍|闭经|体重骤降/ },
  { id: "mental_health", pattern: /抑郁|焦虑|情绪低落|心理问题|失眠/ },
];

const NEGATION = /(?:没有|没|无|不|未|否认|并非|不是)[^，。；！？,.;!?]{0,3}$/;

function matchedRules(text: string, rules: SafetyRule[]) {
  const reasons: string[] = [];
  for (const rule of rules) {
    const match = rule.pattern.exec(text);
    if (!match) continue;
    const negated = isNegated(text, match.index);
    if (!negated) reasons.push(rule.id);
  }
  return reasons;
}

function isNegated(text: string, index: number) {
  return NEGATION.test(text.slice(Math.max(0, index - 8), index));
}

export const EMERGENCY_REPLY = [
  "这听起来可能是需要立即处理的情况。请先保证安全：如果症状正在发生或加重，马上拨打 120，或请身边的人陪你去最近的急诊。",
  "如果你或身边的人正处于自伤、轻生风险中，请立即拨打 110 或心理援助热线 12356，并尽量不要独处。",
  "在等待救援时，保持呼吸通畅，不要自行加药、催吐或进食；如已知有严重过敏，按医生既往指导使用急救药物。",
  "线上文字无法判断病情，我不能给出诊断或用药建议。等症状稳定后，再和医生讨论检查与后续管理。",
].join("\n\n");

const CAUTION_DIRECTIVE = "本轮问题涉及特殊人群、慢性病或医疗处置。只提供一般健康信息，不作诊断、处方、剂量或停药建议；建议用户就个体情况咨询医生或注册营养师，并提醒出现急症时及时就医。";

export function assessHealthSafety(text: string): SafetyAssessment {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return { level: "routine", reasons: [], directive: "" };

  const emergency = matchedRules(normalized, EMERGENCY_RULES);
  if (emergency.length) {
    return { level: "emergency", reasons: emergency, directive: "本轮触发急症或自伤风险规则。不要依赖模型生成回答，直接使用固定的紧急处置文案。" };
  }

  const caution = matchedRules(normalized, CAUTION_RULES);
  if (caution.length) {
    return { level: "caution", reasons: caution, directive: CAUTION_DIRECTIVE };
  }

  return { level: "routine", reasons: [], directive: "" };
}
