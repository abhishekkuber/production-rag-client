import { ThumbsUp, ThumbsDown, User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Citation } from "@/lib/types";

function isLikelyInlineMath(value: string) {
  const text = value.trim();

  if (!text) return false;
  if (/^[A-Za-z]$/.test(text)) return true;
  if (/\\[a-zA-Z]+/.test(text)) return true;
  if (/[\^_=]/.test(text)) return true;
  if (/^[A-Za-z0-9\\_\^{}\s,+\-*/.]+$/.test(text) && /[A-Z]/.test(text)) {
    return true;
  }

  return false;
}

function sanitizeMathExpression(expression: string) {
  return expression
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\\left\\frac/g, "\\frac")
    .replace(/\\left\$/g, "\\left(")
    .replace(/\$\\right/g, ")\\right")
    .replace(/\\right([A-Za-z0-9])/g, " $1")
    .replace(/\$+/g, "")
    .trim();
}

function normalizeMathDelimiters(content: string) {
  let normalized = content;

  // Convert LaTeX-style delimiters to remark-math delimiters.
  normalized = normalized
    .replace(/\\\[/g, "$$\n")
    .replace(/\\\]/g, "\n$$")
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$");

  // Convert block formulas written as standalone [ ... ] into $$ ... $$.
  normalized = normalized.replace(
    /(^|\n)\[\s*\n([\s\S]*?)\n\](?=\n|$)/g,
    (_match, prefix: string, formula: string) => {
      const trimmed = sanitizeMathExpression(formula);
      if (!trimmed) return _match;
      return `${prefix}$$\n${trimmed}\n$$`;
    },
  );

  // Convert multiline blocks wrapped with standalone single $ into $$ ... $$.
  normalized = normalized.replace(
    /(^|\n)\$\s*\n([\s\S]*?)\n\$(?=\n|$)/g,
    (_match, prefix: string, formula: string) => {
      const trimmed = sanitizeMathExpression(formula);
      if (!trimmed) return _match;
      return `${prefix}$$\n${trimmed}\n$$`;
    },
  );

  // Sanitize existing $$...$$ math blocks.
  normalized = normalized.replace(
    /\$\$([\s\S]*?)\$\$/g,
    (_match, formula: string) => {
      const trimmed = sanitizeMathExpression(formula);
      if (!trimmed) return _match;
      return `$$${trimmed}$$`;
    },
  );

  // Sanitize existing $...$ inline math.
  normalized = normalized.replace(
    /\$([^$\n]{1,250})\$/g,
    (_match, formula: string) => {
      const trimmed = sanitizeMathExpression(formula);
      if (!trimmed) return _match;
      return `$${trimmed}$`;
    },
  );

  // Convert common inline-style output like ( Q ) or (W_Q^i) into $...$.
  normalized = normalized.replace(
    /\(\s*([A-Za-z][A-Za-z0-9_\^\s]{0,60})\s*\)/g,
    (match, expr: string, offset: number) => {
      // Do not rewrite parentheses that are part of LaTeX commands like \left(...\right).
      const leftContext = normalized.slice(Math.max(0, offset - 8), offset);
      if (/\\left\s*$/.test(leftContext)) {
        return match;
      }

      if (!isLikelyInlineMath(expr)) {
        return match;
      }

      return `$${expr.trim()}$`;
    },
  );

  // Repair malformed output like \left$...\right$ introduced by noisy model formatting.
  normalized = normalized.replace(
    /\\left\$([\s\S]*?)\\right\$/g,
    (_m, inner: string) => {
      const cleaned = sanitizeMathExpression(inner);
      return `\\left(${cleaned}\\right)`;
    },
  );

  return normalized;
}

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  created_at: string;
  chat_id: string;
  clerk_id: string;
  citations?: Citation[];
}

interface MessageItemProps {
  message: Message;
  onFeedback?: (messageId: string, type: "like" | "dislike") => void;
}

export function MessageItem({ message, onFeedback }: MessageItemProps) {
  const isUser = message.role === "user";
  const renderedAssistantContent = isUser
    ? message.content
    : normalizeMathDelimiters(message.content);
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} group`}>
      <div className={`max-w-[85%] ${isUser ? "ml-12" : "mr-12"} relative`}>
        {/* Avatar & Message Container */}
        <div className="flex items-start gap-3">
          {/* Avatar - Only show for assistant */}
          {!isUser && (
            <div className="flex-shrink-0 w-7 h-7 bg-[#252525] border border-gray-700 rounded-lg flex items-center justify-center mt-1">
              <Bot size={14} className="text-gray-400" />
            </div>
          )}

          {/* Message Bubble */}
          <div
            className={`rounded-lg p-4 border transition-colors ${
              isUser
                ? "bg-white text-gray-900 border-gray-300"
                : "bg-[#202020] text-gray-200 border-gray-800 hover:border-gray-700"
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap leading-relaxed text-sm">
                {message.content}
              </p>
            ) : (
              <div className="leading-relaxed text-sm space-y-2">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[
                    [rehypeKatex, { strict: "ignore", throwOnError: false }],
                  ]}
                  components={{
                    p: ({ children }) => (
                      <p className="whitespace-pre-wrap leading-relaxed text-sm">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc pl-5 space-y-1">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-5 space-y-1">
                        {children}
                      </ol>
                    ),
                    code: ({ children, ...props }) => {
                      const isInline = !String(props.className || "").includes(
                        "language-",
                      );

                      if (isInline) {
                        return (
                          <code className="px-1 py-0.5 rounded bg-[#2a2a2a] text-gray-100 text-[0.9em]">
                            {children}
                          </code>
                        );
                      }

                      return (
                        <pre className="p-3 rounded bg-[#151515] border border-gray-700 overflow-x-auto">
                          <code className="text-gray-100">{children}</code>
                        </pre>
                      );
                    },
                  }}
                >
                  {renderedAssistantContent}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* User Avatar - Only show for user */}
          {isUser && (
            <div className="flex-shrink-0 w-7 h-7 bg-[#252525] border border-gray-700 rounded-lg flex items-center justify-center mt-1">
              <User size={14} className="text-gray-400" />
            </div>
          )}
        </div>

        {/* Feedback Buttons - Only show for assistant messages */}
        {!isUser && (
          <div className="absolute -bottom-2 right-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#252525] border border-gray-700 rounded-lg p-1">
            <button
              onClick={() => onFeedback?.(message.id, "like")}
              className="p-1.5 hover:bg-[#2a2a2a] rounded-md transition-colors group/btn"
              title="Like this response"
            >
              <ThumbsUp
                size={12}
                className="text-gray-400 group-hover/btn:text-gray-300 transition-colors"
              />
            </button>
            <button
              onClick={() => onFeedback?.(message.id, "dislike")}
              className="p-1.5 hover:bg-[#2a2a2a] rounded-md transition-colors group/btn"
              title="Dislike this response"
            >
              <ThumbsDown
                size={12}
                className="text-gray-400 group-hover/btn:text-gray-300 transition-colors"
              />
            </button>
          </div>
        )}

        {/* Timestamp */}
        <div
          className={`flex items-center gap-2 mt-2 px-1 ${
            isUser ? "justify-end" : "justify-start ml-10"
          }`}
        >
          <span className="text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
            {time}
          </span>
          {!isUser && (
            <div className="w-1 h-1 bg-gray-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
          )}
        </div>
      </div>
    </div>
  );
}
