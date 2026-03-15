const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME_REGEX = /^\d{2}:\d{2}(?::\d{2})?$/;

export function isIsoDateString(value: string): boolean {
  return ISO_DATE_REGEX.test(value);
}

export function isIsoTimeString(value: string): boolean {
  return ISO_TIME_REGEX.test(value);
}

export { ISO_DATE_REGEX, ISO_TIME_REGEX };
