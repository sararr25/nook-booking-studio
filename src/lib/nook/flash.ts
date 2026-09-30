import { supabase } from "@/integrations/supabase/client";
import botanical from "@/assets/flash-botanical.jpg";
import moth from "@/assets/flash-moth.jpg";
import sun from "@/assets/flash-sun.jpg";
import swallow from "@/assets/flash-swallow.jpg";
import staySoft from "@/assets/stillroom-flash/tatto1.png";
import orbit from "@/assets/stillroom-flash/tatto2.png";
import redFish from "@/assets/stillroom-flash/tatto3.png";
import breathe from "@/assets/stillroom-flash/tatto4.png";
import matches from "@/assets/stillroom-flash/tatto5.png";
import darkFlash from "@/assets/stillroom-flash/tatto6.png";
import moonMirror from "@/assets/stillroom-flash/tatto7.png";
import wildflowers from "@/assets/stillroom-flash/tatto8.png";
import koi from "@/assets/stillroom-flash/tatto9.png";
import frog from "@/assets/stillroom-flash/tatto10.png";

/** Studio artwork is offered to the owner first; a database row makes it bookable. */
export const studioFlashArtwork = [
  { image_path: "seed:stay-soft", title: "Stay soft", imageUrl: staySoft },
  { image_path: "seed:orbit", title: "Red orbit", imageUrl: orbit },
  { image_path: "seed:red-fish", title: "Red fish", imageUrl: redFish },
  { image_path: "seed:breathe", title: "Breathe", imageUrl: breathe },
  { image_path: "seed:matches", title: "A spark", imageUrl: matches },
  { image_path: "seed:dark-flash", title: "Dark flash", imageUrl: darkFlash },
  { image_path: "seed:moon-mirror", title: "Moon mirror", imageUrl: moonMirror },
  { image_path: "seed:wildflowers", title: "Wildflowers", imageUrl: wildflowers },
  { image_path: "seed:koi", title: "Koi & maple", imageUrl: koi },
  { image_path: "seed:frog", title: "Flower for you", imageUrl: frog },
] as const;

const seedImages: Record<string, string> = {
  "seed:botanical": botanical,
  "seed:moth": moth,
  "seed:sun": sun,
  "seed:swallow": swallow,
  ...Object.fromEntries(
    studioFlashArtwork.map((artwork) => [artwork.image_path, artwork.imageUrl]),
  ),
};

export type FlashDesign = {
  id: string;
  title: string;
  description: string;
  image_path: string;
  price: number;
  duration_minutes: number;
  available: boolean;
  imageUrl: string;
};

export async function loadFlashDesigns(): Promise<FlashDesign[]> {
  const { data, error } = await supabase
    .from("flash_designs")
    .select("id,title,description,image_path,price,duration_minutes,available")
    .order("created_at");
  if (error) throw error;
  return Promise.all(
    (data ?? []).map(async (design) => {
      const seedImage = seedImages[design.image_path];
      if (seedImage) return { ...design, imageUrl: seedImage };
      const { data: signed, error: signedError } = await supabase.storage
        .from("flash-gallery")
        .createSignedUrl(design.image_path, 3600);
      if (signedError || !signed) throw signedError ?? new Error("Could not load flash image");
      return { ...design, imageUrl: signed.signedUrl };
    }),
  );
}
