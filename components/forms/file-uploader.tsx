"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, File as FileIcon, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ApiResponse } from "@/lib/api-response";
import { useUploadThing } from "@/utils/uploadthing";
import { confirmUploadAction } from "@/server/actions/files";

export interface UploadedFile {
  id?: string;
  key: string;
  name: string;
  size: number;
  contentType: string;
  url?: string;
}

export interface FileUploaderProps {
  /** Accept attribute (e.g. "application/pdf,image/*"). */
  accept?: string;
  /** Max file size in bytes. */
  maxSizeBytes?: number;
  /** Allow multiple files. */
  multiple?: boolean;
  /** Called when upload completes (per file). */
  onUploaded?: (file: UploadedFile) => void;
  /** Called when all files are uploaded. */
  onAllUploaded?: (files: UploadedFile[]) => void;
  /** Category of file (drives the upload endpoint bucket path). */
  category?: "content" | "submission" | "avatar" | "document";
  className?: string;
  label?: string;
  hint?: string;
}

/**
 * File uploader — POSTs to /api/files/upload-url to get a presigned URL
 * (R2 mode) or uses Uploadthing's uploader (uploadthing mode, handled
 * server-side by the same endpoint).
 *
 * This component is provider-agnostic: the backend `/api/files/upload-url`
 * route returns either:
 *   - R2: { method: "PUT", uploadUrl, headers, key }
 *   - Uploadthing: { method: "POST", uploadUrl (UT endpoint), key }
 * In both cases the client just PUTs/POSTs the file to `uploadUrl`.
 */
export function FileUploader({
  accept = "*/*",
  maxSizeBytes = 25 * 1024 * 1024,
  multiple = false,
  onUploaded,
  onAllUploaded,
  category = "document",
  className,
  label,
  hint,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pending, setPending] = useState<
    Array<{ name: string; progress: number; error?: string }>
  >([]);

  const uploadOne = useCallback(
    async (file: File): Promise<UploadedFile | null> => {
      if (file.size > maxSizeBytes) {
        toast.error(
          `"${file.name}" dépasse la taille maximale (${Math.round(maxSizeBytes / 1024 / 1024)}MB)`,
        );
        return null;
      }

      // 1. Request presigned URL.
      const res = await fetch(
        `/api/files/upload-url?category=${category}&contentType=${encodeURIComponent(file.type)}&size=${file.size}`,
        { method: "POST" },
      );
      const json = (await res.json()) as ApiResponse<{
        method: "PUT" | "POST";
        uploadUrl: string;
        headers: Record<string, string>;
        key: string;
      }>;

      if (!json.success) {
        toast.error(json.error.message);
        return null;
      }

      const { method, uploadUrl, headers, key } = json.data;

      // 2. Upload to the presigned URL.
      const uploadRes = await fetch(uploadUrl, {
        method,
        body: file,
        headers,
      });

      if (!uploadRes.ok) {
        toast.error(`Upload failed for "${file.name}"`);
        return null;
      }

      // 3. Confirm the upload → create the `files` row in DB (returns fileId).
      const confirmRes = await fetch("/api/files/confirm-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          originalName: file.name,
          contentType: file.type,
          size: file.size,
          category,
        }),
      });
      const confirmJson = (await confirmRes.json()) as ApiResponse<{
        id: string;
        key: string;
        originalName: string;
        contentType: string;
        size: number;
        bucket: string;
        status: string;
      }>;

      if (!confirmJson.success) {
        toast.error(confirmJson.error.message);
        return null;
      }

      const uploaded: UploadedFile = {
        id: confirmJson.data.id,
        key,
        name: file.name,
        size: file.size,
        contentType: file.type,
        url: confirmJson.data.bucket === "uploadthing" ? undefined : undefined,
      };
      onUploaded?.(uploaded);
      return uploaded;
    },
    [maxSizeBytes, category, onUploaded],
  );

  // Uploadthing Path
  const { startUpload, routeConfig } = useUploadThing("fileUploader", {
    onClientUploadComplete: async (files) => {
      console.log("FILES UPLOADED: ", files);
      const results: UploadedFile[] = [];

      for (const file of files) {
        const result = await confirmUploadAction({
          key: file.key,
          originalName: file.name,
          contentType: file.type,
          size: file.size,
          category,
          fileUrl: file.ufsUrl,
        });

        if (!result.success) {
          toast.error(result.error.message);
          return;
        }

        const uploaded: UploadedFile = {
          id: result.data.id,
          key: file.key,
          name: file.name,
          size: file.size,
          contentType: file.type,
          url: result.data.bucket === "uploadthing" ? file.ufsUrl : undefined,
        };
        onUploaded?.(uploaded);

        results.push(uploaded);
        if (results.length > 0) {
          toast.success(`${results.length} fichier(s) envoyé(s) avec succès`);
          onAllUploaded?.(results);
        }
      }
    },
    onUploadError: () => {
      toast.error("error occurred while uploading");
    },
    onUploadBegin: (fileName) => {
      console.log("upload has begun for", fileName);
    },
  });

  const handleFiles = useCallback(
    async (files: FileList) => {
      const isUploadthing =
        process.env.NEXT_PUBLIC_STORAGE_PROVIDER === "uploadthing";

      const list = Array.from(files);
      if (list.length === 0) return;

      setPending(list.map((f) => ({ name: f.name, progress: 0 })));
      const results: UploadedFile[] = [];

      if (isUploadthing) {
        try {
          await startUpload(list);
        } catch (error) {
          toast.error(`Erreur lors de l'upload des fichiers`);
        }
      } else {
        for (const file of list) {
          try {
            const uploaded = await uploadOne(file);
            if (uploaded) results.push(uploaded);
          } catch {
            toast.error(`Erreur lors de l'upload de "${file.name}"`);
          }
        }
        if (results.length > 0) {
          toast.success(`${results.length} fichier(s) envoyé(s) avec succès`);
          onAllUploaded?.(results);
        }
      }

      setPending([]);
    },
    [uploadOne, onAllUploaded],
  );

  return (
    <div className={cn("space-y-2", className)}>
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files.length > 0) {
            void handleFiles(e.dataTransfer.files);
          }
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border px-6 py-10 text-center transition-colors",
          isDragging
            ? "border-primary-500 bg-primary-500/5"
            : "hover:border-primary-500/50 hover:bg-muted/30",
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400">
          <UploadCloud className="size-6" />
        </div>
        <p className="text-sm font-medium text-foreground">
          Glissez vos fichiers ici ou{" "}
          <span className="text-primary-600 dark:text-primary-400">
            parcourez
          </span>
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Pending files */}
      {pending.length > 0 && (
        <ul className="space-y-2">
          {pending.map((p) => (
            <li
              key={p.name}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
            >
              {p.error ? (
                <X className="size-4 text-destructive" />
              ) : (
                <Loader2 className="size-4 animate-spin text-primary-600 dark:text-primary-400" />
              )}
              <FileIcon className="size-4 text-muted-foreground" />
              <span className="flex-1 truncate text-sm">{p.name}</span>
              {p.error && (
                <span className="text-xs text-destructive">{p.error}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
