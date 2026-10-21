// Persisted item data, not theme colors: input[type=color], API validation and
// luminance calculations require actual hex values. Existing user choices stay stable.
export const DEFAULT_ITEM_COLORS = {
  project: '#557558',
  task: '#C98B8B',
  event: '#8E8AA3',
  reminder: '#8E8AA3',
} as const;
