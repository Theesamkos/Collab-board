// Colors match the presence panel avatar palette from the design spec
const CURSOR_COLORS = [
  '#28a745', // green
  '#17a2b8', // teal
  '#6f42c1', // purple
  '#fd7e14', // orange
  '#e83e8c', // pink
  '#20c997', // emerald
];

export function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) & 0xffff;
  }
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}
