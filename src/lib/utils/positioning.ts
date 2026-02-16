export interface PositionedItem {
  id: number;
  position: number;
}

export const POSITION_GAP = 1000;

export function calculateInitialPosition(items: PositionedItem[]): number {
  if (items.length === 0) return POSITION_GAP;
  const maxPosition = Math.max(...items.map(item => item.position));
  return maxPosition + POSITION_GAP;
}

export function calculateReorderPosition(
  items: PositionedItem[],
  draggedItem: PositionedItem,
  targetIndex: number
): number {
  const otherItems = items.filter(item => item.id !== draggedItem.id);

  if (otherItems.length === 0) return POSITION_GAP;

  if (targetIndex === 0) {
    return Math.max(0, otherItems[0].position - POSITION_GAP);
  }

  if (targetIndex >= otherItems.length) {
    return otherItems[otherItems.length - 1].position + POSITION_GAP;
  }

  const before = otherItems[targetIndex - 1];
  const after = otherItems[targetIndex];
  return Math.floor((before.position + after.position) / 2);
}
