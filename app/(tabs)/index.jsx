import React, { useEffect, useState, useRef } from "react";
import { View, TextInput, StyleSheet, Dimensions, Text, TouchableOpacity, Alert } from "react-native";
import MapView, { Marker, Polyline, UrlTile } from "react-native-maps";
import * as Location from "expo-location";
import axios from "axios";
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import { VirtualBumper } from "../../components/VirtualBumper";

const { width, height } = Dimensions.get("window");

export default function HomeScreen() {
  const [location, setLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [search, setSearch] = useState("");
  const [routeCoords, setRouteCoords] = useState([]);
  const [distance, setDistance] = useState(null);
  const [instruction, setInstruction] = useState("");
  const [steps, setSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // New State for Integration
  const [hazardDetected, setHazardDetected] = useState(false);
  const [btConnected, setBtConnected] = useState(false);
  const [btDevice, setBtDevice] = useState(null);

  const mapRef = useRef(null);
  const locationWatcher = useRef(null);

  // Bluetooth & Telemetry Logic
  useEffect(() => {
    const connectBT = async () => {
      try {
        const paired = await RNBluetoothClassic.getPairedDevices();
        const device = paired.find(d => d.name === "NavVisor_ESP32");
        if (device) {
          const connected = await device.connect();
          if (connected) {
            setBtConnected(true);
            setBtDevice(device);
            console.log("Connected to ESP32");
          }
        }
      } catch (err) {
        console.log("BT Connection Error:", err);
      }
    };

    connectBT();
    
    // Telemetry Interval
    const telemetryTimer = setInterval(async () => {
      if (btConnected && btDevice) {
        try {
          const telemetryString = `DIST:${distance || 0};DIR:${instruction || 'N'};HAZ:${hazardDetected ? 1 : 0}\n`;
          await btDevice.write(telemetryString);
          console.log("Sent Telemetry:", telemetryString);
        } catch (err) {
          console.log("Telemetry Write Error:", err);
          setBtConnected(false); // Assume disconnected on failure
        }
      }
    }, 500);

    return () => {
      clearInterval(telemetryTimer);
      if (locationWatcher.current) {
        locationWatcher.current.remove();
      }
    };
  }, [btConnected, btDevice, distance, instruction, hazardDetected]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Permission denied");
        return;
      }

      const currentLoc = await Location.getCurrentPositionAsync({});
      setLocation(currentLoc.coords);

      locationWatcher.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          timeInterval: 2000,
          distanceInterval: 5,
        },
        (loc) => {
          const currentCoords = loc.coords;
          setLocation(currentCoords);

          if (destination) {
            getRoute(currentCoords, destination);
          }

          // Step tracking
          if (steps.length > 0) {
            const closestStep = findClosestStep(currentCoords, steps, currentStepIndex);
            if (closestStep.index !== currentStepIndex) {
              setCurrentStepIndex(closestStep.index);
              setInstruction(closestStep.step.maneuver.instruction);
            }
          }
        }
      );
    })();

    return () => {
      if (locationWatcher.current) {
        locationWatcher.current.remove();
      }
    };
  }, [destination, steps]);

  const handleSearch = async () => {
    if (!search.trim()) return;
    
    // Check for location to provide proximity bias
    let proximityParams = {};
    if (location) {
      const delta = 0.1; // roughly 10km
      proximityParams = {
        viewbox: `${location.longitude - delta},${location.latitude + delta},${location.longitude + delta},${location.latitude - delta}`,
        bounded: 1
      };
    }

    try {
      const response = await axios.get("https://nominatim.openstreetmap.org/search", {
        params: {
          q: search,
          format: 'json',
          addressdetails: 1,
          limit: 1,
          ...proximityParams
        },
        headers: {
          'User-Agent': 'NavVisor/1.0',
          'Accept-Language': 'en',
        },
      });

      if (response.data.length > 0) {
        const { lat, lon } = response.data[0];
        const dest = {
          latitude: parseFloat(lat),
          longitude: parseFloat(lon),
        };
        setDestination(dest);
        
        // Pan map to found location
        mapRef.current?.animateToRegion({
          ...dest,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);

        if (location) {
          getRoute(location, dest);
        }
      } else {
        Alert.alert("No Results", "Could not find that location. Try adding a city or state name.");
      }
    } catch (error) {
      console.error("Search error:", error);
      Alert.alert("Search Error", "Check your internet connection and try again.");
    }
  };

  const toggleManualHazard = () => {
    const newState = !hazardDetected;
    setHazardDetected(newState);
    Alert.alert("Hazard Simulation", newState ? "Manual Hazard TRIGGERED" : "Manual Hazard CLEARED");
  };

  const getRoute = async (start, end) => {
    try {
const res = await axios.get(
  `http://router.project-osrm.org/route/v1/foot/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson&steps=true`
);
      const route = res.data.routes[0];
      const coords = route.geometry.coordinates.map(([lng, lat]) => ({
        latitude: lat,
        longitude: lng,
      }));

      setRouteCoords(coords);
      setDistance((route.distance / 1000).toFixed(2)); // in km

      const stepsData = route.legs[0]?.steps || [];
      setSteps(stepsData);
      setCurrentStepIndex(0);
      
      if (stepsData.length > 0) {
        // Safely set the first instruction
        setInstruction(stepsData[0].maneuver.instruction || stepsData[0].maneuver.type);
      }
    } catch (err) {
      console.log("Routing error", err);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchBar}
        placeholder="Search location"
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={handleSearch}
      />

      <MapView
        ref={mapRef}
        style={styles.map}
        mapType="none"
        region={{
          latitude: location?.latitude || 22.5726,
          longitude: location?.longitude || 88.3639,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={!!location}
        followsUserLocation={!!location}
      >
        <UrlTile 
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
          shouldReplaceMapContent={true}
        />
        {destination && <Marker coordinate={destination} title="Destination" />}
        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeWidth={5} strokeColor="blue" />
        )}
      </MapView>

      {distance && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>🛣️ Distance: {distance} km</Text>
          <Text style={styles.infoText}>🧭 Direction: {instruction}</Text>
          <Text style={[styles.infoText, { color: btConnected ? 'green' : 'red' }]}>
            {btConnected ? "✅ Bluetooth Linked" : "❌ No ESP32 Link"}
          </Text>
        </View>
      )}

      {/* Real-time Virtual Bumper Overlay */}
      <View style={styles.bumperWrapper}>
        <VirtualBumper onHazardDetected={(h) => setHazardDetected(h)} />
      </View>

      {/* Manual Test Controls */}
      <TouchableOpacity style={styles.testBtn} onPress={toggleManualHazard}>
        <Text style={styles.testBtnText}>
          {hazardDetected ? "🛑 STOP TEST" : "⚡ TEST HAZARD"}
        </Text>
      </TouchableOpacity>

      {/* Bottom Hazard Bar */}
      <View style={[styles.hazardBar, hazardDetected && styles.hazardBarActive]}>
        <Text style={styles.hazardBarText}>
          {hazardDetected ? "⚠️ HAZARD DETECTED ⚠️" : "SAFE - MONITORING"}
        </Text>
      </View>
    </View>
  );
}

// ======== UTILS ========
function getDistance(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000; // in meters
}

function findClosestStep(currentCoords, steps, fromIndex = 0) {
  let closest = { index: fromIndex, step: steps[fromIndex], dist: Infinity };

  for (let i = fromIndex; i < steps.length; i++) {
    const { maneuver } = steps[i];
    const dist = getDistance(
      currentCoords.latitude,
      currentCoords.longitude,
      maneuver.location[1],
      maneuver.location[0]
    );
    if (dist < closest.dist && dist < 30) { // 30 meters threshold
      closest = { index: i, step: steps[i], dist };
    }
  }

  return closest;
}

// ======== STYLES ========
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    position: "absolute",
    top: 50,
    left: 10,
    right: 10,
    zIndex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    elevation: 5,
  },
  map: {
    width: width,
    height: height,
  },
  infoBox: {
    position: "absolute",
    bottom: 30,
    left: 10,
    right: 10,
    backgroundColor: "white",
    padding: 12,
    borderRadius: 10,
    elevation: 4,
  },
  infoText: {
    fontSize: 16,
    marginBottom: 4,
  },
  bumperWrapper: {
    position: 'absolute',
    bottom: 180,
    left: 10,
    right: 10,
    height: 150,
  },
  testBtn: {
    position: 'absolute',
    top: 110,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fff',
    zIndex: 2,
  },
  testBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  hazardBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 60,
    backgroundColor: '#34c759',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: '#222',
  },
  hazardBarActive: {
    backgroundColor: '#ff3b30',
  },
  hazardBarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  }
});