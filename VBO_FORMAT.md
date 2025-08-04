# VBO File Format Specification

## Overview

VBO (Vehicle Bus Observer) files are text-based telemetry data files used in motorsport data acquisition systems. They contain timestamped sensor data from various vehicle systems including GPS, engine parameters, and vehicle dynamics measurements.

**Important**: VBO files are highly variable in structure. Almost all sections are optional except for the core data sections. The parser must be flexible to handle different file variations.

## File Structure

VBO files use a section-based format with square bracket delimited sections `[section name]`. The basic structure is:

```
File created on DD/MM/YYYY @ HH:MM:SS

[header]
channel1
channel2
...

[channel units]
unit1
unit2
...

[column names]
col1 col2 col3 ...

[data]
value1 value2 value3 ...
value1 value2 value3 ...
...

[optional sections]
...
```

## Core Sections

### File Header (Optional)
The file may start with a creation timestamp:
```
File created on 15/12/2023 @ 14:30:25
```

**Supported date formats:**
- `DD/MM/YYYY @ HH:MM:SS`
- `DD/MM/YYYY`

### `[header]` Section (Required)
Contains the human-readable channel names, one per line:
```
[header]
satellites
time
latitude
longitude
velocity
heading
```

### `[channel units]` Section (Optional)
Contains units for each channel, corresponding to the header order:
```
[channel units]
(null)
s
deg
deg
kmh
deg
```

**Note**: Units may be `(null)` or empty for dimensionless values.

### `[column names]` Section (Optional)
Contains space-separated machine-readable column names:
```
[column names]
sats time lat long velocity heading
```

**Important**: If this section is missing, the parser uses the `[header]` channel names as column names.

### `[data]` Section (Required)
Contains the actual telemetry data, one row per sample:
```
[data]
8 143025.500 4512.3456 -7365.4321 85.2 180.5
7 143026.000 4512.4456 -7365.5321 82.1 175.2
```

## Optional Sections

### `[laptiming]` Section
Contains timing line definitions for lap detection:
```
[laptiming]
Start +Long1 +Lat1 +Long2 +Lat2 ¬ Start/Finish Line
Split +Long1 +Lat1 +Long2 +Lat2 ¬ Sector 1
```

### `[circuit details]` Section
Contains circuit information:
```
[circuit details]
country United States
circuit Laguna Seca
```

## Data Types and Post-Processing

### Time Format
Times are stored in `HHMMSS.mmm` format (24-hour with milliseconds):
- `143025.500` = 14:30:25.500 (2:30:25.500 PM)
- Parser converts to seconds since midnight: `14*3600 + 30*60 + 25.5 = 51625.5`

**Post-processing**: The parser normalizes timestamps to be relative to session start (subtracts minimum time).

### Coordinate Systems
The parser automatically detects and converts between coordinate formats:

#### 1. Decimal Degrees (GPS Standard)
- **Format**: `±DD.DDDDDD`
- **Example**: `45.123456, -73.654321`
- **Range**: Latitude ±90°, Longitude ±180°
- **Post-processing**: None required

#### 2. NMEA Format (DDMM.MMMMM)
- **Format**: `DDMM.MMMMM` (degrees + decimal minutes)
- **Example**: `4512.3456` = 45°12.3456' = 45.205760°
- **Post-processing**: 
  ```
  degrees = floor(value / 100)
  minutes = value % 100
  decimal = degrees + (minutes / 60)
  ```

#### 3. VBOX Minutes Format
- **Format**: Total minutes as decimal
- **Example**: `2707.2074` = 45.120123°
- **Post-processing**: `decimal_degrees = total_minutes / 60`

#### 4. Local Coordinates
- **Format**: Large values (> 1000) indicating local coordinate system
- **Post-processing**: No conversion applied

### Numeric Values
- **Null values**: Represented as `(null)`, `null`, or empty strings
- **Post-processing**: Converted to `null` or default value (0)
- **Invalid numbers**: Gracefully handled, converted to default values

### Video File Association
Video files follow the naming pattern `{vbo_filename}_NNNN.mp4`:
- VBO file: `session_RD.vbo`
- Video files: `session_RD_0001.mp4`, `session_RD_0002.mp4`, etc.

The `aviFileIndex` field in data points indicates which video file (1, 2, 3...), and `aviSyncTime` provides the timestamp within that video.

## Channel Mappings

The parser supports flexible column name mapping. Common variations:

| VBO Column | Standard Name | Variations |
|------------|---------------|------------|
| `sats` | satellites | `satellites` |
| `time` | time | - |
| `lat` | latitude | `latitude` |
| `long` | longitude | `longitude` |
| `velocity` | velocity | `velocity kmh` |
| `vert-vel` | verticalVelocity | `vertical velocity m/s` |
| `Tsample` | samplePeriod | `sampleperiod` |
| `solution_type` | solutionType | `solution type` |
| `avifileindex` | aviFileIndex | - |
| `avisynctime` | aviSyncTime | - |

## Complete Channel List

Based on the parser's default mappings, VBO files may contain these channels:

### GPS/Navigation
- `satellites` - Number of GPS satellites
- `time` - Timestamp (HHMMSS.mmm format)
- `latitude` - GPS latitude
- `longitude` - GPS longitude
- `velocity` - GPS velocity (km/h)
- `heading` - GPS heading (degrees)
- `height` - GPS altitude
- `verticalVelocity` - Vertical velocity (m/s)
- `samplePeriod` - Sample period
- `solutionType` - GPS solution quality

### Video Synchronization
- `aviFileIndex` - Video file index (1, 2, 3...)
- `aviSyncTime` - Timestamp in video file

### Vehicle Dynamics
- `comboAcc` - Combined acceleration
- `comboG` - Combined G-force
- `steeringAngle` - Steering wheel angle
- `vehicleSpeed` - Vehicle speed (may differ from GPS velocity)
- `gear` - Current gear

### Engine/Powertrain
- `engineSpeed` - Engine RPM
- `throttlePedal` - Throttle pedal position (%)

### Braking
- `brakePressureFront` - Front brake pressure

### Traction Control
- `tcSlip` - TC slip value
- `tcGain` - TC gain
- `tcActive` - TC active status

### System Maps
- `ppsMap` - PPS map value
- `epsMap` - EPS map value  
- `engMap` - Engine map value

### Environmental
- `ambientTemperature` - Ambient temperature
- `carOnJack` - Car on jack status
- `headrest` - Headrest status
- `fuelProbe` - Fuel probe reading

### Session Data
- `driverId` - Driver identifier (numeric)
- `lapNumber` - Current lap number
- `lapGainLoss` - Lap time gain/loss

## File Variations

### Minimal VBO File
```
[header]
time
latitude
longitude

[data]
143025.500 45.123456 -73.654321
143026.000 45.124456 -73.655321
```

### Complete VBO File
```
File created on 15/12/2023 @ 14:30:25

[header]
satellites
time
latitude
longitude
velocity
heading
height
engineSpeed
gear

[channel units]
(null)
s
deg
deg
kmh
deg
m
rpm
(null)

[column names]
sats time lat long velocity heading height Engine_Speed Gear

[data]
8 143025.500 4512.3456 -7365.4321 85.2 180.5 100.5 3000 3
7 143026.000 4512.4456 -7365.5321 82.1 175.2 100.3 2950 3

[laptiming]
Start +2000.0 +1000.0 +2001.0 +1001.0 ¬ Start/Finish
Split +2100.0 +1100.0 +2101.0 +1101.0 ¬ Sector 1

[circuit details]
country United States
circuit Test Circuit
```

## Parser Implementation Notes

1. **Section Detection**: Parser looks for lines starting with `[` and ending with `]`
2. **Flexible Parsing**: Missing sections are handled gracefully
3. **Column Mapping**: Uses both default mappings and custom user mappings
4. **Coordinate Detection**: Automatically detects coordinate system type
5. **Error Handling**: Invalid data points are skipped, not fatal
6. **Memory Efficiency**: Supports limiting data points for large files
7. **Video Integration**: Automatically detects associated video files

## Usage with Parser

```typescript
import { VBOParser } from '@vbo-parser/core';

const parser = new VBOParser({
  customColumnMappings: {
    'custom_speed': 'velocity',
    'my_rpm': 'engineSpeed'
  }
});

const session = await parser.parseVBOFile(vboContent);

// Access video for a data point
const videoInfo = VBOParser.getVideoForDataPoint(session, session.dataPoints[0]);
// Returns: { file: '/videos/filename_0001.mp4', timestamp: 15.25 } or null
```

This flexible format allows VBO files to contain anywhere from basic GPS data to comprehensive vehicle telemetry, with the parser adapting to the available data.