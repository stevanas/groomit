import { storage } from "@/src/utils/storage";

const KEY = "pawfind_favorites";

export type FavShop = {
  id: string;
  place_id: string;
  name: string;
  address?: string;
  category?: string;
  rating?: number | null;
  image_url?: string | null;
  photo_name?: string | null;
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
        rating: shop.rating,
        image_url: shop.image_url ?? null,
        photo_name: shop.image_url ? null : shop.photo_name ?? (shop.photos?.[0] ?? null),
      },
    ];
    result = true;
  }
  await storage.setItem(KEY, JSON.stringify(next));
  return result;
}
