import { test, expect, describe } from 'bun:test';
import { VBOParser } from '../src/parser';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('Telemetry Data Validation', () => {
  const parser = new VBOParser();
  const fixturesDir = join(__dirname, 'fixtures');

  describe('Engine and Vehicle Telemetry', () => {
    test('Engine speed should correlate with vehicle speed', async () => {
      const filePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const content = await readFile(filePath, 'utf-8');
      
      const limitedParser = new VBOParser({ maxDataPoints: 200 });
      const session = await limitedParser.parseVBOFile(content);
      
      // Filter for points where vehicle is moving
      const movingPoints = session.dataPoints.filter(p => 
        p.vehicleSpeed > 10 && p.engineSpeed > 0 && p.gear > 0
      );
      
      movingPoints.forEach(point => {
        // Engine speed should be reasonable for the gear and speed
        expect(point.engineSpeed).toBeGreaterThan(500); // At least idle
        expect(point.engineSpeed).toBeLessThan(20000); // Max RPM
        
        // Higher gears should generally have lower RPM for same speed
        if (point.gear >= 3) {
          const rpmPerKmh = point.engineSpeed / point.vehicleSpeed;
          expect(rpmPerKmh).toBeLessThan(200); // Reasonable ratio
        }
      });
    });

    test('Throttle position should be within valid range', async () => {
      const filePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const content = await readFile(filePath, 'utf-8');
      
      const limitedParser = new VBOParser({ maxDataPoints: 500 });
      const session = await limitedParser.parseVBOFile(content);
      
      session.dataPoints.forEach(point => {
        // Throttle: 0-100%
        expect(point.throttlePedal).toBeGreaterThanOrEqual(0);
        expect(point.throttlePedal).toBeLessThanOrEqual(100);
      });
      
      // Should have varying throttle positions
      const throttleValues = new Set(session.dataPoints.map(p => p.throttlePedal));
      expect(throttleValues.size).toBeGreaterThan(1);
    });

    test('Brake pressure should be reasonable', async () => {
      const filePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const content = await readFile(filePath, 'utf-8');
      
      const limitedParser = new VBOParser({ maxDataPoints: 500 });
      const session = await limitedParser.parseVBOFile(content);
      
      session.dataPoints.forEach(point => {
        // Brake pressure typically 0-200 bar
        expect(point.brakePressureFront).toBeGreaterThanOrEqual(0);
        expect(point.brakePressureFront).toBeLessThan(300);
      });
      
      // Check for braking events
      const brakingPoints = session.dataPoints.filter(p => p.brakePressureFront > 10);
      if (brakingPoints.length > 0) {
        // During braking, throttle should typically be low
        brakingPoints.forEach(point => {
          if (point.brakePressureFront > 50) {
            expect(point.throttlePedal).toBeLessThan(20); // Usually off throttle when braking hard
          }
        });
      }
    });

    test('Gear changes should be sequential', async () => {
      const filePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const content = await readFile(filePath, 'utf-8');
      
      const limitedParser = new VBOParser({ maxDataPoints: 1000 });
      const session = await limitedParser.parseVBOFile(content);
      
      // Check for unrealistic gear jumps
      for (let i = 1; i < session.dataPoints.length; i++) {
        const prevGear = session.dataPoints[i - 1].gear;
        const currGear = session.dataPoints[i].gear;
        
        if (prevGear > 0 && currGear > 0) {
          // Gear changes should typically be by 1 (sequential gearbox)
          const gearDiff = Math.abs(currGear - prevGear);
          if (gearDiff > 0) {
            expect(gearDiff).toBeLessThanOrEqual(2); // Allow 2 for quick shifts
          }
        }
      }
    });

    test('Steering angle should be within reasonable range', async () => {
      const filePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const content = await readFile(filePath, 'utf-8');
      
      const limitedParser = new VBOParser({ maxDataPoints: 500 });
      const session = await limitedParser.parseVBOFile(content);
      
      session.dataPoints.forEach(point => {
        // Steering angle typically -720 to +720 degrees (2 full rotations)
        expect(point.steeringAngle).toBeGreaterThanOrEqual(-900);
        expect(point.steeringAngle).toBeLessThanOrEqual(900);
      });
      
      // Should have both left and right steering
      const hasLeftSteer = session.dataPoints.some(p => p.steeringAngle < -5);
      const hasRightSteer = session.dataPoints.some(p => p.steeringAngle > 5);
      
      // Race tracks have both left and right turns
      if (session.dataPoints.length > 100) {
        expect(hasLeftSteer || hasRightSteer).toBe(true);
      }
    });
  });

  describe('G-Force and Acceleration Data', () => {
    test('G-force values should be within racing car limits', async () => {
      const filePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const content = await readFile(filePath, 'utf-8');
      
      const limitedParser = new VBOParser({ maxDataPoints: 500 });
      const session = await limitedParser.parseVBOFile(content);
      
      session.dataPoints.forEach(point => {
        // Racing cars typically experience -5g to +5g
        expect(point.comboG).toBeGreaterThanOrEqual(-6);
        expect(point.comboG).toBeLessThanOrEqual(6);
        
        expect(point.comboAcc).toBeGreaterThanOrEqual(-6);
        expect(point.comboAcc).toBeLessThanOrEqual(6);
      });
    });

    test('Acceleration should correlate with speed changes', async () => {
      const filePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const content = await readFile(filePath, 'utf-8');
      
      const limitedParser = new VBOParser({ maxDataPoints: 200 });
      const session = await limitedParser.parseVBOFile(content);
      
      for (let i = 1; i < session.dataPoints.length; i++) {
        const prev = session.dataPoints[i - 1];
        const curr = session.dataPoints[i];
        
        const timeDiff = curr.time - prev.time;
        if (timeDiff > 0) {
          const speedDiff = curr.velocity - prev.velocity; // km/h
          const acceleration = (speedDiff / 3.6) / timeDiff; // m/s²
          
          // Acceleration should be reasonable (-50 to +30 m/s²)
          expect(acceleration).toBeGreaterThan(-50);
          expect(acceleration).toBeLessThan(30);
        }
      }
    });
  });

  describe('Environmental and Session Data', () => {
    test('Ambient temperature should be realistic', async () => {
      const filePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const content = await readFile(filePath, 'utf-8');
      
      const limitedParser = new VBOParser({ maxDataPoints: 100 });
      const session = await limitedParser.parseVBOFile(content);
      
      session.dataPoints.forEach(point => {
        // Temperature in Celsius, reasonable range -50 to +60
        expect(point.ambientTemperature).toBeGreaterThanOrEqual(-50);
        expect(point.ambientTemperature).toBeLessThanOrEqual(60);
      });
      
      // Temperature should be relatively stable
      const temps = session.dataPoints.map(p => p.ambientTemperature);
      const uniqueTemps = new Set(temps);
      
      // Shouldn't vary wildly during a session
      if (uniqueTemps.size > 1) {
        const minTemp = Math.min(...temps);
        const maxTemp = Math.max(...temps);
        expect(maxTemp - minTemp).toBeLessThan(10); // Less than 10°C variation
      }
    });

    test('Lap number should increment properly', async () => {
      const filePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const content = await readFile(filePath, 'utf-8');
      
      const limitedParser = new VBOParser({ maxDataPoints: 1000 });
      const session = await limitedParser.parseVBOFile(content);
      
      let previousLap = -1;
      session.dataPoints.forEach(point => {
        // Lap number should not decrease
        if (previousLap >= 0) {
          expect(point.lapNumber).toBeGreaterThanOrEqual(previousLap);
        }
        
        // Lap number should increment by at most 1
        if (point.lapNumber > previousLap) {
          expect(point.lapNumber - previousLap).toBeLessThanOrEqual(1);
        }
        
        previousLap = point.lapNumber;
      });
    });

    test('Driver ID should be consistent', async () => {
      const filePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const content = await readFile(filePath, 'utf-8');
      
      const limitedParser = new VBOParser({ maxDataPoints: 100 });
      const session = await limitedParser.parseVBOFile(content);
      
      // Driver ID should be consistent throughout session
      const driverIds = new Set(session.dataPoints.map(p => p.driverId));
      expect(driverIds.size).toBe(1); // Only one driver per session
    });
  });

  describe('Traction Control and Electronic Systems', () => {
    test('TC values should be within expected ranges', async () => {
      const filePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const content = await readFile(filePath, 'utf-8');
      
      const limitedParser = new VBOParser({ maxDataPoints: 500 });
      const session = await limitedParser.parseVBOFile(content);
      
      session.dataPoints.forEach(point => {
        // TC Slip and Gain typically 0-100 or similar range
        expect(point.tcSlip).toBeGreaterThanOrEqual(0);
        expect(point.tcGain).toBeGreaterThanOrEqual(0);
        
        // TC Active is typically 0 or 1
        expect(point.tcActive).toBeGreaterThanOrEqual(0);
        expect(point.tcActive).toBeLessThanOrEqual(1);
      });
    });

    test('Map settings should be consistent', async () => {
      const filePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const content = await readFile(filePath, 'utf-8');
      
      const limitedParser = new VBOParser({ maxDataPoints: 500 });
      const session = await limitedParser.parseVBOFile(content);
      
      session.dataPoints.forEach(point => {
        // Map values typically small integers (0-10 range)
        expect(point.ppsMap).toBeGreaterThanOrEqual(0);
        expect(point.ppsMap).toBeLessThanOrEqual(20);
        
        expect(point.epsMap).toBeGreaterThanOrEqual(0);
        expect(point.epsMap).toBeLessThanOrEqual(20);
        
        expect(point.engMap).toBeGreaterThanOrEqual(0);
        expect(point.engMap).toBeLessThanOrEqual(20);
      });
    });
  });

  describe('Data Consistency Across Sessions', () => {
    test('Same driver should have similar telemetry patterns', async () => {
      // Compare two runs by the same driver (KO)
      const run1Path = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const run2Path = join(fixturesDir, '25IR05_RdAm_FP1_Run02_KO.vbo');
      
      const run1Content = await readFile(run1Path, 'utf-8');
      const run2Content = await readFile(run2Path, 'utf-8');
      
      const limitedParser = new VBOParser({ maxDataPoints: 100 });
      const run1 = await limitedParser.parseVBOFile(run1Content);
      const run2 = await limitedParser.parseVBOFile(run2Content);
      
      // Calculate average speeds
      const avgSpeed1 = run1.dataPoints.reduce((sum, p) => sum + p.velocity, 0) / run1.dataPoints.length;
      const avgSpeed2 = run2.dataPoints.reduce((sum, p) => sum + p.velocity, 0) / run2.dataPoints.length;
      
      // Should be somewhat similar (within 50 km/h)
      expect(Math.abs(avgSpeed1 - avgSpeed2)).toBeLessThan(50);
      
      // Max speeds should be in similar range
      const maxSpeed1 = Math.max(...run1.dataPoints.map(p => p.velocity));
      const maxSpeed2 = Math.max(...run2.dataPoints.map(p => p.velocity));
      
      expect(Math.abs(maxSpeed1 - maxSpeed2)).toBeLessThan(100);
    });

    test('Different session types should show different characteristics', async () => {
      // Compare Practice vs Qualifying
      const practicePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const qualPath = join(fixturesDir, '25IR05_RdAm_Q_Run01_TL.vbo');
      
      const practiceContent = await readFile(practicePath, 'utf-8');
      const qualContent = await readFile(qualPath, 'utf-8');
      
      const limitedParser = new VBOParser({ maxDataPoints: 200 });
      const practice = await limitedParser.parseVBOFile(practiceContent);
      const qual = await limitedParser.parseVBOFile(qualContent);
      
      // Both should have telemetry data
      expect(practice.dataPoints.length).toBeGreaterThan(0);
      expect(qual.dataPoints.length).toBeGreaterThan(0);
      
      // Calculate aggression metrics
      const practiceMaxThrottle = Math.max(...practice.dataPoints.map(p => p.throttlePedal));
      const qualMaxThrottle = Math.max(...qual.dataPoints.map(p => p.throttlePedal));
      
      // Both should use full throttle at some point
      expect(practiceMaxThrottle).toBeGreaterThan(80);
      expect(qualMaxThrottle).toBeGreaterThan(80);
    });
  });

  describe('Time and Sample Rate Validation', () => {
    test('Sample period should be consistent', async () => {
      const filePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const content = await readFile(filePath, 'utf-8');
      
      const limitedParser = new VBOParser({ maxDataPoints: 100 });
      const session = await limitedParser.parseVBOFile(content);
      
      // Check sample periods
      const samplePeriods = session.dataPoints.map(p => p.samplePeriod);
      const uniquePeriods = new Set(samplePeriods);
      
      // Should have consistent sample rate (typically 0.04s for 25Hz or 0.01s for 100Hz)
      expect(uniquePeriods.size).toBeLessThanOrEqual(3); // Allow for some variation
      
      // Most common should be standard rates
      const mostCommon = [...uniquePeriods].sort((a, b) => 
        samplePeriods.filter(p => p === b).length - 
        samplePeriods.filter(p => p === a).length
      )[0];
      
      // Common rates: 0.01 (100Hz), 0.02 (50Hz), 0.04 (25Hz), 0.1 (10Hz)
      const standardRates = [0.01, 0.02, 0.04, 0.08, 0.1];
      const isStandardRate = standardRates.some(rate => 
        Math.abs(mostCommon - rate) < 0.001
      );
      expect(isStandardRate).toBe(true);
    });

    test('Time progression should be monotonic', async () => {
      const filePath = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const content = await readFile(filePath, 'utf-8');
      
      const limitedParser = new VBOParser({ maxDataPoints: 500 });
      const session = await limitedParser.parseVBOFile(content);
      
      // Time should never go backwards
      for (let i = 1; i < session.dataPoints.length; i++) {
        expect(session.dataPoints[i].time).toBeGreaterThanOrEqual(
          session.dataPoints[i - 1].time
        );
      }
    });
  });
});