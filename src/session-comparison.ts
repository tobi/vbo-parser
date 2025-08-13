import type { VBOSession, VBOLap, VBODataPoint } from './types';

/**
 * Represents a normalized position in a session
 */
export interface NormalizedPosition {
  /** Current lap number (1-indexed) */
  lapNumber: number;
  /** Progress through the current lap (0-1) based on data point index */
  lapProgress: number;
  /** Overall progress through the session (0-1) */
  sessionProgress: number;
  /** Index in the current lap's dataPoints array */
  dataPointIndex: number;
  /** The actual data point at this position */
  dataPoint: VBODataPoint;
  /** Normalized position (0-1) that can be compared across sessions */
  normalizedProgress: number;
}

/**
 * Options for creating a SessionComparison
 */
export interface SessionComparisonOptions {
  /** 
   * Whether to allow comparison of sessions from different tracks 
   * @default false
   */
  allowDifferentTracks?: boolean;
  /**
   * Progress tolerance for matching positions (0-1)
   * @default 0.01 (1% of lap)
   */
  progressTolerance?: number;
}

/**
 * Comparison state for a single session
 */
export interface SessionState {
  session: VBOSession;
  currentLapIndex: number;
  currentDataPointIndex: number;
  position: NormalizedPosition;
}

/**
 * SessionComparison provides synchronized navigation through multiple sessions
 * for easy comparison and analysis
 */
export class SessionComparison {
  private mainSession: VBOSession;
  private comparatorSessions: VBOSession[];
  private states: Map<VBOSession, SessionState>;
  private options: Required<SessionComparisonOptions>;

  constructor(
    mainSession: VBOSession,
    comparatorSessions: VBOSession[] = [],
    options: SessionComparisonOptions = {}
  ) {
    this.mainSession = mainSession;
    this.comparatorSessions = comparatorSessions;
    this.options = {
      allowDifferentTracks: false,
      progressTolerance: 0.01, // 1% of lap
      ...options
    };

    // Validate sessions
    this.validateSessions();

    // Initialize state tracking
    this.states = new Map();

    // Initialize states
    this.initializeStates();
  }

  /**
   * Validate that sessions are comparable
   */
  private validateSessions(): void {
    const allSessions = [this.mainSession, ...this.comparatorSessions];

    // Check that all sessions have laps
    for (const session of allSessions) {
      if (!session.laps || session.laps.length === 0) {
        throw new Error(`Session ${session.filePath} has no laps and cannot be compared`);
      }

      // Check that all laps have data points
      for (const lap of session.laps) {
        if (!lap.dataPoints || lap.dataPoints.length === 0) {
          throw new Error(
            `Lap ${lap.lapNumber} in session ${session.filePath} has no data points`
          );
        }
      }
    }

    // Check track compatibility if required
    if (!this.options.allowDifferentTracks) {
      const mainCircuit = this.mainSession.circuitInfo?.circuit;
      
      for (const session of this.comparatorSessions) {
        const circuit = session.circuitInfo?.circuit;
        
        // If both have circuit info, they must match
        if (mainCircuit && circuit && mainCircuit !== circuit) {
          throw new Error(
            `Cannot compare sessions from different tracks: ${mainCircuit} vs ${circuit}. ` +
            `Set allowDifferentTracks: true to override.`
          );
        }
      }
    }
  }

  /**
   * Initialize states for all sessions
   */
  private initializeStates(): void {
    const allSessions = [this.mainSession, ...this.comparatorSessions];

    for (const session of allSessions) {
      const position = this.calculateNormalizedPosition(session, 0, 0);

      this.states.set(session, {
        session,
        currentLapIndex: 0,
        currentDataPointIndex: 0,
        position
      });
    }
  }

  /**
   * Calculate normalized position for a given point in a session
   */
  private calculateNormalizedPosition(
    session: VBOSession,
    lapIndex: number,
    dataPointIndex: number
  ): NormalizedPosition {
    const lap = session.laps[lapIndex];
    if (!lap) {
      throw new Error(`Invalid lap index: ${lapIndex}`);
    }
    
    const dataPoint = lap.dataPoints[dataPointIndex];
    if (!dataPoint) {
      throw new Error(`Invalid data point index: ${dataPointIndex}`);
    }

    // Calculate lap progress based on data point index
    const lapProgress = lap.dataPoints.length > 1 
      ? dataPointIndex / (lap.dataPoints.length - 1) 
      : 0;

    // Calculate session progress
    const totalLaps = session.laps.length;
    const completedLaps = lapIndex;
    const sessionProgress = totalLaps > 0 
      ? (completedLaps + lapProgress) / totalLaps 
      : 0;

    // Calculate normalized progress (accounts for different lap counts between sessions)
    // This maps the position to a 0-1 scale that can be compared across sessions
    const normalizedProgress = sessionProgress;

    return {
      lapNumber: lap.lapNumber,
      lapProgress,
      sessionProgress,
      dataPointIndex,
      dataPoint,
      normalizedProgress
    };
  }

  /**
   * Get the current state of the main session
   */
  getMainState(): SessionState {
    const state = this.states.get(this.mainSession);
    if (!state) {
      throw new Error('Main session state not found');
    }
    return state;
  }

  /**
   * Get the current state of a comparator session
   */
  getComparatorState(index: number): SessionState | undefined {
    if (index < 0 || index >= this.comparatorSessions.length) {
      return undefined;
    }
    const session = this.comparatorSessions[index];
    return session ? this.states.get(session) : undefined;
  }

  /**
   * Get all comparator states
   */
  getAllComparatorStates(): SessionState[] {
    return this.comparatorSessions
      .map(session => this.states.get(session))
      .filter((state): state is SessionState => state !== undefined);
  }

  /**
   * Set the main session to a specific lap and data point
   */
  setMainPosition(lapIndex: number, dataPointIndex: number): void {
    const session = this.mainSession;
    
    if (lapIndex < 0 || lapIndex >= session.laps.length) {
      throw new Error(`Invalid lap index: ${lapIndex}`);
    }

    const lap = session.laps[lapIndex];
    if (!lap) {
      throw new Error(`Invalid lap index: ${lapIndex}`);
    }
    if (dataPointIndex < 0 || dataPointIndex >= lap.dataPoints.length) {
      throw new Error(`Invalid data point index: ${dataPointIndex}`);
    }

    const position = this.calculateNormalizedPosition(session, lapIndex, dataPointIndex);
    
    this.states.set(session, {
      session,
      currentLapIndex: lapIndex,
      currentDataPointIndex: dataPointIndex,
      position
    });

    // Sync comparators to this position
    this.syncComparatorsToMain();
  }

  /**
   * Move the main session forward by a number of data points
   */
  advanceMain(steps: number = 1): void {
    const state = this.states.get(this.mainSession);
    if (!state) {
      throw new Error('Main session state not found');
    }
    
    let lapIndex = state.currentLapIndex;
    let dataPointIndex = state.currentDataPointIndex;

    for (let i = 0; i < steps; i++) {
      const lap = this.mainSession.laps[lapIndex];
      if (!lap) break;
      
      dataPointIndex++;

      // Move to next lap if needed
      if (dataPointIndex >= lap.dataPoints.length) {
        lapIndex++;
        if (lapIndex >= this.mainSession.laps.length) {
          // Reached end of session
          lapIndex = this.mainSession.laps.length - 1;
          const lastLap = this.mainSession.laps[lapIndex];
          if (lastLap) {
            dataPointIndex = lastLap.dataPoints.length - 1;
          }
          break;
        }
        dataPointIndex = 0;
      }
    }

    this.setMainPosition(lapIndex, dataPointIndex);
  }

  /**
   * Move the main session backward by a number of data points
   */
  rewindMain(steps: number = 1): void {
    const state = this.states.get(this.mainSession);
    if (!state) {
      throw new Error('Main session state not found');
    }
    
    let lapIndex = state.currentLapIndex;
    let dataPointIndex = state.currentDataPointIndex;

    for (let i = 0; i < steps; i++) {
      dataPointIndex--;

      // Move to previous lap if needed
      if (dataPointIndex < 0) {
        lapIndex--;
        if (lapIndex < 0) {
          // Reached start of session
          lapIndex = 0;
          dataPointIndex = 0;
          break;
        }
        const lap = this.mainSession.laps[lapIndex];
        dataPointIndex = lap ? lap.dataPoints.length - 1 : 0;
      }
    }

    this.setMainPosition(lapIndex, dataPointIndex);
  }

  /**
   * Sync all comparator sessions to match the main session's position
   */
  private syncComparatorsToMain(): void {
    const mainState = this.states.get(this.mainSession);
    if (!mainState) {
      throw new Error('Main session state not found');
    }

    for (const comparatorSession of this.comparatorSessions) {
      const closestPoint = this.findClosestProgressPoint(
        comparatorSession,
        mainState.position.normalizedProgress
      );

      if (closestPoint) {
        const position = this.calculateNormalizedPosition(
          comparatorSession,
          closestPoint.lapIndex,
          closestPoint.dataPointIndex
        );

        this.states.set(comparatorSession, {
          session: comparatorSession,
          currentLapIndex: closestPoint.lapIndex,
          currentDataPointIndex: closestPoint.dataPointIndex,
          position
        });
      }
    }
  }

  /**
   * Find the closest data point in a session based on normalized progress
   */
  private findClosestProgressPoint(
    session: VBOSession,
    targetProgress: number
  ): { lapIndex: number; dataPointIndex: number } | null {
    let bestLapIndex = 0;
    let bestDataPointIndex = 0;
    let bestDifference = Infinity;

    for (let lapIndex = 0; lapIndex < session.laps.length; lapIndex++) {
      const lap = session.laps[lapIndex];
      if (!lap) continue;

      for (let pointIndex = 0; pointIndex < lap.dataPoints.length; pointIndex++) {
        const position = this.calculateNormalizedPosition(session, lapIndex, pointIndex);
        const difference = Math.abs(position.normalizedProgress - targetProgress);

        if (difference < bestDifference) {
          bestDifference = difference;
          bestLapIndex = lapIndex;
          bestDataPointIndex = pointIndex;
        }

        // Early exit if we found an exact match
        if (difference < 0.0001) {
          return { lapIndex: bestLapIndex, dataPointIndex: bestDataPointIndex };
        }
      }
    }

    // Return the best match if within tolerance
    if (bestDifference <= this.options.progressTolerance) {
      return { lapIndex: bestLapIndex, dataPointIndex: bestDataPointIndex };
    }

    // If no good match, return the closest anyway
    return { lapIndex: bestLapIndex, dataPointIndex: bestDataPointIndex };
  }

  /**
   * Find the closest data point in a session to another session's current position
   */
  findClosestToSession(
    targetSession: VBOSession,
    sourceSession: VBOSession,
    sourceDataPointIndex: number
  ): { lapIndex: number; dataPointIndex: number; position: NormalizedPosition } | null {
    const sourceState = this.states.get(sourceSession);
    if (!sourceState) {
      throw new Error('Source session not found in comparison');
    }

    // Get the source position's normalized progress
    const sourcePosition = this.calculateNormalizedPosition(
      sourceSession,
      sourceState.currentLapIndex,
      sourceDataPointIndex
    );

    const closestPoint = this.findClosestProgressPoint(
      targetSession, 
      sourcePosition.normalizedProgress
    );
    
    if (!closestPoint) {
      return null;
    }

    const position = this.calculateNormalizedPosition(
      targetSession,
      closestPoint.lapIndex,
      closestPoint.dataPointIndex
    );

    return {
      ...closestPoint,
      position
    };
  }

  /**
   * Get synchronized data points from all sessions at their current positions
   */
  getSynchronizedDataPoints(): {
    main: VBODataPoint;
    comparators: (VBODataPoint | null)[];
  } {
    const mainState = this.states.get(this.mainSession);
    if (!mainState) {
      throw new Error('Main session state not found');
    }
    const comparatorPoints: (VBODataPoint | null)[] = [];

    for (const comparatorSession of this.comparatorSessions) {
      const state = this.states.get(comparatorSession);
      if (state) {
        comparatorPoints.push(state.position.dataPoint);
      } else {
        comparatorPoints.push(null);
      }
    }

    return {
      main: mainState.position.dataPoint,
      comparators: comparatorPoints
    };
  }

  /**
   * Get a summary of the current comparison state
   */
  getSummary(): {
    mainSession: {
      filePath: string;
      lapNumber: number;
      progress: number;
      speed: number;
    };
    comparators: Array<{
      filePath: string;
      lapNumber: number;
      progress: number;
      speed: number;
      delta: number; // Time difference to main session
    }>;
  } {
    const mainState = this.states.get(this.mainSession);
    if (!mainState) {
      throw new Error('Main session state not found');
    }
    const mainDataPoint = mainState.position.dataPoint;

    const comparators = this.comparatorSessions.map(session => {
      const state = this.states.get(session);
      if (!state) {
        throw new Error(`State not found for session ${session.filePath}`);
      }
      const dataPoint = state.position.dataPoint;

      // Calculate time delta
      const delta = dataPoint.time - mainDataPoint.time;

      return {
        filePath: session.filePath,
        lapNumber: state.position.lapNumber,
        progress: state.position.sessionProgress,
        speed: dataPoint.velocity,
        delta
      };
    });

    return {
      mainSession: {
        filePath: this.mainSession.filePath,
        lapNumber: mainState.position.lapNumber,
        progress: mainState.position.sessionProgress,
        speed: mainDataPoint.velocity
      },
      comparators
    };
  }

  /**
   * Reset all sessions to the beginning
   */
  reset(): void {
    this.initializeStates();
  }

  /**
   * Jump to a specific lap in the main session
   */
  jumpToLap(lapNumber: number): void {
    const lapIndex = this.mainSession.laps.findIndex(lap => lap.lapNumber === lapNumber);
    
    if (lapIndex === -1) {
      throw new Error(`Lap ${lapNumber} not found in main session`);
    }

    this.setMainPosition(lapIndex, 0);
  }

  /**
   * Get the number of laps in the main session
   */
  getMainLapCount(): number {
    return this.mainSession.laps.length;
  }

  /**
   * Get the number of laps in a comparator session
   */
  getComparatorLapCount(index: number): number {
    if (index < 0 || index >= this.comparatorSessions.length) {
      return 0;
    }
    const session = this.comparatorSessions[index];
    return session ? session.laps.length : 0;
  }

  /**
   * Move to a specific normalized progress position (0-1)
   */
  setMainProgress(progress: number): void {
    if (progress < 0 || progress > 1) {
      throw new Error('Progress must be between 0 and 1');
    }

    const totalLaps = this.mainSession.laps.length;
    
    // Handle edge case where progress = 1
    if (progress === 1) {
      const lastLapIndex = totalLaps - 1;
      const lastLap = this.mainSession.laps[lastLapIndex];
      if (!lastLap) {
        throw new Error('Invalid lap calculation');
      }
      this.setMainPosition(lastLapIndex, lastLap.dataPoints.length - 1);
      return;
    }

    const lapPosition = progress * totalLaps;
    const lapIndex = Math.floor(lapPosition);
    const lapProgress = lapPosition - lapIndex;

    const lap = this.mainSession.laps[lapIndex];
    
    if (!lap) {
      throw new Error('Invalid lap calculation');
    }

    const dataPointIndex = Math.round(lapProgress * (lap.dataPoints.length - 1));
    this.setMainPosition(lapIndex, dataPointIndex);
  }

  /**
   * Get the current normalized progress of the main session (0-1)
   */
  getMainProgress(): number {
    const state = this.getMainState();
    return state.position.normalizedProgress;
  }
}