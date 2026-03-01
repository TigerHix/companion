import { useState, useEffect, useCallback, useRef } from "react";
import { api, type MokuEnv, type ImagePullState } from "../api.js";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  onClose?: () => void;
  embedded?: boolean;
}

interface VarRow {
  key: string;
  value: string;
}

type Tab = "variables" | "docker" | "ports" | "init";

const DEFAULT_DOCKERFILE = `FROM moku:latest

# Add project-specific dependencies here
# RUN apt-get update && apt-get install -y ...
# RUN npm install -g ...

WORKDIR /workspace
CMD ["sleep", "infinity"]
`;

const TAB_ORDER: Tab[] = ["variables", "docker", "ports", "init"];

export function EnvManager({ onClose, embedded = false }: Props) {
  const [envs, setEnvs] = useState<MokuEnv[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editVars, setEditVars] = useState<VarRow[]>([]);
  const [editDockerfile, setEditDockerfile] = useState("");
  const [editBaseImage, setEditBaseImage] = useState("");
  const [editPorts, setEditPorts] = useState<number[]>([]);
  const [editInitScript, setEditInitScript] = useState("");
  const [error, setError] = useState("");

  const [building, setBuilding] = useState(false);
  const [buildLog, setBuildLog] = useState("");
  const [showBuildLog, setShowBuildLog] = useState(false);

  const [dockerAvailable, setDockerAvailable] = useState<boolean | null>(null);
  const [availableImages, setAvailableImages] = useState<string[]>([]);
  const [imageStates, setImageStates] = useState<Record<string, ImagePullState>>({});
  const pullPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pullingImagesRef = useRef<string[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newVars, setNewVars] = useState<VarRow[]>([{ key: "", value: "" }]);
  const [newDockerfile, setNewDockerfile] = useState("");
  const [newBaseImage, setNewBaseImage] = useState("");
  const [newPorts, setNewPorts] = useState<number[]>([]);
  const [newInitScript, setNewInitScript] = useState("");
  const [newTab, setNewTab] = useState<Tab>("variables");
  const [creating, setCreating] = useState(false);

  const refreshImageStatus = useCallback((tag: string) => {
    api.getImageStatus(tag).then((state) => {
      setImageStates((prev) => ({ ...prev, [tag]: state }));
    }).catch(() => {});
  }, []);

  const handlePullImage = useCallback((tag: string) => {
    api.pullImage(tag).then((res) => {
      if (res.state) {
        setImageStates((prev) => ({ ...prev, [tag]: res.state }));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const pullingImages = Object.entries(imageStates)
      .filter(([, state]) => state.status === "pulling")
      .map(([tag]) => tag);
    pullingImagesRef.current = pullingImages;

    if (pullingImages.length === 0) {
      if (pullPollRef.current) {
        clearInterval(pullPollRef.current);
        pullPollRef.current = null;
      }
      return;
    }

    if (!pullPollRef.current) {
      pullPollRef.current = setInterval(() => {
        for (const tag of pullingImagesRef.current) {
          refreshImageStatus(tag);
        }
      }, 2000);
    }

    return () => {
      if (pullPollRef.current) {
        clearInterval(pullPollRef.current);
        pullPollRef.current = null;
      }
    };
  }, [imageStates, refreshImageStatus]);

  useEffect(() => {
    if (!dockerAvailable) return;
    for (const env of envs) {
      const image = env.imageTag || env.baseImage;
      if (image) refreshImageStatus(image);
    }
  }, [dockerAvailable, envs, refreshImageStatus]);

  const refresh = useCallback(() => {
    api.listEnvs().then(setEnvs).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    api.getContainerStatus().then((status) => {
      setDockerAvailable(status.available);
      if (status.available) {
        api.getContainerImages().then(setAvailableImages).catch(() => {});
      }
    }).catch(() => setDockerAvailable(false));
  }, [refresh]);

  function resetCreateForm() {
    setNewName("");
    setNewVars([{ key: "", value: "" }]);
    setNewDockerfile("");
    setNewBaseImage("");
    setNewPorts([]);
    setNewInitScript("");
    setNewTab("variables");
  }

  function startEdit(env: MokuEnv) {
    setEditingSlug(env.slug);
    setEditName(env.name);
    const rows = Object.entries(env.variables).map(([key, value]) => ({ key, value }));
    if (rows.length === 0) rows.push({ key: "", value: "" });
    setEditVars(rows);
    setEditDockerfile(env.dockerfile || "");
    setEditBaseImage(env.baseImage || "");
    setEditPorts(env.ports || []);
    setEditInitScript(env.initScript || "");
    setError("");
    setBuildLog("");
    setShowBuildLog(false);
  }

  function cancelEdit() {
    setEditingSlug(null);
    setError("");
  }

  async function saveEdit() {
    if (!editingSlug) return;
    const variables: Record<string, string> = {};
    for (const row of editVars) {
      const key = row.key.trim();
      if (key) variables[key] = row.value;
    }
    try {
      await api.updateEnv(editingSlug, {
        name: editName.trim() || undefined,
        variables,
        dockerfile: editDockerfile || undefined,
        baseImage: editBaseImage || undefined,
        ports: editPorts.length > 0 ? editPorts : undefined,
        initScript: editInitScript || undefined,
      });
      setEditingSlug(null);
      setError("");
      refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDelete(slug: string) {
    try {
      await api.deleteEnv(slug);
      if (editingSlug === slug) setEditingSlug(null);
      refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;

    setCreating(true);
    const variables: Record<string, string> = {};
    for (const row of newVars) {
      const key = row.key.trim();
      if (key) variables[key] = row.value;
    }

    try {
      await api.createEnv(name, variables, {
        dockerfile: newDockerfile || undefined,
        baseImage: newBaseImage || undefined,
        ports: newPorts.length > 0 ? newPorts : undefined,
        initScript: newInitScript || undefined,
      });
      resetCreateForm();
      setShowCreate(false);
      setError("");
      refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  async function handleBuild(slug: string) {
    setBuilding(true);
    setBuildLog("Starting build...\n");
    setShowBuildLog(true);

    try {
      await api.buildEnvImage(slug);
      const poll = async () => {
        const status = await api.getEnvBuildStatus(slug);
        if (status.buildStatus === "building") {
          setTimeout(poll, 2000);
          return;
        }

        setBuilding(false);
        if (status.buildStatus === "success") {
          setBuildLog((prev) => prev + "\nBuild successful!");
        } else {
          setBuildLog((prev) => prev + `\nBuild failed: ${status.buildError || "Unknown error"}`);
        }
        refresh();
        api.getContainerImages().then(setAvailableImages).catch(() => {});
      };

      setTimeout(poll, 2000);
    } catch (e: unknown) {
      setBuilding(false);
      setBuildLog((prev) => prev + `\nBuild error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const dockerBadge = dockerAvailable === null ? null : dockerAvailable ? (
    <StatusChip tone="success">Docker</StatusChip>
  ) : (
    <StatusChip tone="warning">No Docker</StatusChip>
  );

  const createForm = (
    <div className="card-moku space-y-3 rounded-xl p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">New Environment</span>
        {!embedded && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              resetCreateForm();
              setError("");
            }}
          >
            Reset
          </Button>
        )}
      </div>

      <Input
        type="text"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder="Environment name (e.g. production)"
        className="min-h-11 px-3 py-2.5"
        onKeyDown={(e) => {
          if (e.key === "Enter" && newName.trim()) handleCreate();
        }}
      />

      {renderTabs(newTab, setNewTab)}
      {newTab === "variables" && <VarEditor rows={newVars} onChange={setNewVars} />}
      {newTab === "docker" && renderDockerTab(newDockerfile, setNewDockerfile, newBaseImage, setNewBaseImage)}
      {newTab === "ports" && renderPortsTab(newPorts, setNewPorts)}
      {newTab === "init" && renderInitScriptTab(newInitScript, setNewInitScript)}

      {error && <ErrorBanner message={error} />}

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-[11px] text-muted-foreground">
          Stored in <code className="rounded bg-accent px-1 py-0.5 text-[10px]">~/.moku/envs/</code>
        </p>
        <Button
          type="button"
          onClick={handleCreate}
          disabled={!newName.trim() || creating}
          className="min-h-11"
        >
          {creating ? "Creating..." : "Create"}
        </Button>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="h-full overflow-x-hidden overflow-y-auto bg-background font-sans text-foreground antialiased">
        <div className="mx-auto max-w-2xl px-4 py-6 pb-28 md:pb-6 sm:px-6 sm:py-10">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-foreground">Environments</h1>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                Reusable environment profiles with optional Docker isolation.
              </p>
            </div>
            {dockerBadge}
          </div>

          <div className="mb-5 mt-4 flex items-center gap-2">
            <div className="flex-1" />
            <Button
              type="button"
              variant={showCreate ? "secondary" : "default"}
              size="sm"
              className="min-h-11 shrink-0"
              onClick={() => {
                setShowCreate((current) => !current);
                setError("");
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                {showCreate ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M12 5v14M5 12h14" />}
              </svg>
              <span className="hidden sm:inline">{showCreate ? "Cancel" : "New Environment"}</span>
            </Button>
          </div>

          {showCreate && (
            <div className="mb-6" style={{ animation: "fadeSlideIn 150ms ease-out" }}>
              {createForm}
            </div>
          )}

          <div className="mb-3 flex items-center gap-2 text-[12px] text-muted-foreground">
            <span>{envs.length} environment{envs.length !== 1 ? "s" : ""}</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading environments...</div>
          ) : envs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No environments yet.</div>
          ) : (
            <div className="space-y-2">
              {envs.map((env) => {
                if (editingSlug === env.slug) {
                  return (
                    <div key={env.slug} style={{ animation: "fadeSlideIn 150ms ease-out" }}>
                      {renderEditor(env, false)}
                    </div>
                  );
                }

                return (
                  <EnvRow
                    key={env.slug}
                    env={env}
                    varCount={Object.keys(env.variables).length}
                    onStartEdit={() => startEdit(env)}
                    onDelete={() => void handleDelete(env.slug)}
                  />
                );
              })}
            </div>
          )}

          {error && !showCreate && <div className="mt-4"><ErrorBanner message={error} /></div>}
        </div>
      </div>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent
        showCloseButton={false}
        className="top-auto left-0 bottom-0 w-full max-w-none translate-x-0 translate-y-0 gap-0 rounded-t-[14px] rounded-b-none p-0 sm:top-1/2 sm:left-1/2 sm:bottom-auto sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[14px]"
      >
        <div className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[14px] border border-border bg-background sm:max-h-[80dvh] sm:rounded-[14px]">
          <DialogHeader className="shrink-0 flex-row items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-sm font-semibold text-foreground">Manage Environments</DialogTitle>
              {dockerBadge}
            </div>
            {onClose && (
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                </svg>
              </Button>
            )}
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3 pb-safe sm:px-5 sm:py-4">
            {error && <ErrorBanner message={error} />}

            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Loading environments...</div>
            ) : envs.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No environments yet.</div>
            ) : (
              <div className="space-y-3">
                {envs.map((env) => (
                  <div key={env.slug}>
                    {editingSlug === env.slug ? (
                      renderEditor(env, true)
                    ) : (
                      <ModalEnvRow
                        env={env}
                        onEdit={() => startEdit(env)}
                        onDelete={() => void handleDelete(env.slug)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {createForm}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  function renderEditor(env: MokuEnv, compact: boolean) {
    return (
      <div className={cn("card-moku space-y-3 rounded-xl p-4", compact && "p-3")}>
        <Input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          placeholder="Environment name"
          className="min-h-11 px-3 py-2.5"
        />

        <div className="space-y-3">
          <div>
            <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">Variables</div>
            <VarEditor rows={editVars} onChange={setEditVars} />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">Docker</div>
            {renderDockerTab(editDockerfile, setEditDockerfile, editBaseImage, setEditBaseImage, env.slug, env)}
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">Ports</div>
            {renderPortsTab(editPorts, setEditPorts)}
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">Init Script</div>
            {renderInitScriptTab(editInitScript, setEditInitScript)}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={cancelEdit} className="min-h-11">
            Cancel
          </Button>
          <Button type="button" onClick={() => void saveEdit()} className="min-h-11">
            Save
          </Button>
        </div>
      </div>
    );
  }

  function renderTabs(activeTab: Tab, setTab: (tab: Tab) => void) {
    return (
      <div className="flex flex-wrap gap-1">
        {TAB_ORDER.map((tab) => (
          <Button
            key={tab}
            type="button"
            variant={activeTab === tab ? "secondary" : "ghost"}
            size="xs"
            className={cn(
              "min-h-11 rounded-md px-3 py-2.5 text-[11px] font-medium capitalize",
              activeTab === tab && "text-primary",
            )}
            onClick={() => setTab(tab)}
          >
            {tab}
          </Button>
        ))}
      </div>
    );
  }

  function renderDockerTab(
    dockerfile: string,
    setDockerfile: (value: string) => void,
    baseImage: string,
    setBaseImage: (value: string) => void,
    slug?: string,
    env?: MokuEnv,
  ) {
    const effectiveImage = env?.imageTag || baseImage;
    const imageState = effectiveImage ? imageStates[effectiveImage] : undefined;
    const isPulling = imageState?.status === "pulling";

    return (
      <div className="space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="text-[11px] text-muted-foreground">Base Image</label>
            {effectiveImage && (
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {imageState?.status === "ready" && <StatusChip tone="success">Ready</StatusChip>}
                {imageState?.status === "pulling" && (
                  <StatusChip tone="warning">
                    <span className="size-2.5 rounded-full border border-warning/30 border-t-warning animate-spin" />
                    Pulling...
                  </StatusChip>
                )}
                {imageState?.status === "idle" && <StatusChip tone="muted">Not downloaded</StatusChip>}
                {imageState?.status === "error" && <StatusChip tone="destructive">Pull failed</StatusChip>}
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={isPulling}
                  onClick={() => handlePullImage(effectiveImage)}
                  className="min-h-11"
                >
                  {isPulling ? "Pulling..." : imageState?.status === "ready" ? "Update" : "Pull"}
                </Button>
              </div>
            )}
          </div>

          <select
            value={baseImage}
            onChange={(e) => {
              setBaseImage(e.target.value);
              if (e.target.value) refreshImageStatus(e.target.value);
            }}
            className="input-moku min-h-11 w-full rounded-md px-3 py-2.5 text-sm text-foreground outline-none"
          >
            <option value="">None (local execution)</option>
            <option value="moku:latest">moku:latest</option>
            {availableImages.filter((img) => img !== "moku:latest").map((img) => (
              <option key={img} value={img}>{img}</option>
            ))}
          </select>
        </div>

        {isPulling && imageState?.progress && imageState.progress.length > 0 && (
          <pre className="max-h-[120px] overflow-auto whitespace-pre-wrap rounded-lg bg-code-bg px-3 py-2 font-mono text-[10px] text-muted-foreground">
            {imageState.progress.slice(-20).join("\n")}
          </pre>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="text-[11px] text-muted-foreground">Dockerfile (optional override)</label>
            {!dockerfile && (
              <Button type="button" variant="link" size="xs" className="h-auto px-0 py-0" onClick={() => setDockerfile(DEFAULT_DOCKERFILE)}>
                Use template
              </Button>
            )}
          </div>

          <Textarea
            value={dockerfile}
            onChange={(e) => setDockerfile(e.target.value)}
            placeholder="# Custom Dockerfile content..."
            rows={10}
            className="min-h-[120px] resize-y px-3 py-2.5 font-mono text-[11px]"
          />
        </div>

        {slug && dockerfile && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => handleBuild(slug)}
                disabled={building}
                size="sm"
                className="min-h-11"
              >
                {building ? "Building..." : "Build Image"}
              </Button>
              {env?.buildStatus === "success" && env.lastBuiltAt && (
                <span className="text-[10px] text-success">
                  Built {new Date(env.lastBuiltAt).toLocaleDateString()}
                </span>
              )}
              {env?.buildStatus === "error" && <span className="text-[10px] text-destructive">Build failed</span>}
              {env?.imageTag && <StatusChip tone="primary" mono>{env.imageTag}</StatusChip>}
            </div>

            {showBuildLog && buildLog && (
              <div className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Close build log"
                  className="absolute top-1 right-1"
                  onClick={() => setShowBuildLog(false)}
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                    <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                  </svg>
                </Button>
                <pre className="max-h-[200px] overflow-auto whitespace-pre-wrap rounded-lg bg-code-bg px-3 py-2 font-mono text-[10px] text-muted-foreground">
                  {buildLog}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderPortsTab(ports: number[], setPorts: (ports: number[]) => void) {
    return (
      <div className="space-y-2">
        <label className="block text-[11px] text-muted-foreground">Ports to expose in the container</label>
        {ports.map((port, index) => (
          <div key={`${port}-${index}`} className="flex items-center gap-1.5">
            <Input
              type="number"
              value={port}
              onChange={(e) => {
                const next = [...ports];
                next[index] = parseInt(e.target.value, 10) || 0;
                setPorts(next);
              }}
              min={1}
              max={65535}
              className="min-h-11 w-28 px-3 py-2.5 font-mono text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Remove port"
              className="min-h-11 text-muted-foreground hover:text-destructive"
              onClick={() => setPorts(ports.filter((_, portIndex) => portIndex !== index))}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
              </svg>
            </Button>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" className="min-h-11 px-0" onClick={() => setPorts([...ports, 3000])}>
          + Add port
        </Button>
      </div>
    );
  }

  function renderInitScriptTab(initScript: string, setInitScript: (value: string) => void) {
    return (
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Init Script</label>
          <Textarea
            value={initScript}
            onChange={(e) => setInitScript(e.target.value)}
            placeholder={"# Runs inside the container before Claude starts\n# Example:\nbun install\npip install -r requirements.txt"}
            rows={10}
            className="min-h-[120px] resize-y px-3 py-2.5 font-mono text-[11px]"
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          This shell script runs as root inside the container via{" "}
          <code className="rounded bg-accent px-1 py-0.5">sh -lc</code> before the session starts.
          Timeout: 120s.
        </p>
      </div>
    );
  }
}

interface EnvRowProps {
  env: MokuEnv;
  varCount: number;
  onStartEdit: () => void;
  onDelete: () => void;
}

function EnvRow({ env, varCount, onStartEdit, onDelete }: EnvRowProps) {
  return (
    <div className="group flex min-h-[44px] items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-accent/60">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-3.5">
          <path d="M12 3v18M3 12h18M4.5 6.5l15 0M4.5 17.5h15M6.5 4.5v15M17.5 4.5v15" />
        </svg>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{env.name}</span>
          {env.imageTag && <StatusChip tone="primary" mono>{env.imageTag.split(":")[0]?.split("/").pop() || env.imageTag}</StatusChip>}
          {!env.imageTag && env.baseImage && <StatusChip tone="muted" mono>{env.baseImage}</StatusChip>}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {varCount} variable{varCount !== 1 ? "s" : ""}
          {env.ports && env.ports.length > 0 && ` · ${env.ports.length} port${env.ports.length !== 1 ? "s" : ""}`}
          {env.initScript && " · init script"}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
          aria-label="Edit"
          onClick={onStartEdit}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-3.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
          </svg>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive sm:min-h-0 sm:min-w-0"
          aria-label="Delete"
          onClick={onDelete}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-3.5">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
          </svg>
        </Button>
      </div>
    </div>
  );
}

function ModalEnvRow({
  env,
  onEdit,
  onDelete,
}: {
  env: MokuEnv;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="card-moku overflow-hidden rounded-xl">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="flex-1 text-sm font-medium text-foreground">{env.name}</span>
        {env.imageTag && <StatusChip tone="primary" mono>{env.imageTag.split(":")[0]?.split("/").pop() || env.imageTag}</StatusChip>}
        {env.baseImage && !env.imageTag && <StatusChip tone="muted" mono>{env.baseImage}</StatusChip>}
        <span className="text-xs text-muted-foreground">
          {Object.keys(env.variables).length} var{Object.keys(env.variables).length !== 1 ? "s" : ""}
        </span>
        <Button type="button" variant="ghost" size="xs" className="min-h-11" onClick={onEdit}>Edit</Button>
        <Button type="button" variant="ghost" size="xs" className="min-h-11 text-muted-foreground hover:text-destructive" onClick={onDelete}>
          Delete
        </Button>
      </div>

      {Object.keys(env.variables).length > 0 && (
        <div className="space-y-1 px-3 py-2.5">
          {Object.entries(env.variables).map(([key, value]) => (
            <div key={key} className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-1.5 text-xs leading-5">
              <span className="break-all font-mono text-foreground">{key}</span>
              <span className="text-muted-foreground">=</span>
              <span className="break-all whitespace-pre-wrap font-mono text-muted-foreground">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VarEditor({ rows, onChange }: { rows: VarRow[]; onChange: (rows: VarRow[]) => void }) {
  function updateRow(index: number, field: "key" | "value", value: string) {
    const next = [...rows];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  }

  function removeRow(index: number) {
    const next = rows.filter((_, rowIndex) => rowIndex !== index);
    if (next.length === 0) next.push({ key: "", value: "" });
    onChange(next);
  }

  function addRow() {
    onChange([...rows, { key: "", value: "" }]);
  }

  return (
    <div className="space-y-1.5">
      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <Input
            type="text"
            value={row.key}
            onChange={(e) => updateRow(index, "key", e.target.value)}
            placeholder="KEY"
            className="min-h-11 flex-1 px-3 py-2.5 font-mono text-xs"
          />
          <span className="text-[10px] text-muted-foreground">=</span>
          <Input
            type="text"
            value={row.value}
            onChange={(e) => updateRow(index, "value", e.target.value)}
            placeholder="value"
            className="min-h-11 flex-1 px-3 py-2.5 font-mono text-xs"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove variable"
            className="min-h-11 text-muted-foreground hover:text-destructive"
            onClick={() => removeRow(index)}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </Button>
        </div>
      ))}

      <Button type="button" variant="ghost" size="sm" className="min-h-11 px-0" onClick={addRow}>
        + Add variable
      </Button>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      {message}
    </div>
  );
}

function StatusChip({
  children,
  className,
  mono = false,
  tone = "muted",
}: {
  children: React.ReactNode;
  className?: string;
  mono?: boolean;
  tone?: "muted" | "primary" | "success" | "warning" | "destructive";
}) {
  return (
    <span
      className={cn(
        "status-chip",
        tone === "muted" && "status-chip-muted",
        tone === "primary" && "status-chip-primary",
        tone === "success" && "status-chip-success",
        tone === "warning" && "status-chip-warning",
        tone === "destructive" && "status-chip-destructive",
        mono && "font-mono",
        className,
      )}
    >
      {children}
    </span>
  );
}
