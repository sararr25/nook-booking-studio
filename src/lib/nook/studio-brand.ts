export const STUDIO_NAME = "Stillroom Tattoo";

/** Read older demo settings without showing the former studio name to customers. */
export const currentStudioName = (name: string | null | undefined) =>
  name === "Ember & Thread" || !name ? STUDIO_NAME : name;
