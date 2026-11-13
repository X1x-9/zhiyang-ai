type MacroItem = { proteinG?: number; carbsG?: number; fatG?: number };

function round(value: number) {
  return Math.round(value * 10) / 10;
}

export function nutritionTotals(items: MacroItem[]) {
  const withMacros = items.filter(
    (item) => item.proteinG !== undefined && item.carbsG !== undefined && item.fatG !== undefined,
  );
  if (withMacros.length === 0) {
    return { proteinG: null, carbsG: null, fatG: null, macroItems: 0 };
  }
  return {
    proteinG: round(withMacros.reduce((sum, item) => sum + (item.proteinG ?? 0), 0)),
    carbsG: round(withMacros.reduce((sum, item) => sum + (item.carbsG ?? 0), 0)),
    fatG: round(withMacros.reduce((sum, item) => sum + (item.fatG ?? 0), 0)),
    macroItems: withMacros.length,
  };
}
