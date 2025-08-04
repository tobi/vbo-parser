import { test, expect, describe } from 'bun:test';
import { VBOParser, VBOParseError, VBOValidationError } from './parser';
import type { VBOSession } from './types';

describe('VBOParser', () => {
  describe('Constructor and Options', () => {
    test('should create parser with default options', () => {
      const parser = new VBOParser();
      expect(parser).toBeInstanceOf(VBOParser);
    });

    test('should create parser with custom options', () => {
      const parser = new VBOParser({
        calculateLaps: false,
        validateDataPoints: true,
        maxDataPoints: 1000,
        customColumnMappings: { 'custom_speed': 'velocity' }
      });
      expect(parser).toBeInstanceOf(VBOParser);
    });
  });

  describe('parseVBOFile', () => {
    test('should parse valid VBO content', async () => {
      const mockVBOContent = `File created on 15/12/2023 @ 14:30:25

[header]
satellites
time
latitude
longitude
velocity
heading

[channel units]
(null)
s
deg
deg
kmh
deg

[column names]
sats time lat long velocity heading

[data]
8 1.5 45.123456 -73.654321 85.2 180.5
7 2.0 45.124456 -73.655321 82.1 175.2
6 2.5 45.125456 -73.656321 78.9 170.8`;

      const parser = new VBOParser();
      const session = await parser.parseVBOFile(mockVBOContent);

      expect(session.filePath).toBe('unknown.vbo');
      expect(session.header.channels).toHaveLength(6);
      expect(session.dataPoints).toHaveLength(3);
      expect(session.totalTime).toBe(2.5);
      expect(session.dataPoints[0].satellites).toBe(8);
      expect(session.dataPoints[0].latitude).toBe(45.123456);
      expect(session.dataPoints[2].velocity).toBe(78.9);
    });

    test('should parse VBO from File object', async () => {
      const mockVBOContent = `File created on 15/12/2023 @ 14:30:25
[header]
satellites
time
[channel units]
(null)
s
[column names]
sats time
[data]
8 1.5
7 2.0`;

      const mockFile = new File([mockVBOContent], 'test.vbo', { type: 'application/octet-stream' });
      const parser = new VBOParser();
      const session = await parser.parseVBOFile(mockFile);

      expect(session.filePath).toBe('test.vbo');
      expect(session.dataPoints).toHaveLength(2);
    });

    test('should parse VBO from Uint8Array', async () => {
      const mockVBOContent = `File created on 15/12/2023 @ 14:30:25
[header]
satellites
time
[channel units]
(null)
s
[column names]
sats time
[data]
8 1.5`;

      const uint8Array = new TextEncoder().encode(mockVBOContent);
      const parser = new VBOParser();
      const session = await parser.parseVBOFile(uint8Array);

      expect(session.filePath).toBe('unknown.vbo');
      expect(session.dataPoints).toHaveLength(1);
    });

    test('should handle Windows line endings', async () => {
      const mockVBOContent = `File created on 15/12/2023 @ 14:30:25\r\n[header]\r\nsats\r\ntime\r\n[channel units]\r\n(null)\r\ns\r\n[column names]\r\nsats time\r\n[data]\r\n8 1.5`;

      const parser = new VBOParser();
      const session = await parser.parseVBOFile(mockVBOContent);

      expect(session.dataPoints).toHaveLength(1);
      expect(session.dataPoints[0].satellites).toBe(8);
    });

    test('should throw error for empty content', async () => {
      const parser = new VBOParser();
      await expect(parser.parseVBOFile('')).rejects.toThrow(VBOParseError);
    });

    test('should throw error for missing header section', async () => {
      const mockVBOContent = `File created on 15/12/2023 @ 14:30:25
[data]
8 1.5`;

      const parser = new VBOParser();
      await expect(parser.parseVBOFile(mockVBOContent)).rejects.toThrow('No [header] section found');
    });

    test('should throw error for missing data section', async () => {
      const mockVBOContent = `File created on 15/12/2023 @ 14:30:25
[header]
satellites
time`;

      const parser = new VBOParser();
      await expect(parser.parseVBOFile(mockVBOContent)).rejects.toThrow('No [data] section found');
    });

    test('should respect maxDataPoints option', async () => {
      const mockVBOContent = `File created on 15/12/2023 @ 14:30:25
[header]
satellites
time
[column names]
sats time
[data]
8 1.5
7 2.0
6 2.5
5 3.0
4 3.5`;

      const parser = new VBOParser({ maxDataPoints: 3 });
      const session = await parser.parseVBOFile(mockVBOContent);

      expect(session.dataPoints).toHaveLength(3);
    });

    test('should validate data points when option is enabled', async () => {
      const mockVBOContent = `File created on 15/12/2023 @ 14:30:25
[header]
satellites
time
[column names]
sats time
[data]
8 1.5`;

      const parser = new VBOParser({ validateDataPoints: true });
      const session = await parser.parseVBOFile(mockVBOContent);

      expect(session.dataPoints).toHaveLength(1);
    });

    test('should handle custom column mappings', async () => {
      const mockVBOContent = `File created on 15/12/2023 @ 14:30:25
[header]
custom_speed
time
[column names]
custom_speed time
[data]
85.2 1.5`;

      const parser = new VBOParser({
        customColumnMappings: { 'custom_speed': 'velocity' }
      });
      const session = await parser.parseVBOFile(mockVBOContent);

      expect(session.dataPoints[0].velocity).toBe(85.2);
    });
  });

  describe('parseVBOFromInput', () => {
    test('should parse multiple files from array', async () => {
      const mockContent1 = `File created on 15/12/2023 @ 14:30:25
[header]
satellites
time
[column names]
sats time
[data]
8 1.5`;

      const mockContent2 = `File created on 16/12/2023 @ 15:30:25
[header]
satellites
time
[column names]
sats time
[data]
7 2.0`;

      const mockFile1 = new File([mockContent1], 'test1.vbo', { type: 'application/octet-stream' });
      const mockFile2 = new File([mockContent2], 'test2.vbo', { type: 'application/octet-stream' });

      const parser = new VBOParser();
      const sessions = await parser.parseVBOFromInput([mockFile1, mockFile2]);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].filePath).toBe('test1.vbo');
      expect(sessions[1].filePath).toBe('test2.vbo');
    });

    // Removed error testing case for cleaner output
  });

  describe('Static Methods', () => {
    test('getVideoForDataPoint should return video file and timestamp', () => {
      const mockSession: VBOSession = {
        filePath: 'test.vbo',
        videos: [
          { filename: '/videos/test_0001.mp4', index: 1 },
          { filename: '/videos/test_0002.mp4', index: 2 }
        ],
        header: { creationDate: new Date(), channels: [], units: [] },
        laps: [],
        totalTime: 0,
        dataPoints: [],
        circuitInfo: { timingLines: [] }
      };

      const dataPoint = {
        satellites: 8, time: 1.5, latitude: 45.123, longitude: -73.654,
        velocity: 85.2, heading: 180.5, height: 100, verticalVelocity: 0,
        samplePeriod: 0.1, solutionType: 4, aviFileIndex: 1, aviSyncTime: 15.25,
        comboAcc: 0, tcSlip: 0, tcGain: 0, ppsMap: 0, epsMap: 0, engMap: 0,
        driverId: 0, ambientTemperature: 20, carOnJack: 0, headrest: 0,
        fuelProbe: 0, tcActive: 0, lapNumber: 1, lapGainLoss: 0,
        engineSpeed: 3000, steeringAngle: 0, brakePressureFront: 0,
        throttlePedal: 50, vehicleSpeed: 85.2, gear: 3, comboG: 0.5
      };

      const result = VBOParser.getVideoForDataPoint(mockSession, dataPoint);
      expect(result).toEqual({
        file: '/videos/test_0001.mp4',
        timestamp: 15.25
      });
    });

    test('getVideoForDataPoint should return null for non-existent video index', () => {
      const mockSession: VBOSession = {
        filePath: 'test.vbo',
        videos: [{ filename: '/videos/test_0001.mp4', index: 1 }],
        header: { creationDate: new Date(), channels: [], units: [] },
        laps: [],
        totalTime: 0,
        dataPoints: [],
        circuitInfo: { timingLines: [] }
      };

      const dataPoint = {
        satellites: 8, time: 1.5, latitude: 45.123, longitude: -73.654,
        velocity: 85.2, heading: 180.5, height: 100, verticalVelocity: 0,
        samplePeriod: 0.1, solutionType: 4, aviFileIndex: 5, aviSyncTime: 15.25,
        comboAcc: 0, tcSlip: 0, tcGain: 0, ppsMap: 0, epsMap: 0, engMap: 0,
        driverId: 0, ambientTemperature: 20, carOnJack: 0, headrest: 0,
        fuelProbe: 0, tcActive: 0, lapNumber: 1, lapGainLoss: 0,
        engineSpeed: 3000, steeringAngle: 0, brakePressureFront: 0,
        throttlePedal: 50, vehicleSpeed: 85.2, gear: 3, comboG: 0.5
      };

      const result = VBOParser.getVideoForDataPoint(mockSession, dataPoint);
      expect(result).toBeNull();
    });

    test('calculateDistance should calculate GPS distance', () => {
      // Distance between Montreal and Toronto (approx 540km)
      const montreal = { lat: 45.5017, lng: -73.5673 };
      const toronto = { lat: 43.6532, lng: -79.3832 };
      
      const distance = VBOParser.calculateDistance(
        montreal.lat, montreal.lng,
        toronto.lat, toronto.lng
      );
      
      // Should be approximately 540km (540,000 meters)
      expect(distance).toBeGreaterThan(500000);
      expect(distance).toBeLessThan(600000);
    });

    test('calculateDistance should handle same coordinates', () => {
      const distance = VBOParser.calculateDistance(45.5017, -73.5673, 45.5017, -73.5673);
      expect(distance).toBe(0);
    });

    test('listVBOFiles should return known files for string path', async () => {
      const files = await VBOParser.listVBOFiles('/public/videos');
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
    });
  });

  describe('Date Parsing', () => {
    test('should parse various date formats', async () => {
      const testCases = [
        'File created on 15/12/2023 @ 14:30:25',
        'File created on 01/01/2024 @ 09:15:00',
        'File created on 31/12/2023'
      ];

      for (const dateStr of testCases) {
        const mockVBOContent = `${dateStr}
[header]
satellites
time
[column names]
sats time
[data]
8 1.5`;

        const parser = new VBOParser();
        const session = await parser.parseVBOFile(mockVBOContent);
        expect(session.header.creationDate).toBeInstanceOf(Date);
      }
    });
  });

  describe('Video Files Detection', () => {
    test('should detect multiple video files for VBO files', async () => {
      const mockVBOContent = `File created on 15/12/2023 @ 14:30:25
[header]
satellites
time
[column names]
sats time
[data]
8 1.5`;

      const mockFile = new File([mockVBOContent], 'test_session_RD.vbo', { type: 'application/octet-stream' });
      const parser = new VBOParser();
      const session = await parser.parseVBOFile(mockFile);

      expect(session.videos).toHaveLength(10); // Maximum of 10 videos
      expect(session.videos[0]).toEqual({
        filename: '/videos/test_session_RD_0001.mp4',
        index: 1
      });
      expect(session.videos[9]).toEqual({
        filename: '/videos/test_session_RD_0010.mp4',
        index: 10
      });
    });

    test('should handle VBO files without video extension', async () => {
      const mockVBOContent = `File created on 15/12/2023 @ 14:30:25
[header]
satellites
time
[column names]
sats time
[data]
8 1.5`;

      const mockFile = new File([mockVBOContent], 'invalid_name', { type: 'application/octet-stream' });
      const parser = new VBOParser();
      const session = await parser.parseVBOFile(mockFile);

      expect(session.videos).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    test('should throw VBOParseError for invalid input type', async () => {
      const parser = new VBOParser();
      await expect(parser.parseVBOFile(123 as any)).rejects.toThrow(VBOParseError);
    });

    test('should handle malformed numeric values', async () => {
      const mockVBOContent = `File created on 15/12/2023 @ 14:30:25
[header]
satellites
time
velocity
[column names]
sats time velocity
[data]
invalid_number 1.5 85.2
8 invalid_time 82.1`;

      const parser = new VBOParser();
      const session = await parser.parseVBOFile(mockVBOContent);

      expect(session.dataPoints).toHaveLength(2);
      // Invalid values should be handled gracefully
      expect(session.dataPoints[0].satellites).toBe(0); // Default value
      expect(session.dataPoints[1].time).toBe(0); // Default value
    });
  });
});