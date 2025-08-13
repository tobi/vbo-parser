import { describe, it, expect, beforeEach } from 'vitest';
import { SessionComparison } from './session-comparison';
import type { VBOSession, VBOLap, VBODataPoint } from './types';

// Helper function to create mock data points
function createMockDataPoints(count: number, lapNumber: number = 1): VBODataPoint[] {
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
      velocity: 150 + Math.sin(angle) * 20, // Speed varies 130-170 km/h
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
      engineSpeed: 7000,
      steeringAngle: Math.sin(angle) * 45,
      brakePressureFront: Math.max(0, -Math.cos(angle)) * 100,
      throttlePedal: Math.max(0, Math.cos(angle)) * 100,
      vehicleSpeed: 150,
      gear: 4,
      comboG: 1.2
    });
  }

  return points;
}

// Helper function to create a mock lap
function createMockLap(lapNumber: number, pointCount: number = 100): VBOLap {
  const dataPoints = createMockDataPoints(pointCount, lapNumber);
  const startTime = dataPoints[0].time;
  const endTime = dataPoints[dataPoints.length - 1].time;

  return {
    lapNumber,
    startTime,
    endTime,
    lapTime: endTime - startTime,
    distance: 2000, // 2km lap
    sectors: [],
    dataPoints,
    isValid: true,
    label: 'timed-lap'
  };
}

// Helper function to create a mock session
function createMockSession(lapCount: number = 3, filePath: string = 'test.vbo'): VBOSession {
  const laps: VBOLap[] = [];
  const allDataPoints: VBODataPoint[] = [];

  for (let i = 0; i < lapCount; i++) {
    const lap = createMockLap(i + 1);
    laps.push(lap);
    allDataPoints.push(...lap.dataPoints);
  }

  return {
    filePath,
    videos: [],
    header: {
      creationDate: new Date(),
      channels: [],
      units: [],
      sampleRate: 10,
      driverId: 'test-driver',
      vehicle: 'test-car',
      version: '1.0'
    },
    laps,
    fastestLap: laps[0],
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

describe('SessionComparison', () => {
  let mainSession: VBOSession;
  let comparatorSession1: VBOSession;
  let comparatorSession2: VBOSession;

  beforeEach(() => {
    mainSession = createMockSession(3, 'main.vbo');
    comparatorSession1 = createMockSession(3, 'comparator1.vbo');
    comparatorSession2 = createMockSession(4, 'comparator2.vbo'); // Different lap count
  });

  describe('Initialization', () => {
    it('should create a comparison with main session only', () => {
      const comparison = new SessionComparison(mainSession);
      expect(comparison).toBeDefined();
      expect(comparison.getMainState()).toBeDefined();
      expect(comparison.getMainState().session).toBe(mainSession);
    });

    it('should create a comparison with multiple sessions', () => {
      const comparison = new SessionComparison(mainSession, [comparatorSession1, comparatorSession2]);
      expect(comparison).toBeDefined();
      expect(comparison.getAllComparatorStates()).toHaveLength(2);
    });

    it('should throw error for sessions without laps', () => {
      const emptySession = { ...mainSession, laps: [] };
      expect(() => new SessionComparison(emptySession)).toThrow('has no laps');
    });

    it('should throw error for laps without data points', () => {
      const sessionWithEmptyLap = {
        ...mainSession,
        laps: [{ ...mainSession.laps[0], dataPoints: [] }]
      };
      expect(() => new SessionComparison(sessionWithEmptyLap)).toThrow('has no data points');
    });

    it('should validate track compatibility by default', () => {
      const differentTrackSession = {
        ...comparatorSession1,
        circuitInfo: { ...comparatorSession1.circuitInfo, circuit: 'Monaco' }
      };
      
      expect(() => 
        new SessionComparison(mainSession, [differentTrackSession])
      ).toThrow('Cannot compare sessions from different tracks');
    });

    it('should allow different tracks with option', () => {
      const differentTrackSession = {
        ...comparatorSession1,
        circuitInfo: { ...comparatorSession1.circuitInfo, circuit: 'Monaco' }
      };
      
      const comparison = new SessionComparison(
        mainSession, 
        [differentTrackSession],
        { allowDifferentTracks: true }
      );
      expect(comparison).toBeDefined();
    });
  });

  describe('Position Tracking', () => {
    it('should track normalized position correctly', () => {
      const comparison = new SessionComparison(mainSession);
      const state = comparison.getMainState();

      expect(state.currentLapIndex).toBe(0);
      expect(state.currentDataPointIndex).toBe(0);
      expect(state.position.lapNumber).toBe(1);
      expect(state.position.lapProgress).toBeCloseTo(0, 2);
      expect(state.position.sessionProgress).toBeCloseTo(0, 2);
    });

    it('should calculate progress through session', () => {
      const comparison = new SessionComparison(mainSession);
      
      // Move to middle of first lap
      comparison.setMainPosition(0, 50);
      let state = comparison.getMainState();
      expect(state.position.lapProgress).toBeCloseTo(0.5, 1);
      
      // Move to second lap
      comparison.setMainPosition(1, 0);
      state = comparison.getMainState();
      expect(state.position.lapNumber).toBe(2);
      expect(state.position.sessionProgress).toBeGreaterThan(0.3);
    });

    it('should calculate normalized progress correctly', () => {
      const comparison = new SessionComparison(mainSession);
      
      // Move through the session
      comparison.setMainPosition(0, 50);
      const state1 = comparison.getMainState();
      
      comparison.setMainPosition(1, 50);
      const state2 = comparison.getMainState();
      
      // Second position should have more progress
      expect(state2.position.normalizedProgress).toBeGreaterThan(state1.position.normalizedProgress);
    });
  });

  describe('Navigation', () => {
    it('should advance main session forward', () => {
      const comparison = new SessionComparison(mainSession);
      
      comparison.advanceMain(10);
      const state = comparison.getMainState();
      expect(state.currentDataPointIndex).toBe(10);
    });

    it('should handle advancing past lap boundary', () => {
      const comparison = new SessionComparison(mainSession);
      
      // Move near end of first lap
      comparison.setMainPosition(0, 95);
      
      // Advance past lap boundary
      comparison.advanceMain(10);
      const state = comparison.getMainState();
      expect(state.currentLapIndex).toBe(1);
      expect(state.currentDataPointIndex).toBe(5); // Should wrap to lap 2 at position 5
    });

    it('should rewind main session backward', () => {
      const comparison = new SessionComparison(mainSession);
      
      comparison.setMainPosition(0, 20);
      comparison.rewindMain(10);
      const state = comparison.getMainState();
      expect(state.currentDataPointIndex).toBe(10);
    });

    it('should handle rewinding past lap boundary', () => {
      const comparison = new SessionComparison(mainSession);
      
      // Move to start of second lap
      comparison.setMainPosition(1, 5);
      
      // Rewind past lap boundary
      comparison.rewindMain(10);
      const state = comparison.getMainState();
      expect(state.currentLapIndex).toBe(0);
      expect(state.currentDataPointIndex).toBe(95); // Should wrap to lap 1
    });

    it('should jump to specific lap', () => {
      const comparison = new SessionComparison(mainSession);
      
      comparison.jumpToLap(2);
      const state = comparison.getMainState();
      expect(state.currentLapIndex).toBe(1); // Lap 2 is at index 1
      expect(state.position.lapNumber).toBe(2);
      expect(state.currentDataPointIndex).toBe(0);
    });

    it('should throw error for invalid lap number', () => {
      const comparison = new SessionComparison(mainSession);
      expect(() => comparison.jumpToLap(10)).toThrow('Lap 10 not found');
    });

    it('should reset to beginning', () => {
      const comparison = new SessionComparison(mainSession);
      
      comparison.setMainPosition(2, 50);
      comparison.reset();
      
      const state = comparison.getMainState();
      expect(state.currentLapIndex).toBe(0);
      expect(state.currentDataPointIndex).toBe(0);
    });
  });

  describe('Synchronization', () => {
    it('should sync comparator sessions to main position', () => {
      const comparison = new SessionComparison(mainSession, [comparatorSession1]);
      
      // Move main session
      comparison.setMainPosition(0, 50);
      
      // Check comparator is synced
      const comparatorState = comparison.getComparatorState(0);
      expect(comparatorState).toBeDefined();
      // Comparator should be at a similar position
      expect(comparatorState!.position.lapProgress).toBeCloseTo(
        comparison.getMainState().position.lapProgress,
        0 // Within 1 decimal place
      );
    });

    it('should find closest point in target session', () => {
      const comparison = new SessionComparison(mainSession, [comparatorSession1]);
      
      comparison.setMainPosition(0, 50);
      
      const closest = comparison.findClosestToSession(
        comparatorSession1,
        mainSession,
        50
      );
      
      expect(closest).toBeDefined();
      expect(closest!.position.lapProgress).toBeCloseTo(0.5, 0);
    });

    it('should handle sessions with different lap counts', () => {
      const comparison = new SessionComparison(
        mainSession, 
        [comparatorSession2] // Has 4 laps vs 3
      );
      
      // Move to last lap of main session
      comparison.jumpToLap(3);
      
      // Comparator should sync to appropriate position
      const comparatorState = comparison.getComparatorState(0);
      expect(comparatorState).toBeDefined();
    });

    it('should return synchronized data points', () => {
      const comparison = new SessionComparison(mainSession, [comparatorSession1, comparatorSession2]);
      
      comparison.setMainPosition(1, 25);
      
      const syncedPoints = comparison.getSynchronizedDataPoints();
      expect(syncedPoints.main).toBeDefined();
      expect(syncedPoints.comparators).toHaveLength(2);
      expect(syncedPoints.comparators[0]).toBeDefined();
      expect(syncedPoints.comparators[1]).toBeDefined();
    });
  });

  describe('Summary and Info', () => {
    it('should provide session summary', () => {
      const comparison = new SessionComparison(mainSession, [comparatorSession1]);
      
      comparison.setMainPosition(1, 50);
      
      const summary = comparison.getSummary();
      expect(summary.mainSession.filePath).toBe('main.vbo');
      expect(summary.mainSession.lapNumber).toBe(2);
      expect(summary.mainSession.progress).toBeGreaterThan(0);
      expect(summary.mainSession.speed).toBeGreaterThan(0);
      
      expect(summary.comparators).toHaveLength(1);
      expect(summary.comparators[0].filePath).toBe('comparator1.vbo');
      expect(summary.comparators[0].delta).toBeDefined();
    });

    it('should get lap counts', () => {
      const comparison = new SessionComparison(mainSession, [comparatorSession1, comparatorSession2]);
      
      expect(comparison.getMainLapCount()).toBe(3);
      expect(comparison.getComparatorLapCount(0)).toBe(3);
      expect(comparison.getComparatorLapCount(1)).toBe(4);
      expect(comparison.getComparatorLapCount(10)).toBe(0); // Invalid index
    });

    it('should handle invalid comparator index', () => {
      const comparison = new SessionComparison(mainSession, [comparatorSession1]);
      
      expect(comparison.getComparatorState(-1)).toBeUndefined();
      expect(comparison.getComparatorState(10)).toBeUndefined();
    });
  });

  describe('Progress-based Navigation', () => {
    it('should set and get main progress', () => {
      const comparison = new SessionComparison(mainSession);
      
      // Set to 50% progress
      comparison.setMainProgress(0.5);
      const progress = comparison.getMainProgress();
      expect(progress).toBeCloseTo(0.5, 2);
      
      // Check we're in the middle lap
      const state = comparison.getMainState();
      expect(state.currentLapIndex).toBe(1); // Second lap (0-indexed)
    });

    it('should handle edge progress values', () => {
      const comparison = new SessionComparison(mainSession);
      
      // Start of session
      comparison.setMainProgress(0);
      expect(comparison.getMainProgress()).toBe(0);
      
      // End of session
      comparison.setMainProgress(1);
      const endProgress = comparison.getMainProgress();
      // With 3 laps, the last position is at lap 3, point 99 of 100
      // This gives progress of (2 + 99/99) / 3 = 3/3 = 1
      expect(endProgress).toBeGreaterThan(0.99);
    });

    it('should throw on invalid progress values', () => {
      const comparison = new SessionComparison(mainSession);
      
      expect(() => comparison.setMainProgress(-0.1)).toThrow('Progress must be between 0 and 1');
      expect(() => comparison.setMainProgress(1.1)).toThrow('Progress must be between 0 and 1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single lap sessions', () => {
      const singleLapSession = createMockSession(1);
      const comparison = new SessionComparison(singleLapSession);
      
      expect(comparison.getMainLapCount()).toBe(1);
      comparison.advanceMain(200); // Try to go past the lap
      
      const state = comparison.getMainState();
      expect(state.currentLapIndex).toBe(0); // Should stay in lap 1
    });

    it('should handle very small progress tolerance', () => {
      const comparison = new SessionComparison(
        mainSession,
        [comparatorSession1],
        { progressTolerance: 0.001 } // Very tight tolerance
      );
      
      comparison.setMainPosition(0, 50);
      // With tight tolerance, syncing should still work
      const comparatorState = comparison.getComparatorState(0);
      expect(comparatorState).toBeDefined();
    });

    it('should handle sessions with no track length', () => {
      const sessionNoTrackLength = {
        ...mainSession,
        trackLength: undefined
      };
      
      const comparison = new SessionComparison(sessionNoTrackLength);
      expect(comparison).toBeDefined();
      
      // Should calculate normalized progress
      const state = comparison.getMainState();
      expect(state.position.normalizedProgress).toBeDefined();
    });

    it('should handle laps with no distance property', () => {
      const sessionNoLapDistance = {
        ...mainSession,
        laps: mainSession.laps.map(lap => ({
          ...lap,
          distance: 0 // No distance recorded
        }))
      };
      
      const comparison = new SessionComparison(sessionNoLapDistance);
      expect(comparison).toBeDefined();
      
      // Should calculate progress correctly
      comparison.setMainPosition(0, 50);
      const state = comparison.getMainState();
      expect(state.position.lapProgress).toBeCloseTo(0.5, 1);
    });
  });
});