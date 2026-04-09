import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';

// Safely attempt to load the TFLite model
let useTensorflowModel = null;
let modelAsset = null;
try {
  const tflite = require('react-native-fast-tflite');
  useTensorflowModel = tflite.useTensorflowModel;
  modelAsset = require('../assets/models/hazards_int4.tflite');
} catch (e) {
  console.log('[VirtualBumper] TFLite model not found — running in simulation mode.');
}

/**
 * VirtualBumper Component
 * @param {Object} props
 * @param {Function} props.onHazardDetected - Callback when a hazard is detected
 * @param {Boolean} props.simulationMode - Enable manual hazard simulation
 */
export const VirtualBumper = ({ onHazardDetected, simulationMode = false }) => {
  const device = useCameraDevice('back');
  const modelReady = useTensorflowModel !== null && modelAsset !== null;

  // Only call the hook if the module loaded successfully
  const model = modelReady ? useTensorflowModel(modelAsset) : { state: 'idle', model: null };

  const [hazard, setHazard] = useState(false);

  // Frame Processor for Real-time Inference (Edge Computing)
  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (model.state === 'loaded' && !simulationMode) {
        try {
          const output = model.model.run([frame.toArrayBuffer()]);
          if (output && output.length > 0) {
            const hazardProb = output[0][0];
            const isHazard = hazardProb > 0.7;
            if (isHazard) {
              Worklets.runOnJS(onHazardDetected)(true);
              Worklets.runOnJS(setHazard)(true);
            } else {
              Worklets.runOnJS(onHazardDetected)(false);
              Worklets.runOnJS(setHazard)(false);
            }
          }
        } catch (e) {
          console.error('Edge Inference Error:', e);
        }
      }
    },
    [model, simulationMode]
  );

  const toggleSimulatedHazard = () => {
    const newState = !hazard;
    setHazard(newState);
    onHazardDetected(newState);
  };

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>📷 No Camera Device</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        frameProcessor={modelReady ? frameProcessor : undefined}
      />
      <View style={[styles.hud, hazard && styles.hazardAlert]}>
        <Text style={styles.hudText}>
          {!modelReady
            ? '⚠️ Simulation Mode (No Model)'
            : model.state !== 'loaded'
            ? '⏳ Loading Model...'
            : hazard
            ? '🚨 HAZARD DETECTED'
            : '✅ Scanning...'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 200,
    width: '100%',
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#333',
    backgroundColor: '#000',
  },
  hud: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 5,
    alignItems: 'center',
  },
  hazardAlert: {
    backgroundColor: 'rgba(255,0,0,0.8)',
  },
  hudText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  controls: {
    position: 'absolute',
    bottom: 10,
    width: '100%',
    alignItems: 'center',
  },
  btn: {
    backgroundColor: 'rgba(0,122,255,0.8)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  btnActive: {
    backgroundColor: '#ff3b30',
  },
  btnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  error: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8d7da',
  }
});
