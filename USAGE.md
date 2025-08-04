# VBO Parser - Usage Guide

## Quick Start

### Installation

```bash
# Using Bun (recommended)
bun add @vbo-parser/core

# Using npm
npm install @vbo-parser/core

# Using yarn
yarn add @vbo-parser/core
```

### Basic Usage

```typescript
import { VBOParser, LapDetection } from '@vbo-parser/core';

// Create parser instance
const parser = new VBOParser();

// Parse a VBO file
const session = await parser.parseVBOFile('race_data.vbo');

// Detect laps automatically
const laps = LapDetection.detectLaps(session.dataPoints);

// Find fastest lap
const fastest = LapDetection.findFastestLap(laps);

console.log(`Parsed ${session.dataPoints.length} data points`);
console.log(`Detected ${laps.length} laps`);
console.log(`Fastest lap: ${fastest?.lapTime}s`);
```

## Browser Usage

### File Input Integration

```typescript
import { VBOParser, LapDetection } from '@vbo-parser/core';

const parser = new VBOParser();

// Handle file input
const handleFileInput = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  try {
    const session = await parser.parseVBOFile(file);
    const laps = LapDetection.detectLaps(session.dataPoints);
    
    // Display results
    displaySessionInfo(session, laps);
  } catch (error) {
    console.error('Error parsing file:', error);
  }
};

// Display session information
const displaySessionInfo = (session: VBOSession, laps: VBOLap[]) => {
  const info = document.getElementById('session-info');
  info.innerHTML = `
    <h3>Session: ${session.filePath}</h3>
    <p>Total Time: ${session.totalTime.toFixed(2)}s</p>
    <p>Data Points: ${session.dataPoints.length}</p>
    <p>Laps: ${laps.length}</p>
    <p>Fastest Lap: ${LapDetection.findFastestLap(laps)?.lapTime.toFixed(2)}s</p>
  `;
};
```

### File System Access API

```typescript
// Modern browser file picker
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

// Directory picker
const openVBODirectory = async () => {
  const directoryHandle = await window.showDirectoryPicker();
  const vboFiles = await VBOParser.listVBOFiles(directoryHandle);
  
  const sessions = await Promise.all(
    vboFiles.map(handle => parser.parseVBOFile(handle.getFile()))
  );
  
  return sessions;
};
```

## Node.js Usage

### File System Integration

```typescript
import { readFile } from 'fs/promises';
import { VBOParser, LapDetection } from '@vbo-parser/core';

const parser = new VBOParser();

// Parse from file path
const parseVBOFile = async (filePath: string) => {
  try {
    const content = await readFile(filePath, 'utf-8');
    const session = await parser.parseVBOFile(content);
    const laps = LapDetection.detectLaps(session.dataPoints);
    
    return { session, laps };
  } catch (error) {
    console.error('Error parsing file:', error);
    throw error;
  }
};

// Batch processing
const parseMultipleFiles = async (filePaths: string[]) => {
  const results = await Promise.allSettled(
    filePaths.map(parseVBOFile)
  );
  
  return results.map((result, index) => ({
    filePath: filePaths[index],
    success: result.status === 'fulfilled',
    data: result.status === 'fulfilled' ? result.value : null,
    error: result.status === 'rejected' ? result.reason : null
  }));
};
```

## Advanced Configuration

### Custom Column Mappings

```typescript
const parser = new VBOParser({
  customColumnMappings: {
    'custom_speed': 'velocity',
    'brake_front': 'brakePressureFront',
    'engine_rpm': 'engineSpeed',
    'steering': 'steeringAngle',
    'throttle': 'throttlePedal'
  }
});
```

### Performance Tuning

```typescript
// For large files
const parser = new VBOParser({
  maxDataPoints: 50000,        // Limit data points
  validateDataPoints: false,   // Skip validation for speed
  calculateLaps: false       // Skip lap detection
});

// Process in chunks
const processLargeFile = async (file: File) => {
  const parser = new VBOParser({ maxDataPoints: 10000 });
  const session = await parser.parseVBOFile(file);
  
  // Process data in chunks
  const chunkSize = 1000;
  for (let i = 0; i < session.dataPoints.length; i += chunkSize) {
    const chunk = session.dataPoints.slice(i, i + chunkSize);
    await processChunk(chunk);
  }
};
```

### Lap Detection Configuration

```typescript
const laps = LapDetection.detectLaps(
  session.dataPoints,
  {
    minDistance: 1000,      // Minimum lap distance (meters)
    speedThreshold: 20,     // Speed threshold for line crossing (km/h)
    sectorCount: 3          // Number of sectors per lap
  },
  session.circuitInfo  // Use timing lines if available
);
```

## Real-World Examples

### Racing Analysis Dashboard

```typescript
import { VBOParser, LapDetection } from '@vbo-parser/core';

class RacingAnalyzer {
  private parser: VBOParser;

  constructor() {
    this.parser = new VBOParser({
      calculateLaps: true,
      validateDataPoints: false
    });
  }

  async analyzeSession(file: File) {
    const session = await this.parser.parseVBOFile(file);
    const laps = LapDetection.detectLaps(
      session.dataPoints,
      { minDistance: 1000, sectorCount: 3 },
      session.circuitInfo
    );

    return {
      session,
      laps,
      summary: this.generateSummary(session, laps),
      fastestLap: LapDetection.findFastestLap(laps),
      bestSectors: LapDetection.findBestSectorTimes(laps)
    };
  }

  private generateSummary(session: VBOSession, laps: VBOLap[]) {
    const validLaps = laps.filter(lap => lap.isValid);
    const avgLapTime = LapDetection.calculateAverageLapTime(validLaps);
    
    return {
      totalTime: session.totalTime,
      lapCount: validLaps.length,
      avgLapTime,
      maxSpeed: Math.max(...session.dataPoints.map(p => p.velocity)),
      trackLength: this.calculateTrackLength(validLaps)
    };
  }

  private calculateTrackLength(laps: VBOLap[]) {
    const validLaps = laps.filter(lap => lap.isValid);
    if (validLaps.length === 0) return 0;
    
    const distances = validLaps.map(lap => lap.distance);
    return distances.reduce((a, b) => a + b, 0) / distances.length;
  }
}

// Usage
const analyzer = new RacingAnalyzer();
const analysis = await analyzer.analyzeSession(raceFile);
```

### Telemetry Comparison

```typescript
const compareSessions = async (files: File[]) => {
  const parser = new VBOParser();
  const sessions = await parser.parseVBOFromInput(files);
  
  const comparisons = sessions.map(session => {
    const laps = LapDetection.detectLaps(session.dataPoints);
    const fastest = LapDetection.findFastestLap(laps);
    
    return {
      file: session.filePath,
      totalTime: session.totalTime,
      lapCount: laps.length,
      fastestLap: fastest?.lapTime,
      avgSpeed: session.dataPoints.reduce((sum, p) => sum + p.velocity, 0) / session.dataPoints.length
    };
  });
  
  return comparisons;
};
```

### Real-time Processing

```typescript
class RealTimeProcessor {
  private parser: VBOParser;
  private buffer: VBODataPoint[] = [];

  constructor() {
    this.parser = new VBOParser({ calculateLaps: false });
  }

  async processChunk(chunk: string) {
    const session = await this.parser.parseVBOFile(chunk);
    this.buffer.push(...session.dataPoints);
    
    // Process when we have enough data
    if (this.buffer.length > 1000) {
      const laps = LapDetection.detectLaps(this.buffer);
      this.onLapsDetected(laps);
      this.buffer = []; // Reset buffer
    }
  }

  private onLapsDetected(laps: VBOLap[]) {
    console.log(`Detected ${laps.length} laps`);
    // Emit event or update UI
  }
}
```

## Error Handling Patterns

### Comprehensive Error Handling

```typescript
import { VBOParseError, VBOValidationError } from '@vbo-parser/core';

const safeParseVBO = async (input: File | string) => {
  try {
    const parser = new VBOParser({ validateDataPoints: true });
    const session = await parser.parseVBOFile(input);
    
    return { success: true, data: session };
  } catch (error) {
    if (error instanceof VBOValidationError) {
      return {
        success: false,
        error: 'Validation failed',
        details: error.validationErrors.errors
      };
    } else if (error instanceof VBOParseError) {
      return {
        success: false,
        error: 'Parse error',
        details: error.message,
        cause: error.cause
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

### Retry Logic

```typescript
const parseWithRetry = async (file: File, maxRetries = 3) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const parser = new VBOParser({
        validateDataPoints: false, // Skip validation for retry
        maxDataPoints: 50000
      });
      
      return await parser.parseVBOFile(file);
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  throw lastError;
};
```

## Testing and Debugging

### Debug Mode

```typescript
const debugParser = new VBOParser({
  calculateLaps: true,
  validateDataPoints: true,
  maxDataPoints: 1000 // Small sample for debugging
});

// Enable verbose logging
const debugLaps = LapDetection.detectLaps(dataPoints, {
  minDistance: 100,
  speedThreshold: 10,
  sectorCount: 2
});

console.log('Debug laps:', debugLaps);
```

### Performance Monitoring

```typescript
const measurePerformance = async (file: File) => {
  const start = performance.now();
  
  const parser = new VBOParser();
  const session = await parser.parseVBOFile(file);
  const laps = LapDetection.detectLaps(session.dataPoints);
  
  const end = performance.now();
  
  return {
    parseTime: end - start,
    dataPoints: session.dataPoints.length,
    laps: laps.length,
    memoryUsage: performance.memory?.usedJSHeapSize
  };
};
```

## Best Practices

### Memory Management

```typescript
// Process large files efficiently
const processLargeFile = async (file: File) => {
  const parser = new VBOParser({ maxDataPoints: 10000 });
  const session = await parser.parseVBOFile(file);
  
  // Process in chunks to avoid memory issues
  const chunkSize = 1000;
  for (let i = 0; i < session.dataPoints.length; i += chunkSize) {
    const chunk = session.dataPoints.slice(i, i + chunkSize);
    await processChunk(chunk);
    
    // Allow garbage collection
    if (i % 10000 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
};
```

### Data Validation

```typescript
const validateSession = (session: VBOSession) => {
  const issues = [];
  
  if (session.dataPoints.length === 0) {
    issues.push('No data points found');
  }
  
  if (session.totalTime <= 0) {
    issues.push('Invalid total time');
  }
  
  const gpsPoints = session.dataPoints.filter(p => 
    p.latitude !== 0 && p.longitude !== 0
  );
  
  if (gpsPoints.length < session.dataPoints.length * 0.9) {
    issues.push('Insufficient GPS data');
  }
  
  return issues;
};
```

## Common Patterns

### Batch Processing

```typescript
const processVBODirectory = async (directoryPath: string) => {
  const files = await VBOParser.listVBOFiles(directoryPath);
  const results = [];
  
  for (const file of files) {
    try {
      const session = await parser.parseVBOFile(file);
      const laps = LapDetection.detectLaps(session.dataPoints);
      
      results.push({
        file,
        session,
        laps,
        fastest: LapDetection.findFastestLap(laps)
      });
    } catch (error) {
      results.push({ file, error: error.message });
    }
  }
  
  return results;
};
```

### Data Export

```typescript
const exportSessionData = (session: VBOSession, laps: VBOLap[]) => {
  return {
    metadata: {
      file: session.filePath,
      totalTime: session.totalTime,
      dataPoints: session.dataPoints.length,
      channels: session.header.channels.length
    },
    laps: laps.map(lap => ({
      number: lap.lapNumber,
      time: lap.lapTime,
      distance: lap.distance,
      maxSpeed: Math.max(...lap.dataPoints.map(p => p.velocity)),
      avgSpeed: lap.dataPoints.reduce((sum, p) => sum + p.velocity, 0) / lap.dataPoints.length,
      sectors: lap.sectors.map(s => ({
        number: s.sectorNumber,
        time: s.sectorTime
      }))
    }))
  };
};
```