import { theme } from "./theme";

export function Blockquote({ children }: { children?: React.ReactNode }) {
  return <blockquote className={theme.quote}>{children}</blockquote>;
}
