// Users are addressed as `handle@instance`, e.g. `alice@jolt.chat` or `bob@localhost:4001` in development.

export const HANDLE_PATTERN = /^[a-z0-9_.-]{2,32}$/;
export const INSTANCE_PATTERN =
  /^(?=.{1,253}(?::\d{1,5})?$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*(:\d{1,5})?$/;

export interface UserAddress {
  handle: string;
  instance: string;
}

export function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase();
}

export function normalizeInstance(instance: string): string {
  return instance
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
}

export function isValidHandle(handle: string): boolean {
  return HANDLE_PATTERN.test(handle) && !/^[.-]|[.-]$/.test(handle);
}

export function isValidInstance(instance: string): boolean {
  return INSTANCE_PATTERN.test(instance);
}

export function formatAddress({ handle, instance }: UserAddress): string {
  return `${handle}@${instance}`;
}

export function parseAddress(address: string): UserAddress | null {
  const at = address.lastIndexOf('@');
  if (at <= 0) return null;
  const handle = normalizeHandle(address.slice(0, at));
  const instance = normalizeInstance(address.slice(at + 1));
  if (!isValidHandle(handle) || !isValidInstance(instance)) return null;
  return { handle, instance };
}

export function instanceOrigin(instance: string, insecure = false): string {
  return `${insecure ? 'http' : 'https'}://${instance}`;
}
