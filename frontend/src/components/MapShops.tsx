import React, { useRef } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from "react-native-maps";
import { colors } from "@/src/theme";

export default function MapShops({
  shops,
  region,
  onSelect,
}: {
  shops: any[];
  region?: { latitude: number; longitude: number };
  onSelect: (s: any) => void;
}) {
  const mapRef = useRef<MapView>(null);
  const center = region || { latitude: 37.7849, longitude: -122.4094 };

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        testID="shops-map"
      >
        {shops
          .filter((s) => s.latitude && s.longitude)
          .map((s) => (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.latitude, longitude: s.longitude }}
              onPress={() => onSelect(s)}
            >
              <View style={[styles.pin, { backgroundColor: s.category === "groomer" ? colors.brand : colors.warning }]}>
                <Text style={styles.pinText}>{s.category === "groomer" ? "✂" : "🏪"}</Text>
              </View>
            </Marker>
          ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  pin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  pinText: { fontSize: 16 },
});
