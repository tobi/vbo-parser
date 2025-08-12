import { test, expect, describe } from 'bun:test';
import { VBOParser } from '../src/parser';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('Coordinate Conversion Tests', () => {
  const parser = new VBOParser();
  const fixturesDir = join(__dirname, 'fixtures');

  describe('NMEA to Decimal Degrees Conversion', () => {
    test('Should convert NMEA coordinates from fixture files', async () => {
      const filePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const content = await readFile(filePath, 'utf-8');
      
      // Parse a subset for performance
      const limitedParser = new VBOParser({ maxDataPoints: 10 });
      const session = await limitedParser.parseVBOFile(content);
      
      // All coordinates should be converted to decimal degrees
      session.dataPoints.forEach(point => {
        // Decimal degrees should be in valid GPS ranges
        expect(Math.abs(point.latitude)).toBeLessThanOrEqual(90);
        expect(Math.abs(point.longitude)).toBeLessThanOrEqual(180);
        
        // Should not be zero unless actually at 0,0
        if (point.satellites > 0) {
          expect(Math.abs(point.latitude) + Math.abs(point.longitude)).toBeGreaterThan(0);
        }
      });
    });

    test('Should handle different coordinate formats across files', async () => {
      const testFiles = [
        '25IR05_RdAm_FP1_Run01_KO.vbo',
        '25IT04_RdAm_PT2_Run01_RD.vbo',
        '25IR05_RdAm_Q_Run01_TL.vbo'
      ];
      
      for (const filename of testFiles) {
        const filePath = join(fixturesDir, filename);
        const content = await readFile(filePath, 'utf-8');
        
        const limitedParser = new VBOParser({ maxDataPoints: 5 });
        const session = await limitedParser.parseVBOFile(content);
        
        // Check first valid GPS point
        const validPoint = session.dataPoints.find(p => p.satellites > 0);
        if (validPoint) {
          expect(typeof validPoint.latitude).toBe('number');
          expect(typeof validPoint.longitude).toBe('number');
          expect(isNaN(validPoint.latitude)).toBe(false);
          expect(isNaN(validPoint.longitude)).toBe(false);
        }
      }
    });

    test('Should maintain coordinate precision', async () => {
      const filePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const content = await readFile(filePath, 'utf-8');
      
      const limitedParser = new VBOParser({ maxDataPoints: 10 });
      const session = await limitedParser.parseVBOFile(content);
      
      // Check that we have sufficient decimal places
      const firstValidPoint = session.dataPoints.find(p => p.satellites > 0);
      if (firstValidPoint) {
        const latStr = firstValidPoint.latitude.toString();
        const lonStr = firstValidPoint.longitude.toString();
        
        // Should have at least some decimal precision
        if (latStr.includes('.')) {
          const latDecimals = latStr.split('.')[1].length;
          expect(latDecimals).toBeGreaterThanOrEqual(1);
        }
        
        if (lonStr.includes('.')) {
          const lonDecimals = lonStr.split('.')[1].length;
          expect(lonDecimals).toBeGreaterThanOrEqual(1);
        }
      }
    });

    test('Should calculate reasonable distances between consecutive points', async () => {
      const filePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const content = await readFile(filePath, 'utf-8');
      
      const limitedParser = new VBOParser({ maxDataPoints: 100 });
      const session = await limitedParser.parseVBOFile(content);
      
      // Check distances between consecutive points
      for (let i = 1; i < Math.min(50, session.dataPoints.length); i++) {
        const prev = session.dataPoints[i - 1];
        const curr = session.dataPoints[i];
        
        if (prev.satellites > 0 && curr.satellites > 0) {
          const distance = VBOParser.calculateDistance(
            prev.latitude, prev.longitude,
            curr.latitude, curr.longitude
          );
          
          // Time difference
          const timeDiff = curr.time - prev.time;
          
          // Max speed in m/s (assuming max 400 km/h = ~111 m/s)
          const maxDistance = timeDiff * 111;
          
          // Distance should be reasonable for the time interval
          if (timeDiff > 0) {
            expect(distance).toBeLessThanOrEqual(maxDistance * 1.5); // Allow some margin
          }
        }
      }
    });
  });

  describe('Track Location Validation', () => {
    test('Rotterdam track coordinates should be in Netherlands region', async () => {
      // These are Rotterdam (RdAm) sessions
      const rotterdamFiles = [
        '25IR05_RdAm_FP1_Run01_KO.vbo',
        '25IR05_RdAm_FP2_Run01_TL.vbo',
        '25IR05_RdAm_Q_Run01_TL.vbo'
      ];
      
      for (const filename of rotterdamFiles) {
        const filePath = join(fixturesDir, filename);
        const content = await readFile(filePath, 'utf-8');
        
        const limitedParser = new VBOParser({ maxDataPoints: 10 });
        const session = await limitedParser.parseVBOFile(content);
        
        const validPoint = session.dataPoints.find(p => p.satellites > 0);
        if (validPoint) {
          // Rotterdam approximate coordinates: 51.9°N, 4.5°E
          // Allow for wide range as track might be anywhere in region
          // But coordinates should at least be in Europe
          expect(validPoint.latitude).toBeGreaterThan(20);  // North of Africa
          expect(validPoint.latitude).toBeLessThan(70);     // South of Arctic
          expect(validPoint.longitude).toBeGreaterThan(-20); // East of Atlantic
          expect(validPoint.longitude).toBeLessThan(40);    // West of Asia
        }
      }
    });

    test('Circuit timing lines should have valid GPS coordinates', async () => {
      const filePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const content = await readFile(filePath, 'utf-8');
      const session = await parser.parseVBOFile(content);
      
      if (session.circuitInfo.timingLines.length > 0) {
        session.circuitInfo.timingLines.forEach(line => {
          // Start/finish line coordinates
          expect(Math.abs(line.start.latitude)).toBeLessThanOrEqual(90);
          expect(Math.abs(line.start.longitude)).toBeLessThanOrEqual(180);
          expect(Math.abs(line.end.latitude)).toBeLessThanOrEqual(90);
          expect(Math.abs(line.end.longitude)).toBeLessThanOrEqual(180);
          
          // Start and end should be close (typical finish line width)
          const lineLength = VBOParser.calculateDistance(
            line.start.latitude, line.start.longitude,
            line.end.latitude, line.end.longitude
          );
          
          // Finish line typically 10-30 meters wide
          expect(lineLength).toBeGreaterThan(5);
          expect(lineLength).toBeLessThan(100);
        });
      }
    });
  });

  describe('Coordinate System Detection', () => {
    test('Should correctly identify coordinate system type', async () => {
      const testCases = [
        {
          filename: '25IR05_RdAm_FP1_Run01_KO.vbo',
          expectedRange: { latMin: 20, latMax: 70, lonMin: -20, lonMax: 60 }
        },
        {
          filename: '25IT04_RdAm_PT2_Run01_RD.vbo',
          expectedRange: { latMin: 20, latMax: 70, lonMin: -20, lonMax: 60 }
        }
      ];
      
      for (const testCase of testCases) {
        const filePath = join(fixturesDir, testCase.filename);
        const content = await readFile(filePath, 'utf-8');
        
        const limitedParser = new VBOParser({ maxDataPoints: 20 });
        const session = await limitedParser.parseVBOFile(content);
        
        const validPoints = session.dataPoints.filter(p => p.satellites > 0);
        if (validPoints.length > 0) {
          const avgLat = validPoints.reduce((sum, p) => sum + p.latitude, 0) / validPoints.length;
          const avgLon = validPoints.reduce((sum, p) => sum + p.longitude, 0) / validPoints.length;
          
          expect(avgLat).toBeGreaterThan(testCase.expectedRange.latMin);
          expect(avgLat).toBeLessThan(testCase.expectedRange.latMax);
          expect(avgLon).toBeGreaterThan(testCase.expectedRange.lonMin);
          expect(avgLon).toBeLessThan(testCase.expectedRange.lonMax);
        }
      }
    });

    test('Should handle edge cases in coordinate values', async () => {
      const filePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const content = await readFile(filePath, 'utf-8');
      
      const limitedParser = new VBOParser({ maxDataPoints: 100 });
      const session = await limitedParser.parseVBOFile(content);
      
      session.dataPoints.forEach(point => {
        // Check for NaN or Infinity
        expect(isNaN(point.latitude)).toBe(false);
        expect(isNaN(point.longitude)).toBe(false);
        expect(isFinite(point.latitude)).toBe(true);
        expect(isFinite(point.longitude)).toBe(true);
        
        // If no GPS fix, coordinates might be 0
        if (point.satellites === 0) {
          // Allow 0,0 for no GPS fix
          expect(point.latitude).toBeDefined();
          expect(point.longitude).toBeDefined();
        }
      });
    });
  });

  describe('Coordinate Trajectory Analysis', () => {
    test('Should show reasonable vehicle movement patterns', async () => {
      const filePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const content = await readFile(filePath, 'utf-8');
      
      const limitedParser = new VBOParser({ maxDataPoints: 200 });
      const session = await limitedParser.parseVBOFile(content);
      
      // Calculate total distance traveled
      let totalDistance = 0;
      let validSegments = 0;
      
      for (let i = 1; i < session.dataPoints.length; i++) {
        const prev = session.dataPoints[i - 1];
        const curr = session.dataPoints[i];
        
        if (prev.satellites >= 4 && curr.satellites >= 4) {
          const distance = VBOParser.calculateDistance(
            prev.latitude, prev.longitude,
            curr.latitude, curr.longitude
          );
          
          // Only count reasonable distances (filter out jumps)
          const timeDiff = curr.time - prev.time;
          const maxReasonableDistance = timeDiff * 150; // 150 m/s max
          
          if (distance <= maxReasonableDistance) {
            totalDistance += distance;
            validSegments++;
          }
        }
      }
      
      // Should have covered some distance
      if (validSegments > 10) {
        expect(totalDistance).toBeGreaterThan(0);
        
        // Average speed check
        const totalTime = session.dataPoints[session.dataPoints.length - 1].time;
        if (totalTime > 0) {
          const avgSpeed = totalDistance / totalTime; // m/s
          expect(avgSpeed).toBeGreaterThan(0);
          expect(avgSpeed).toBeLessThan(150); // Less than 540 km/h
        }
      }
    });

    test('Should maintain coordinate continuity', async () => {
      const filePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const content = await readFile(filePath, 'utf-8');
      
      const limitedParser = new VBOParser({ maxDataPoints: 100 });
      const session = await limitedParser.parseVBOFile(content);
      
      // Check for sudden jumps in coordinates
      let suddenJumps = 0;
      const jumpThreshold = 100; // meters
      
      for (let i = 1; i < session.dataPoints.length; i++) {
        const prev = session.dataPoints[i - 1];
        const curr = session.dataPoints[i];
        
        if (prev.satellites >= 4 && curr.satellites >= 4) {
          const distance = VBOParser.calculateDistance(
            prev.latitude, prev.longitude,
            curr.latitude, curr.longitude
          );
          
          const timeDiff = curr.time - prev.time;
          if (timeDiff > 0) {
            const speed = distance / timeDiff;
            // If speed > 200 m/s (720 km/h), it's likely a jump
            if (speed > 200) {
              suddenJumps++;
            }
          }
        }
      }
      
      // Should have minimal sudden jumps
      const jumpRatio = suddenJumps / session.dataPoints.length;
      expect(jumpRatio).toBeLessThan(0.05); // Less than 5% jumps
    });
  });
});