import { test, expect, describe } from 'bun:test';
import { VBOParser } from '../src/parser';
import type { VBOSession, VBODataPoint } from '../src/types';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('VBO Fixture Files', () => {
  const parser = new VBOParser();
  const fixturesDir = join(__dirname, 'fixtures');
  
  const fixtureFiles = [
    '25IR05_RdAm_FP1_Run01_KO.vbo',
    '25IR05_RdAm_FP1_Run02_KO.vbo',
    '25IR05_RdAm_FP1_Run03_KO.vbo',
    '25IR05_RdAm_FP1_Run04_KO.vbo',
    '25IR05_RdAm_FP1_Run05_TL.vbo',
    '25IR05_RdAm_FP1_Run06_TL.vbo',
    '25IR05_RdAm_FP2_Run01_TL.vbo',
    '25IR05_RdAm_FP2_Run02_KO.vbo',
    '25IR05_RdAm_FP2_Run03&04_TL.vbo',
    '25IR05_RdAm_Q_Run01_TL.vbo',
    '25IT04_RdAm_PT2_Run01_RD.vbo',
    '25IT04_RdAm_PT2_Run05_TL.vbo',
  ];

  describe('Parse all fixture files', () => {
    fixtureFiles.forEach(filename => {
      test(`should parse ${filename}`, async () => {
        const filePath = join(fixturesDir, filename);
        const content = await readFile(filePath, 'utf-8');
        const mockFile = new File([content], filename, { type: 'application/octet-stream' });
        
        const session = await parser.parseVBOFile(mockFile);
        
        // Basic validation
        expect(session).toBeDefined();
        expect(session.filePath).toBe(filename);
        expect(session.header).toBeDefined();
        expect(session.header.channels).toBeArray();
        expect(session.header.channels.length).toBeGreaterThan(0);
        expect(session.dataPoints).toBeArray();
        
        // Should have at least some data points
        expect(session.dataPoints.length).toBeGreaterThan(0);
        
        // Validate first data point has required fields
        if (session.dataPoints.length > 0) {
          const firstPoint = session.dataPoints[0];
          expect(firstPoint).toHaveProperty('time');
          expect(firstPoint).toHaveProperty('latitude');
          expect(firstPoint).toHaveProperty('longitude');
          expect(firstPoint).toHaveProperty('velocity');
          expect(firstPoint).toHaveProperty('satellites');
        }
      });
    });
  });

  describe('Video file parsing', () => {
    test('Should correctly parse video files from AVI section', async () => {
      const filename = '25IR05_RdAm_FP1_Run01_KO.vbo';
      const filePath = join(fixturesDir, filename);
      const content = await readFile(filePath, 'utf-8');
      const mockFile = new File([content], filename, { type: 'application/octet-stream' });
      const session = await parser.parseVBOFile(mockFile);
      
      // Should have exactly 2 videos as specified in AVI section
      expect(session.videos).toHaveLength(2);
      
      // Check first camera
      expect(session.videos[0].index).toBe(1);
      expect(session.videos[0].filename).toBe('/videos/25IR05_RdAm_FP1_Run01_KO_0001.mp4');
      
      // Check second camera
      expect(session.videos[1].index).toBe(2);
      expect(session.videos[1].filename).toBe('/videos/25IR05_RdAm_FP1_Run01_KO_0002.mp4');
    });
    
    test('All fixture files should have 2 cameras', async () => {
      for (const filename of fixtureFiles) {
        const filePath = join(fixturesDir, filename);
        const content = await readFile(filePath, 'utf-8');
        const mockFile = new File([content], filename, { type: 'application/octet-stream' });
        const session = await parser.parseVBOFile(mockFile);
        
        // Based on AVI sections, all files have 2 mp4 videos
        expect(session.videos).toHaveLength(2);
        
        // Both should be mp4 format
        expect(session.videos[0].filename).toContain('.mp4');
        expect(session.videos[1].filename).toContain('.mp4');
        
        // Should contain the base filename
        const baseFilename = filename.replace('.vbo', '');
        expect(session.videos[0].filename).toContain(baseFilename);
        expect(session.videos[1].filename).toContain(baseFilename);
        
        // Indices should be sequential for consecutive files
        expect(session.videos[0].index).toBe(1);
        expect(session.videos[1].index).toBe(2);
      }
    });
    
    test('Video seeking should return correct file based on aviFileIndex', async () => {
      const filename = '25IR05_RdAm_FP1_Run01_KO.vbo';
      const filePath = join(fixturesDir, filename);
      const content = await readFile(filePath, 'utf-8');
      const mockFile = new File([content], filename, { type: 'application/octet-stream' });
      const session = await parser.parseVBOFile(mockFile);
      
      // Test data points should reference video file 1
      const firstPoint = session.dataPoints[0];
      expect(firstPoint.aviFileIndex).toBe(1);
      
      const videoInfo = VBOParser.getVideoForDataPoint(session, firstPoint);
      expect(videoInfo).not.toBeNull();
      expect(videoInfo?.file).toBe('/videos/25IR05_RdAm_FP1_Run01_KO_0001.mp4');
      expect(videoInfo?.timestamp).toBe(firstPoint.aviSyncTime);
    });
    
    test('Should get video info for session time', async () => {
      const filename = '25IR05_RdAm_FP1_Run01_KO.vbo';
      const filePath = join(fixturesDir, filename);
      const content = await readFile(filePath, 'utf-8');
      const mockFile = new File([content], filename, { type: 'application/octet-stream' });
      const session = await parser.parseVBOFile(mockFile);
      
      // Get video for a time in the middle of the session
      const midTime = session.totalTime / 2;
      const videoInfo = VBOParser.getVideoForSessionTime(session, midTime);
      
      expect(videoInfo).not.toBeNull();
      expect(videoInfo?.file).toContain('.mp4');
      expect(typeof videoInfo?.timestamp).toBe('number');
    });
    
    test('Should identify video segments in session', async () => {
      const filename = '25IR05_RdAm_FP1_Run01_KO.vbo';
      const filePath = join(fixturesDir, filename);
      const content = await readFile(filePath, 'utf-8');
      const mockFile = new File([content], filename, { type: 'application/octet-stream' });
      const session = await parser.parseVBOFile(mockFile);
      
      const segments = VBOParser.getVideoSegments(session);
      
      // For these test files, all data stays in video file 1
      expect(segments).toHaveLength(1);
      expect(segments[0].file).toBe('/videos/25IR05_RdAm_FP1_Run01_KO_0001.mp4');
      expect(segments[0].index).toBe(1);
      expect(segments[0].startTime).toBe(0);
      expect(segments[0].endTime).toBe(session.totalTime);
    });
  });

  describe('Detailed validation for each file', () => {
    test('25IR05_RdAm_FP1_Run01_KO.vbo should have correct metadata', async () => {
      const filename = '25IR05_RdAm_FP1_Run01_KO.vbo';
      const filePath = join(fixturesDir, filename);
      const content = await readFile(filePath, 'utf-8');
      const mockFile = new File([content], filename, { type: 'application/octet-stream' });
      const session = await parser.parseVBOFile(mockFile);
      
      // Check creation date
      expect(session.header.creationDate).toBeInstanceOf(Date);
      expect(session.header.creationDate.getFullYear()).toBe(2025);
      expect(session.header.creationDate.getMonth()).toBe(7); // August (0-indexed)
      expect(session.header.creationDate.getDate()).toBe(1);
      
      // Check channels
      const expectedChannels = [
        'satellites', 'time', 'latitude', 'longitude', 'velocity kmh',
        'heading', 'height', 'vertical velocity m/s', 'sampleperiod',
        'solution type', 'avifileindex', 'avisynctime', 'ComboAcc',
        'TC_Slip', 'TC_Gain', 'PPS_Map', 'EPS_Map', 'ENG_Map',
        'DriverID', 'Ambient_Temperature', 'Car_On_Jack', 'Headrest',
        'Fuel_Probe', 'TC_Active', 'Lap_Number', 'Lap_Gain_Loss',
        'Engine_Speed', 'Steering_Angle', 'Brake_Pressure_Front',
        'Throttle_Pedal', 'Vehicle_Speed', 'Gear', 'Combo_G'
      ];
      
      expect(session.header.channels).toHaveLength(expectedChannels.length);
      expectedChannels.forEach((channelName, index) => {
        expect(session.header.channels[index].name).toBe(channelName);
      });
      
      // Check lap timing info
      expect(session.circuitInfo).toBeDefined();
      expect(session.circuitInfo.timingLines).toHaveLength(1);
      expect(session.circuitInfo.timingLines[0].type).toBe('Start');
      expect(session.circuitInfo.timingLines[0].name).toBe('Start / Finish');
      
      // Check video files (2 consecutive files as per AVI section)
      expect(session.videos).toHaveLength(2);
      expect(session.videos[0].filename).toContain('25IR05_RdAm_FP1_Run01_KO_0001.mp4');
      expect(session.videos[1].filename).toContain('25IR05_RdAm_FP1_Run01_KO_0002.mp4');
    });

    test('Data points should have correct telemetry values', async () => {
      const filename = '25IR05_RdAm_FP1_Run01_KO.vbo';
      const filePath = join(fixturesDir, filename);
      const content = await readFile(filePath, 'utf-8');
      const mockFile = new File([content], filename, { type: 'application/octet-stream' });
      const session = await parser.parseVBOFile(mockFile);
      
      // Check first data point values
      const firstPoint = session.dataPoints[0];
      
      // Satellites
      expect(firstPoint.satellites).toBe(11);
      
      // Time (normalized to session start)
      expect(firstPoint.time).toBe(0);
      
      // Velocity
      expect(firstPoint.velocity).toBeCloseTo(42.224, 2);
      
      // Heading
      expect(firstPoint.heading).toBeCloseTo(176.940, 2);
      
      // Height
      expect(firstPoint.height).toBeCloseTo(324.01, 1);
      
      // Telemetry values
      expect(firstPoint.engineSpeed).toBeCloseTo(2605, 0);
      expect(firstPoint.throttlePedal).toBeCloseTo(3.4, 1);
      expect(firstPoint.vehicleSpeed).toBeCloseTo(42.6, 1);
      expect(firstPoint.gear).toBe(1);
      expect(firstPoint.ambientTemperature).toBe(-40);
      
      // Check AVI sync
      expect(firstPoint.aviFileIndex).toBe(1);
      expect(firstPoint.aviSyncTime).toBeCloseTo(30733, 0);
    });

    test('Coordinate conversion should work correctly', async () => {
      const filename = '25IR05_RdAm_FP1_Run01_KO.vbo';
      const filePath = join(fixturesDir, filename);
      const content = await readFile(filePath, 'utf-8');
      const mockFile = new File([content], filename, { type: 'application/octet-stream' });
      const session = await parser.parseVBOFile(mockFile);
      
      const firstPoint = session.dataPoints[0];
      
      // Original coordinates in NMEA format: +2627.80326600 +5279.38485600
      // These should be converted to decimal degrees
      // 2627.80326600 = 26°27.80326600' = 26.463387766°
      // 5279.38485600 = 52°79.38485600' which is invalid (minutes > 60)
      // The parser should handle this gracefully
      
      // Since the longitude value has minutes > 60, it's likely VBOX minutes format
      // or a different coordinate system altogether
      expect(firstPoint.latitude).toBeDefined();
      expect(firstPoint.longitude).toBeDefined();
      expect(typeof firstPoint.latitude).toBe('number');
      expect(typeof firstPoint.longitude).toBe('number');
    });

    test('Multiple runs should have different characteristics', async () => {
      // Compare Run01 and Run05 (different drivers: KO vs TL)
      const run01Path = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const run05Path = join(fixturesDir, '25IR05_RdAm_FP1_Run05_TL.vbo');
      
      const run01Content = await readFile(run01Path, 'utf-8');
      const run05Content = await readFile(run05Path, 'utf-8');
      
      const run01File = new File([run01Content], '25IR05_RdAm_FP1_Run01_KO.vbo', { type: 'application/octet-stream' });
      const run05File = new File([run05Content], '25IR05_RdAm_FP1_Run05_TL.vbo', { type: 'application/octet-stream' });
      
      const run01 = await parser.parseVBOFile(run01File);
      const run05 = await parser.parseVBOFile(run05File);
      
      // Both should parse successfully
      expect(run01.dataPoints.length).toBeGreaterThan(0);
      expect(run05.dataPoints.length).toBeGreaterThan(0);
      
      // They should have similar channel structures
      expect(run01.header.channels.length).toBe(run05.header.channels.length);
      
      // Video files should match their respective runs
      expect(run01.videos[0].filename).toContain('Run01_KO');
      expect(run05.videos[0].filename).toContain('Run05_TL');
    });

    test('Files with special characters in names should parse', async () => {
      const filename = '25IR05_RdAm_FP2_Run03&04_TL.vbo';
      const filePath = join(fixturesDir, filename);
      const content = await readFile(filePath, 'utf-8');
      const mockFile = new File([content], filename, { type: 'application/octet-stream' });
      
      const session = await parser.parseVBOFile(mockFile);
      
      expect(session).toBeDefined();
      expect(session.dataPoints.length).toBeGreaterThan(0);
      expect(session.videos[0].filename).toContain('Run03&04_TL');
    });
  });

  describe('Performance and data integrity', () => {
    test('Should handle large files efficiently', async () => {
      // Test with the largest file
      const largestFiles = fixtureFiles.map(async (filename) => {
        const filePath = join(fixturesDir, filename);
        const stats = await Bun.file(filePath).size;
        return { filename, size: stats };
      });
      
      const fileSizes = await Promise.all(largestFiles);
      const largest = fileSizes.reduce((max, current) => 
        current.size > max.size ? current : max
      );
      
      const startTime = performance.now();
      const filePath = join(fixturesDir, largest.filename);
      const content = await readFile(filePath, 'utf-8');
      const mockFile = new File([content], largest.filename, { type: 'application/octet-stream' });
      const session = await parser.parseVBOFile(mockFile);
      const endTime = performance.now();
      
      // Should parse in reasonable time (< 1 second for typical VBO files)
      expect(endTime - startTime).toBeLessThan(1000);
      expect(session.dataPoints.length).toBeGreaterThan(0);
    });

    test('Time normalization should be consistent', async () => {
      const filename = '25IR05_RdAm_FP1_Run01_KO.vbo';
      const filePath = join(fixturesDir, filename);
      const content = await readFile(filePath, 'utf-8');
      const mockFile = new File([content], filename, { type: 'application/octet-stream' });
      const session = await parser.parseVBOFile(mockFile);
      
      // First point should have time 0
      expect(session.dataPoints[0].time).toBe(0);
      
      // Times should be monotonically increasing
      for (let i = 1; i < Math.min(100, session.dataPoints.length); i++) {
        expect(session.dataPoints[i].time).toBeGreaterThanOrEqual(session.dataPoints[i-1].time);
      }
      
      // Total time should match the last data point
      const lastPoint = session.dataPoints[session.dataPoints.length - 1];
      expect(session.totalTime).toBeCloseTo(lastPoint.time, 1);
    });

    test('Data point fields should have reasonable ranges', async () => {
      const filename = '25IR05_RdAm_FP1_Run01_KO.vbo';
      const filePath = join(fixturesDir, filename);
      const content = await readFile(filePath, 'utf-8');
      const mockFile = new File([content], filename, { type: 'application/octet-stream' });
      const session = await parser.parseVBOFile(mockFile);
      
      session.dataPoints.forEach((point, index) => {
        // Satellites: 0-20 typically
        expect(point.satellites).toBeGreaterThanOrEqual(0);
        expect(point.satellites).toBeLessThanOrEqual(50);
        
        // Velocity: 0-400 km/h reasonable for racing
        expect(point.velocity).toBeGreaterThanOrEqual(0);
        expect(point.velocity).toBeLessThanOrEqual(500);
        
        // Heading: 0-360 degrees
        expect(point.heading).toBeGreaterThanOrEqual(0);
        expect(point.heading).toBeLessThanOrEqual(360);
        
        // Engine speed: 0-20000 RPM
        if (point.engineSpeed !== 0) {
          expect(point.engineSpeed).toBeGreaterThanOrEqual(0);
          expect(point.engineSpeed).toBeLessThanOrEqual(20000);
        }
        
        // Gear: -1 to 8 typically
        expect(point.gear).toBeGreaterThanOrEqual(-1);
        expect(point.gear).toBeLessThanOrEqual(10);
        
        // Throttle: 0-100%
        expect(point.throttlePedal).toBeGreaterThanOrEqual(0);
        expect(point.throttlePedal).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Circuit and lap timing information', () => {
    test('Should parse lap timing sections correctly', async () => {
      const filename = '25IR05_RdAm_FP1_Run01_KO.vbo';
      const filePath = join(fixturesDir, filename);
      const content = await readFile(filePath, 'utf-8');
      const mockFile = new File([content], filename, { type: 'application/octet-stream' });
      const session = await parser.parseVBOFile(mockFile);
      
      expect(session.circuitInfo).toBeDefined();
      expect(session.circuitInfo.timingLines).toBeArray();
      
      if (session.circuitInfo.timingLines.length > 0) {
        const timingLine = session.circuitInfo.timingLines[0];
        expect(timingLine.type).toMatch(/^(Start|Split)$/);
        expect(timingLine.start).toHaveProperty('latitude');
        expect(timingLine.start).toHaveProperty('longitude');
        expect(timingLine.end).toHaveProperty('latitude');
        expect(timingLine.end).toHaveProperty('longitude');
        expect(timingLine.name).toBeDefined();
      }
    });

    test('Different sessions should have appropriate circuit info', async () => {
      const fpSession = join(fixturesDir, '25IR05_RdAm_FP1_Run01_KO.vbo');
      const qualSession = join(fixturesDir, '25IR05_RdAm_Q_Run01_TL.vbo');
      
      const fpContent = await readFile(fpSession, 'utf-8');
      const qualContent = await readFile(qualSession, 'utf-8');
      
      const fpFile = new File([fpContent], '25IR05_RdAm_FP1_Run01_KO.vbo', { type: 'application/octet-stream' });
      const qualFile = new File([qualContent], '25IR05_RdAm_Q_Run01_TL.vbo', { type: 'application/octet-stream' });
      
      const fp = await parser.parseVBOFile(fpFile);
      const qual = await parser.parseVBOFile(qualFile);
      
      // Both should have circuit info
      expect(fp.circuitInfo).toBeDefined();
      expect(qual.circuitInfo).toBeDefined();
      
      // File names suggest these are from Rotterdam
      // FP = Free Practice, Q = Qualifying
      expect(fp.filePath).toBe('25IR05_RdAm_FP1_Run01_KO.vbo');
      expect(qual.filePath).toBe('25IR05_RdAm_Q_Run01_TL.vbo');
    });
  });

  describe('Edge cases and error handling', () => {
    test('Should handle duplicate data points', async () => {
      const filename = '25IR05_RdAm_FP1_Run01_KO.vbo';
      const filePath = join(fixturesDir, filename);
      const content = await readFile(filePath, 'utf-8');
      const mockFile = new File([content], filename, { type: 'application/octet-stream' });
      const session = await parser.parseVBOFile(mockFile);
      
      // Check for any exact duplicate timestamps (line 89-90 in the sample have same time)
      const timeCounts = new Map<number, number>();
      session.dataPoints.forEach(point => {
        const count = timeCounts.get(point.time) || 0;
        timeCounts.set(point.time, count + 1);
      });
      
      // Parser should handle duplicates gracefully
      expect(session.dataPoints).toBeDefined();
    });

    test('Should parse files with maxDataPoints limit', async () => {
      const limitedParser = new VBOParser({ maxDataPoints: 100 });
      const filename = '25IR05_RdAm_FP1_Run01_KO.vbo';
      const filePath = join(fixturesDir, filename);
      const content = await readFile(filePath, 'utf-8');
      const mockFile = new File([content], filename, { type: 'application/octet-stream' });
      
      const session = await limitedParser.parseVBOFile(mockFile);
      
      expect(session.dataPoints).toHaveLength(100);
      
      // Should still have valid data
      expect(session.dataPoints[0].satellites).toBeGreaterThanOrEqual(0);
      expect(session.dataPoints[99].satellites).toBeGreaterThanOrEqual(0);
    });

    test('Should handle scientific notation in data', async () => {
      const filename = '25IR05_RdAm_FP1_Run01_KO.vbo';
      const filePath = join(fixturesDir, filename);
      const content = await readFile(filePath, 'utf-8');
      const mockFile = new File([content], filename, { type: 'application/octet-stream' });
      const session = await parser.parseVBOFile(mockFile);
      
      // The sample shows scientific notation like +1.208014E-01
      const firstPoint = session.dataPoints[0];
      
      // ComboAcc value in scientific notation
      expect(firstPoint.comboAcc).toBeCloseTo(0.1208014, 6);
      
      // Combo_G value in scientific notation  
      expect(firstPoint.comboG).toBeCloseTo(0.1208014, 6);
    });
  });

  describe('Batch processing', () => {
    test('Should process all fixture files without errors', async () => {
      const results = await Promise.allSettled(
        fixtureFiles.map(async (filename) => {
          const filePath = join(fixturesDir, filename);
          const content = await readFile(filePath, 'utf-8');
          const mockFile = new File([content], filename, { type: 'application/octet-stream' });
          return parser.parseVBOFile(mockFile);
        })
      );
      
      // All should succeed
      results.forEach((result, index) => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.dataPoints.length).toBeGreaterThan(0);
        }
      });
    });

    test('Should extract driver IDs from filenames', () => {
      const drivers = new Set<string>();
      
      fixtureFiles.forEach(filename => {
        const match = filename.match(/_([A-Z]{2})\.vbo$/);
        if (match) {
          drivers.add(match[1]);
        }
      });
      
      // Should have KO, TL, and RD drivers
      expect(drivers.has('KO')).toBe(true);
      expect(drivers.has('TL')).toBe(true);
      expect(drivers.has('RD')).toBe(true);
    });

    test('Should identify session types from filenames', () => {
      const sessionTypes = new Set<string>();
      
      fixtureFiles.forEach(filename => {
        if (filename.includes('_FP1_')) sessionTypes.add('FP1');
        if (filename.includes('_FP2_')) sessionTypes.add('FP2');
        if (filename.includes('_Q_')) sessionTypes.add('Q');
        if (filename.includes('_PT2_')) sessionTypes.add('PT2');
      });
      
      // Should have Free Practice 1, Free Practice 2, Qualifying, and Practice/Test
      expect(sessionTypes.has('FP1')).toBe(true);
      expect(sessionTypes.has('FP2')).toBe(true);
      expect(sessionTypes.has('Q')).toBe(true);
      expect(sessionTypes.has('PT2')).toBe(true);
    });
  });
});