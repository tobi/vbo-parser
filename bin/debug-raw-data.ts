#!/usr/bin/env bun

import { parseVBOFile } from '../src';

async function debugRawData(filePath: string) {
  console.log('🔍 DEBUGGING RAW VBO DATA');
  console.log('─'.repeat(60));

  try {
    const file = Bun.file(filePath);
    const content = await file.text();
    const session = await parseVBOFile(content);

    console.log('📋 FIRST 10 DATA POINTS:');
    console.log('─'.repeat(40));
    session.dataPoints.slice(0, 10).forEach((point, i) => {
      console.log(`Point ${i + 1}:`);
      console.log(`  Time: ${point.time.toFixed(2)}s`);
      console.log(`  Lap: ${point.lapNumber || 'N/A'}`);
      console.log(`  GPS Raw: ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`);
      console.log(`  Speed: ${point.velocity.toFixed(1)} km/h`);
      console.log();
    });

    console.log('📋 SAMPLE FROM MIDDLE:');
    console.log('─'.repeat(40));
    const midIndex = Math.floor(session.dataPoints.length / 2);
    session.dataPoints.slice(midIndex, midIndex + 5).forEach((point, i) => {
      console.log(`Point ${midIndex + i + 1}:`);
      console.log(`  Time: ${point.time.toFixed(2)}s`);
      console.log(`  Lap: ${point.lapNumber || 'N/A'}`);
      console.log(`  GPS Raw: ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`);
      console.log(`  Speed: ${point.velocity.toFixed(1)} km/h`);
      console.log();
    });

    console.log('📋 LAST 5 DATA POINTS:');
    console.log('─'.repeat(40));
    session.dataPoints.slice(-5).forEach((point, i) => {
      const index = session.dataPoints.length - 5 + i;
      console.log(`Point ${index + 1}:`);
      console.log(`  Time: ${point.time.toFixed(2)}s`);
      console.log(`  Lap: ${point.lapNumber || 'N/A'}`);
      console.log(`  GPS Raw: ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`);
      console.log(`  Speed: ${point.velocity.toFixed(1)} km/h`);
      console.log();
    });

    // Analyze time differences
    console.log('⏱️  TIME ANALYSIS:');
    console.log('─'.repeat(40));

    const timeDiffs: number[] = [];
    for (let i = 1; i < Math.min(100, session.dataPoints.length); i++) {
      const diff = session.dataPoints[i].time - session.dataPoints[i-1].time;
      timeDiffs.push(diff);
    }

    const avgTimeDiff = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
    const minTimeDiff = Math.min(...timeDiffs);
    const maxTimeDiff = Math.max(...timeDiffs);

    console.log(`Average time between points: ${avgTimeDiff.toFixed(3)}s`);
    console.log(`Min time diff: ${minTimeDiff.toFixed(3)}s`);
    console.log(`Max time diff: ${maxTimeDiff.toFixed(3)}s`);
    console.log(`Estimated sample rate: ${(1/avgTimeDiff).toFixed(1)} Hz`);

    // Check if times are absolute timestamps
    const firstTime = session.dataPoints[0].time;
    const lastTime = session.dataPoints[session.dataPoints.length - 1].time;
    const totalDuration = lastTime - firstTime;

    console.log(`First time: ${firstTime.toFixed(2)}s`);
    console.log(`Last time: ${lastTime.toFixed(2)}s`);
    console.log(`Total duration: ${totalDuration.toFixed(2)}s (${(totalDuration/60).toFixed(2)} minutes)`);

    // GPS coordinate analysis
    console.log('\n🌍 GPS COORDINATE ANALYSIS:');
    console.log('─'.repeat(40));

    const latitudes = session.dataPoints.map(p => p.latitude).filter(lat => lat !== 0);
    const longitudes = session.dataPoints.map(p => p.longitude).filter(lng => lng !== 0);

    if (latitudes.length > 0) {
      console.log(`Latitude range: ${Math.min(...latitudes).toFixed(6)} to ${Math.max(...latitudes).toFixed(6)}`);
      console.log(`Longitude range: ${Math.min(...longitudes).toFixed(6)} to ${Math.max(...longitudes).toFixed(6)}`);

      // Check if coordinates look like NMEA format
      const avgLat = latitudes.reduce((sum, lat) => sum + lat, 0) / latitudes.length;
      const avgLng = longitudes.reduce((sum, lng) => sum + lng, 0) / longitudes.length;

      console.log(`Average position: ${avgLat.toFixed(6)}, ${avgLng.toFixed(6)}`);

      // Convert NMEA to decimal degrees for comparison
      function nmeaToDecimal(nmea: number): number {
        const degrees = Math.floor(nmea / 100);
        const minutes = nmea % 100;
        return degrees + (minutes / 60);
      }

      const decimalLat = nmeaToDecimal(avgLat);
      const decimalLng = nmeaToDecimal(avgLng);

      console.log(`If NMEA format, decimal degrees would be: ${decimalLat.toFixed(6)}, ${decimalLng.toFixed(6)}`);

      // Check if this looks like a reasonable location
      if (decimalLat >= -90 && decimalLat <= 90 && decimalLng >= -180 && decimalLng <= 180) {
        console.log(`✅ NMEA conversion looks valid - coordinates are within Earth bounds`);
      } else {
        console.log(`❌ NMEA conversion produces invalid coordinates`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Usage
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: bun bin/debug-raw-data.ts <vbo-file-path>');
  console.log('');
  console.log('Example:');
  console.log('  bun bin/debug-raw-data.ts ../../public/videos/25IT04_RdAm_PT2_Run01_RD.vbo');
  process.exit(1);
}

const filePath = args[0];
await debugRawData(filePath);