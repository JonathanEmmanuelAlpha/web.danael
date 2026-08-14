import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { getCurrentDbUser, requireSession } from "./clerk";
import { fail } from "./api-response";
import { FILE_SIZE_LIMITS } from "./constants";

export interface UploadResult {
  key: string;
  url: string;
  name: string;
  size: number;
  contentType: string;
}

const f = createUploadthing();

export const ourFileRouter = {
  fileUploader: f({
    image: {
      /**
       * For full list of options and defaults, see the File Route API reference
       * @see https://docs.uploadthing.com/file-routes#route-config
       */
      maxFileSize: "2MB",
      maxFileCount: 1,
    },
    pdf: {
      maxFileCount: 1,
      maxFileSize: "32MB",
    },
    video: {
      maxFileCount: 1,
      maxFileSize: "256MB",
    },
  })
    .middleware(async ({ req }) => {
      const user = await requireSession();

      if (!user) throw new UploadThingError("Unauthorized");

      return { userId: user.clerkId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return {
        contentType: file.type,
        key: file.key,
        name: file.name,
        size: file.size,
        url: file.ufsUrl,
      } satisfies UploadResult;
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
