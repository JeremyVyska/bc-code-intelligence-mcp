/**
 * Manual test script for snapshot extraction
 * 
 * Usage: tsx dev-tools/test-snapshot-extraction.ts <path-to-snap-file>
 */

import { SnapshotService } from '../src/services/snapshot-service.js';

async function testSnapshotExtraction() {
  const snapshotPath = process.argv[2];

  if (!snapshotPath) {
    console.log('❌ Usage: tsx dev-tools/test-snapshot-extraction.ts <path-to-snap-file>');
    process.exit(1);
  }

  console.log('🔍 Testing snapshot extraction...\n');
  console.log(`📁 Snapshot file: ${snapshotPath}\n`);

  const service = new SnapshotService();

  try {
    const result = await service.extractSnapshot(snapshotPath);

    console.log('✅ Extraction successful!\n');
    console.log('📊 Metadata:');
    console.log(`  - MDC files: ${result.metadata.total_mdc_files}`);
    console.log(`  - AL files: ${result.metadata.total_al_files}`);
    if (result.metadata.bc_version) {
      console.log(`  - BC Version: ${result.metadata.bc_version}`);
    }
    console.log();

    console.log('📂 File Tree:');
    console.log(result.file_tree);
    console.log();

    if (result.notable_files.largest_mdc) {
      console.log(`🔍 Largest MDC: ${result.notable_files.largest_mdc}`);
    }

    if (result.notable_files.al_files.length > 0) {
      console.log('\n📄 AL Files:');
      result.notable_files.al_files.slice(0, 5).forEach(file => {
        if (file.object_type && file.object_id) {
          console.log(`  - ${file.encoded_name} → ${file.object_type} ${file.object_id}`);
        } else {
          console.log(`  - ${file.encoded_name}`);
        }
      });
      if (result.notable_files.al_files.length > 5) {
        console.log(`  ... and ${result.notable_files.al_files.length - 5} more`);
      }
    }

    console.log(`\n📁 Extracted to: ${result.temp_directory}`);
    console.log('\n💡 You can now read files from this directory using standard file tools.');
    console.log('   The temp directory will persist until system cleanup or manual deletion.\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testSnapshotExtraction();
