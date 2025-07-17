import { LexicalEditor } from "lexical";
import { ComponentPropsWithRef, ReactElement, ReactNode } from "react";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import {
  InitialConfigType,
  LexicalComposer,
} from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { cn } from "@/lib/utils";
import { $convertFromMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { EditorRefPlugin } from "@lexical/react/LexicalEditorRefPlugin";

import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListNode, ListItemNode } from "@lexical/list";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { theme } from "@/components/typography/theme";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

export function Editor({
  children,
  ref,
  readOnly,
  initialContent,
}: {
  children: ReactNode;
  ref?: React.RefObject<LexicalEditor | null | undefined>;
  initialContent?: string;
  readOnly?: boolean;
}) {
  const initialConfig = {
    namespace: "MyEditor",
    theme,
    onError: (error, _editor) => {
      console.error("Editor error:", error.message);
    },
    editable: !readOnly,
    editorState: () => {
      if (initialContent) {
        $convertFromMarkdownString(initialContent, TRANSFORMERS);
      }
    },
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      CodeNode,
      LinkNode,
      HorizontalRuleNode,
    ],
  } satisfies InitialConfigType;

  return (
    <LexicalComposer initialConfig={initialConfig}>
      {children}
      {!readOnly && (
        <>
          <HistoryPlugin />
          <AutoFocusPlugin />
          {ref && <EditorRefPlugin editorRef={ref} />}
          <ListPlugin />
        </>
      )}
      <MarkdownShortcutPlugin />
    </LexicalComposer>
  );
}

export function EditorContent({ children }: { children: ReactElement }) {
  return (
    <RichTextPlugin
      contentEditable={children}
      ErrorBoundary={LexicalErrorBoundary}
    />
  );
}

export function EditorContentEditable({
  ref,
  className,
  ...props
}: ComponentPropsWithRef<typeof ContentEditable>) {
  const [editor] = useLexicalComposerContext();
  const editable = editor.isEditable();

  return (
    <ContentEditable
      ref={ref}
      className={cn(
        editable &&
          "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40 field-sizing-content max-h-full min-h-16 w-full overflow-y-auto rounded-md border bg-transparent px-3 py-2 shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
