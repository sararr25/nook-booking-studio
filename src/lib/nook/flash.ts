import { supabase } from "@/integrations/supabase/client";
import botanical from "@/assets/flash-botanical.jpg";
import moth from "@/assets/flash-moth.jpg";
import sun from "@/assets/flash-sun.jpg";
import swallow from "@/assets/flash-swallow.jpg";

const seedImages: Record<string, string> = {
  "seed:botanical": botanical,
  "seed:moth": moth,
  "seed:sun": sun,
  "seed:swallow": swallow,
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
