// Rule 12: Valid US state code
const VALID_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC'
]);

export function checkValidStateCode(row: Record<string, unknown>): string | null {
  const state = ((row['borrowerState'] ?? row['borrower_state'] ?? '') as string).toUpperCase().trim();
  if (!state) return null;
  if (!VALID_STATES.has(state)) {
    return `borrower_state "${state}" is not a valid US state code`;
  }
  return null;
}
