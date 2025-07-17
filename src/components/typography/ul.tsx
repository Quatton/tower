import { theme } from "./theme";

export function UnorderedList({ children }: { children?: React.ReactNode }) {
  return <ul className={theme.list.ul}>{children}</ul>;
}
