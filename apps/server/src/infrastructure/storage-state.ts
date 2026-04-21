let storageAvailable = true;

export function setStorageAvailable(nextValue: boolean): void {
  storageAvailable = nextValue;
}

export function isStorageAvailable(): boolean {
  return storageAvailable;
}
