import React from "react";
import { useRouter } from "expo-router";
import MapPreview from "@/src/components/MapPreview";
import { mapsDisabled } from "@/src/feature-flags";

// Mini map for the shop details screen: shows the shop (highlighted) + nearby shops.
export default function StoreMapSection({ shop }: { shop: any }) {
  const router = useRouter();
  const center = { latitude: shop.latitude, longitude: shop.longitude };
  const data = [shop];

  return (
    <MapPreview
      shops={data}
      region={center}
      focusId={String(shop.id)}
      delta={0.012}
      onPress={() =>
        !mapsDisabled &&
        router.push({
          pathname: "/map",
          params: { lat: String(shop.latitude), lng: String(shop.longitude), focusId: String(shop.id) },
        })
      }
      testID="store-map-preview"
    />
  );
}
