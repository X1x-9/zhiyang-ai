export const FOOD_DATA_VERSION = "2026-11.2";
export const FOOD_DATA_SOURCE = "USDA FoodData Central 与《中国食物成分表》参考值";

export type FoodCategory = "staple" | "protein" | "vegetable" | "fruit" | "dairy" | "fat" | "drink" | "dish";

export type NutritionPer100 = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type FoodReference = {
  id: string;
  name: string;
  aliases: string[];
  category: FoodCategory;
  per100: NutritionPer100;
  portionGrams: number;
  portionLabel: string;
  source: string;
  note?: string;
};

const source = FOOD_DATA_SOURCE;

export const FOOD_REFERENCE: readonly FoodReference[] = [
  { id: "rice-cooked", name: "米饭", aliases: ["白米饭", "熟米饭", "大米饭", "白饭"], category: "staple", per100: { kcal: 130, proteinG: 2.7, carbsG: 28.2, fatG: 0.3 }, portionGrams: 150, portionLabel: "一小碗约 150g", source },
  { id: "mixed-grain-rice", name: "杂粮饭", aliases: ["糙米饭", "五谷饭", "杂粮米饭", "粗粮饭"], category: "staple", per100: { kcal: 140, proteinG: 4, carbsG: 29, fatG: 1 }, portionGrams: 150, portionLabel: "一小碗约 150g", source },
  { id: "oats", name: "燕麦片", aliases: ["燕麦", "即食燕麦", "原味燕麦"], category: "staple", per100: { kcal: 389, proteinG: 16.9, carbsG: 66.3, fatG: 6.9 }, portionGrams: 40, portionLabel: "一份约 40g", source, note: "干重参考值" },
  { id: "whole-wheat-bread", name: "全麦面包", aliases: ["全麦吐司", "全麦土司"], category: "staple", per100: { kcal: 247, proteinG: 13, carbsG: 41, fatG: 4.2 }, portionGrams: 60, portionLabel: "两片约 60g", source },
  { id: "mantou", name: "馒头", aliases: ["白馒头", "蒸馒头"], category: "staple", per100: { kcal: 223, proteinG: 7, carbsG: 47, fatG: 1.1 }, portionGrams: 80, portionLabel: "一个约 80g", source },
  { id: "noodles-cooked", name: "面条", aliases: ["煮面", "清汤面", "汤面", "挂面"], category: "staple", per100: { kcal: 138, proteinG: 4.5, carbsG: 25, fatG: 2.1 }, portionGrams: 200, portionLabel: "一碗熟面约 200g", source, note: "熟重参考值，不含汤底和浇头" },
  { id: "millet-congee", name: "小米粥", aliases: ["小米稀饭", "粥"], category: "staple", per100: { kcal: 46, proteinG: 1.4, carbsG: 8.4, fatG: 0.7 }, portionGrams: 250, portionLabel: "一碗约 250g", source },
  { id: "sweet-potato", name: "红薯", aliases: ["地瓜", "烤红薯", "蒸红薯"], category: "staple", per100: { kcal: 90, proteinG: 2, carbsG: 21, fatG: 0.2 }, portionGrams: 150, portionLabel: "一个中等大小约 150g", source },
  { id: "corn", name: "玉米", aliases: ["甜玉米", "煮玉米", "玉米棒"], category: "staple", per100: { kcal: 96, proteinG: 3.4, carbsG: 21, fatG: 1.5 }, portionGrams: 150, portionLabel: "一根约 150g", source },
  { id: "potato", name: "土豆", aliases: ["马铃薯", "蒸土豆", "煮土豆"], category: "staple", per100: { kcal: 87, proteinG: 1.9, carbsG: 20, fatG: 0.1 }, portionGrams: 150, portionLabel: "一个中等大小约 150g", source },
  { id: "chicken-breast", name: "鸡胸肉", aliases: ["鸡胸", "煎鸡胸", "水煮鸡胸", "清蒸鸡胸"], category: "protein", per100: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 }, portionGrams: 120, portionLabel: "一块约 120g", source, note: "熟重参考值" },
  { id: "chicken-thigh", name: "鸡腿肉", aliases: ["去皮鸡腿", "鸡腿", "煎鸡腿"], category: "protein", per100: { kcal: 209, proteinG: 26, carbsG: 0, fatG: 10.9 }, portionGrams: 120, portionLabel: "一份约 120g", source, note: "去皮熟重参考值" },
  { id: "egg", name: "鸡蛋", aliases: ["水煮蛋", "煮鸡蛋", "蒸蛋", "鸡子"], category: "protein", per100: { kcal: 143, proteinG: 12.6, carbsG: 0.7, fatG: 9.5 }, portionGrams: 50, portionLabel: "一个约 50g", source },
  { id: "salmon", name: "三文鱼", aliases: ["鲑鱼", "烤三文鱼", "煎三文鱼"], category: "protein", per100: { kcal: 206, proteinG: 22, carbsG: 0, fatG: 12 }, portionGrams: 120, portionLabel: "一份约 120g", source },
  { id: "shrimp", name: "虾仁", aliases: ["虾", "白灼虾", "清炒虾仁"], category: "protein", per100: { kcal: 99, proteinG: 24, carbsG: 0.2, fatG: 0.3 }, portionGrams: 100, portionLabel: "一份约 100g", source },
  { id: "lean-beef", name: "瘦牛肉", aliases: ["牛肉", "牛里脊", "酱牛肉"], category: "protein", per100: { kcal: 217, proteinG: 26, carbsG: 0, fatG: 12 }, portionGrams: 100, portionLabel: "一份约 100g", source },
  { id: "pork-tenderloin", name: "猪里脊", aliases: ["里脊肉", "瘦猪肉", "猪瘦肉"], category: "protein", per100: { kcal: 143, proteinG: 26, carbsG: 0, fatG: 3.5 }, portionGrams: 100, portionLabel: "一份约 100g", source },
  { id: "tofu", name: "豆腐", aliases: ["北豆腐", "老豆腐", "嫩豆腐", "南豆腐"], category: "protein", per100: { kcal: 90, proteinG: 9, carbsG: 3, fatG: 5 }, portionGrams: 150, portionLabel: "半盒约 150g", source },
  { id: "plain-yogurt", name: "无糖酸奶", aliases: ["原味酸奶", "酸奶"], category: "dairy", per100: { kcal: 63, proteinG: 5.3, carbsG: 7, fatG: 1.6 }, portionGrams: 150, portionLabel: "一杯约 150g", source, note: "按无添加糖原味酸奶参考" },
  { id: "greek-yogurt", name: "希腊酸奶", aliases: ["浓缩酸奶", "高蛋白酸奶"], category: "dairy", per100: { kcal: 59, proteinG: 10, carbsG: 3.6, fatG: 0.4 }, portionGrams: 150, portionLabel: "一杯约 150g", source },
  { id: "milk", name: "牛奶", aliases: ["全脂牛奶", "纯牛奶"], category: "dairy", per100: { kcal: 61, proteinG: 3.2, carbsG: 4.8, fatG: 3.3 }, portionGrams: 250, portionLabel: "一杯约 250ml", source },
  { id: "soy-milk", name: "无糖豆浆", aliases: ["豆浆", "现磨豆浆", "原味豆浆"], category: "drink", per100: { kcal: 33, proteinG: 2.8, carbsG: 1.7, fatG: 1.6 }, portionGrams: 250, portionLabel: "一杯约 250ml", source },
  { id: "broccoli", name: "西兰花", aliases: ["西蓝花", "清炒西兰花", "水煮西兰花"], category: "vegetable", per100: { kcal: 34, proteinG: 2.8, carbsG: 6.6, fatG: 0.4 }, portionGrams: 150, portionLabel: "一份约 150g", source },
  { id: "spinach", name: "菠菜", aliases: ["炒菠菜", "菠菜段"], category: "vegetable", per100: { kcal: 23, proteinG: 2.9, carbsG: 3.6, fatG: 0.4 }, portionGrams: 150, portionLabel: "一份约 150g", source },
  { id: "lettuce", name: "生菜", aliases: ["罗马生菜", "球生菜"], category: "vegetable", per100: { kcal: 15, proteinG: 1.4, carbsG: 2.9, fatG: 0.2 }, portionGrams: 100, portionLabel: "一份约 100g", source },
  { id: "tomato", name: "番茄", aliases: ["西红柿", "圣女果", "小番茄"], category: "vegetable", per100: { kcal: 18, proteinG: 0.9, carbsG: 3.9, fatG: 0.2 }, portionGrams: 150, portionLabel: "一个约 150g", source },
  { id: "cucumber", name: "黄瓜", aliases: ["青瓜", "拍黄瓜"], category: "vegetable", per100: { kcal: 15, proteinG: 0.7, carbsG: 3.6, fatG: 0.1 }, portionGrams: 150, portionLabel: "半根约 150g", source },
  { id: "carrot", name: "胡萝卜", aliases: ["红萝卜", "胡萝卜丝"], category: "vegetable", per100: { kcal: 41, proteinG: 0.9, carbsG: 9.6, fatG: 0.2 }, portionGrams: 100, portionLabel: "半根约 100g", source },
  { id: "mushroom", name: "蘑菇", aliases: ["菌菇", "口蘑", "白蘑菇"], category: "vegetable", per100: { kcal: 22, proteinG: 3.1, carbsG: 3.3, fatG: 0.3 }, portionGrams: 100, portionLabel: "一份约 100g", source },
  { id: "leafy-greens", name: "青菜", aliases: ["绿叶菜", "时蔬", "炒青菜", "清炒时蔬", "小白菜", "上海青"], category: "vegetable", per100: { kcal: 20, proteinG: 1.8, carbsG: 3.2, fatG: 0.3 }, portionGrams: 150, portionLabel: "一份约 150g", source },
  { id: "apple", name: "苹果", aliases: ["红苹果", "青苹果"], category: "fruit", per100: { kcal: 52, proteinG: 0.3, carbsG: 14, fatG: 0.2 }, portionGrams: 180, portionLabel: "一个约 180g", source },
  { id: "banana", name: "香蕉", aliases: ["芭蕉"], category: "fruit", per100: { kcal: 89, proteinG: 1.1, carbsG: 23, fatG: 0.3 }, portionGrams: 120, portionLabel: "一根约 120g", source },
  { id: "orange", name: "橙子", aliases: ["甜橙", "脐橙"], category: "fruit", per100: { kcal: 47, proteinG: 0.9, carbsG: 12, fatG: 0.1 }, portionGrams: 180, portionLabel: "一个约 180g", source },
  { id: "blueberry", name: "蓝莓", aliases: ["蓝梅", "蓝莓果"], category: "fruit", per100: { kcal: 57, proteinG: 0.7, carbsG: 14, fatG: 0.3 }, portionGrams: 100, portionLabel: "一小盒约 100g", source },
  { id: "avocado", name: "牛油果", aliases: ["鳄梨"], category: "fruit", per100: { kcal: 160, proteinG: 2, carbsG: 9, fatG: 15 }, portionGrams: 100, portionLabel: "半个约 100g", source },
  { id: "mixed-nuts", name: "混合坚果", aliases: ["坚果", "每日坚果", "一小把坚果"], category: "fat", per100: { kcal: 607, proteinG: 20, carbsG: 21, fatG: 54 }, portionGrams: 20, portionLabel: "一小把约 20g", source },
  { id: "chia-seed", name: "奇亚籽", aliases: ["奇亚子", "chia"], category: "fat", per100: { kcal: 486, proteinG: 16.5, carbsG: 42.1, fatG: 30.7 }, portionGrams: 10, portionLabel: "一勺约 10g", source },
  { id: "honey", name: "蜂蜜", aliases: ["蜜糖", "洋槐蜜"], category: "fat", per100: { kcal: 304, proteinG: 0.3, carbsG: 82.4, fatG: 0 }, portionGrams: 5, portionLabel: "一小勺约 5g", source, note: "按可食用糖参考，计入添加糖" },
  { id: "whole-wheat-cracker", name: "全麦饼干", aliases: ["全麦苏打饼干", "消化饼干"], category: "staple", per100: { kcal: 440, proteinG: 8.5, carbsG: 68, fatG: 15 }, portionGrams: 15, portionLabel: "两块约 15g", source },
  { id: "olive-oil", name: "橄榄油", aliases: ["食用油", "烹调油"], category: "fat", per100: { kcal: 884, proteinG: 0, carbsG: 0, fatG: 100 }, portionGrams: 10, portionLabel: "一勺约 10g", source, note: "估算用油时请按实际用量" },
  { id: "peanut-butter", name: "花生酱", aliases: ["无糖花生酱"], category: "fat", per100: { kcal: 588, proteinG: 25, carbsG: 20, fatG: 50 }, portionGrams: 15, portionLabel: "一勺约 15g", source },
  { id: "tomato-egg", name: "番茄炒蛋", aliases: ["西红柿炒鸡蛋", "番茄炒鸡蛋", "西红柿炒蛋"], category: "dish", per100: { kcal: 98, proteinG: 5.5, carbsG: 4.5, fatG: 6.5 }, portionGrams: 200, portionLabel: "一份约 200g", source, note: "菜品参考值，用油量会影响结果" },
  { id: "kung-pao-chicken", name: "宫保鸡丁", aliases: ["宫爆鸡丁"], category: "dish", per100: { kcal: 160, proteinG: 10, carbsG: 8, fatG: 10 }, portionGrams: 200, portionLabel: "一份约 200g", source, note: "菜品参考值，含花生和酱汁" },
  { id: "mapo-tofu", name: "麻婆豆腐", aliases: ["麻辣豆腐"], category: "dish", per100: { kcal: 115, proteinG: 7, carbsG: 5, fatG: 8 }, portionGrams: 200, portionLabel: "一份约 200g", source, note: "菜品参考值，用油量会影响结果" },
  { id: "fish-fragrant-pork", name: "鱼香肉丝", aliases: ["鱼香猪肉丝"], category: "dish", per100: { kcal: 190, proteinG: 9, carbsG: 8, fatG: 14 }, portionGrams: 200, portionLabel: "一份约 200g", source, note: "菜品参考值，含糖和油" },
  { id: "dumplings", name: "饺子", aliases: ["水饺", "煮饺子", "蒸饺"], category: "dish", per100: { kcal: 200, proteinG: 8, carbsG: 24, fatG: 8 }, portionGrams: 200, portionLabel: "约 10 个 200g", source, note: "按常见猪肉蔬菜馅参考" },
  { id: "baozi", name: "包子", aliases: ["肉包", "菜包", "蒸包"], category: "dish", per100: { kcal: 227, proteinG: 8, carbsG: 32, fatG: 7 }, portionGrams: 100, portionLabel: "一个约 100g", source },
  { id: "fried-rice", name: "炒饭", aliases: ["蛋炒饭", "扬州炒饭"], category: "dish", per100: { kcal: 180, proteinG: 5, carbsG: 27, fatG: 6 }, portionGrams: 250, portionLabel: "一份约 250g", source, note: "菜品参考值，用油量会影响结果" },
  { id: "rice-noodles", name: "米粉", aliases: ["米线", "河粉", "粉"], category: "staple", per100: { kcal: 109, proteinG: 1.8, carbsG: 24, fatG: 0.2 }, portionGrams: 250, portionLabel: "一碗熟粉约 250g", source, note: "熟重参考值，不含汤底和浇头" },
  { id: "cola", name: "可乐", aliases: ["汽水", "碳酸饮料"], category: "drink", per100: { kcal: 42, proteinG: 0, carbsG: 10.6, fatG: 0 }, portionGrams: 330, portionLabel: "一罐约 330ml", source },
  { id: "latte", name: "拿铁", aliases: ["拿铁咖啡", "咖啡拿铁"], category: "drink", per100: { kcal: 55, proteinG: 3, carbsG: 5, fatG: 2.5 }, portionGrams: 300, portionLabel: "一杯约 300ml", source, note: "按全脂奶、无糖参考" },
  { id: "americano", name: "美式咖啡", aliases: ["黑咖啡", "冰美式", "热美式"], category: "drink", per100: { kcal: 2, proteinG: 0.1, carbsG: 0, fatG: 0 }, portionGrams: 300, portionLabel: "一杯约 300ml", source },
  { id: "protein-powder", name: "蛋白粉", aliases: ["乳清蛋白", "蛋白粉冲剂"], category: "protein", per100: { kcal: 400, proteinG: 80, carbsG: 8, fatG: 6 }, portionGrams: 30, portionLabel: "一勺约 30g", source, note: "按常见乳清蛋白粉参考" },
];

const CLEAN_PATTERN = /[\s\u3000[\]，,。.、/\\·・\-—_]/g;
const QUANTITY_PREFIX = /^(半碗|一碗|一小碗|一份|半份|一个|两个|一小把|一杯|一勺|适量|少许)/;
const COOKING_PREFIX = /^(清蒸|清炒|水煮|香煎|煎|烤|炒|蒸|煮|炖|凉拌|红烧|少油|低油|白灼|卤)/;
const DESCRIPTOR_SUFFIX = /(块|片|丝|丁|段|粒|末|泥)$/;

export function normalizeFoodName(raw: string) {
  return raw
    .toLowerCase()
    .replace(/（[^）]*）|\([^)]*\)/g, "")
    .replace(CLEAN_PATTERN, "")
    .replace(QUANTITY_PREFIX, "")
    .replace(COOKING_PREFIX, "")
    .trim();
}

export type FoodMatch = {
  food: FoodReference;
  score: number;
  matchedOn: string;
};

export function matchFood(raw: string): FoodMatch | null {
  const query = normalizeFoodName(raw);
  if (!query) return null;

  let best: FoodMatch | null = null;
  for (const food of FOOD_REFERENCE) {
    const candidates = [food.name, ...food.aliases];
    for (const candidate of candidates) {
      const normalized = normalizeFoodName(candidate);
      if (!normalized) continue;
      let score = 0;
      if (normalized === query) score = 1;
      else if (normalized.length >= 2 && query.startsWith(normalized)) {
        const suffix = query.slice(normalized.length);
        if (suffix.length <= 2 && DESCRIPTOR_SUFFIX.test(suffix)) score = 0.9;
      } else if (query.length >= 2 && normalized.includes(query)) score = 0.82;
      if (score > (best?.score ?? 0)) {
        best = { food, score, matchedOn: candidate };
        if (score === 1) return best;
      }
    }
  }

  return best && best.score >= 0.82 ? best : null;
}

export function scaleNutrition(per100: NutritionPer100, grams: number): NutritionPer100 {
  const ratio = Math.max(0, grams) / 100;
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    kcal: Math.round(per100.kcal * ratio),
    proteinG: round(per100.proteinG * ratio),
    carbsG: round(per100.carbsG * ratio),
    fatG: round(per100.fatG * ratio),
  };
}

export function sumNutrition(items: Array<NutritionPer100>): NutritionPer100 {
  const round = (value: number) => Math.round(value * 10) / 10;
  const total = items.reduce(
    (sum, item) => ({
      kcal: sum.kcal + item.kcal,
      proteinG: sum.proteinG + item.proteinG,
      carbsG: sum.carbsG + item.carbsG,
      fatG: sum.fatG + item.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  return {
    kcal: Math.round(total.kcal),
    proteinG: round(total.proteinG),
    carbsG: round(total.carbsG),
    fatG: round(total.fatG),
  };
}

export function foodReferenceSummary() {
  return {
    version: FOOD_DATA_VERSION,
    source: FOOD_DATA_SOURCE,
    count: FOOD_REFERENCE.length,
    note: "参考值按每 100g 可食部整理，用于估算；品牌、烹饪方式和实际份量都会造成差异。",
  };
}