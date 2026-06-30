import React from "react";
import { useRouter } from "expo-router";
import MapPreview from "@/src/components/MapPreview";
import { useShops } from "@/src/useShops";
import { useI18n } from "@/src/i18n";

// Mini map for the shop details screen: shows the shop (highlighted) + nearby shops.
export default function StoreMapSection({ shop }: { shop: any }) {
  const router = useRouter();
  const { lang } = useI18n();
  const center = { latitude: shop.latitude, longitude: shop.longitude };
  const { shops } = useShops("all", { lang, center });

  // Ensure the focused shop is always present even if not in the nearby list.
  const data = shops.some((s) => String(s.id) === String(shop.id)) ? shops : [shop, ...shops];

  return (
    <MapPreview
      shops={data}
      region={center}
      focusId={String(shop.id)}
      onPress={() =>
        router.push({
          pathname: "/map",
          params: { lat: String(shop.latitude), lng: String(shop.longitude), focusId: String(shop.id) },
        })
      }
      testID="store-map-preview"
    />
  );
}
