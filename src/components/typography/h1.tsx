import { theme } from "./theme";

export function H1({ children }: { children?: React.ReactNode }) {
  return <h1 className={theme.heading?.h1}>{children}</h1>;
}
