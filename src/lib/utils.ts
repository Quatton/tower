import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getOrCreateLocalStorageItem<T>(
  key: string,
  defaultValue: T | (() => T),
): T {
  const item = localStorage.getItem(key);
  if (item !== null) {
    return JSON.parse(item) as T;
  }
  const value =
    typeof defaultValue === "function"
      ? (defaultValue as () => T)()
      : defaultValue;
  localStorage.setItem(key, JSON.stringify(value));
  return value;
}
