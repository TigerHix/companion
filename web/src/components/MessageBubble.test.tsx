// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import type { ChatMessage, ContentBlock } from "../types.js";

// Mock react-markdown to avoid ESM/parsing issues in tests
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

vi.mock("remark-gfm", () => ({
  default: {},
}));

import { MessageBubble } from "./MessageBubble.js";

function makeMessage(overrides: Partial<ChatMessage> & { role: ChatMessage["role"] }): ChatMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    content: "",
    timestamp: Date.now(),
    ...overrides,
  };
}

// ─── System messages ─────────────────────────────────────────────────────────

describe("MessageBubble - system messages", () => {
  // Validates system messages render with italic styling for the text content
  it("renders system message with italic text", () => {
    const msg = makeMessage({ role: "system", content: "Session started" });
    const { container } = render(<MessageBubble message={msg} />);

    const italicSpan = container.querySelector(".italic");
    expect(italicSpan).toBeTruthy();
    expect(italicSpan?.textContent).toBe("Session started");
  });

  // Validates system messages show separator dividers on each side of the text
  it("renders system message with separator dividers", () => {
    const msg = makeMessage({ role: "system", content: "Divider test" });
    const { container } = render(<MessageBubble message={msg} />);

    // The Separator component renders with data-slot="separator" and h-px class
    const separators = container.querySelectorAll('[data-slot="separator"]');
    expect(separators.length).toBe(2);
  });
});

// ─── User messages ───────────────────────────────────────────────────────────

describe("MessageBubble - user messages", () => {
  // Validates user messages are right-aligned and display the content text
  it("renders user message right-aligned with content", () => {
    const msg = makeMessage({ role: "user", content: "Hello Claude" });
    const { container } = render(<MessageBubble message={msg} />);

    // Check for right-alignment (justify-end)
    const wrapper = container.querySelector(".justify-end");
    expect(wrapper).toBeTruthy();

    // Check content
    expect(screen.getByText("Hello Claude")).toBeTruthy();
  });

  // Validates user messages render image attachments as <img> elements with
  // the correct base64 data: URIs
  it("renders user messages with image thumbnails", () => {
    const msg = makeMessage({
      role: "user",
      content: "See this image",
      images: [
        { media_type: "image/png", data: "abc123base64" },
        { media_type: "image/jpeg", data: "def456base64" },
      ],
    });
    const { container } = render(<MessageBubble message={msg} />);

    const images = container.querySelectorAll("img");
    expect(images.length).toBe(2);
    expect(images[0].getAttribute("src")).toBe("data:image/png;base64,abc123base64");
    expect(images[1].getAttribute("src")).toBe("data:image/jpeg;base64,def456base64");
    expect(images[0].getAttribute("alt")).toBe("attachment");
  });

  // Validates that an empty images array results in no <img> elements
  it("does not render images section when images array is empty", () => {
    const msg = makeMessage({ role: "user", content: "No images", images: [] });
    const { container } = render(<MessageBubble message={msg} />);

    const images = container.querySelectorAll("img");
    expect(images.length).toBe(0);
  });
});

// ─── Assistant messages ──────────────────────────────────────────────────────

describe("MessageBubble - assistant messages", () => {
  // Validates plain assistant messages pass through markdown rendering
  it("renders plain text assistant message with markdown", () => {
    const msg = makeMessage({ role: "assistant", content: "Hello world" });
    render(<MessageBubble message={msg} />);

    // Our mock renders content inside data-testid="markdown"
    const markdown = screen.getByTestId("markdown");
    expect(markdown.textContent).toBe("Hello world");
  });

  // Validates text content blocks render through markdown
  it("renders assistant message with text content blocks", () => {
    const msg = makeMessage({
      role: "assistant",
      content: "",
      contentBlocks: [
        { type: "text", text: "Here is the answer" },
      ],
    });
    render(<MessageBubble message={msg} />);

    const markdown = screen.getByTestId("markdown");
    expect(markdown.textContent).toBe("Here is the answer");
  });

  // Validates tool_use blocks render as ToolBlock components with correct labels
  it("renders tool_use content blocks as ToolBlock components", () => {
    const msg = makeMessage({
      role: "assistant",
      content: "",
      contentBlocks: [
        { type: "tool_use", id: "tu-1", name: "Bash", input: { command: "pwd" } },
      ],
    });
    render(<MessageBubble message={msg} />);

    // ToolBlock renders with the label "Terminal" for Bash
    expect(screen.getByText("Terminal")).toBeTruthy();
    // And the preview should show the command
    expect(screen.getByText("pwd")).toBeTruthy();
  });

  // Validates thinking blocks show "Reasoning" label and character count
  it("renders thinking blocks with 'Reasoning' label and char count", () => {
    const thinkingText = "Let me analyze this problem step by step...";
    const msg = makeMessage({
      role: "assistant",
      content: "",
      contentBlocks: [
        { type: "thinking", thinking: thinkingText },
      ],
    });
    render(<MessageBubble message={msg} />);

    expect(screen.getByText("Reasoning")).toBeTruthy();
    expect(screen.getByText(`${thinkingText.length} chars`)).toBeTruthy();
  });

  // Validates that thinking blocks can be expanded/collapsed by clicking
  it("thinking blocks expand and collapse on click", () => {
    const thinkingText = "Deep analysis of the problem at hand.";
    const msg = makeMessage({
      role: "assistant",
      content: "",
      contentBlocks: [
        { type: "thinking", thinking: thinkingText },
      ],
    });
    const { container } = render(<MessageBubble message={msg} />);

    // Thinking content is visible by default
    expect(screen.getByText(thinkingText)).toBeTruthy();

    // Find and click the thinking button
    const thinkingButton = screen.getByText("Reasoning").closest("button")!;
    fireEvent.click(thinkingButton);

    // Now collapsed
    const preAfterCollapse = container.querySelector("pre");
    expect(preAfterCollapse?.textContent || "").not.toContain(thinkingText);

    // Click again to re-open
    fireEvent.click(thinkingButton);
    expect(screen.getByText(thinkingText)).toBeTruthy();
  });

  // Validates tool_result blocks render string content directly
  it("renders tool_result blocks with string content", () => {
    const msg = makeMessage({
      role: "assistant",
      content: "",
      contentBlocks: [
        { type: "tool_result", tool_use_id: "tu-1", content: "Command output: success" },
      ],
    });
    render(<MessageBubble message={msg} />);

    expect(screen.getByText("Command output: success")).toBeTruthy();
  });

  // Validates tool_result blocks with non-string content are JSON.stringify'd
  it("renders tool_result blocks with JSON content", () => {
    const jsonContent = [{ type: "text" as const, text: "nested result" }];
    const msg = makeMessage({
      role: "assistant",
      content: "",
      contentBlocks: [
        { type: "tool_result", tool_use_id: "tu-2", content: jsonContent as unknown as string },
      ],
    });
    render(<MessageBubble message={msg} />);

    // The JSON.stringify of the content should be rendered
    const rendered = screen.getByText(JSON.stringify(jsonContent));
    expect(rendered).toBeTruthy();
  });

  // Validates error tool results use destructive styling classes
  it("renders tool_result error blocks with error styling", () => {
    const msg = makeMessage({
      role: "assistant",
      content: "",
      contentBlocks: [
        { type: "tool_result", tool_use_id: "tu-3", content: "Error: file not found", is_error: true },
      ],
    });
    const { container } = render(<MessageBubble message={msg} />);

    expect(screen.getByText("Error: file not found")).toBeTruthy();
    // Check for destructive styling class (new design system uses text-destructive)
    const errorDiv = container.querySelector(".text-destructive");
    expect(errorDiv).toBeTruthy();
  });

  // Validates non-error tool results use muted styling instead of error
  it("renders non-error tool_result without error styling", () => {
    const msg = makeMessage({
      role: "assistant",
      content: "",
      contentBlocks: [
        { type: "tool_result", tool_use_id: "tu-4", content: "Success output" },
      ],
    });
    const { container } = render(<MessageBubble message={msg} />);

    expect(screen.getByText("Success output")).toBeTruthy();
    const resultDiv = screen.getByText("Success output");
    expect(resultDiv.className).toContain("text-muted-foreground");
    expect(resultDiv.className).not.toContain("text-destructive");
  });

  // Validates Bash tool results truncate to last 20 lines and provide
  // a toggle to show full output
  it("renders Bash tool_result with last 20 lines and supports full output toggle", () => {
    const outputLines = Array.from({ length: 25 }, (_, i) => `line-${i + 1}`).join("\n");
    const msg = makeMessage({
      role: "assistant",
      content: "",
      contentBlocks: [
        { type: "tool_use", id: "tu-bash", name: "Bash", input: { command: "cat big.log" } },
        { type: "tool_result", tool_use_id: "tu-bash", content: outputLines },
      ],
    });
    render(<MessageBubble message={msg} />);

    expect(screen.getByText("Output (last 20 lines)")).toBeTruthy();
    const resultPre = document.querySelector("pre");
    const tailLines = (resultPre?.textContent || "").split("\n");
    expect(tailLines.includes("line-1")).toBe(false);
    expect(tailLines.includes("line-25")).toBe(true);

    fireEvent.click(screen.getByText("Show full"));
    const fullPre = document.querySelector("pre");
    const fullLines = (fullPre?.textContent || "").split("\n");
    expect(fullLines.includes("line-1")).toBe(true);
    expect(screen.getByText("Show tail")).toBeTruthy();
  });
});

// ─── groupContentBlocks behavior (tested indirectly through MessageBubble) ──

describe("MessageBubble - content block grouping", () => {
  // Validates that consecutive tool_use blocks with the same tool name
  // are merged into a single group with a count badge
  it("groups consecutive same-tool tool_use blocks together", () => {
    const msg = makeMessage({
      role: "assistant",
      content: "",
      contentBlocks: [
        { type: "tool_use", id: "tu-1", name: "Read", input: { file_path: "/a.ts" } },
        { type: "tool_use", id: "tu-2", name: "Read", input: { file_path: "/b.ts" } },
        { type: "tool_use", id: "tu-3", name: "Read", input: { file_path: "/c.ts" } },
      ],
    });
    const { container } = render(<MessageBubble message={msg} />);

    // When grouped, there should be a count badge showing "3"
    expect(screen.getByText("3")).toBeTruthy();
    // The label should appear once (grouped)
    const labels = screen.getAllByText("Read File");
    expect(labels.length).toBe(1);
  });

  // Validates that different tool types are never grouped together
  it("does not group different tool types together", () => {
    const msg = makeMessage({
      role: "assistant",
      content: "",
      contentBlocks: [
        { type: "tool_use", id: "tu-1", name: "Read", input: { file_path: "/a.ts" } },
        { type: "tool_use", id: "tu-2", name: "Bash", input: { command: "ls" } },
      ],
    });
    render(<MessageBubble message={msg} />);

    // Both labels should appear separately
    expect(screen.getByText("Read File")).toBeTruthy();
    expect(screen.getByText("Terminal")).toBeTruthy();
  });

  // Validates that a single tool_use renders without the group count badge
  it("renders a single tool_use without group count badge", () => {
    const msg = makeMessage({
      role: "assistant",
      content: "",
      contentBlocks: [
        { type: "tool_use", id: "tu-1", name: "Bash", input: { command: "echo hi" } },
      ],
    });
    render(<MessageBubble message={msg} />);

    // Should render Terminal label but no count badge
    expect(screen.getByText("Terminal")).toBeTruthy();
    expect(screen.queryByText("1")).toBeNull();
  });

  // Validates that same-named tools separated by non-tool blocks (like text)
  // are NOT merged into one group
  it("groups same tools separated by non-tool blocks into separate groups", () => {
    const msg = makeMessage({
      role: "assistant",
      content: "",
      contentBlocks: [
        { type: "tool_use", id: "tu-1", name: "Read", input: { file_path: "/a.ts" } },
        { type: "text", text: "Let me check something else" },
        { type: "tool_use", id: "tu-2", name: "Read", input: { file_path: "/b.ts" } },
      ],
    });
    render(<MessageBubble message={msg} />);

    // The two Read tools should not be grouped since there is a text block between them
    const labels = screen.getAllByText("Read File");
    expect(labels.length).toBe(2);
  });
});
