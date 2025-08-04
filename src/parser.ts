import {
  type VBOHeader,
  type VBOChannel,
  type VBODataPoint,
  type VBOSession,
  type VBOCircuitInfo,
  type VBOVideoFile,
  type VBOParserOptions,
  type FileSystemFileHandle,
  type FileSystemDirectoryHandle,
  VBOParseError,
  VBOValidationError,
} from './types';

export class VBOParser {
  private static readonly DEFAULT_COLUMN_NAMES_MAP: Record<string, keyof VBODataPoint> = {
    'sats': 'satellites',
    'satellites': 'satellites', // Exact match
    'time': 'time',
    'lat': 'latitude',
    'latitude': 'latitude', // Exact match
    'long': 'longitude',
    'longitude': 'longitude', // Exact match
    'velocity': 'velocity',
    'velocity kmh': 'velocity', // Exact match from VBO
    'heading': 'heading',
    'height': 'height',
    'vert-vel': 'verticalVelocity',
    'vertical velocity m/s': 'verticalVelocity', // Exact match from VBO
    'Tsample': 'samplePeriod',
    'sampleperiod': 'samplePeriod', // Exact match from VBO
    'solution_type': 'solutionType',
    'solution type': 'solutionType', // Exact match from VBO
    'avifileindex': 'aviFileIndex',
    'avisynctime': 'aviSyncTime',
    'ComboAcc': 'comboAcc',
    'TC_Slip': 'tcSlip',
    'TC_Gain': 'tcGain',
    'PPS_Map': 'ppsMap',
    'EPS_Map': 'epsMap',
    'ENG_Map': 'engMap',
    'DriverID': 'driverId',
    'Ambient_Temperature': 'ambientTemperature',
    'Car_On_Jack': 'carOnJack',
    'Headrest': 'headrest',
    'Fuel_Probe': 'fuelProbe',
    'TC_Active': 'tcActive',
    'Lap_Number': 'lapNumber',
    'Lap_Gain_Loss': 'lapGainLoss',
    'Engine_Speed': 'engineSpeed',
    'Steering_Angle': 'steeringAngle',
    'Brake_Pressure_Front': 'brakePressureFront',
    'Throttle_Pedal': 'throttlePedal',
    'Vehicle_Speed': 'vehicleSpeed',
    'Gear': 'gear',
    'Combo_G': 'comboG',
  };

  private options: Required<VBOParserOptions>;

  constructor(options: VBOParserOptions = {}) {
    this.options = {
      calculateLaps: true,
      customColumnMappings: {},
      validateDataPoints: false,
      maxDataPoints: undefined,
      ...options,
    };
  }

  /**
   * Parse a VBO file from various input sources
   */
  async parseVBOFile(input: File | string | Uint8Array): Promise<VBOSession> {
    let content: string;

    try {
      if (input instanceof File) {
        content = await input.text();
      } else if (typeof input === 'string') {
        content = input;
      } else if (input instanceof Uint8Array) {
        content = new TextDecoder().decode(input);
      } else {
        throw new VBOParseError('Unsupported input type');
      }

      const session = await this.parseVBOContent(content, input instanceof File ? input.name : 'unknown.vbo');

      return session;
    } catch (error) {
      if (error instanceof VBOParseError) {
        throw error;
      }
      throw new VBOParseError(`Failed to parse VBO file: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Parse multiple VBO files from FileList or File array
   */
  async parseVBOFromInput(input: FileList | File[]): Promise<VBOSession[]> {
    const files = Array.from(input);
    const sessions: VBOSession[] = [];

    for (const fileInput of files) {
      try {
        const session = await this.parseVBOFile(fileInput);
        sessions.push(session);
      } catch (error) {
        console.error(`Failed to parse VBO file ${fileInput.name}:`, error);
        // Continue processing other files
      }
    }

    return sessions;
  }

  /**
   * Parse VBO content from string
   */
  private async parseVBOContent(content: string, filePath: string): Promise<VBOSession> {
    const lines = content.split(/\r?\n/);

    if (lines.length === 0) {
      throw new VBOParseError('VBO file is empty');
    }

    try {
      const header = this.parseHeader(lines);
      const rawDataPoints = this.parseDataSectionRaw(lines, header);

      if (rawDataPoints.length === 0 && (this.options.maxDataPoints === undefined || this.options.maxDataPoints > 0)) {
        throw new VBOParseError('No data points found in VBO file');
      }

      // Calculate total time before normalization
      let totalTime = 0;
      if (rawDataPoints.length > 0) {
        for (let i = 0; i < rawDataPoints.length; i++) {
          if (rawDataPoints[i].time > totalTime) {
            totalTime = rawDataPoints[i].time;
          }
        }
      }

      // Normalize data points
      const dataPoints = this.normalizeDataPoints(rawDataPoints);

      // Parse circuit info and timing lines
      const circuitInfo = this.parseCircuitInfo(content);

      const session: VBOSession = {
        filePath,
        header,
        dataPoints,
        laps: [],
        totalTime,
        trackLength: undefined,
        circuitInfo,
        videos: this.findVideoFiles(filePath),
      };

      return session;
    } catch (error) {
      if (error instanceof VBOParseError) {
        throw error;
      }
      throw new VBOParseError(`Failed to parse VBO content: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error : undefined);
    }
  }

  private parseHeader(lines: string[]): VBOHeader {
    const creationDateLine = lines.find(line => line.startsWith('File created on'));
    let creationDate = new Date();

    if (creationDateLine) {
      const dateMatch = creationDateLine.match(/File created on (.+)/);
      if (dateMatch) {
        const dateStr = dateMatch[1].trim();
        const parsedDate = this.parseVBODate(dateStr);
        if (parsedDate) {
          creationDate = parsedDate;
        }
      }
    }

    const headerStartIndex = lines.findIndex(line => line.trim() === '[header]');
    const unitsStartIndex = lines.findIndex(line => line.trim() === '[channel units]');

    if (headerStartIndex === -1) {
      throw new VBOParseError('No [header] section found in VBO file');
    }

    const channels: VBOChannel[] = [];
    const units: string[] = [];

    // Parse channels
    for (let i = headerStartIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '' || line.startsWith('[')) break;

      channels.push({
        name: line,
        unit: '',
        index: channels.length,
      });
    }

    // Parse units
    if (unitsStartIndex !== -1) {
      for (let i = unitsStartIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '' || line.startsWith('[')) break;
        units.push(line);
      }

      // Assign units to channels
      for (let i = 0; i < Math.min(channels.length, units.length); i++) {
        channels[i].unit = units[i];
      }
    }

    return {
      creationDate,
      channels,
      units,
    };
  }

  private parseDataSectionRaw(lines: string[], header: VBOHeader): VBODataPoint[] {
    const dataStartIndex = lines.findIndex(line => line.trim() === '[data]');
    if (dataStartIndex === -1) {
      console.error('Available sections:', lines.filter(line => line.trim().startsWith('[')).map(line => line.trim()));
      throw new VBOParseError('No [data] section found in VBO file');
    }

    // Find column names line
    const columnNamesIndex = lines.findIndex(line => line.trim() === '[column names]');
    let columnMapping: string[] = [];

    if (columnNamesIndex >= 0 && columnNamesIndex < dataStartIndex) {
      const columnLine = lines[columnNamesIndex + 1];
      if (columnLine) {
        columnMapping = columnLine.trim().split(/\s+/);
      }
    }

    // If no column mapping found, use header channels
    if (columnMapping.length === 0) {
      columnMapping = header.channels.map(ch => ch.name);
    }

    // Merge default and custom column mappings
    const allColumnMappings = { ...VBOParser.DEFAULT_COLUMN_NAMES_MAP, ...this.options.customColumnMappings };

    const rawDataPoints: VBODataPoint[] = [];
    let processedCount = 0;

    for (let i = dataStartIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '' || line.startsWith('[')) continue;

      // Check max data points limit
      if (this.options.maxDataPoints !== undefined && processedCount >= this.options.maxDataPoints) {
        break;
      }

      const values = line.split(/\s+/);
      if (values.length === 0) continue;

      try {
        const dataPoint = this.createDataPoint(values, columnMapping, allColumnMappings);
        rawDataPoints.push(dataPoint);
        processedCount++;
      } catch (error) {
        console.warn(`Failed to parse data point at line ${i + 1}:`, error);
        // Continue processing other lines
      }
    }

    return rawDataPoints;
  }

  private createDataPoint(values: string[], columnMapping: string[], mappings: Record<string, keyof VBODataPoint>): VBODataPoint {
    const dataPoint: Partial<VBODataPoint> = {};

    // Initialize with default values
    const defaultDataPoint: VBODataPoint = {
      satellites: 0,
      time: 0,
      latitude: 0,
      longitude: 0,
      velocity: 0,
      heading: 0,
      height: 0,
      verticalVelocity: 0,
      samplePeriod: 0,
      solutionType: 0,
      aviFileIndex: 0,
      aviSyncTime: 0,
      comboAcc: 0,
      tcSlip: 0,
      tcGain: 0,
      ppsMap: 0,
      epsMap: 0,
      engMap: 0,
      driverId: 0,
      ambientTemperature: 0,
      carOnJack: 0,
      headrest: 0,
      fuelProbe: 0,
      tcActive: 0,
      lapNumber: 0,
      lapGainLoss: 0,
      engineSpeed: 0,
      steeringAngle: 0,
      brakePressureFront: 0,
      throttlePedal: 0,
      vehicleSpeed: 0,
      gear: 0,
      comboG: 0,
    };

    // Map column values to data point properties
    for (let i = 0; i < Math.min(values.length, columnMapping.length); i++) {
      const columnName = columnMapping[i];
      const mappedName = mappings[columnName] || columnName;

      if (mappedName in defaultDataPoint) {
        let numericValue: number | null = null;

        // Special handling for time field (HHMMSS.mmm format)
        if (mappedName === 'time') {
          numericValue = this.parseVBOTime(values[i]);
        } else {
          numericValue = this.parseNumericValue(values[i]);
        }

        if (numericValue !== null) {
          (dataPoint as any)[mappedName] = numericValue;
        }
      }
    }

    // Merge with defaults
    return { ...defaultDataPoint, ...dataPoint };
  }

  /**
   * Parse VBO time format (HHMMSS.mmm) to seconds since midnight
   */
  private parseVBOTime(timeString: string): number | null {
    if (!timeString || timeString === '(null)' || timeString === 'null') return null;

    const timeNum = parseFloat(timeString);
    if (isNaN(timeNum)) return null;

    // Extract HHMMSS.mmm components
    const hours = Math.floor(timeNum / 10000);
    const minutes = Math.floor((timeNum % 10000) / 100);
    const seconds = timeNum % 100;

    // Validate ranges
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds >= 60) {
      // If not valid HHMMSS format, treat as regular number (fallback)
      return timeNum;
    }

    // Convert to total seconds since midnight
    return hours * 3600 + minutes * 60 + seconds;
  }

  private parseNumericValue(value: string): number | null {
    if (!value || value === '(null)' || value === 'null') return null;

    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  /**
   * Normalize data points by converting absolute timestamps to session-relative times
   * and NMEA coordinates to decimal degrees
   */
  private normalizeDataPoints(dataPoints: VBODataPoint[]): VBODataPoint[] {
    if (dataPoints.length === 0) return dataPoints;

    // Find the minimum time to use as session start
    let minTime = Infinity;
    for (let i = 0; i < dataPoints.length; i++) {
      if (dataPoints[i].time < minTime) {
        minTime = dataPoints[i].time;
      }
    }

    // Detect coordinate system type and conversion needed
    const coordinateType = this.detectCoordinateSystem(dataPoints);
    const needsConversion = coordinateType === 'nmea' || coordinateType === 'vbox_minutes';

    // Pre-calculate conversion functions to avoid repeated checks
    const convertLat = needsConversion ? (lat: number) => 
      lat !== 0 ? this.convertCoordinate(lat, coordinateType) : lat : 
      (lat: number) => lat;
    
    const convertLng = needsConversion ? (lng: number) => 
      lng !== 0 ? this.convertCoordinate(lng, coordinateType) : lng : 
      (lng: number) => lng;

    // Use a single pass with pre-allocated array
    const result = new Array(dataPoints.length);
    for (let i = 0; i < dataPoints.length; i++) {
      const point = dataPoints[i];
      result[i] = {
        ...point,
        time: point.time - minTime,
        latitude: convertLat(point.latitude),
        longitude: convertLng(point.longitude),
      };
    }

    return result;
  }

  /**
   * Detect the coordinate system used in the data points
   */
  private detectCoordinateSystem(dataPoints: VBODataPoint[]): 'gps' | 'nmea' | 'vbox_minutes' | 'local' {
    const nonZeroPoints = dataPoints.filter(p => p.latitude !== 0 && p.longitude !== 0);
    if (nonZeroPoints.length === 0) return 'gps';

    const sample = nonZeroPoints.slice(0, Math.min(100, nonZeroPoints.length));

    // Check if values are too large for any GPS format (> 1000 suggests local coordinates)
    const hasLargeValues = sample.some(p => Math.abs(p.latitude) > 1000 || Math.abs(p.longitude) > 1000);
    if (hasLargeValues) {
      return 'local';
    }

    // Check coordinate ranges for GPS formats
    const latRange = Math.max(...sample.map(p => p.latitude)) - Math.min(...sample.map(p => p.latitude));
    const lonRange = Math.max(...sample.map(p => p.longitude)) - Math.min(...sample.map(p => p.longitude));

    // Check for VBOX minutes format (only for values that could be GPS)
    const couldBeVboxMinutes = sample.some(p => {
      const latDegrees = Math.abs(p.latitude) / 60;
      const lonDegrees = Math.abs(p.longitude) / 60;
      return latDegrees >= 0 && latDegrees <= 90 && lonDegrees >= 0 && lonDegrees <= 180 &&
             (Math.abs(p.latitude) > 100 || Math.abs(p.longitude) > 100) &&
             (Math.abs(p.latitude) < 1000 && Math.abs(p.longitude) < 1000);
    });

    if (couldBeVboxMinutes) {
      return 'vbox_minutes';
    }

    // Check for NMEA format (DDMM.MMMMM)
    const couldBeNmea = sample.some(p => {
      const latDegrees = Math.floor(Math.abs(p.latitude) / 100);
      const latMinutes = Math.abs(p.latitude) - (latDegrees * 100);
      const lonDegrees = Math.floor(Math.abs(p.longitude) / 100);
      const lonMinutes = Math.abs(p.longitude) - (lonDegrees * 100);

      return latDegrees <= 90 && latMinutes < 60 && lonDegrees <= 180 && lonMinutes < 60 &&
             (Math.abs(p.latitude) > 1000 || Math.abs(p.longitude) > 1000);
    });

    if (couldBeNmea) {
      return 'nmea';
    }

    // Default to standard GPS decimal degrees
    return 'gps';
  }

  /**
   * Convert coordinates based on the detected type
   */
  private convertCoordinate(coordinate: number, type: 'nmea' | 'vbox_minutes'): number {
    switch (type) {
      case 'nmea':
        return this.nmeaToDecimal(coordinate);
      case 'vbox_minutes':
        return this.vboxMinutesToDecimal(coordinate);
      default:
        return coordinate;
    }
  }

  /**
   * Parse circuit information and timing lines from VBO content
   */
  private parseCircuitInfo(content: string): VBOCircuitInfo {
    const lines = content.split(/\r?\n/);
    const circuitInfo: VBOCircuitInfo = {
      timingLines: []
    };

    let inLapTimingSection = false;
    let inCircuitDetailsSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === '[laptiming]') {
        inLapTimingSection = true;
        inCircuitDetailsSection = false;
        continue;
      }

      if (trimmed === '[circuit details]') {
        inCircuitDetailsSection = true;
        inLapTimingSection = false;
        continue;
      }

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        inLapTimingSection = false;
        inCircuitDetailsSection = false;
        continue;
      }

      if (inLapTimingSection && trimmed) {
        const timingLine = this.parseTimingLine(trimmed);
        if (timingLine) {
          circuitInfo.timingLines.push(timingLine);
        }
      }

      if (inCircuitDetailsSection && trimmed) {
        if (trimmed.startsWith('country ')) {
          circuitInfo.country = trimmed.substring(8);
        } else if (trimmed.startsWith('circuit ')) {
          circuitInfo.circuit = trimmed.substring(8);
        }
      }
    }

    return circuitInfo;
  }

  /**
   * Parse a single timing line from the [laptiming] section
   * Format: Start/Split +Long1 +Lat1 +Long2 +Lat2 ¬ Name
   */
  private parseTimingLine(line: string): any | null {
    try {
      // Split by whitespace and filter out empty parts
      const parts = line.split(/\s+/).filter(part => part.length > 0);

      if (parts.length < 6) return null;

      const type = parts[0] as 'Start' | 'Split';
      if (type !== 'Start' && type !== 'Split') return null;

      // Parse coordinates (remove + signs)
      const long1 = parseFloat(parts[1].replace(/\+/, ''));
      const lat1 = parseFloat(parts[2].replace(/\+/, ''));
      const long2 = parseFloat(parts[3].replace(/\+/, ''));
      const lat2 = parseFloat(parts[4].replace(/\+/, ''));

      // Extract name (everything after ¬)
      const nameIndex = line.indexOf('¬');
      const name = nameIndex >= 0 ? line.substring(nameIndex + 1).trim() : `${type} Line`;

      return {
        type,
        start: { latitude: lat1, longitude: long1 },
        end: { latitude: lat2, longitude: long2 },
        name
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Convert NMEA coordinates (DDMM.MMMMM) to decimal degrees
   */
  private nmeaToDecimal(nmeaCoord: number): number {
    if (nmeaCoord === 0) return 0;

    const degrees = Math.floor(Math.abs(nmeaCoord) / 100);
    const minutes = Math.abs(nmeaCoord) % 100;
    const decimal = degrees + (minutes / 60);

    // Preserve sign
    return nmeaCoord < 0 ? -decimal : decimal;
  }

  /**
   * Convert VBOX minutes format to decimal degrees
   * VBOX format: total_minutes = (degrees * 60) + minutes + (seconds / 60)
   */
  private vboxMinutesToDecimal(totalMinutes: number): number {
    const sign = totalMinutes >= 0 ? 1 : -1;
    const absTotalMinutes = Math.abs(totalMinutes);

    // Convert total minutes back to decimal degrees
    const decimalDegrees = absTotalMinutes / 60;

    return decimalDegrees * sign;
  }

  private parseVBODate(dateStr: string): Date | null {
    // Try different date formats that might appear in VBO files
    const formats = [
      /(\d{2})\/(\d{2})\/(\d{4}) @ (\d{2}):(\d{2}):(\d{2})/, // DD/MM/YYYY @ HH:MM:SS
      /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (match.length >= 4) {
          const [, day, month, year, hour = '0', minute = '0', second = '0'] = match;
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day),
                         parseInt(hour), parseInt(minute), parseInt(second));
        }
      }
    }

    return null;
  }

  private findVideoFiles(vboPath: string): VBOVideoFile[] {
    const videos: VBOVideoFile[] = [];
    
    if (vboPath.toLowerCase().endsWith('.vbo')) {
      const baseName = vboPath.replace(/\.vbo$/i, '');
      
      // Check for multiple video files with pattern {filename}_0001.mp4, {filename}_0002.mp4, etc.
      // For now, we'll assume a reasonable maximum of 10 video files per VBO
      for (let i = 1; i <= 10; i++) {
        const videoIndex = i.toString().padStart(4, '0');
        const videoFilename = `${baseName}_${videoIndex}.mp4`.split('/').pop();
        
        if (videoFilename) {
          videos.push({
            filename: `/videos/${videoFilename}`,
            index: i
          });
        }
      }
    }
    
    return videos;
  }


  /**
   * Get video file and timestamp for a specific data point
   * Uses aviFileIndex to find the correct video file and aviSyncTime for the timestamp
   */
  static getVideoForDataPoint(session: VBOSession, dataPoint: VBODataPoint): { file: string; timestamp: number } | null {
    const videoIndex = dataPoint.aviFileIndex;
    const timestamp = dataPoint.aviSyncTime;
    
    // Find the video file with the matching index
    const videoFile = session.videos.find(video => video.index === videoIndex);
    
    if (!videoFile) {
      return null;
    }
    
    return {
      file: videoFile.filename,
      timestamp: timestamp
    };
  }

  /**
   * Calculate distance between two GPS coordinates using Haversine formula
   */
  static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * List VBO files from various sources
   */
  static async listVBOFiles(directory: string = '/public/videos'): Promise<string[]> {
    // Browser/server environment - return known files
    const knownFiles = [
      `${directory}/25IT04_RdAm_PT2_Run01_RD.vbo`,
      `${directory}/25IT04_RdAm_PT2_Run05_TL.vbo`,
    ];

    return knownFiles;
  }

  /**
   * Open file picker for VBO files (browser only)
   */
  static async openFilePicker(): Promise<FileSystemFileHandle[]> {
    throw new VBOParseError('File System Access API not supported in this environment');
  }
}

// Re-export error classes for convenience
export { VBOParseError, VBOValidationError };