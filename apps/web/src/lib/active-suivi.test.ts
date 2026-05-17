import { afterEach, describe, expect, test } from "bun:test";

import {
  getPreferredActiveSuiviId,
  getRememberedActiveSuiviId,
  rememberActiveSuiviId,
} from "./active-suivi";

const originalWindow = globalThis.window;

function installWindowWithStorage(storage: Storage) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage },
  });
}

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
});

describe("active suivi persistence", () => {
  test("remembers suivi ids per patient", () => {
    installWindowWithStorage(createMemoryStorage());

    rememberActiveSuiviId("patient-1", "suivi-a");
    rememberActiveSuiviId("patient-2", "suivi-b");

    expect(getRememberedActiveSuiviId("patient-1")).toBe("suivi-a");
    expect(getRememberedActiveSuiviId("patient-2")).toBe("suivi-b");
  });

  test("ignores empty suivi ids", () => {
    installWindowWithStorage(createMemoryStorage());

    rememberActiveSuiviId("patient-1", "");

    expect(getRememberedActiveSuiviId("patient-1")).toBeNull();
  });

  test("falls back to first active suivi when no remembered suivi exists", () => {
    installWindowWithStorage(createMemoryStorage());

    expect(
      getPreferredActiveSuiviId("patient-1", [
        { id: "closed", est_actif: false },
        { id: "active", est_actif: true },
      ]),
    ).toBe("active");
  });

  test("does not prefill a remembered closed suivi", () => {
    installWindowWithStorage(createMemoryStorage());
    rememberActiveSuiviId("patient-1", "closed");

    expect(
      getPreferredActiveSuiviId("patient-1", [
        { id: "closed", est_actif: false },
        { id: "active", est_actif: true },
      ]),
    ).toBe("active");
  });

  test("handles storage failures without throwing", () => {
    installWindowWithStorage({
      clear() {},
      getItem() {
        throw new Error("blocked");
      },
      key() {
        return null;
      },
      length: 0,
      removeItem() {},
      setItem() {
        throw new Error("blocked");
      },
    });

    expect(() => rememberActiveSuiviId("patient-1", "suivi-a")).not.toThrow();
    expect(getRememberedActiveSuiviId("patient-1")).toBeNull();
  });
});
