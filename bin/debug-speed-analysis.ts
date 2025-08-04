#!/usr/bin/env bun

import { parseVBOFile } from '../src';

async function debugSpeedAnalysis(filePath: string) {
  console.log('🏎️  SPEED PATTERN ANALYSIS');
  console.log('─'.repeat(60));

  try {
    const file = Bun.file(filePath);
    const content = await file.text();
    const session = await parseVBOFile(content);

    // Analyze speed distribution
    const speeds = session.dataPoints.map(p => p.velocity).filter(v => v > 0);
    speeds.sort((a, b) => a - b);

    const minSpeed = Math.min(...speeds);
    const maxSpeed = Math.max(...speeds);
    const avgSpeed = speeds.reduce((sum, s) => sum + s, 0) / speeds.length;
    const medianSpeed = speeds[Math.floor(speeds.length / 2)];
    const p90Speed = speeds[Math.floor(speeds.length * 0.9)];

    console.log('📊 SPEED STATISTICS:');
    console.log('─'.repeat(40));
    console.log(`Min speed: ${minSpeed.toFixed(1)} km/h`);
    console.log(`Max speed: ${maxSpeed.toFixed(1)} km/h`);
    console.log(`Average speed: ${avgSpeed.toFixed(1)} km/h`);
    console.log(`Median speed: ${medianSpeed.toFixed(1)} km/h`);
    console.log(`90th percentile: ${p90Speed.toFixed(1)} km/h`);

    // Speed histogram
    console.log('\n📈 SPEED DISTRIBUTION:');
    console.log('─'.repeat(40));
    const bins = [0, 20, 50, 100, 150, 200, 250, 300];
    for (let i = 0; i < bins.length - 1; i++) {
      const count = speeds.filter(s => s >= bins[i] && s < bins[i+1]).length;
      const percentage = (count / speeds.length * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor(count / speeds.length * 50));
      console.log(`${bins[i].toString().padStart(3)}-${bins[i+1].toString().padEnd(3)} km/h: ${count.toString().padStart(6)} (${percentage.padStart(5)}%) ${bar}`);
    }

    // Analyze racing segments
    console.log('\n🏁 RACING SEGMENT ANALYSIS:');
    console.log('─'.repeat(40));

    const RACING_SPEED_THRESHOLD = 100; // km/h
    const MIN_RACING_DURATION = 60; // seconds

    let racingSegments: Array<{ start: number, end: number, duration: number, avgSpeed: number, maxSpeed: number }> = [];
    let segmentStart = -1;
    let speedSum = 0;
    let speedCount = 0;
    let segmentMaxSpeed = 0;

    for (let i = 0; i < session.dataPoints.length; i++) {
      const point = session.dataPoints[i];
      const isRacingSpeed = point.velocity >= RACING_SPEED_THRESHOLD;

      if (isRacingSpeed) {
        if (segmentStart === -1) {
          segmentStart = i;
          speedSum = 0;
          speedCount = 0;
          segmentMaxSpeed = 0;
        }
        speedSum += point.velocity;
        speedCount++;
        segmentMaxSpeed = Math.max(segmentMaxSpeed, point.velocity);
      } else {
        // End of racing segment
        if (segmentStart !== -1) {
          const duration = session.dataPoints[i - 1].time - session.dataPoints[segmentStart].time;
          if (duration >= MIN_RACING_DURATION) {
            racingSegments.push({
              start: segmentStart,
              end: i - 1,
              duration,
              avgSpeed: speedSum / speedCount,
              maxSpeed: segmentMaxSpeed
            });
          }
          segmentStart = -1;
        }
      }
    }

    // Handle last segment
    if (segmentStart !== -1) {
      const duration = session.dataPoints[session.dataPoints.length - 1].time - session.dataPoints[segmentStart].time;
      if (duration >= MIN_RACING_DURATION) {
        racingSegments.push({
          start: segmentStart,
          end: session.dataPoints.length - 1,
          duration,
          avgSpeed: speedSum / speedCount,
          maxSpeed: segmentMaxSpeed
        });
      }
    }

    console.log(`Found ${racingSegments.length} racing segments (${RACING_SPEED_THRESHOLD}+ km/h for ${MIN_RACING_DURATION}+ seconds):`);

    racingSegments.forEach((segment, i) => {
      const startTime = session.dataPoints[segment.start].time;
      const endTime = session.dataPoints[segment.end].time;
      const duration = segment.duration;

      console.log(`  ${i + 1}. ${formatTime(startTime)} → ${formatTime(endTime)} (${formatTime(duration)})`);
      console.log(`     Avg: ${segment.avgSpeed.toFixed(1)} km/h, Max: ${segment.maxSpeed.toFixed(1)} km/h`);
      console.log(`     Points: ${segment.end - segment.start + 1}`);
    });

    // Analyze speed patterns over time to find lap characteristics
    console.log('\n⏱️  SPEED PATTERNS BY LAP:');
    console.log('─'.repeat(40));

    const lapNumbers = [...new Set(session.dataPoints.map(p => p.lapNumber).filter(n => n && n > 0))].sort();

    for (const lapNum of lapNumbers) {
      const lapPoints = session.dataPoints.filter(p => p.lapNumber === lapNum);
      if (lapPoints.length === 0) continue;

      const lapSpeeds = lapPoints.map(p => p.velocity).filter(v => v > 0);
      const lapAvgSpeed = lapSpeeds.reduce((sum, s) => sum + s, 0) / lapSpeeds.length;
      const lapMaxSpeed = Math.max(...lapSpeeds);
      const racingPoints = lapPoints.filter(p => p.velocity >= RACING_SPEED_THRESHOLD).length;
      const racingPercentage = (racingPoints / lapPoints.length * 100);

      console.log(`Lap ${lapNum}: Avg: ${lapAvgSpeed.toFixed(1)} km/h, Max: ${lapMaxSpeed.toFixed(1)} km/h`);
      console.log(`         Racing speed (${RACING_SPEED_THRESHOLD}+): ${racingPoints}/${lapPoints.length} points (${racingPercentage.toFixed(1)}%)`);
    }

    // Try different racing thresholds
    console.log('\n🎯 THRESHOLD SENSITIVITY:');
    console.log('─'.repeat(40));

    for (const threshold of [50, 75, 100, 125, 150]) {
      const racingPoints = session.dataPoints.filter(p => p.velocity >= threshold).length;
      const percentage = (racingPoints / session.dataPoints.length * 100).toFixed(1);
      console.log(`${threshold}+ km/h: ${racingPoints.toLocaleString()} points (${percentage}%)`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toFixed(2).padStart(5, '0')}`;
}

// Usage
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: bun bin/debug-speed-analysis.ts <vbo-file-path>');
  console.log('');
  console.log('Example:');
  console.log('  bun bin/debug-speed-analysis.ts ../../public/videos/25IT04_RdAm_PT2_Run01_RD.vbo');
  process.exit(1);
}

const filePath = args[0];
await debugSpeedAnalysis(filePath);