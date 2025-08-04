#!/usr/bin/env bun

import { parseVBOFile, LapDetection } from '../src';
import type { VBODataPoint } from '../src';

interface RealLapData {
  lapNumber: number;
  lapTime: number; // in seconds
  maxSpeed: number;
}

const REAL_LAP_TIMES: RealLapData[] = [
  { lapNumber: 1, lapTime: 123.27, maxSpeed: 273.210 },
  { lapNumber: 2, lapTime: 117.47, maxSpeed: 280.250 },
  { lapNumber: 3, lapTime: 115.70, maxSpeed: 279.910 },
  { lapNumber: 4, lapTime: 114.62, maxSpeed: 281.800 }, // fastest
  { lapNumber: 5, lapTime: 126.02, maxSpeed: 281.330 },
];

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toFixed(2).padStart(5, '0')}`;
}

async function debugLapDetection(filePath: string) {
  console.log('🔍 DEBUGGING LAP DETECTION');
  console.log('─'.repeat(60));
  
  try {
    // Parse VBO file
    const file = Bun.file(filePath);
    const content = await file.text();
    const session = await parseVBOFile(content);
    
    console.log(`📊 Total data points: ${session.dataPoints.length.toLocaleString()}`);
    console.log(`⏱️  Total session time: ${formatTime(session.totalTime)}`);
    console.log(`📈 Sample rate: ~${(session.dataPoints.length / session.totalTime).toFixed(1)} Hz`);
    
    // Analyze lap number transitions
    console.log('\n🔄 LAP NUMBER ANALYSIS');
    console.log('─'.repeat(40));
    
    const lapTransitions: Array<{
      fromLap: number;
      toLap: number;
      timePoint: number;
      dataIndex: number;
    }> = [];
    
    let currentLap = 0;
    session.dataPoints.forEach((point, index) => {
      if (point.lapNumber && point.lapNumber !== currentLap && point.lapNumber > 0) {
        lapTransitions.push({
          fromLap: currentLap,
          toLap: point.lapNumber,
          timePoint: point.time,
          dataIndex: index
        });
        currentLap = point.lapNumber;
      }
    });
    
    console.log(`Found ${lapTransitions.length} lap transitions:`);
    lapTransitions.forEach((transition, i) => {
      console.log(`  ${i + 1}. Lap ${transition.fromLap} → ${transition.toLap} at ${formatTime(transition.timePoint)} (index ${transition.dataIndex})`);
    });
    
    // Group data by lap number
    console.log('\n📋 LAP DATA DISTRIBUTION');
    console.log('─'.repeat(40));
    
    const lapGroups = new Map<number, VBODataPoint[]>();
    session.dataPoints.forEach(point => {
      if (point.lapNumber && point.lapNumber > 0) {
        if (!lapGroups.has(point.lapNumber)) {
          lapGroups.set(point.lapNumber, []);
        }
        lapGroups.get(point.lapNumber)!.push(point);
      }
    });
    
    for (const [lapNum, points] of lapGroups) {
      const minTime = Math.min(...points.map(p => p.time));
      const maxTime = Math.max(...points.map(p => p.time));
      const duration = maxTime - minTime;
      
      console.log(`Lap ${lapNum}: ${points.length} points, ${formatTime(minTime)} → ${formatTime(maxTime)} (${formatTime(duration)})`);
    }
    
    // Run current lap detection
    console.log('\n🏁 CURRENT ALGORITHM RESULTS');
    console.log('─'.repeat(40));
    
    const detectedLaps = LapDetection.detectLaps(session.dataPoints);
    console.log(`Detected ${detectedLaps.length} laps:`);
    
    detectedLaps.forEach(lap => {
      console.log(`  Lap ${lap.lapNumber}: ${formatTime(lap.lapTime)} (${formatTime(lap.startTime)} → ${formatTime(lap.endTime)})`);
      if (lap.distance) {
        console.log(`    Distance: ${(lap.distance / 1000).toFixed(2)} km`);
      }
    });
    
    // Compare with real data
    console.log('\n📊 COMPARISON WITH REAL DATA');
    console.log('─'.repeat(40));
    
    console.log('Real lap times:');
    REAL_LAP_TIMES.forEach(real => {
      console.log(`  Lap ${real.lapNumber}: ${formatTime(real.lapTime)} (${real.maxSpeed.toFixed(1)} km/h max)`);
    });
    
    console.log('\nDetected vs Real:');
    detectedLaps.forEach(detected => {
      const real = REAL_LAP_TIMES.find(r => r.lapNumber === detected.lapNumber);
      if (real) {
        const diff = detected.lapTime - real.lapTime;
        const diffStr = diff > 0 ? `+${formatTime(diff)}` : formatTime(Math.abs(diff));
        console.log(`  Lap ${detected.lapNumber}: ${formatTime(detected.lapTime)} vs ${formatTime(real.lapTime)} (${diffStr})`);
      }
    });
    
    // Analyze GPS data for potential issues
    console.log('\n🌍 GPS ANALYSIS');
    console.log('─'.repeat(40));
    
    const gpsPoints = session.dataPoints.filter(p => p.latitude !== 0 && p.longitude !== 0);
    console.log(`GPS points: ${gpsPoints.length}/${session.dataPoints.length}`);
    
    if (gpsPoints.length > 100) {
      // Look for potential start/finish line area
      const startPoints = gpsPoints.slice(0, 50);
      const endPoints = gpsPoints.slice(-50);
      
      const avgStartLat = startPoints.reduce((sum, p) => sum + p.latitude, 0) / startPoints.length;
      const avgStartLng = startPoints.reduce((sum, p) => sum + p.longitude, 0) / startPoints.length;
      const avgEndLat = endPoints.reduce((sum, p) => sum + p.latitude, 0) / endPoints.length;
      const avgEndLng = endPoints.reduce((sum, p) => sum + p.longitude, 0) / endPoints.length;
      
      console.log(`Start area: ${avgStartLat.toFixed(6)}, ${avgStartLng.toFixed(6)}`);
      console.log(`End area: ${avgEndLat.toFixed(6)}, ${avgEndLng.toFixed(6)}`);
      
      const startEndDistance = LapDetection['calculateDistance'](avgStartLat, avgStartLng, avgEndLat, avgEndLng);
      console.log(`Start-end distance: ${startEndDistance.toFixed(1)}m`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Usage
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: bun bin/debug-lap-detection.ts <vbo-file-path>');
  console.log('');
  console.log('Example:');
  console.log('  bun bin/debug-lap-detection.ts ../../public/videos/25IT04_RdAm_PT2_Run01_RD.vbo');
  process.exit(1);
}

const filePath = args[0];
await debugLapDetection(filePath);