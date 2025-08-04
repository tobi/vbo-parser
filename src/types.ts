import { z } from 'zod';

// Core VBO data structures
export const VBOChannelSchema = z.object({
  name: z.string(),
  unit: z.string(),
  index: z.number(),
});

export const VBOHeaderSchema = z.object({
  creationDate: z.date(),
  channels: z.array(VBOChannelSchema),
  units: z.array(z.string()),
  sampleRate: z.number().optional(),
  driverId: z.string().optional(),
  vehicle: z.string().optional(),
  version: z.string().optional(),
});

export const VBODataPointSchema = z.object({
  satellites: z.number(),
  time: z.number(),
  latitude: z.number(),
  longitude: z.number(),
  velocity: z.number(),
  heading: z.number(),
  height: z.number(),
  verticalVelocity: z.number(),
  samplePeriod: z.number(),
  solutionType: z.number(),
  aviFileIndex: z.number(),
  aviSyncTime: z.number(),
  comboAcc: z.number(),
  tcSlip: z.number(),
  tcGain: z.number(),
  ppsMap: z.number(),
  epsMap: z.number(),
  engMap: z.number(),
  driverId: z.number(),
  ambientTemperature: z.number(),
  carOnJack: z.number(),
  headrest: z.number(),
  fuelProbe: z.number(),
  tcActive: z.number(),
  lapNumber: z.number(),
  lapGainLoss: z.number(),
  engineSpeed: z.number(),
  steeringAngle: z.number(),
  brakePressureFront: z.number(),
  throttlePedal: z.number(),
  vehicleSpeed: z.number(),
  gear: z.number(),
  comboG: z.number(),
});

export const VBOSectorSchema = z.object({
  sectorNumber: z.number(),
  startTime: z.number(),
  endTime: z.number(),
  sectorTime: z.number(),
  startDistance: z.number(),
  endDistance: z.number(),
});

export const VBOLapSchema = z.object({
  lapNumber: z.number(),
  startTime: z.number(),
  endTime: z.number(),
  lapTime: z.number(),
  distance: z.number(),
  sectors: z.array(VBOSectorSchema),
  dataPoints: z.array(VBODataPointSchema),
  isValid: z.boolean(),
  fastestSector: z.number().optional(),
  label: z.enum(['off-track', 'in-lap', 'out-lap', 'timed-lap']),
});

export const VBOTimingLineSchema = z.object({
  type: z.enum(['Start', 'Split']),
  start: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  end: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  name: z.string(),
});

export const VBOCircuitInfoSchema = z.object({
  country: z.string().optional(),
  circuit: z.string().optional(),
  timingLines: z.array(VBOTimingLineSchema),
});

export const VBOSessionSchema = z.object({
  filePath: z.string(),
  videoPath: z.string().optional(),
  header: VBOHeaderSchema,
  laps: z.array(VBOLapSchema),
  fastestLap: VBOLapSchema.optional(),
  totalTime: z.number(),
  trackLength: z.number().optional(),
  dataPoints: z.array(VBODataPointSchema),
  circuitInfo: VBOCircuitInfoSchema,
});

// Inferred types
export type VBOHeader = z.infer<typeof VBOHeaderSchema>;
export type VBOChannel = z.infer<typeof VBOChannelSchema>;
export type VBODataPoint = z.infer<typeof VBODataPointSchema>;
export type VBOLap = z.infer<typeof VBOLapSchema>;
export type VBOSector = z.infer<typeof VBOSectorSchema>;
export type VBOTimingLine = z.infer<typeof VBOTimingLineSchema>;
export type VBOCircuitInfo = z.infer<typeof VBOCircuitInfoSchema>;
export type VBOSession = z.infer<typeof VBOSessionSchema>;

// Utility types
export interface TrackPoint {
  latitude: number;
  longitude: number;
  distance: number;
  speed?: number;
  time: number;
}

// Parser options
export interface VBOParserOptions {
  /**
   * Whether to calculate lap data automatically
   * @default true
   */
  calculateLaps?: boolean;

  /**
   * Custom column name mappings for VBO files with non-standard headers
   */
  customColumnMappings?: Record<string, keyof VBODataPoint>;

  /**
   * Whether to validate data points against schema (slower but safer)
   * @default false
   */
  validateDataPoints?: boolean;

  /**
   * Maximum number of data points to parse (for large files)
   * @default undefined (no limit)
   */
  maxDataPoints?: number;
}

// File system types for browser compatibility
export interface FileSystemFileHandle {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<File>;
}

export interface FileSystemDirectoryHandle {
  readonly kind: 'directory';
  readonly name: string;
  values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>;
}

// Error types
export class VBOParseError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'VBOParseError';
  }
}

export class VBOValidationError extends VBOParseError {
  constructor(message: string, public readonly validationErrors: z.ZodError) {
    super(message);
    this.name = 'VBOValidationError';
  }
}