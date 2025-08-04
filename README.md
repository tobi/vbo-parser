# VBO Parser

A comprehensive TypeScript library for parsing and analyzing VBO (Vehicle Bus Observer) telemetry files from motorsport data acquisition systems.

## Features

- 🏎️ **Complete VBO file parsing** - Parse motorsport telemetry data from VBO files
- 🔄 **Automatic lap detection** - Smart lap detection using GPS data or existing lap markers
- 📊 **Sector analysis** - Automatically generate sector times and analysis
- 🎯 **Type-safe** - Full TypeScript support with Zod validation
- 🌐 **Browser & Node.js** - Works in both browser and server environments
- 📱 **File System Access API** - Modern browser file picking support
- ⚡ **Performance optimized** - Efficient parsing for large telemetry files
- 🧪 **Well tested** - Comprehensive test suite

## Installation

```bash
npm install '@vbo-parser/core@git+https://github.com/tobi/vbo-parser'
# or
yarn add '@vbo-parser/core@git+https://github.com/tobi/vbo-parser'
# or
bun add '@vbo-parser/core@git+https://github.com/tobi/vbo-parser'
```

## Quick Start

```typescript
import { VBOParser, detectLaps, findFastestLap } from '@vbo-parser/core';

// Parse a VBO file
const parser = new VBOParser();
const session = await parser.parseVBOFile(file);

// Detect laps automatically
const laps = detectLaps(session.dataPoints);

// Find the fastest lap
const fastestLap = findFastestLap(laps);

console.log(`Session: ${session.filePath}`);
console.log(`Total time: ${session.totalTime}s`);
console.log(`Laps: ${laps.length}`);
console.log(`Fastest lap: ${fastestLap?.lapTime}s`);
```

## 📚 Documentation

- **[📖 Complete Documentation](DOCUMENTATION.md)** - Comprehensive documentation and advanced usage
- **[🔧 API Reference](API.md)** - Detailed API documentation
- **[📋 VBO Format Specification](VBO_FORMAT.md)** - Complete VBO file format documentation
- **[🧪 Testing Guide](TESTING.md)** - Testing and debugging information

## API Reference

### VBOParser

Main parser class for VBO files.

```typescript
const parser = new VBOParser({
  calculateLaps: true,              // Auto-detect laps
  validateDataPoints: false,        // Validate against schema (slower)
  maxDataPoints: undefined,         // Limit data points (for large files)
  customColumnMappings: {}          // Custom column name mappings
});

// Parse from different sources
const session = await parser.parseVBOFile(file);           // File object
const session = await parser.parseVBOFile(content);        // String content
const session = await parser.parseVBOFile(buffer);         // Uint8Array

// Parse multiple files
const sessions = await parser.parseVBOFromInput(fileList);
```

### Data Types

```typescript
interface VBOSession {
  filePath: string;
  videos: VBOVideoFile[];       // Associated video files
  header: VBOHeader;
  dataPoints: VBODataPoint[];
  laps: VBOLap[];
  totalTime: number;
  trackLength?: number;
}

interface VBODataPoint {
  satellites: number;
  time: number;
  latitude: number;
  longitude: number;
  velocity: number;
  heading: number;
  height: number;
  engineSpeed: number;
  steeringAngle: number;
  brakePressureFront: number;
  throttlePedal: number;
  vehicleSpeed: number;
  gear: number;
  // ... and many more telemetry channels
}

interface VBOLap {
  lapNumber: number;
  startTime: number;
  endTime: number;
  lapTime: number;
  sectors: VBOSector[];
  dataPoints: VBODataPoint[];
  isValid: boolean;
}
```

### Lap Detection

```typescript
import { LapDetection } from '@vbo-parser/core';

// Detect laps with custom options
const laps = LapDetection.detectLaps(dataPoints, {
  minLapTime: 30,          // Minimum lap time (seconds)
  maxLapTime: 600,         // Maximum lap time (seconds)
  minDistance: 1000,       // Minimum distance (meters)
  speedThreshold: 20,      // Speed threshold for line crossing
  sectorCount: 3           // Number of sectors per lap
});

// Find fastest lap
const fastest = LapDetection.findFastestLap(laps);

// Calculate average lap time
const avgTime = LapDetection.calculateAverageLapTime(laps);

// Find best sector times
const bestSectors = LapDetection.findBestSectorTimes(laps);
```

### Browser File Picking

```typescript
// Open file picker (modern browsers only)
const fileHandles = await VBOParser.openFilePicker();
const sessions = await parser.parseVBOFromInput(fileHandles);

// List files from directory (if supported)
const directoryHandle = await window.showDirectoryPicker();
const vboFiles = await VBOParser.listVBOFiles(directoryHandle);
```

### Utility Functions

```typescript
// Get video file and timestamp for a data point
const videoInfo = VBOParser.getVideoForDataPoint(session, dataPoint);
// Returns: { file: '/videos/filename_0001.mp4', timestamp: 15.25 } or null

// Calculate GPS distance
const distance = VBOParser.calculateDistance(lat1, lng1, lat2, lng2);

// List known VBO files
const files = await VBOParser.listVBOFiles('/public/videos');
```

## Advanced Usage

### Custom Column Mappings

```typescript
const parser = new VBOParser({
  customColumnMappings: {
    'custom_speed': 'velocity',
    'brake_front': 'brakePressureFront',
    'engine_rpm': 'engineSpeed'
  }
});
```

### Error Handling

```typescript
import { VBOParseError, VBOValidationError } from '@vbo-parser/core';

try {
  const session = await parser.parseVBOFile(file);
} catch (error) {
  if (error instanceof VBOValidationError) {
    console.error('Validation failed:', error.validationErrors);
  } else if (error instanceof VBOParseError) {
    console.error('Parse error:', error.message, error.cause);
  }
}
```

### Performance Optimization

```typescript
// For large files, limit data points
const parser = new VBOParser({
  maxDataPoints: 10000,
  validateDataPoints: false    // Skip validation for better performance
});

// Process data in chunks
const session = await parser.parseVBOFile(file);
const chunkSize = 1000;
for (let i = 0; i < session.dataPoints.length; i += chunkSize) {
  const chunk = session.dataPoints.slice(i, i + chunkSize);
  // Process chunk...
}
```

## Browser Support

- ✅ Chrome 86+ (File System Access API)
- ✅ Firefox 90+ (File API)
- ✅ Safari 14+ (File API)
- ✅ Edge 86+ (File System Access API)

## Node.js Support

- ✅ Node.js 16+
- ✅ Works with fs.readFile
- ✅ Stream processing support

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## Support

- 📖 [Documentation](https://github.com/vbo-parser/core/wiki)
- 🐛 [Issues](https://github.com/vbo-parser/core/issues)
- 💬 [Discussions](https://github.com/vbo-parser/core/discussions)
- 📧 Email: support@vbo-parser.dev
