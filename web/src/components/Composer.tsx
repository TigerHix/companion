import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Bookmark,
  Image as ImageIcon,
  Send,
  Square,
  Slash,
  Sparkles,
  Pause,
  ChevronsRight,
  X,
} from "lucide-react";
import { useStore } from "../store.js";
import { sendToSession } from "../ws.js";
import { CLAUDE_MODES, CODEX_MODES } from "../utils/backends.js";
import { api, type SavedPrompt, type ClaudeConfigResponse } from "../api.js";
import type { ModeOption } from "../utils/backends.js";
import { ModelSwitcher } from "./ModelSwitcher.js";
import { MentionMenu } from "./MentionMenu.js";
import { useMentionMenu } from "../utils/use-mention-menu.js";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { readFileAsBase64, type ImageAttachment } from "../utils/image.js";

let idCounter = 0;

interface CommandItem {
  name: string;
  type: "command" | "skill";
}

export function Composer({ sessionId }: { sessionId: string }) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [savePromptName, setSavePromptName] = useState("");
  const [savePromptError, setSavePromptError] = useState<string | null>(null);
  const [caretPos, setCaretPos] = useState(0);
  const [fallbackCommands, setFallbackCommands] = useState<CommandItem[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pendingSelectionRef = useRef<number | null>(null);
  const cliConnected = useStore((s) => s.cliConnected);
  const sessionData = useStore((s) => s.sessions.get(sessionId));
  const previousMode = useStore((s) => s.previousPermissionMode.get(sessionId) || "acceptEdits");

  const isConnected = cliConnected.get(sessionId) ?? false;
  const currentMode = sessionData?.permissionMode || "acceptEdits";
  const isPlan = currentMode === "plan";
  const isCodex = sessionData?.backend_type === "codex";
  const modes: ModeOption[] = isCodex ? CODEX_MODES : CLAUDE_MODES;
  const modeLabel = modes.find((m) => m.value === currentMode)?.label?.toLowerCase() || currentMode;

  const mention = useMentionMenu({
    text,
    caretPos,
    cwd: sessionData?.cwd,
    enabled: !slashMenuOpen,
  });

  // Build command list from live session data first.
  const sessionCommands = useMemo<CommandItem[]>(() => {
    const cmds: CommandItem[] = [];
    if (sessionData?.slash_commands) {
      for (const cmd of sessionData.slash_commands) {
        cmds.push({ name: cmd.startsWith("/") ? cmd.slice(1) : cmd, type: "command" });
      }
    }
    if (sessionData?.skills) {
      for (const skill of sessionData.skills) {
        cmds.push({ name: skill, type: "skill" });
      }
    }
    return cmds;
  }, [sessionData?.slash_commands, sessionData?.skills]);

  useEffect(() => {
    if (!sessionData?.cwd || sessionCommands.length > 0) {
      if (sessionCommands.length > 0) {
        setFallbackCommands([]);
      }
      return;
    }
    let cancelled = false;
    api.getClaudeConfig(sessionData.cwd)
      .then((config: ClaudeConfigResponse) => {
        if (cancelled) return;
        const next: CommandItem[] = [];
        for (const cmd of config.project.commands) {
          next.push({ name: cmd.name.startsWith("/") ? cmd.name.slice(1) : cmd.name, type: "command" });
        }
        for (const cmd of config.user.commands) {
          next.push({ name: cmd.name.startsWith("/") ? cmd.name.slice(1) : cmd.name, type: "command" });
        }
        for (const skill of config.user.skills) {
          next.push({ name: skill.slug, type: "skill" });
        }
        const deduped = new Map<string, CommandItem>();
        for (const item of next) {
          deduped.set(`${item.type}:${item.name.toLowerCase()}`, item);
        }
        setFallbackCommands(Array.from(deduped.values()));
      })
      .catch(() => {
        if (!cancelled) setFallbackCommands([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionData?.cwd, sessionCommands.length]);

  const allCommands = sessionCommands.length > 0 ? sessionCommands : fallbackCommands;

  const slashToken = useMemo(() => {
    const beforeCaret = text.slice(0, caretPos);
    const match = /(^|\s)\/([^\s/]*)$/.exec(beforeCaret);
    if (!match) return null;
    const tokenStart = (match.index ?? 0) + match[1].length;
    return {
      query: match[2].toLowerCase(),
      tokenStart,
    };
  }, [text, caretPos]);

  // Filter commands based on what the user typed after /
  const filteredCommands = useMemo(() => {
    if (!slashMenuOpen || !slashToken) return [];
    const query = slashToken.query;
    if (query === "") return allCommands;
    return allCommands.filter((cmd) => cmd.name.toLowerCase().includes(query));
  }, [slashMenuOpen, slashToken, allCommands]);

  // Open/close slash menu based on text
  useEffect(() => {
    const shouldOpen = slashToken !== null;
    if (shouldOpen && !slashMenuOpen) {
      setSlashMenuOpen(true);
      setSlashMenuIndex(0);
    } else if (!shouldOpen && slashMenuOpen) {
      setSlashMenuOpen(false);
    }
  }, [slashToken, allCommands.length, slashMenuOpen]);

  // Keep slash menu selected index in bounds
  useEffect(() => {
    if (slashMenuIndex >= filteredCommands.length) {
      setSlashMenuIndex(Math.max(0, filteredCommands.length - 1));
    }
  }, [filteredCommands.length, slashMenuIndex]);

  // Scroll slash menu selected item into view
  useEffect(() => {
    if (!menuRef.current || !slashMenuOpen) return;
    const items = menuRef.current.querySelectorAll("[data-cmd-index]");
    const selected = items[slashMenuIndex];
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [slashMenuIndex, slashMenuOpen]);

  useEffect(() => {
    if (pendingSelectionRef.current === null || !textareaRef.current) return;
    const next = pendingSelectionRef.current;
    textareaRef.current.setSelectionRange(next, next);
    pendingSelectionRef.current = null;
  }, [text]);

  const selectCommand = useCallback((cmd: CommandItem) => {
    const commandText = `/${cmd.name} `;
    if (slashToken) {
      const nextText = `${text.slice(0, slashToken.tokenStart)}${commandText}${text.slice(caretPos).replace(/^\s*/, "")}`;
      const nextCursor = slashToken.tokenStart + commandText.length;
      pendingSelectionRef.current = nextCursor;
      setText(nextText);
      setCaretPos(nextCursor);
    } else {
      pendingSelectionRef.current = commandText.length;
      setText(commandText);
      setCaretPos(commandText.length);
    }
    setSlashMenuOpen(false);
    textareaRef.current?.focus();
  }, [caretPos, slashToken, text]);

  const selectPrompt = useCallback((prompt: SavedPrompt) => {
    const result = mention.selectPrompt(prompt);
    pendingSelectionRef.current = result.nextCursor;
    setText(result.nextText);
    mention.setMentionMenuOpen(false);
    setCaretPos(result.nextCursor);
    textareaRef.current?.focus();
    // Auto-resize textarea after prompt insertion
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [mention]);

  function handleSend() {
    const msg = text.trim();
    if (!msg || !isConnected) return;

    sendToSession(sessionId, {
      type: "user_message",
      content: msg,
      session_id: sessionId,
      images: images.length > 0 ? images.map((img) => ({ media_type: img.mediaType, data: img.base64 })) : undefined,
    });

    useStore.getState().appendMessage(sessionId, {
      id: `user-${Date.now()}-${++idCounter}`,
      role: "user",
      content: msg,
      images: images.length > 0 ? images.map((img) => ({ media_type: img.mediaType, data: img.base64 })) : undefined,
      timestamp: Date.now(),
    });

    setText("");
    setImages([]);
    setSlashMenuOpen(false);
    mention.setMentionMenuOpen(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Slash menu navigation
    if (slashMenuOpen && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashMenuIndex((i) => (i + 1) % filteredCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashMenuIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        selectCommand(filteredCommands[slashMenuIndex]);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        selectCommand(filteredCommands[slashMenuIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashMenuOpen(false);
        return;
      }
    }

    if (mention.mentionMenuOpen) {
      if (e.key === "Escape") {
        e.preventDefault();
        mention.setMentionMenuOpen(false);
        return;
      }
    }

    if (mention.mentionMenuOpen && mention.filteredPrompts.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        mention.setMentionMenuIndex((i) => (i + 1) % mention.filteredPrompts.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        mention.setMentionMenuIndex((i) => (i - 1 + mention.filteredPrompts.length) % mention.filteredPrompts.length);
        return;
      }
      if ((e.key === "Tab" && !e.shiftKey) || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        selectPrompt(mention.filteredPrompts[mention.mentionMenuIndex]);
        return;
      }
    }

    if (
      mention.mentionMenuOpen
      && mention.filteredPrompts.length === 0
      && ((e.key === "Enter" && !e.shiftKey) || (e.key === "Tab" && !e.shiftKey))
    ) {
      e.preventDefault();
      return;
    }

    if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      toggleMode();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    setCaretPos(e.target.selectionStart ?? e.target.value.length);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }

  function syncCaret() {
    if (!textareaRef.current) return;
    setCaretPos(textareaRef.current.selectionStart ?? 0);
  }

  function handleInterrupt() {
    sendToSession(sessionId, { type: "interrupt" });
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const newImages: ImageAttachment[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const { base64, mediaType } = await readFileAsBase64(file);
      newImages.push({ name: file.name, base64, mediaType });
    }
    setImages((prev) => [...prev, ...newImages]);
    e.target.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const newImages: ImageAttachment[] = [];
    for (const item of Array.from(items)) {
      if (!item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (!file) continue;
      const { base64, mediaType } = await readFileAsBase64(file);
      newImages.push({ name: `pasted-${Date.now()}.${file.type.split("/")[1]}`, base64, mediaType });
    }
    if (newImages.length > 0) {
      e.preventDefault();
      setImages((prev) => [...prev, ...newImages]);
    }
  }

  function toggleMode() {
    if (!isConnected) return;
    const store = useStore.getState();
    if (!isPlan) {
      store.setPreviousPermissionMode(sessionId, currentMode);
      sendToSession(sessionId, { type: "set_permission_mode", mode: "plan" });
      store.updateSession(sessionId, { permissionMode: "plan" });
    } else {
      const restoreMode = previousMode || (isCodex ? "bypassPermissions" : "acceptEdits");
      sendToSession(sessionId, { type: "set_permission_mode", mode: restoreMode });
      store.updateSession(sessionId, { permissionMode: restoreMode });
    }
  }

  async function handleCreatePrompt() {
    const content = text.trim();
    const name = savePromptName.trim();
    if (!content || !name) return;
    const payload: { name: string; content: string; scope: "global" | "project"; cwd?: string } = {
      name,
      content,
      scope: "global",
    };
    try {
      await api.createPrompt(payload);
      await mention.refreshPrompts();
      setSavePromptOpen(false);
      setSavePromptName("");
      setSavePromptError(null);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Could not save prompt.";
      setSavePromptError(message);
    }
  }

  const sessionStatus = useStore((s) => s.sessionStatus);
  const isRunning = sessionStatus.get(sessionId) === "running";
  const canSend = text.trim().length > 0 && isConnected;

  return (
    <div className="relative z-10 shrink-0 px-0 sm:px-6 pt-0 sm:pt-3 pb-5 sm:pb-4 bg-card sm:bg-transparent">
      <div className="relative max-w-3xl mx-auto">
        {/* Image thumbnails */}
        {images.length > 0 && (
          <div className="flex items-center gap-2 mb-2 px-3 sm:px-0 flex-wrap">
            {images.map((img, i) => (
              <div key={i} className="relative group">
                <img
                  src={`data:${img.mediaType};base64,${img.base64}`}
                  alt={img.name}
                  className="w-12 h-12 rounded-lg object-cover border border-border"
                />
                <Button
                  type="button"
                  onClick={() => removeImage(i)}
                  aria-label="Remove image"
                  variant="destructive"
                  size="icon-xs"
                  className="absolute -top-1.5 -right-1.5 rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <X className="size-2.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Attach images"
        />

        {/* Input container: flat separator on mobile, glass card on desktop */}
        <div className={cn(
          "relative overflow-visible transition-colors border-t border-border",
          "sm:border sm:border-border sm:bg-card/95 sm:rounded-[14px] sm:shadow-[0_10px_30px_rgba(0,0,0,0.10)] sm:backdrop-blur-sm",
          isPlan
            ? "sm:border-primary/40"
            : "sm:focus-within:border-primary/30"
        )}>
          {/* Slash command menu */}
          {slashMenuOpen && (
            <div
              ref={menuRef}
              className="absolute left-2 right-2 bottom-full mb-1 max-h-[240px] overflow-y-auto card-moku border border-border rounded-[10px] shadow-lg z-40 py-1"
            >
              {filteredCommands.length > 0 ? (
                filteredCommands.map((cmd, i) => (
                  <Button
                    type="button"
                    key={`${cmd.type}-${cmd.name}`}
                    data-cmd-index={i}
                    onClick={() => selectCommand(cmd)}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-auto w-full justify-start px-3 py-2 text-left",
                      i === slashMenuIndex
                        ? "bg-accent"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <span className="flex items-center justify-center w-6 h-6 rounded-md bg-accent text-muted-foreground shrink-0">
                      {cmd.type === "skill" ? (
                        <Sparkles className="size-3.5" />
                      ) : (
                        <Slash className="size-3.5" />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-medium text-foreground">/{cmd.name}</span>
                      <span className="ml-2 text-[11px] text-muted-foreground">{cmd.type}</span>
                    </div>
                  </Button>
                ))
              ) : (
                <div className="px-3 py-2 text-[12px] text-muted-foreground">
                  No slash commands available yet.
                </div>
              )}
            </div>
          )}

          {/* @ prompt menu */}
          <MentionMenu
            open={mention.mentionMenuOpen}
            loading={mention.promptsLoading}
            prompts={mention.filteredPrompts}
            selectedIndex={mention.mentionMenuIndex}
            onSelect={selectPrompt}
            menuRef={mention.mentionMenuRef}
            className="absolute left-2 right-2 bottom-full mb-1 z-40"
          />

          {savePromptOpen && (
            <div className="absolute left-2 right-2 bottom-full mb-1 card-moku border border-border rounded-[10px] shadow-lg z-40 p-3 space-y-2">
              <div className="text-xs font-semibold text-foreground">Save prompt</div>
              <input
                value={savePromptName}
                onChange={(e) => {
                  setSavePromptName(e.target.value);
                  if (savePromptError) setSavePromptError(null);
                }}
                placeholder="Prompt title"
                aria-label="Prompt title"
                className="w-full px-2 py-1.5 text-sm input-moku rounded-md text-foreground"
              />
              <div className="text-[11px] text-muted-foreground">Scope: global &bull; stored locally</div>
              {savePromptError ? (
                <div className="text-[11px] text-destructive">{savePromptError}</div>
              ) : null}
              <div className="flex items-center gap-1.5 justify-end">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setSavePromptOpen(false);
                    setSavePromptError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="xs"
                  onClick={handleCreatePrompt}
                  disabled={!savePromptName.trim() || !text.trim()}
                >
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* Mobile toolbar: mode toggle + model switcher + secondary actions (hidden on sm+) */}
          <div className="flex items-center gap-1.5 px-3 pt-1.5 pb-0.5 sm:hidden">
            <Button
              type="button"
              onClick={toggleMode}
              disabled={!isConnected}
              variant={isPlan ? "secondary" : "outline"}
              size="sm"
              className={cn(
                "h-8 gap-1.5 px-2 text-[12px] font-semibold select-none shrink-0",
                !isConnected
                  ? "text-muted-foreground border-transparent"
                  : isPlan
                    ? "text-primary border-primary/30 bg-primary/8"
                    : "text-muted-foreground"
              )}
              title="Toggle mode (Shift+Tab)"
            >
              {isPlan ? (
                <Pause className="size-3.5" />
              ) : (
                <ChevronsRight className="size-3.5" />
              )}
              <span>{modeLabel}</span>
            </Button>

            <ModelSwitcher sessionId={sessionId} />

            <div className="flex-1" />

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                const defaultName = text.trim().slice(0, 32);
                setSavePromptName(defaultName || "");
                setSavePromptError(null);
                setSavePromptOpen((v) => !v);
              }}
              disabled={!isConnected || !text.trim()}
              title="Save as prompt"
            >
              <Bookmark className="size-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isConnected}
              title="Upload image"
            >
              <ImageIcon className="size-4" />
            </Button>
          </div>

          {/* Textarea row */}
          <div className="px-3 sm:px-3 pt-1 sm:pt-2.5">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onClick={syncCaret}
              onKeyUp={syncCaret}
              onPaste={handlePaste}
              aria-label="Message input"
              placeholder={isConnected
                ? "Type a message... (/ + @)"
                : "Waiting for CLI connection..."}
              disabled={!isConnected}
              rows={1}
              className="w-full px-1 py-1.5 text-base sm:text-sm bg-transparent resize-none outline-none text-foreground font-sans placeholder:text-muted-foreground disabled:opacity-50 overflow-y-auto"
              style={{ minHeight: "36px", maxHeight: "200px" }}
            />
          </div>

          {/* Mobile action row (hidden on sm+) */}
          <div className="flex items-center justify-end gap-1 px-3 pb-1 sm:hidden">
            {/* Send/stop */}
            {isRunning ? (
              <Button
                variant="destructive"
                size="icon"
                onClick={handleInterrupt}
                title="Stop generation"
                className="rounded-lg"
              >
                <Square className="size-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                size="icon-lg"
                className={cn(
                  "rounded-full transition-colors shadow-[0_6px_20px_rgba(0,0,0,0.18)]",
                  canSend
                    ? ""
                    : "bg-accent text-muted-foreground shadow-none"
                )}
                title="Send message"
              >
                <Send className="size-3.5" />
              </Button>
            )}
          </div>

          {/* Desktop action bar: + bookmark mode spacer model send (hidden on mobile) */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 pb-2">
            {/* + button (image upload) */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isConnected}
              title="Attach image"
            >
              <Plus className="size-4" />
            </Button>

            {/* Save prompt (bookmark) */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                const defaultName = text.trim().slice(0, 32);
                setSavePromptName(defaultName || "");
                setSavePromptError(null);
                setSavePromptOpen((v) => !v);
              }}
              disabled={!isConnected || !text.trim()}
              title="Save as prompt"
            >
              <Bookmark className="size-4" />
            </Button>

            {/* Mode toggle */}
            <Button
              type="button"
              onClick={toggleMode}
              disabled={!isConnected}
              variant={isPlan ? "secondary" : "outline"}
              size="sm"
              className={cn(
                "text-[12px] font-semibold select-none shrink-0",
                !isConnected
                  ? "text-muted-foreground border-transparent"
                  : isPlan
                    ? "text-primary border-primary/30 bg-primary/8 hover:bg-primary/12"
                    : "text-muted-foreground"
              )}
              title="Toggle mode (Shift+Tab)"
            >
              {isPlan ? (
                <Pause className="size-3.5" />
              ) : (
                <ChevronsRight className="size-3.5" />
              )}
              <span>{modeLabel}</span>
            </Button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Model switcher */}
            <ModelSwitcher sessionId={sessionId} />

            {/* Send/stop */}
            {isRunning ? (
              <Button
                variant="destructive"
                size="icon"
                onClick={handleInterrupt}
                title="Stop generation"
                className="rounded-lg"
              >
                <Square className="size-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                size="icon"
                className={cn(
                  "rounded-full transition-colors shadow-[0_6px_20px_rgba(0,0,0,0.18)]",
                  canSend
                    ? ""
                    : "bg-accent text-muted-foreground shadow-none"
                )}
                title="Send message"
              >
                <Send className="size-3.5" />
              </Button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
