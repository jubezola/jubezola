import raw from "@/data/menu.json";
import { parseMenu, type DailyMenu } from "./menu-parse";

export * from "./menu-parse";

export function getDailyMenu(): DailyMenu {
  return parseMenu(raw);
}
