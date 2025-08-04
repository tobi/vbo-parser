# VBO Parser - Complete Documentation

## Overview

The VBO Parser is a comprehensive TypeScript library for parsing and analyzing VBO (Vehicle Bus Observer) telemetry files from motorsport data acquisition systems. It provides robust parsing capabilities, intelligent lap detection, and advanced telemetry analysis features.

## 📁 Documentation Structure

- **[README.md](README.md)** - Quick start guide and basic usage
- **[API.md](API.md)** - Complete API reference with detailed method signatures
- **[USAGE.md](USAGE.md)** - Practical usage examples and patterns
- **[TESTING.md](TESTING.md)** - Testing documentation and debug tools
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and updates

## 🚀 Quick Start

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

## 🏗️ Architecture

### Core Components

1. **VBOParser** - Main file parsing engine
2. **LapDetection** - Advanced lap detection algorithms
3. **Type System** - Full TypeScript support with Zod validation
4. **Error Handling** - Comprehensive error types and recovery
5. **Browser/Node.js Support** - Cross-platform compatibility

### Data Flow

```
VBO File → VBOParser → VBOSession → LapDetection → VBOLap[]
```

## 📊 Supported Features

### File Formats
- ✅ Standard VBO format with `[header]` and `[data]` sections
- ✅ Custom column name mappings
- ✅ GPS coordinate conversion (NMEA → decimal degrees)
- ✅ Timestamp normalization
- ✅ Video file association

### Lap Detection
- ✅ **Timing Line Detection** - Uses precise timing line crossings
- ✅ **GPS Pattern Analysis** - Detects periodic GPS patterns
- ✅ **Speed-Based Detection** - Identifies racing segments
- ✅ **Lap Number Extraction** - Uses existing lap markers
- ✅ **Sector Generation** - Creates sector timing

### Browser Features
- ✅ **File System Access API** - Modern browser file picking
- ✅ **Drag & Drop** - File input integration
- ✅ **Directory Listing** - Browse VBO directories
- ✅ **Progressive Loading** - Handle large files efficiently

### Node.js Features
- ✅ **File System Integration** - Read from file paths
- ✅ **Batch Processing** - Process multiple files
- ✅ **Stream Processing** - Handle large datasets
- ✅ **Memory Management** - Efficient memory usage

## 🎯 Key Use Cases

### 1. Racing Analysis Dashboard

```typescript
class RacingAnalyzer {
  async analyzeSession(file: File) {
    const parser = new VBOParser({ calculateLaps: true });
    const session = await parser.parseVBOFile(file);
    const laps = LapDetection.detectLaps(
      session.dataPoints,
      { sectorCount: 3 },
      session.circuitInfo
    );

    return {
      session,
      laps,
      fastestLap: LapDetection.findFastestLap(laps),
      bestSectors: LapDetection.findBestSectorTimes(laps)
    };
  }
}
```

### 2. Browser File Manager

```typescript
// File picker integration
const openVBOFiles = async () => {
  const handles = await VBOParser.openFilePicker();
  const sessions = await Promise.all(
    handles.map(handle => parser.parseVBOFile(handle.getFile()))
  );
  return sessions;
};

// Directory browsing
const browseVBODirectory = async () => {
  const directoryHandle = await window.showDirectoryPicker();
  const vboFiles = await VBOParser.listVBOFiles(directoryHandle);
  return vboFiles;
};
```

### 3. Batch Processing

```typescript
const processMultipleFiles = async (filePaths: string[]) => {
  const parser = new VBOParser();
  const results = [];

  for (const filePath of filePaths) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const session = await parser.parseVBOFile(content);
      const laps = LapDetection.detectLaps(session.dataPoints);
      
      results.push({
        file: filePath,
        session,
        laps,
        fastestLap: LapDetection.findFastestLap(laps)
      });
    } catch (error) {
      results.push({ file: filePath, error: error.message });
    }
  }

  return results;
};
```

## 🔧 Configuration Options

### Parser Configuration

```typescript
const parser = new VBOParser({
  calculateLaps: true,           // Auto-detect laps
  validateDataPoints: false,     // Skip validation for speed
  maxDataPoints: 50000,           // Limit data points
  customColumnMappings: {       // Custom column mappings
    'custom_speed': 'velocity',
    'brake_front': 'brakePressureFront'
  }
});
```

### Lap Detection Configuration

```typescript
const laps = LapDetection.detectLaps(
  dataPoints,
  {
    minDistance: 1000,      // Minimum lap distance (meters)
    speedThreshold: 20,   // Speed threshold (km/h)
    sectorCount: 3         // Sectors per lap
  },
  circuitInfo            // Use timing lines
);
```

## 📈 Performance Optimization

### Memory Management

```typescript
// Process large files efficiently
const processLargeFile = async (file: File) => {
  const parser = new VBOParser({ maxDataPoints: 10000 });
  const session = await parser.parseVBOFile(file);
  
  // Process in chunks
  const chunkSize = 1000;
  for (let i = 0; i < session.dataPoints.length; i += chunkSize) {
    const chunk = session.dataPoints.slice(i, i + chunkSize);
    await processChunk(chunk);
  }
};
```

### Performance Tuning

```typescript
// For production use
const parser = new VBOParser({
  calculateLaps: true,
  validateDataPoints: false,  // Skip validation for speed
  maxDataPoints: undefined    // No limit
});

// For development/debugging
const debugParser = new VBOParser({
  calculateLaps: true,
  validateDataPoints: true,   // Enable validation
  maxDataPoints: 1000         // Small sample
});
```

## 🐛 Error Handling

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

## 🧪 Testing

### Running Tests

```bash
# Run all tests
bun test

# Run specific test files
bun test src/real-world.test.ts
bun test src/lap-detection.test.ts

# Run with verbose output
bun test --reporter verbose
```

### Debug Tools

```bash
# Lap detection analysis
bun src/lib/vbo-parser/bin/debug-lap-detection.ts path/to/file.vbo

# Raw data investigation
bun src/lib/vbo-parser/bin/debug-raw-data.ts path/to/file.vbo

# Speed pattern analysis
bun src/lib/vbo-parser/bin/debug-speed-analysis.ts path/to/file.vbo
```

## 📋 Data Types Reference

### Core Types

- **VBOSession** - Complete session data
- **VBOHeader** - File header information
- **VBODataPoint** - Single telemetry point
- **VBOLap** - Lap data with timing
- **VBOSector** - Sector timing
- **VBOCircuitInfo** - Circuit information

### Example Data Structure

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

## 🔄 Migration Guide

### From v0.x to v1.0

```typescript
// Old API (v0.x)
import { parseVBO } from 'vbo-parser';
const data = await parseVBO(file);

// New API (v1.0)
import { VBOParser, LapDetection } from '@vbo-parser/core';
const parser = new VBOParser();
const session = await parser.parseVBOFile(file);
const laps = LapDetection.detectLaps(session.dataPoints);
```

## 📚 Additional Resources

### Links
- [GitHub Repository](https://github.com/vbo-parser/core)
- [Issue Tracker](https://github.com/vbo-parser/core/issues)
- [Discussions](https://github.com/vbo-parser/core/discussions)
- [NPM Package](https://www.npmjs.com/package/@vbo-parser/core)

### Support
- 📧 Email: support@vbo-parser.dev
- 💬 Discord: [VBO Parser Community](https://discord.gg/vbo-parser)
- 📖 Documentation: [GitHub Wiki](https://github.com/vbo-parser/core/wiki)

## 🏁 Next Steps

1. **Read the [README.md](README.md)** for quick start
2. **Check [API.md](API.md)** for complete API reference
3. **Explore [USAGE.md](USAGE.md)** for practical examples
4. **Review [TESTING.md](TESTING.md)** for testing and debugging
5. **Join the community** for support and updates

---

**Version**: 1.0.0  
**License**: MIT  
**Author**: VBO Parser Team