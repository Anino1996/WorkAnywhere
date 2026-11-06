// Tiny `cn` helper. Avoids an extra dependency.
import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}