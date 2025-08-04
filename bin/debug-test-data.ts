#!/usr/bin/env bun

import { LapDetection } from '../src';
import type { VBODataPoint } from '../src';

// Same mock function as in tests
const createMockDataPoint = (overrides: Partial<VBODataPoint> = {}): VBODataPoint => ({
  satellites: 8,
  time: 0,
  latitude: 45.123456,
  longitude: -73.654321,
  velocity: 80,
  heading: 180,
  height: 100,
  verticalVelocity: 0,
  samplePeriod: 0.04,
  solutionType: 2,
  aviFileIndex: 1,
  aviSyncTime: 0,
  comboAcc: 0,
  tcSlip: 0,
  tcGain: 0,
  ppsMap: 0,
  epsMap: 0,
  engMap: 0,
  driverId: 0,
  ambientTemperature: 20,
  carOnJack: 0,
  headrest: 0,
  fuelProbe: 0,
  tcActive: 0,
  lapNumber: 0,
  lapGainLoss: 0,
  engineSpeed: 3000,
  steeringAngle: 0,
  brakePressureFront: 0,
  throttlePedal: 50,
  vehicleSpeed: 80,
  gear: 3,
  comboG: 0,
  ...overrides
});

function debugTestData() {
  console.log('🧪 DEBUGGING TEST DATA');
  console.log('─'.repeat(50));

  // Test 1: Basic lap detection from the failing test
  const dataPoints: VBODataPoint[] = [
    createMockDataPoint({ time: 0, lapNumber: 1, latitude: 45.123, longitude: -73.654 }),
    createMockDataPoint({ time: 10, lapNumber: 1, latitude: 45.124, longitude: -73.655 }),
    createMockDataPoint({ time: 20, lapNumber: 1, latitude: 45.125, longitude: -73.656 }),
    createMockDataPoint({ time: 30, lapNumber: 1, latitude: 45.126, longitude: -73.657 }),
    createMockDataPoint({ time: 40, lapNumber: 1, latitude: 45.127, longitude: -73.658 }),
    createMockDataPoint({ time: 50, lapNumber: 2, latitude: 45.128, longitude: -73.659 }),
    createMockDataPoint({ time: 60, lapNumber: 2, latitude: 45.129, longitude: -73.660 }),
    createMockDataPoint({ time: 70, lapNumber: 2, latitude: 45.130, longitude: -73.661 }),
    createMockDataPoint({ time: 80, lapNumber: 2, latitude: 45.131, longitude: -73.662 }),
    createMockDataPoint({ time: 90, lapNumber: 2, latitude: 45.132, longitude: -73.663 }),
  ];

  const laps = LapDetection.detectLaps(dataPoints, { minDistance: 100 });

  console.log('📊 TEST DATA RESULTS:');
  console.log(`Total data points: ${dataPoints.length}`);
  console.log(`Speed range: ${Math.min(...dataPoints.map(p => p.velocity))}-${Math.max(...dataPoints.map(p => p.velocity))} km/h`);
  console.log(`Time range: ${Math.min(...dataPoints.map(p => p.time))}-${Math.max(...dataPoints.map(p => p.time))}s`);

  console.log('\n🏁 DETECTED LAPS:');
  console.log(`Lap count: ${laps.length}`);

  laps.forEach((lap, i) => {
    console.log(`Lap ${lap.lapNumber}:`);
    console.log(`  Start: ${lap.startTime}s`);
    console.log(`  End: ${lap.endTime}s`);
    console.log(`  Duration: ${lap.lapTime}s`);
    console.log(`  Valid: ${lap.isValid}`);
    console.log(`  Points: ${lap.dataPoints?.length || 0}`);
    console.log(`  Distance: ${lap.distance?.toFixed(0) || 'N/A'}m`);
    console.log();
  });

  console.log('❌ TEST EXPECTATIONS vs ACTUAL:');
  console.log('Expected: 2 laps');
  console.log(`Actual: ${laps.length} laps`);

  if (laps.length > 0) {
    console.log('\nLap 1:');
    console.log(`  Expected startTime: 0, Actual: ${laps[0]?.startTime}`);
    console.log(`  Expected endTime: 40, Actual: ${laps[0]?.endTime}`);
    console.log(`  Expected lapTime: 40, Actual: ${laps[0]?.lapTime}`);
  }

  if (laps.length > 1) {
    console.log('\nLap 2:');
    console.log(`  Expected startTime: 50, Actual: ${laps[1]?.startTime}`);
    console.log(`  Expected endTime: 90, Actual: ${laps[1]?.endTime}`);
    console.log(`  Expected lapTime: 40, Actual: ${laps[1]?.lapTime}`);
  }
}

function debugValidationTests() {
  console.log('\n🔍 DEBUGGING VALIDATION TESTS');
  console.log('─'.repeat(50));

  // Test: Too short lap
  console.log('\n1️⃣ TOO SHORT LAP TEST:');
  const shortLapData: VBODataPoint[] = [
    createMockDataPoint({ time: 0, lapNumber: 1, latitude: 45.123, longitude: -73.654 }),
    createMockDataPoint({ time: 5, lapNumber: 1, latitude: 45.124, longitude: -73.655 }), // 5 second lap - too short
    createMockDataPoint({ time: 10, lapNumber: 2, latitude: 45.125, longitude: -73.656 }),
    createMockDataPoint({ time: 50, lapNumber: 2, latitude: 45.140, longitude: -73.670 }), // 40 second lap - valid
  ];

  const shortLaps = LapDetection.detectLaps(shortLapData, { minLapTime: 30, minDistance: 100 });
  console.log(`Expected: 1 lap, Actual: ${shortLaps.length} laps`);
  shortLaps.forEach(lap => {
    console.log(`  Lap ${lap.lapNumber}: ${lap.startTime}s → ${lap.endTime}s (${lap.lapTime}s) Valid: ${lap.isValid}`);
  });

  // Test: Too long lap
  console.log('\n2️⃣ TOO LONG LAP TEST:');
  const longLapData: VBODataPoint[] = [
    createMockDataPoint({ time: 0, lapNumber: 1, latitude: 45.123, longitude: -73.654 }),
    createMockDataPoint({ time: 700, lapNumber: 1, latitude: 45.124, longitude: -73.655 }), // 700 second lap - too long
    createMockDataPoint({ time: 710, lapNumber: 2, latitude: 45.125, longitude: -73.656 }),
    createMockDataPoint({ time: 750, lapNumber: 2, latitude: 45.140, longitude: -73.670 }), // 40 second lap - valid
  ];

  const longLaps = LapDetection.detectLaps(longLapData, { maxLapTime: 600, minDistance: 100 });
  console.log(`Expected: 1 lap, Actual: ${longLaps.length} laps`);
  longLaps.forEach(lap => {
    console.log(`  Lap ${lap.lapNumber}: ${lap.startTime}s → ${lap.endTime}s (${lap.lapTime}s) Valid: ${lap.isValid}`);
  });
}

debugTestData();
debugValidationTests();