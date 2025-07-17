import { theme } from "./theme";

export function Code({ children }: { children?: React.ReactNode }) {
  return <code className={theme.code}>{children}</code>;
}
