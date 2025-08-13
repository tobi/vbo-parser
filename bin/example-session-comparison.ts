#!/usr/bin/env bun

import { SessionComparison } from '../src/session-comparison';
import type { VBOSession, VBOLap, VBODataPoint } from '../src/types';

/**
 * Example demonstrating how to use the SessionComparison class
 * to synchronize and compare multiple racing sessions
 */

// Helper function to create mock data points
function createMockDataPoints(count: number, lapNumber: number, speedVariation: number = 20): VBODataPoint[] {
  const points: VBODataPoint[] = [];
  const baseLatitude = 51.5074; // London coordinates
  const baseLongitude = -0.1278;

  for (let i = 0; i < count; i++) {
    // Create a circular track
    const angle = (i / count) * 2 * Math.PI;
    const radius = 0.01; // ~1km radius

    points.push({
      satellites: 10,
      time: i * 0.1, // 100ms intervals
      latitude: baseLatitude + radius * Math.cos(angle),
      longitude: baseLongitude + radius * Math.sin(angle),
      velocity: 150 + Math.sin(angle) * speedVariation, // Speed varies
      heading: (angle * 180) / Math.PI,
      height: 100,
      verticalVelocity: 0,
      samplePeriod: 0.1,
      solutionType: 1,
      aviFileIndex: 0,
      aviSyncTime: i * 0.1,
      comboAcc: 0,
      tcSlip: 0,
      tcGain: 0,
      ppsMap: 0,
      epsMap: 0,
      engMap: 0,
      driverId: 1,
      ambientTemperature: 20,
      carOnJack: 0,
      headrest: 0,
      fuelProbe: 50,
      tcActive: 0,
      lapNumber: lapNumber,
      lapGainLoss: 0,
      engineSpeed: 7000 + Math.sin(angle) * 1000,
      steeringAngle: Math.sin(angle) * 45,
      brakePressureFront: Math.max(0, -Math.cos(angle)) * 100,
      throttlePedal: Math.max(0, Math.cos(angle)) * 100,
      vehicleSpeed: 150,
      gear: Math.floor(4 + Math.sin(angle) * 2),
      comboG: 1.2 + Math.sin(angle) * 0.5
    });
  }

  return points;
}

// Helper function to create a mock lap
function createMockLap(lapNumber: number, lapTime: number, pointCount: number = 100): VBOLap {
  const dataPoints = createMockDataPoints(pointCount, lapNumber, 20 + lapNumber * 5);
  const startTime = (lapNumber - 1) * lapTime;
  const endTime = lapNumber * lapTime;

  // Update times in data points
  dataPoints.forEach((point, index) => {
    point.time = startTime + (index / pointCount) * lapTime;
  });

  return {
    lapNumber,
    startTime,
    endTime,
    lapTime,
    distance: 2000, // 2km lap
    sectors: [],
    dataPoints,
    isValid: true,
    label: 'timed-lap'
  };
}

// Helper function to create a mock session
function createMockSession(lapCount: number, avgLapTime: number, name: string): VBOSession {
  const laps: VBOLap[] = [];
  const allDataPoints: VBODataPoint[] = [];

  for (let i = 0; i < lapCount; i++) {
    // Add some variation to lap times
    const lapTimeVariation = (Math.random() - 0.5) * 5; // ±2.5 seconds
    const lap = createMockLap(i + 1, avgLapTime + lapTimeVariation);
    laps.push(lap);
    allDataPoints.push(...lap.dataPoints);
  }

  return {
    filePath: `${name}.vbo`,
    videos: [],
    header: {
      creationDate: new Date(),
      channels: [],
      units: [],
      sampleRate: 10,
      driverId: name,
      vehicle: 'Formula Car',
      version: '1.0'
    },
    laps,
    fastestLap: laps.reduce((fastest, lap) => 
      !fastest || lap.lapTime < fastest.lapTime ? lap : fastest
    ),
    totalTime: laps[laps.length - 1].endTime,
    trackLength: 2000,
    dataPoints: allDataPoints,
    circuitInfo: {
      country: 'UK',
      circuit: 'Silverstone',
      timingLines: []
    }
  };
}

async function compareSessionsExample() {
  console.log('🏁 Session Comparison Example\n');

  // Create mock sessions with different characteristics
  const mainSession = createMockSession(3, 90, 'qualifying');    // 3 laps, ~90s each
  const raceSession1 = createMockSession(3, 92, 'race1');       // Slightly slower
  const raceSession2 = createMockSession(4, 88, 'race2');       // 4 laps, faster

  // Create a SessionComparison instance
  const comparison = new SessionComparison(
    mainSession,
    [raceSession1, raceSession2],
    {
      progressTolerance: 0.01, // 1% of lap tolerance
      allowDifferentTracks: false // Only compare sessions from the same track
    }
  );

  console.log('📊 Session Overview:');
  console.log(`Main session: ${mainSession.filePath}`);
  console.log(`  - Laps: ${comparison.getMainLapCount()}`);
  console.log(`  - Track: ${mainSession.circuitInfo?.circuit || 'Unknown'}`);
  console.log(`  - Fastest lap: ${mainSession.fastestLap?.lapTime.toFixed(2)}s\n`);

  console.log('Comparator sessions:');
  [raceSession1, raceSession2].forEach((session, index) => {
    console.log(`  ${index + 1}. ${session.filePath}`);
    console.log(`     - Laps: ${comparison.getComparatorLapCount(index)}`);
    console.log(`     - Fastest lap: ${session.fastestLap?.lapTime.toFixed(2)}s`);
  });

  // Example 1: Navigate through the session
  console.log('\n🚗 Navigation Example:');
  
  // Jump to lap 2
  comparison.jumpToLap(2);
  let state = comparison.getMainState();
  console.log(`Jumped to Lap ${state.position.lapNumber}`);
  
  // Advance by 50 data points
  comparison.advanceMain(50);
  state = comparison.getMainState();
  console.log(`Advanced to position ${state.currentDataPointIndex} in lap ${state.position.lapNumber}`);
  console.log(`  - Lap progress: ${(state.position.lapProgress * 100).toFixed(1)}%`);
  console.log(`  - Session progress: ${(state.position.sessionProgress * 100).toFixed(1)}%`);

  // Example 2: Get synchronized data points
  console.log('\n📍 Synchronized Data Points:');
  const syncedData = comparison.getSynchronizedDataPoints();
  
  console.log('Main session data:');
  console.log(`  - Speed: ${syncedData.main.velocity.toFixed(1)} km/h`);
  console.log(`  - Throttle: ${syncedData.main.throttlePedal.toFixed(1)}%`);
  console.log(`  - Brake: ${syncedData.main.brakePressureFront.toFixed(1)} bar`);
  console.log(`  - G-Force: ${syncedData.main.comboG.toFixed(2)}G`);
  
  syncedData.comparators.forEach((data, index) => {
    if (data) {
      console.log(`\nComparator ${index + 1} data:`);
      console.log(`  - Speed: ${data.velocity.toFixed(1)} km/h`);
      console.log(`  - Throttle: ${data.throttlePedal.toFixed(1)}%`);
      console.log(`  - Brake: ${data.brakePressureFront.toFixed(1)} bar`);
      console.log(`  - G-Force: ${data.comboG.toFixed(2)}G`);
    }
  });

  // Example 3: Get comparison summary with time deltas
  console.log('\n⏱️ Comparison Summary:');
  const summary = comparison.getSummary();
  
  console.log('Main session:');
  console.log(`  - Current lap: ${summary.mainSession.lapNumber}`);
  console.log(`  - Progress: ${(summary.mainSession.progress * 100).toFixed(1)}%`);
  console.log(`  - Speed: ${summary.mainSession.speed.toFixed(1)} km/h`);
  
  summary.comparators.forEach((comp, index) => {
    console.log(`\nComparator ${index + 1} (${[raceSession1, raceSession2][index].filePath}):`);
    console.log(`  - Current lap: ${comp.lapNumber}`);
    console.log(`  - Progress: ${(comp.progress * 100).toFixed(1)}%`);
    console.log(`  - Speed: ${comp.speed.toFixed(1)} km/h`);
    console.log(`  - Delta: ${comp.delta > 0 ? '+' : ''}${comp.delta.toFixed(3)}s`);
  });

  // Example 4: Progress-based navigation
  console.log('\n📈 Progress-based Navigation:');
  
  // Jump to 25% through the session
  comparison.setMainProgress(0.25);
  console.log(`Set to 25% progress - Lap ${comparison.getMainState().position.lapNumber}, ` +
              `Point ${comparison.getMainState().currentDataPointIndex}`);
  
  // Jump to 75% through the session
  comparison.setMainProgress(0.75);
  console.log(`Set to 75% progress - Lap ${comparison.getMainState().position.lapNumber}, ` +
              `Point ${comparison.getMainState().currentDataPointIndex}`);

  // Example 5: Synchronized playback simulation
  console.log('\n▶️ Synchronized Playback Simulation:');
  
  // Reset to beginning
  comparison.reset();
  console.log('Reset to start of session\n');
  
  // Simulate playback for 5 steps
  for (let i = 0; i < 5; i++) {
    comparison.advanceMain(20);
    const state = comparison.getMainState();
    const syncedPoints = comparison.getSynchronizedDataPoints();
    
    console.log(`Step ${i + 1}: Progress ${(state.position.sessionProgress * 100).toFixed(1)}%`);
    console.log(`  Main: Lap ${state.position.lapNumber}, Speed: ${syncedPoints.main.velocity.toFixed(0)} km/h`);
    
    syncedPoints.comparators.forEach((point, idx) => {
      if (point) {
        const delta = point.time - syncedPoints.main.time;
        console.log(`  Comp ${idx + 1}: Speed: ${point.velocity.toFixed(0)} km/h, Delta: ${delta > 0 ? '+' : ''}${delta.toFixed(2)}s`);
      }
    });
  }

  // Example 6: Find closest matching position
  console.log('\n🎯 Finding Closest Points:');
  
  // Set main to a specific position
  comparison.setMainPosition(1, 75); // Lap 2, point 75
  
  // Find the closest point in the first comparator
  const closest = comparison.findClosestToSession(
    raceSession1,
    mainSession,
    75
  );
  
  if (closest) {
    console.log(`Found closest point in race1 session:`);
    console.log(`  - Lap: ${closest.position.lapNumber}`);
    console.log(`  - Data point index: ${closest.dataPointIndex}`);
    console.log(`  - Lap progress: ${(closest.position.lapProgress * 100).toFixed(1)}%`);
  }
}

/**
 * Advanced example: Analyzing performance differences
 */
function analyzePerformanceDifferences() {
  console.log('\n\n🔍 Performance Analysis Example\n');

  // Create sessions with different performance characteristics
  const fastSession = createMockSession(1, 85, 'fast_lap');    // Fast lap
  const slowSession = createMockSession(1, 95, 'slow_lap');    // Slower lap

  // Create comparison
  const comparison = new SessionComparison(fastSession, [slowSession]);

  // Analyze at different points through the lap
  const checkpoints = [0, 0.25, 0.5, 0.75, 1];
  
  console.log('Speed Comparison at Different Points:');
  console.log('Position | Fast Lap | Slow Lap | Difference');
  console.log('---------|----------|----------|------------');
  
  for (const checkpoint of checkpoints) {
    if (checkpoint === 1) {
      // Handle end position specially
      const lastLap = fastSession.laps[0];
      comparison.setMainPosition(0, lastLap.dataPoints.length - 1);
    } else {
      comparison.setMainProgress(checkpoint);
    }
    
    const syncedData = comparison.getSynchronizedDataPoints();
    const fastSpeed = syncedData.main.velocity;
    const slowSpeed = syncedData.comparators[0]?.velocity || 0;
    const speedDiff = fastSpeed - slowSpeed;
    
    console.log(`${(checkpoint * 100).toString().padStart(7)}% | ${fastSpeed.toFixed(1).padStart(8)} | ${slowSpeed.toFixed(1).padStart(8)} | ${speedDiff > 0 ? '+' : ''}${speedDiff.toFixed(1)}`);
  }

  // Analyze braking and throttle
  console.log('\n\nBraking and Throttle Analysis:');
  
  // Check corner entry (typically high braking)
  comparison.setMainProgress(0.24); // Just before 25% - corner entry
  let syncedData = comparison.getSynchronizedDataPoints();
  
  console.log('Corner Entry (24% through lap):');
  console.log(`  Fast lap - Brake: ${syncedData.main.brakePressureFront.toFixed(1)} bar, Throttle: ${syncedData.main.throttlePedal.toFixed(1)}%`);
  console.log(`  Slow lap - Brake: ${syncedData.comparators[0]?.brakePressureFront.toFixed(1)} bar, Throttle: ${syncedData.comparators[0]?.throttlePedal.toFixed(1)}%`);
  
  // Check corner exit (typically high throttle)
  comparison.setMainProgress(0.26); // Just after 25% - corner exit
  syncedData = comparison.getSynchronizedDataPoints();
  
  console.log('\nCorner Exit (26% through lap):');
  console.log(`  Fast lap - Brake: ${syncedData.main.brakePressureFront.toFixed(1)} bar, Throttle: ${syncedData.main.throttlePedal.toFixed(1)}%`);
  console.log(`  Slow lap - Brake: ${syncedData.comparators[0]?.brakePressureFront.toFixed(1)} bar, Throttle: ${syncedData.comparators[0]?.throttlePedal.toFixed(1)}%`);
}

// Run examples
console.log('═'.repeat(60));
console.log('  VBO Parser - Session Comparison Examples');
console.log('═'.repeat(60));

compareSessionsExample()
  .then(() => analyzePerformanceDifferences())
  .then(() => {
    console.log('\n' + '═'.repeat(60));
    console.log('  Examples completed successfully!');
    console.log('═'.repeat(60));
  })
  .catch(console.error);