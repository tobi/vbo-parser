# VBO Parser - API Documentation

## Core Classes

### VBOParser

Main parser class for VBO (Vehicle Bus Observer) telemetry files.

#### Constructor

```typescript
const parser = new VBOParser(options?: VBOParserOptions)
```

**Options:**
- `calculateLaps?: boolean` - Auto-detect laps (default: true)
- `validateDataPoints?: boolean` - Validate against schema (slower but safer, default: false)
- `maxDataPoints?: number` - Limit data points for large files (default: undefined)
- `customColumnMappings?: Record<string, keyof VBODataPoint>` - Custom column name mappings

#### Methods

##### parseVBOFile(input: File | string | Uint8Array): Promise<VBOSession>

Parse a VBO file from various input sources.

```typescript
// From File object (browser)
const file = new File([content], 'session.vbo');
const session = await parser.parseVBOFile(file);

// From string content
const content = await fetch('/data/session.vbo').then(r => r.text());
const session = await parser.parseVBOFile(content);

// From Uint8Array
const buffer = new Uint8Array(content);
const session = await parser.parseVBOFile(buffer);
```

##### parseVBOFromInput(input: FileList | File[] | FileSystemFileHandle[]): Promise<VBOSession[]>

Parse multiple VBO files from FileList, File array, or FileSystemFileHandle array.

```typescript
// From file input
const fileList = document.getElementById('fileInput').files;
const sessions = await parser.parseVBOFromInput(fileList);

// From FileSystemFileHandle (browser)
const handles = await window.showOpenFilePicker();
const sessions = await parser.parseVBOFromInput(handles);
```

#### Static Methods

##### extractDriverFromFilename(filename: string): string

Extract driver code from VBO filename format.

```typescript
const driver = VBOParser.extractDriverFromFilename('session_RD_001.vbo'); // "RD"
const driver2 = VBOParser.extractDriverFromFilename('race_TL_2024.vbo'); // "TL"
```

##### calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number

Calculate distance between two GPS coordinates using Haversine formula.

```typescript
const distance = VBOParser.calculateDistance(
  26.4678, 53.3214, // Bahrain GP coordinates
  26.4689, 53.3225
); // Returns distance in meters
```

##### listVBOFiles(directory?: string | FileSystemDirectoryHandle): Promise<string[] | FileSystemFileHandle[]>

List VBO files from directory or FileSystemDirectoryHandle.

```typescript
// Browser with File System Access API
const directoryHandle = await window.showDirectoryPicker();
const vboFiles = await VBOParser.listVBOFiles(directoryHandle);

// Server environment
const files = await VBOParser.listVBOFiles('/public/videos');
```

##### openFilePicker(): Promise<FileSystemFileHandle[]>

Open file picker for VBO files (browser only).

```typescript
try {
  const handles = await VBOParser.openFilePicker();
  const sessions = await Promise.all(
    handles.map(handle => parser.parseVBOFile(handle.getFile()))
  );
} catch (error) {
  console.error('File picker failed:', error);
}
```

### LapDetection

Advanced lap detection and analysis utilities.

#### Static Methods

##### detectLaps(dataPoints: VBODataPoint[], options?: LapDetectionOptions, circuitInfo?: VBOCircuitInfo): VBOLap[]

Detect laps from VBO data points using multiple detection strategies.

```typescript
import { LapDetection } from '@vbo-parser/core';

const laps = LapDetection.detectLaps(session.dataPoints, {
  minDistance: 1000,      // Minimum distance in meters
  speedThreshold: 20,     // Speed threshold for line crossing
  sectorCount: 3          // Number of sectors per lap
}, session.circuitInfo);
```

##### findFastestLap(laps: VBOLap[]): VBOLap | null

Find the fastest lap from a collection of laps.

```typescript
const fastest = LapDetection.findFastestLap(laps);
if (fastest) {
  console.log(`Fastest lap: ${fastest.lapTime}s`);
}
```

##### calculateAverageLapTime(laps: VBOLap[]): number

Calculate average lap time from valid laps.

```typescript
const avgTime = LapDetection.calculateAverageLapTime(laps);
console.log(`Average lap time: ${avgTime}s`);
```

##### findBestSectorTimes(laps: VBOLap[]): Map<number, number>

Find the best sector time for each sector across all laps.

```typescript
const bestSectors = LapDetection.findBestSectorTimes(laps);
bestSectors.forEach((time, sector) => {
  console.log(`Sector ${sector}: ${time}s`);
});
```

## Data Types

### VBOSession

Complete VBO session data structure.

```typescript
interface VBOSession {
  filePath: string;
  videoPath?: string;
  header: VBOHeader;
  dataPoints: VBODataPoint[];
  laps: VBOLap[];
  fastestLap?: VBOLap;
  totalTime: number;
  trackLength?: number;
  circuitInfo: VBOCircuitInfo;
}
```

### VBOHeader

VBO file header information.

```typescript
interface VBOHeader {
  creationDate: Date;
  channels: VBOChannel[];
  units: string[];
  sampleRate?: number;
  driverId?: string;
  vehicle?: string;
  version?: string;
}
```

### VBOChannel

Telemetry channel definition.

```typescript
interface VBOChannel {
  name: string;
  unit: string;
  index: number;
}
```

### VBODataPoint

Single telemetry data point.

```typescript
interface VBODataPoint {
  satellites: number;
  time: number;
  latitude: number;
  longitude: number;
  velocity: number;
  heading: number;
  height: number;
  verticalVelocity: number;
  samplePeriod: number;
  solutionType: number;
  aviFileIndex: number;
  aviSyncTime: number;
  comboAcc: number;
  tcSlip: number;
  tcGain: number;
  ppsMap: number;
  epsMap: number;
  engMap: number;
  driverId: number;
  ambientTemperature: number;
  carOnJack: number;
  headrest: number;
  fuelProbe: number;
  tcActive: number;
  lapNumber: number;
  lapGainLoss: number;
  engineSpeed: number;
  steeringAngle: number;
  brakePressureFront: number;
  throttlePedal: number;
  vehicleSpeed: number;
  gear: number;
  comboG: number;
}
```

### VBOLap

Single lap data with timing and telemetry.

```typescript
interface VBOLap {
  lapNumber: number;
  startTime: number;
  endTime: number;
  lapTime: number;
  sectors: VBOSector[];
  dataPoints: VBODataPoint[];
  isValid: boolean;
  fastestSector?: number;
  label: 'off-track' | 'in-lap' | 'out-lap' | 'timed-lap';
}
```

### VBOSector

Sector timing within a lap.

```typescript
interface VBOSector {
  sectorNumber: number;
  startTime: number;
  endTime: number;
  sectorTime: number;
  startDistance: number;
  endDistance: number;
}
```

### VBOCircuitInfo

Circuit information including timing lines.

```typescript
interface VBOCircuitInfo {
  country?: string;
  circuit?: string;
  timingLines: VBOTimingLine[];
}
```

### VBOTimingLine

Timing line definition for precise lap timing.

```typescript
interface VBOTimingLine {
  type: 'Start' | 'Split';
  start: { latitude: number; longitude: number };
  end: { latitude: number; longitude: number };
  name: string;
}
```

## Configuration Options

### VBOParserOptions

```typescript
interface VBOParserOptions {
  calculateLaps?: boolean;
  customColumnMappings?: Record<string, keyof VBODataPoint>;
  validateDataPoints?: boolean;
  maxDataPoints?: number;
}
```

### LapDetectionOptions

```typescript
interface LapDetectionOptions {
  minDistance?: number;
  speedThreshold?: number;
  sectorCount?: number;
}
```

## Error Handling

### VBOParseError

Base error class for parsing failures.

```typescript
try {
  const session = await parser.parseVBOFile(file);
} catch (error) {
  if (error instanceof VBOParseError) {
    console.error('Parse error:', error.message);
  }
}
```

### VBOValidationError

Validation error with detailed schema violations.

```typescript
try {
  const session = await parser.parseVBOFile(file);
} catch (error) {
  if (error instanceof VBOValidationError) {
    console.error('Validation failed:', error.validationErrors);
  }
}
```

## Convenience Functions

### parseVBOFile

Quick parsing with default options.

```typescript
import { parseVBOFile } from '@vbo-parser/core';

const session = await parseVBOFile(file);
```

### parseMultipleVBOFiles

Parse multiple files with consistent options.

```typescript
import { parseMultipleVBOFiles } from '@vbo-parser/core';

const sessions = await parseMultipleVBOFiles(fileList, {
  calculateLaps: true,
  maxDataPoints: 10000
});
```

### detectLaps

Quick lap detection with default options.

```typescript
import { detectLaps } from '@vbo-parser/core';

const laps = detectLaps(session.dataPoints);
```

### findFastestLap

Find fastest lap with default filtering.

```typescript
import { findFastestLap } from '@vbo-parser/core';

const fastest = findFastestLap(laps);
```

## Usage Examples

### Basic Usage

```typescript
import { VBOParser, LapDetection } from '@vbo-parser/core';

const parser = new VBOParser();
const session = await parser.parseVBOFile('race_data.vbo');

console.log(`Session: ${session.filePath}`);
console.log(`Total time: ${session.totalTime}s`);
console.log(`Data points: ${session.dataPoints.length}`);

const laps = LapDetection.detectLaps(session.dataPoints);
console.log(`Laps: ${laps.length}`);

const fastest = LapDetection.findFastestLap(laps);
if (fastest) {
  console.log(`Fastest lap: ${fastest.lapTime}s`);
}
```

### Advanced Configuration

```typescript
const parser = new VBOParser({
  calculateLaps: true,
  validateDataPoints: true,
  maxDataPoints: 50000,
  customColumnMappings: {
    'custom_speed': 'velocity',
    'brake_front': 'brakePressureFront',
    'engine_rpm': 'engineSpeed'
  }
});

const session = await parser.parseVBOFile(file);

const laps = LapDetection.detectLaps(
  session.dataPoints,
  {
    minDistance: 1000,
    speedThreshold: 25,
    sectorCount: 3
  },
  session.circuitInfo
);
```

### Browser Integration

```typescript
// File picker integration
const openVBOFiles = async () => {
  try {
    const handles = await VBOParser.openFilePicker();
    const sessions = await Promise.all(
      handles.map(handle => parser.parseVBOFile(handle.getFile()))
    );
    
    return sessions;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('User cancelled file selection');
    } else {
      console.error('Error:', error);
    }
  }
};

// Directory listing
const listVBODirectory = async () => {
  const directoryHandle = await window.showDirectoryPicker();
  const vboFiles = await VBOParser.listVBOFiles(directoryHandle);
  
  const sessions = await Promise.all(
    vboFiles.map(handle => parser.parseVBOFile(handle.getFile()))
  );
  
  return sessions;
};
```

### Performance Optimization

```typescript
// For large files, limit data points
const parser = new VBOParser({
  maxDataPoints: 10000,
  validateDataPoints: false
});

// Process data in chunks
const session = await parser.parseVBOFile(file);
const chunkSize = 1000;

for (let i = 0; i < session.dataPoints.length; i += chunkSize) {
  const chunk = session.dataPoints.slice(i, i + chunkSize);
  // Process chunk...
}
```

### Error Handling

```typescript
import { VBOParseError, VBOValidationError } from '@vbo-parser/core';

const parseWithErrorHandling = async (file: File) => {
  try {
    const session = await parser.parseVBOFile(file);
    return { success: true, data: session };
  } catch (error) {
    if (error instanceof VBOValidationError) {
      return {
        success: false,
        error: 'Validation failed',
        details: error.validationErrors
      };
    } else if (error instanceof VBOParseError) {
      return {
        success: false,
        error: 'Parse error',
        details: error.message
      };
    } else {
      return {
        success: false,
        error: 'Unknown error',
        details: error.message
      };
    }
  }
};
```