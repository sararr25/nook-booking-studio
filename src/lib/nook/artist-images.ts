import ines from "@/assets/artist-ines.jpg";
import tove from "@/assets/artist-tove.jpg";
import rafa from "@/assets/artist-rafa.jpg";

const artistImages: Record<string, string> = { ines, tove, rafa };

/** The owner's uploaded avatar wins; the seeded artists fall back to their bundled portraits. */
export function artistImage(member: { id: string; photo?: string }): string | undefined {
  return member.photo || artistImages[member.id];
}

/** Center-crops an image to a square and shrinks it so it fits comfortably in the studio config. */
export async function toAvatarDataUrl(file: File, size = 256): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't process images");
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
