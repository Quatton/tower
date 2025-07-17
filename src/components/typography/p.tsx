import { theme } from "./theme";

export function Paragraph({ children }: { children?: React.ReactNode }) {
  return <p className={theme.paragraph}>{children}</p>;
}
