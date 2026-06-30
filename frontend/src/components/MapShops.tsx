import React, { useRef } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from "react-native-maps";
import { colors, getCat } from "@/src/theme";

// Hide Google's POI / transit / business clutter so only our pins stand out.
const MAP_STYLE = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.attraction", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

export default function MapShops({
  shops,
  region,
  focusId,
  onSelect,
  interactive = true,
}: {
  shops: any[];
  region?: { latitude: number; longitude: number };
  focusId?: string;
  onSelect?: (s: any) => void;
  interactive?: boolean;
}) {
  const mapRef = useRef<MapView>(null);
  const center = region || { latitude: 37.9838, longitude: 23.7275 };

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        showsPointsOfInterest={false}
        showsTraffic={false}
        showsBuildings={false}
        customMapStyle={MAP_STYLE}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        pitchEnabled={interactive}
        rotateEnabled={interactive}
        toolbarEnabled={false}
        testID="shops-map"
      >
        {shops
          .filter((s) => s.latitude && s.longitude)
          .map((s) => {
            const focused = focusId != null && String(s.id) === String(focusId);
            return (
              <Marker
                key={s.id}
                coordinate={{ latitude: s.latitude, longitude: s.longitude }}
                onPress={() => onSelect?.(s)}
                zIndex={focused ? 10 : 1}
              >
                <View style={[styles.pin, { backgroundColor: getCat(s.category).main }, focused && styles.pinFocused]}>
                  <Text style={styles.pinText}>{s.category === "groomer" ? "✂" : s.category === "both" ? "★" : "🏪"}</Text>
                </View>
              </Marker>
            );
          })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  pin: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  pinFocused: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderColor: colors.brand,
    borderWidth: 4,
  },
  pinText: { fontSize: 16 },
});
