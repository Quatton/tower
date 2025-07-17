import { theme } from "./theme";

export function H4({ children }: { children?: React.ReactNode }) {
  return <h4 className={theme.heading.h4}>{children}</h4>;
}
