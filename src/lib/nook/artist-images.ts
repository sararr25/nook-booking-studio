import ines from "@/assets/artist-ines.jpg";
import tove from "@/assets/artist-tove.jpg";
import rafa from "@/assets/artist-rafa.jpg";

const artistImages: Record<string, string> = { ines, tove, rafa };

export function artistImage(memberId: string): string | undefined {
  return artistImages[memberId];
}