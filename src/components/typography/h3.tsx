import { theme } from "./theme";

export function H3({ children }: { children?: React.ReactNode }) {
  return <h3 className={theme.heading.h3}>{children}</h3>;
}
