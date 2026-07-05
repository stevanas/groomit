import { storage } from "@/src/utils/storage";

const KEY = "pawfind_favorites";

export type FavShop = {
  id: string;
  place_id: string;
  name: string;
  address?: string;
  category?: string;
  tags?: string[];
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  image_url?: string | null;
  photo_name?: string | null;
  open_now?: boolean | null;
  schedule?: any[] | null;
  user_rating_count?: number | null;
};

export async function getFavorites(): Promise<FavShop[]> {
  const raw = await storage.getItem<string>(KEY, "[]");
  try {
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

export async function isFavorite(id: string): Promise<boolean> {
  const favs = await getFavorites();
  return favs.some((f) => f.place_id === id);
}

export async function toggleFavorite(shop: any): Promise<boolean> {
  const favs = await getFavorites();
  const exists = favs.some((f) => f.place_id === shop.id);
  let next: FavShop[];
  let result: boolean;
  if (exists) {
    next = favs.filter((f) => f.place_id !== shop.id);
    result = false;
  } else {
    next = [
      ...favs,
      {
        id: shop.id,
        place_id: shop.id,
        name: shop.name,
        address: shop.address,
        category: shop.category,
        tags: Array.isArray(shop.tags) ? shop.tags : [],
        latitude: typeof shop.latitude === "number" ? shop.latitude : null,
        longitude: typeof shop.longitude === "number" ? shop.longitude : null,
        rating: shop.rating,
        image_url: shop.image_url ?? null,
        photo_name: shop.image_url ? null : shop.photo_name ?? (shop.photos?.[0] ?? null),
        open_now: shop.open_now ?? null,
        schedule: shop.schedule ?? null,
        user_rating_count: shop.user_rating_count ?? null,
      },
    ];
    result = true;
  }
  await storage.setItem(KEY, JSON.stringify(next));
  return result;
}

export async function clearFavorites(): Promise<void> {
  await storage.setItem(KEY, "[]");
}
