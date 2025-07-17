import { theme } from "./theme";

export function H2({ children }: { children?: React.ReactNode }) {
  return <h2 className={theme.heading.h2}>{children}</h2>;
}
