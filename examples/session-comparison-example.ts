import { VBOParser, SessionComparison } from '../src';
import type { VBOSession } from '../src/types';

/**
 * Example demonstrating how to use the SessionComparison class
 * to synchronize and compare multiple racing sessions
 */

async function compareSessionsExample() {
  console.log('🏁 Session Comparison Example\n');

  // Parse multiple VBO files
  const parser = new VBOParser();
  
  // In a real application, these would be actual VBO files
  // For this example, we'll assume we have three sessions loaded
  const mainSession: VBOSession = await parser.parseVBOFile('qualifying.vbo');
  const raceSession1: VBOSession = await parser.parseVBOFile('race1.vbo');
  const raceSession2: VBOSession = await parser.parseVBOFile('race2.vbo');

  // Create a SessionComparison instance
  const comparison = new SessionComparison(
    mainSession,
    [raceSession1, raceSession2],
    {
      positionTolerance: 15, // 15 meters tolerance for position matching
      allowDifferentTracks: false // Only compare sessions from the same track
    }
  );

  console.log('📊 Session Overview:');
  console.log(`Main session: ${mainSession.filePath}`);
  console.log(`  - Laps: ${comparison.getMainLapCount()}`);
  console.log(`  - Track: ${mainSession.circuitInfo?.circuit || 'Unknown'}\n`);

  console.log('Comparator sessions:');
  [raceSession1, raceSession2].forEach((session, index) => {
    console.log(`  ${index + 1}. ${session.filePath}`);
    console.log(`     - Laps: ${comparison.getComparatorLapCount(index)}`);
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
  
  syncedData.comparators.forEach((data, index) => {
    if (data) {
      console.log(`\nComparator ${index + 1} data:`);
      console.log(`  - Speed: ${data.velocity.toFixed(1)} km/h`);
      console.log(`  - Throttle: ${data.throttlePedal.toFixed(1)}%`);
      console.log(`  - Brake: ${data.brakePressureFront.toFixed(1)} bar`);
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
    console.log(`\nComparator ${index + 1}:`);
    console.log(`  - Current lap: ${comp.lapNumber}`);
    console.log(`  - Progress: ${(comp.progress * 100).toFixed(1)}%`);
    console.log(`  - Speed: ${comp.speed.toFixed(1)} km/h`);
    console.log(`  - Delta: ${comp.delta > 0 ? '+' : ''}${comp.delta.toFixed(3)}s`);
  });

  // Example 4: Find closest point in another session
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
    console.log(`Closest point in comparator session:`);
    console.log(`  - Lap: ${closest.position.lapNumber}`);
    console.log(`  - Data point index: ${closest.dataPointIndex}`);
    console.log(`  - Distance from start: ${closest.position.totalMeters.toFixed(1)}m`);
  }

  // Example 5: Synchronized playback simulation
  console.log('\n▶️ Synchronized Playback Simulation:');
  
  // Reset to beginning
  comparison.reset();
  
  // Simulate playback for 10 steps
  for (let i = 0; i < 10; i++) {
    comparison.advanceMain(10);
    const state = comparison.getMainState();
    const syncedPoints = comparison.getSynchronizedDataPoints();
    
    console.log(`Step ${i + 1}:`);
    console.log(`  Main: Lap ${state.position.lapNumber}, ` +
                `Speed: ${syncedPoints.main.velocity.toFixed(0)} km/h`);
    
    syncedPoints.comparators.forEach((point, idx) => {
      if (point) {
        console.log(`  Comp ${idx + 1}: Speed: ${point.velocity.toFixed(0)} km/h`);
      }
    });
  }
}

/**
 * Advanced example: Analyzing performance differences
 */
async function analyzePerformanceDifferences() {
  console.log('\n🔍 Performance Analysis Example\n');

  const parser = new VBOParser();
  
  // Load sessions
  const fastLap: VBOSession = await parser.parseVBOFile('fast_lap.vbo');
  const slowLap: VBOSession = await parser.parseVBOFile('slow_lap.vbo');

  // Create comparison
  const comparison = new SessionComparison(fastLap, [slowLap]);

  // Analyze corner entry speeds
  const cornerPositions = [25, 50, 75]; // Data point indices for corners
  
  console.log('Corner Entry Speed Comparison:');
  
  for (const position of cornerPositions) {
    comparison.setMainPosition(0, position);
    const syncedData = comparison.getSynchronizedDataPoints();
    
    const speedDiff = syncedData.main.velocity - (syncedData.comparators[0]?.velocity || 0);
    const brakeDiff = syncedData.main.brakePressureFront - (syncedData.comparators[0]?.brakePressureFront || 0);
    
    console.log(`\nCorner at position ${position}:`);
    console.log(`  Speed difference: ${speedDiff > 0 ? '+' : ''}${speedDiff.toFixed(1)} km/h`);
    console.log(`  Brake difference: ${brakeDiff > 0 ? '+' : ''}${brakeDiff.toFixed(1)} bar`);
    
    if (speedDiff > 10) {
      console.log('  💡 Fast lap carries more speed through corner');
    } else if (brakeDiff < -10) {
      console.log('  💡 Fast lap brakes later/lighter');
    }
  }
}

/**
 * Example: Creating a custom telemetry overlay
 */
function createTelemetryOverlay(comparison: SessionComparison) {
  console.log('\n📺 Telemetry Overlay Data\n');

  // Get current state
  const summary = comparison.getSummary();
  const syncedData = comparison.getSynchronizedDataPoints();

  // Format overlay data
  const overlayData = {
    main: {
      driver: 'Main Driver',
      lap: summary.mainSession.lapNumber,
      progress: (summary.mainSession.progress * 100).toFixed(1) + '%',
      speed: syncedData.main.velocity.toFixed(0) + ' km/h',
      gear: syncedData.main.gear,
      throttle: syncedData.main.throttlePedal.toFixed(0) + '%',
      brake: syncedData.main.brakePressureFront.toFixed(0) + ' bar',
      gForce: syncedData.main.comboG.toFixed(1) + 'G'
    },
    comparators: summary.comparators.map((comp, idx) => ({
      driver: `Driver ${idx + 2}`,
      lap: comp.lapNumber,
      delta: (comp.delta > 0 ? '+' : '') + comp.delta.toFixed(3) + 's',
      speed: comp.speed.toFixed(0) + ' km/h',
      gear: syncedData.comparators[idx]?.gear || 0,
      throttle: (syncedData.comparators[idx]?.throttlePedal || 0).toFixed(0) + '%',
      brake: (syncedData.comparators[idx]?.brakePressureFront || 0).toFixed(0) + ' bar'
    }))
  };

  console.log('Overlay Data:', JSON.stringify(overlayData, null, 2));
  
  return overlayData;
}

// Export examples for use in other files
export {
  compareSessionsExample,
  analyzePerformanceDifferences,
  createTelemetryOverlay
};

// Run examples if this file is executed directly
if (require.main === module) {
  compareSessionsExample()
    .then(() => analyzePerformanceDifferences())
    .catch(console.error);
}