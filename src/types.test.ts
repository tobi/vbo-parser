import { test, expect, describe } from 'bun:test';
import { z } from 'zod';
import {
  VBOChannelSchema,
  VBOHeaderSchema,
  VBODataPointSchema,
  VBOSectorSchema,
  VBOLapSchema,
  VBOSessionSchema,
  VBOParseError,
  VBOValidationError,
  type VBOChannel,
  type VBOHeader,
  type VBODataPoint,
  type VBOSector,
  type VBOLap,
  type VBOSession
} from './types';

describe('VBO Schemas', () => {
  describe('VBOChannelSchema', () => {
    test('should validate correct channel data', () => {
      const validChannel = {
        name: 'velocity',
        unit: 'kmh',
        index: 0
      };

      const result = VBOChannelSchema.safeParse(validChannel);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('velocity');
        expect(result.data.unit).toBe('kmh');
        expect(result.data.index).toBe(0);
      }
    });

    test('should reject invalid channel data', () => {
      const invalidChannel = {
        name: 123, // Should be string
        unit: 'kmh',
        index: 0
      };

      const result = VBOChannelSchema.safeParse(invalidChannel);
      expect(result.success).toBe(false);
    });

    test('should require all fields', () => {
      const incompleteChannel = {
        name: 'velocity'
        // Missing unit and index
      };

      const result = VBOChannelSchema.safeParse(incompleteChannel);
      expect(result.success).toBe(false);
    });
  });

  describe('VBOHeaderSchema', () => {
    test('should validate correct header data', () => {
      const validHeader = {
        creationDate: new Date('2023-12-15T14:30:25'),
        channels: [
          { name: 'velocity', unit: 'kmh', index: 0 },
          { name: 'time', unit: 's', index: 1 }
        ],
        units: ['kmh', 's']
      };

      const result = VBOHeaderSchema.safeParse(validHeader);
      expect(result.success).toBe(true);
    });

    test('should allow optional fields', () => {
      const headerWithOptionals = {
        creationDate: new Date('2023-12-15T14:30:25'),
        channels: [{ name: 'velocity', unit: 'kmh', index: 0 }],
        units: ['kmh'],
        sampleRate: 25,
        driverId: 'RD',
        vehicle: 'Formula Car',
        version: '1.0'
      };

      const result = VBOHeaderSchema.safeParse(headerWithOptionals);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sampleRate).toBe(25);
        expect(result.data.driverId).toBe('RD');
        expect(result.data.vehicle).toBe('Formula Car');
        expect(result.data.version).toBe('1.0');
      }
    });

    test('should reject invalid date', () => {
      const invalidHeader = {
        creationDate: 'not-a-date',
        channels: [],
        units: []
      };

      const result = VBOHeaderSchema.safeParse(invalidHeader);
      expect(result.success).toBe(false);
    });
  });

  describe('VBODataPointSchema', () => {
    test('should validate complete data point', () => {
      const validDataPoint = {
        satellites: 8,
        time: 1.5,
        latitude: 45.123456,
        longitude: -73.654321,
        velocity: 85.2,
        heading: 180.5,
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
        lapNumber: 1,
        lapGainLoss: 0,
        engineSpeed: 3000,
        steeringAngle: -5.6,
        brakePressureFront: 1.03,
        throttlePedal: 60.6,
        vehicleSpeed: 61.4,
        gear: 3,
        comboG: 0.5
      };

      const result = VBODataPointSchema.safeParse(validDataPoint);
      expect(result.success).toBe(true);
    });

    test('should reject missing required fields', () => {
      const incompleteDataPoint = {
        satellites: 8,
        time: 1.5
        // Missing many required fields
      };

      const result = VBODataPointSchema.safeParse(incompleteDataPoint);
      expect(result.success).toBe(false);
    });

    test('should reject invalid types', () => {
      const invalidDataPoint = {
        satellites: '8', // Should be number
        time: 1.5,
        latitude: 45.123456,
        longitude: -73.654321,
        velocity: 85.2,
        heading: 180.5,
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
        lapNumber: 1,
        lapGainLoss: 0,
        engineSpeed: 3000,
        steeringAngle: -5.6,
        brakePressureFront: 1.03,
        throttlePedal: 60.6,
        vehicleSpeed: 61.4,
        gear: 3,
        comboG: 0.5
      };

      const result = VBODataPointSchema.safeParse(invalidDataPoint);
      expect(result.success).toBe(false);
    });
  });

  describe('VBOSectorSchema', () => {
    test('should validate correct sector data', () => {
      const validSector = {
        sectorNumber: 1,
        startTime: 0,
        endTime: 20,
        sectorTime: 20,
        startDistance: 0,
        endDistance: 1000
      };

      const result = VBOSectorSchema.safeParse(validSector);
      expect(result.success).toBe(true);
    });

    test('should allow negative values for times and distances', () => {
      const sectorWithNegatives = {
        sectorNumber: 1,
        startTime: -1,
        endTime: 20,
        sectorTime: 21,
        startDistance: -100,
        endDistance: 1000
      };

      const result = VBOSectorSchema.safeParse(sectorWithNegatives);
      expect(result.success).toBe(true);
    });
  });

  describe('VBOLapSchema', () => {
    test('should validate complete lap data', () => {
      const validLap = {
        lapNumber: 1,
        startTime: 0,
        endTime: 60,
        lapTime: 60,
        distance: 1000,
        sectors: [
          {
            sectorNumber: 1,
            startTime: 0,
            endTime: 20,
            sectorTime: 20,
            startDistance: 0,
            endDistance: 1000
          }
        ],
        dataPoints: [
          {
            satellites: 8,
            time: 1.5,
            latitude: 45.123456,
            longitude: -73.654321,
            velocity: 85.2,
            heading: 180.5,
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
            lapNumber: 1,
            lapGainLoss: 0,
            engineSpeed: 3000,
            steeringAngle: -5.6,
            brakePressureFront: 1.03,
            throttlePedal: 60.6,
            vehicleSpeed: 61.4,
            gear: 3,
            comboG: 0.5
          }
        ],
        isValid: true,
        label: 'timed-lap'
      };

      const result = VBOLapSchema.safeParse(validLap);
      expect(result.success).toBe(true);
    });

    test('should allow optional fastestSector field', () => {
      const lapWithFastestSector = {
        lapNumber: 1,
        startTime: 0,
        endTime: 60,
        lapTime: 60,
        distance: 1000,
        sectors: [],
        dataPoints: [],
        isValid: true,
        fastestSector: 2,
        label: 'timed-lap'
      };

      const result = VBOLapSchema.safeParse(lapWithFastestSector);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fastestSector).toBe(2);
      }
    });
  });

  describe('VBOSessionSchema', () => {
    test('should validate complete session data', () => {
      const validSession = {
        filePath: 'test.vbo',
        videos: [],
        header: {
          creationDate: new Date('2023-12-15T14:30:25'),
          channels: [{ name: 'velocity', unit: 'kmh', index: 0 }],
          units: ['kmh']
        },
        laps: [],
        totalTime: 120,
        dataPoints: [],
        circuitInfo: {
          timingLines: []
        }
      };

      const result = VBOSessionSchema.safeParse(validSession);
      expect(result.success).toBe(true);
    });

    test('should allow optional fields', () => {
      const sessionWithOptionals = {
        filePath: 'test.vbo',
        videos: [{ filename: '/videos/test_0001.mp4', index: 1 }],
        header: {
          creationDate: new Date('2023-12-15T14:30:25'),
          channels: [{ name: 'velocity', unit: 'kmh', index: 0 }],
          units: ['kmh']
        },
        laps: [],
        fastestLap: {
          lapNumber: 1,
          startTime: 0,
          endTime: 60,
          lapTime: 60,
          distance: 1000,
          sectors: [],
          dataPoints: [],
          isValid: true,
          label: 'timed-lap'
        },
        totalTime: 120,
        trackLength: 3000,
        dataPoints: [],
        circuitInfo: {
          country: 'United States',
          circuit: 'Test Circuit',
          timingLines: [{
            type: 'Start',
            start: { latitude: 1000, longitude: 2000 },
            end: { latitude: 1001, longitude: 2001 },
            name: 'StartFinish'
          }]
        }
      };

      const result = VBOSessionSchema.safeParse(sessionWithOptionals);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.videos).toHaveLength(1);
        expect(result.data.videos[0].filename).toBe('/videos/test_0001.mp4');
        expect(result.data.videos[0].index).toBe(1);
        expect(result.data.trackLength).toBe(3000);
        expect(result.data.fastestLap?.lapNumber).toBe(1);
      }
    });
  });
});

describe('Error Classes', () => {
  describe('VBOParseError', () => {
    test('should create error with message', () => {
      const error = new VBOParseError('Test error message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(VBOParseError);
      expect(error.name).toBe('VBOParseError');
      expect(error.message).toBe('Test error message');
      expect(error.cause).toBeUndefined();
    });

    test('should create error with message and cause', () => {
      const originalError = new Error('Original error');
      const error = new VBOParseError('Test error message', originalError);

      expect(error.message).toBe('Test error message');
      expect(error.cause).toBe(originalError);
    });
  });

  describe('VBOValidationError', () => {
    test('should create validation error with zod error', () => {
      // Create a mock Zod error
      const invalidData = { satellites: 'invalid' };
      const parseResult = VBODataPointSchema.safeParse(invalidData);

      if (!parseResult.success) {
        const error = new VBOValidationError('Validation failed', parseResult.error);

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(VBOParseError);
        expect(error).toBeInstanceOf(VBOValidationError);
        expect(error.name).toBe('VBOValidationError');
        expect(error.message).toBe('Validation failed');
        expect(error.validationErrors).toBe(parseResult.error);
      } else {
        throw new Error('Expected parsing to fail');
      }
    });
  });
});

describe('Type Inference', () => {
  test('should infer correct types from schemas', () => {
    // Test that TypeScript types are correctly inferred
    const channel: VBOChannel = {
      name: 'velocity',
      unit: 'kmh',
      index: 0
    };

    const header: VBOHeader = {
      creationDate: new Date(),
      channels: [channel],
      units: ['kmh']
    };

    const dataPoint: VBODataPoint = {
      satellites: 8,
      time: 1.5,
      latitude: 45.123456,
      longitude: -73.654321,
      velocity: 85.2,
      heading: 180.5,
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
      lapNumber: 1,
      lapGainLoss: 0,
      engineSpeed: 3000,
      steeringAngle: -5.6,
      brakePressureFront: 1.03,
      throttlePedal: 60.6,
      vehicleSpeed: 61.4,
      gear: 3,
      comboG: 0.5
    };

    const sector: VBOSector = {
      sectorNumber: 1,
      startTime: 0,
      endTime: 20,
      sectorTime: 20,
      startDistance: 0,
      endDistance: 1000
    };

    const lap: VBOLap = {
      lapNumber: 1,
      startTime: 0,
      endTime: 60,
      lapTime: 60,
      sectors: [sector],
      dataPoints: [dataPoint],
      isValid: true
    };

    const session: VBOSession = {
      filePath: 'test.vbo',
      header,
      laps: [lap],
      totalTime: 120,
      dataPoints: [dataPoint]
    };

    // If this compiles without errors, the types are correctly inferred
    expect(channel.name).toBe('velocity');
    expect(header.channels).toHaveLength(1);
    expect(dataPoint.satellites).toBe(8);
    expect(sector.sectorNumber).toBe(1);
    expect(lap.lapNumber).toBe(1);
    expect(session.filePath).toBe('test.vbo');
  });
});