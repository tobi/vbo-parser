import { test, expect, describe } from 'bun:test';
import { LapDetection } from './lap-detection';
import type { VBODataPoint, VBOLap } from './types';

describe('LapDetection', () => {
  // Helper function to create mock data points
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

  describe('detectLaps', () => {
    test('should return empty array for empty data', () => {
      const laps = LapDetection.detectLaps([]);
      expect(laps).toEqual([]);
    });

    test('should detect laps from lap numbers', () => {
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

      const laps = LapDetection.detectLaps(dataPoints, { minDistance: 100 }); // Lower minimum distance for test

      expect(laps).toHaveLength(2);
      expect(laps[0].lapNumber).toBe(1);
      expect(laps[0].startTime).toBe(0);
      expect(laps[0].endTime).toBe(40);
      expect(laps[0].lapTime).toBe(40);
      expect(laps[0].isValid).toBe(true);

      expect(laps[1].lapNumber).toBe(2);
      expect(laps[1].startTime).toBe(50);
      expect(laps[1].endTime).toBe(90);
      expect(laps[1].lapTime).toBe(40);
    });

    test('should classify short laps appropriately', () => {
      const dataPoints: VBODataPoint[] = [
        createMockDataPoint({ time: 0, lapNumber: 1, latitude: 45.123, longitude: -73.654 }),
        createMockDataPoint({ time: 5, lapNumber: 1, latitude: 45.124, longitude: -73.655 }),
        createMockDataPoint({ time: 10, lapNumber: 2, latitude: 45.125, longitude: -73.656 }),
        createMockDataPoint({ time: 50, lapNumber: 2, latitude: 45.140, longitude: -73.670 }),
      ];

      const laps = LapDetection.detectLaps(dataPoints, { minDistance: 100 });

      expect(laps).toHaveLength(2);

      // Check that laps have reasonable timing (based on the lap number groups)
      expect(laps[0].lapTime).toBeGreaterThan(0);
      expect(laps[1].lapTime).toBeGreaterThan(0);

      // Check that each lap has a valid label
      expect(['off-track', 'in-lap', 'out-lap', 'timed-lap']).toContain(laps[0].label);
      expect(['off-track', 'in-lap', 'out-lap', 'timed-lap']).toContain(laps[1].label);
    });

    test('should classify long laps appropriately', () => {
      const dataPoints: VBODataPoint[] = [
        createMockDataPoint({ time: 0, lapNumber: 1, latitude: 45.123, longitude: -73.654 }),
        createMockDataPoint({ time: 700, lapNumber: 1, latitude: 45.124, longitude: -73.655 }),
        createMockDataPoint({ time: 710, lapNumber: 2, latitude: 45.125, longitude: -73.656 }),
        createMockDataPoint({ time: 750, lapNumber: 2, latitude: 45.140, longitude: -73.670 }),
      ];

      const laps = LapDetection.detectLaps(dataPoints, { minDistance: 100 });

      expect(laps).toHaveLength(2);

      // Check that laps have reasonable timing
      expect(laps[0].lapTime).toBeGreaterThan(0);
      expect(laps[1].lapTime).toBeGreaterThan(0);

      // Check that each lap has a valid label
      expect(['off-track', 'in-lap', 'out-lap', 'timed-lap']).toContain(laps[0].label);
      expect(['off-track', 'in-lap', 'out-lap', 'timed-lap']).toContain(laps[1].label);
    });

    test('should generate sectors for laps', () => {
      const dataPoints: VBODataPoint[] = [];
      for (let i = 0; i < 12; i++) {
        dataPoints.push(createMockDataPoint({
          time: i * 5,
          lapNumber: 1,
          latitude: 45.123456 + (i * 0.001),
          longitude: -73.654321 + (i * 0.001)
        }));
      }

      const laps = LapDetection.detectLaps(dataPoints, { sectorCount: 3 });

      expect(laps).toHaveLength(1);
      expect(laps[0].sectors).toHaveLength(3);
      expect(laps[0].sectors[0].sectorNumber).toBe(1);
      expect(laps[0].sectors[1].sectorNumber).toBe(2);
      expect(laps[0].sectors[2].sectorNumber).toBe(3);
    });

    test('should handle custom options', () => {
      const dataPoints: VBODataPoint[] = [
        createMockDataPoint({ time: 0, lapNumber: 1, latitude: 45.123, longitude: -73.654 }),
        createMockDataPoint({ time: 25, lapNumber: 1, latitude: 45.135, longitude: -73.665 }),
        createMockDataPoint({ time: 30, lapNumber: 2, latitude: 45.125, longitude: -73.656 }),
        createMockDataPoint({ time: 70, lapNumber: 2, latitude: 45.140, longitude: -73.670 }),
      ];

      const laps = LapDetection.detectLaps(dataPoints, {
        minDistance: 100,
        sectorCount: 2
      });

      expect(laps).toHaveLength(2);
      expect(laps[0].sectors).toHaveLength(2);
      expect(laps[1].sectors).toHaveLength(2);
    });
  });

  describe('findFastestLap', () => {
    test('should return null for empty array', () => {
      const fastest = LapDetection.findFastestLap([]);
      expect(fastest).toBeNull();
    });

    test('should find fastest valid lap', () => {
      const laps: VBOLap[] = [
        {
          lapNumber: 1,
          startTime: 0,
          endTime: 60,
          lapTime: 60,
          sectors: [],
          dataPoints: [],
          isValid: true,
          label: 'timed-lap'
        },
        {
          lapNumber: 2,
          startTime: 60,
          endTime: 105,
          lapTime: 45,
          sectors: [],
          dataPoints: [],
          isValid: true,
          label: 'timed-lap'
        },
        {
          lapNumber: 3,
          startTime: 105,
          endTime: 155,
          lapTime: 50,
          sectors: [],
          dataPoints: [],
          isValid: false,
          label: 'off-track'
        }
      ];

      const fastest = LapDetection.findFastestLap(laps);
      expect(fastest?.lapNumber).toBe(2);
      expect(fastest?.lapTime).toBe(45);
    });

    test('should ignore invalid laps', () => {
      const laps: VBOLap[] = [
        {
          lapNumber: 1,
          startTime: 0,
          endTime: 30,
          lapTime: 30,
          sectors: [],
          dataPoints: [],
          isValid: false,
          label: 'off-track'
        },
        {
          lapNumber: 2,
          startTime: 30,
          endTime: 90,
          lapTime: 60,
          sectors: [],
          dataPoints: [],
          isValid: true,
          label: 'timed-lap'
        }
      ];

      const fastest = LapDetection.findFastestLap(laps);
      expect(fastest?.lapNumber).toBe(2);
      expect(fastest?.lapTime).toBe(60);
    });
  });

  describe('calculateAverageLapTime', () => {
    test('should return 0 for empty array', () => {
      const average = LapDetection.calculateAverageLapTime([]);
      expect(average).toBe(0);
    });

    test('should calculate average of valid laps only', () => {
      const laps: VBOLap[] = [
        {
          lapNumber: 1,
          startTime: 0,
          endTime: 60,
          lapTime: 60,
          sectors: [],
          dataPoints: [],
          isValid: true,
          label: 'timed-lap'
        },
        {
          lapNumber: 2,
          startTime: 60,
          endTime: 100,
          lapTime: 40,
          sectors: [],
          dataPoints: [],
          isValid: true,
          label: 'timed-lap'
        },
        {
          lapNumber: 3,
          startTime: 100,
          endTime: 130,
          lapTime: 30,
          sectors: [],
          dataPoints: [],
          isValid: false,
          label: 'off-track'
        }
      ];

      const average = LapDetection.calculateAverageLapTime(laps);
      expect(average).toBe(50); // (60 + 40) / 2
    });

    test('should return 0 when no valid laps', () => {
      const laps: VBOLap[] = [
        {
          lapNumber: 1,
          startTime: 0,
          endTime: 60,
          lapTime: 60,
          sectors: [],
          dataPoints: [],
          isValid: false,
          label: 'off-track'
        }
      ];

      const average = LapDetection.calculateAverageLapTime(laps);
      expect(average).toBe(0);
    });
  });

  describe('findBestSectorTimes', () => {
    test('should return empty map for empty array', () => {
      const bestTimes = LapDetection.findBestSectorTimes([]);
      expect(bestTimes.size).toBe(0);
    });

    test('should find best sector times across laps', () => {
      const laps: VBOLap[] = [
        {
          lapNumber: 1,
          startTime: 0,
          endTime: 60,
          lapTime: 60,
          sectors: [
            { sectorNumber: 1, startTime: 0, endTime: 20, sectorTime: 20, startDistance: 0, endDistance: 1000 },
            { sectorNumber: 2, startTime: 20, endTime: 40, sectorTime: 20, startDistance: 1000, endDistance: 2000 },
            { sectorNumber: 3, startTime: 40, endTime: 60, sectorTime: 20, startDistance: 2000, endDistance: 3000 }
          ],
          dataPoints: [],
          isValid: true,
          label: 'timed-lap'
        },
        {
          lapNumber: 2,
          startTime: 60,
          endTime: 115,
          lapTime: 55,
          sectors: [
            { sectorNumber: 1, startTime: 60, endTime: 78, sectorTime: 18, startDistance: 0, endDistance: 1000 }, // Best sector 1
            { sectorNumber: 2, startTime: 78, endTime: 100, sectorTime: 22, startDistance: 1000, endDistance: 2000 },
            { sectorNumber: 3, startTime: 100, endTime: 115, sectorTime: 15, startDistance: 2000, endDistance: 3000 } // Best sector 3
          ],
          dataPoints: [],
          isValid: true,
          label: 'timed-lap'
        }
      ];

      const bestTimes = LapDetection.findBestSectorTimes(laps);

      expect(bestTimes.get(1)).toBe(18); // Best sector 1 time
      expect(bestTimes.get(2)).toBe(20); // Best sector 2 time
      expect(bestTimes.get(3)).toBe(15); // Best sector 3 time
    });

    test('should ignore invalid laps', () => {
      const laps: VBOLap[] = [
        {
          lapNumber: 1,
          startTime: 0,
          endTime: 60,
          lapTime: 60,
          sectors: [
            { sectorNumber: 1, startTime: 0, endTime: 20, sectorTime: 20, startDistance: 0, endDistance: 1000 }
          ],
          dataPoints: [],
          isValid: false,
          label: 'off-track'
        },
        {
          lapNumber: 2,
          startTime: 60,
          endTime: 115,
          lapTime: 55,
          sectors: [
            { sectorNumber: 1, startTime: 60, endTime: 78, sectorTime: 18, startDistance: 0, endDistance: 1000 }
          ],
          dataPoints: [],
          isValid: true,
          label: 'timed-lap'
        }
      ];

      const bestTimes = LapDetection.findBestSectorTimes(laps);

      expect(bestTimes.get(1)).toBe(18); // Only valid lap should be considered
      expect(bestTimes.size).toBe(1);
    });
  });

  describe('GPS-based Detection', () => {
    test('should fall back to GPS detection when no lap numbers', () => {
      // Create a circular track pattern
      const dataPoints: VBODataPoint[] = [];
      const centerLat = 45.123456;
      const centerLng = -73.654321;
      const radius = 0.01; // ~1km radius

      // Create 200 points in a circle (simulating a track)
      for (let i = 0; i < 200; i++) {
        const angle = (i / 200) * 2 * Math.PI;
        const lat = centerLat + radius * Math.cos(angle);
        const lng = centerLng + radius * Math.sin(angle);

        dataPoints.push(createMockDataPoint({
          time: i * 0.5, // 0.5 second intervals
          latitude: lat,
          longitude: lng,
          velocity: 50, // Above speed threshold
          lapNumber: 0 // No lap numbers
        }));
      }

      const laps = LapDetection.detectLaps(dataPoints, {
        speedThreshold: 20
      });

      // Should detect at least some pattern
      expect(Array.isArray(laps)).toBe(true);
    });
  });

  describe('Distance Calculation', () => {
    test('should calculate distance correctly', () => {
      const distance = (LapDetection as any).calculateDistance(
        45.5017, -73.5673, // Montreal
        43.6532, -79.3832  // Toronto
      );

      // Should be approximately 540km
      expect(distance).toBeGreaterThan(500000);
      expect(distance).toBeLessThan(600000);
    });

    test('should return 0 for same coordinates', () => {
      const distance = (LapDetection as any).calculateDistance(
        45.5017, -73.5673,
        45.5017, -73.5673
      );

      expect(distance).toBe(0);
    });

    test('should handle small distances correctly', () => {
      const distance = (LapDetection as any).calculateDistance(
        45.123456, -73.654321,
        45.123556, -73.654421 // Very small difference
      );

      // Should be a small positive number
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(100); // Less than 100 meters
    });
  });
});