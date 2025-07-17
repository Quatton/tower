import { H1 } from "./h1";
import { H2 } from "./h2";
import { H3 } from "./h3";
import { H4 } from "./h4";
import { Paragraph } from "./p";
import { Blockquote } from "./blockquote";
import { Code } from "./code";
import { UnorderedList } from "./ul";

export const theme = {
  heading: {
    h1: "scroll-m-20 text-4xl font-extrabold tracking-tight text-balance",
    h2: "scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0",
    h3: "scroll-m-20 text-2xl font-semibold tracking-tight",
    h4: "scroll-m-20 text-xl font-semibold tracking-tight",
  },
  paragraph: "leading-7 [&:not(:first-child)]:mt-3",
  quote: "mt-4 border-l-2 pl-4 italic",
  code: "bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
  list: {
    ul: "my-4 ml-4 list-disc [&>li]:mt-2",
  },
} as const;

export const components = {
  h1: H1,
  h2: H2,
  h3: H3,
  h4: H4,
  p: Paragraph,
  blockquote: Blockquote,
  code: Code,
  ul: UnorderedList,
} as const;
