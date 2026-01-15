/**
 * Snapshot Service - BC Snapshot Extraction and Analysis
 * 
 * Handles extraction of BC snapshot (.snap) files which are ZIP archives
 * containing debug traces, AL source files, and metadata.
 */

import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import os from 'os';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import { Parse } from 'unzipper';

export interface SnapshotMetadata {
  total_mdc_files: number;
  total_al_files: number;
  bc_version?: string;
  app_info: Array<{
    appId: string;
    publisher: string;
    name: string;
    version: string;
  }>;
}

export interface ALFileInfo {
  encoded_name: string;
  decoded_name: string;
  object_type?: string;
  object_id?: string;
}

export interface ExtractionResult {
  temp_directory: string;
  file_tree: string;
  metadata: SnapshotMetadata;
  notable_files: {
    largest_mdc?: string;
    al_files: ALFileInfo[];
  };
}

/**
 * Service for extracting and analyzing BC snapshot files
 * 
 * SECURITY: Snapshot files contain sensitive production data.
 * - Extracted files are tracked and cleaned up on process exit
 * - Manual cleanup available via cleanup() method
 */
export class SnapshotService {
  private static extractedDirectories: Set<string> = new Set();
  private static cleanupRegistered = false;

  constructor() {
    // Register cleanup handler once
    if (!SnapshotService.cleanupRegistered) {
      this.registerCleanupHandlers();
      SnapshotService.cleanupRegistered = true;
    }
  }

  /**
   * Register cleanup handlers for process exit
   */
  private registerCleanupHandlers(): void {
    const cleanupAll = async () => {
      if (SnapshotService.extractedDirectories.size > 0) {
        console.error(`🧹 Cleaning up ${SnapshotService.extractedDirectories.size} extracted snapshot(s)...`);
        for (const dir of SnapshotService.extractedDirectories) {
          await this.cleanup(dir);
        }
      }
    };

    // Clean up on normal exit
    process.on('beforeExit', cleanupAll);
    
    // Clean up on SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      await cleanupAll();
      process.exit(0);
    });

    // Clean up on SIGTERM (kill command)
    process.on('SIGTERM', async () => {
      await cleanupAll();
      process.exit(0);
    });
  }

  /**
   * Extract a BC snapshot file to a temporary directory
   */
  async extractSnapshot(snapshotPath: string): Promise<ExtractionResult> {
    // Validate snapshot file exists
    try {
      await fs.access(snapshotPath);
    } catch (error) {
      throw new Error(`Snapshot file not found: ${snapshotPath}`);
    }

    // Create temp directory for extraction
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bc-snapshot-'));

    try {
      // Extract the ZIP file
      await this.extractZip(snapshotPath, tempDir);

      // Track for cleanup
      SnapshotService.extractedDirectories.add(tempDir);

      // Analyze contents
      const metadata = await this.analyzeContents(tempDir);
      const fileTree = await this.generateFileTree(tempDir);
      const notableFiles = await this.findNotableFiles(tempDir);

      return {
        temp_directory: tempDir,
        file_tree: fileTree,
        metadata,
        notable_files: notableFiles
      };
    } catch (error) {
      // Clean up on error
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  }

  /**
   * Extract ZIP file using Node's unzipper
   */
  private async extractZip(zipPath: string, targetDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      createReadStream(zipPath)
        .pipe(Parse())
        .on('entry', async (entry: any) => {
          const fileName = entry.path;
          const type = entry.type; // 'Directory' or 'File'
          const fullPath = path.join(targetDir, fileName);

          if (type === 'Directory') {
            await fs.mkdir(fullPath, { recursive: true });
            entry.autodrain();
          } else {
            // Ensure directory exists
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            entry.pipe(require('fs').createWriteStream(fullPath));
          }
        })
        .on('close', resolve)
        .on('error', reject);
    });
  }

  /**
   * Analyze snapshot contents for metadata
   */
  private async analyzeContents(tempDir: string): Promise<SnapshotMetadata> {
    const files = await this.getAllFiles(tempDir);

    const mdcFiles = files.filter(f => f.endsWith('.mdc'));
    const alFiles = files.filter(f => f.endsWith('.al'));

    // Try to read BC version from version file if it exists
    let bcVersion: string | undefined;
    const versionFile = files.find(f => f.toLowerCase().includes('version'));
    if (versionFile) {
      try {
        const content = await fs.readFile(path.join(tempDir, versionFile), 'utf-8');
        const versionMatch = content.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (versionMatch) {
          bcVersion = versionMatch[1];
        }
      } catch {
        // Version file not readable, skip
      }
    }

    // Extract app info from first .mdc file if available
    const appInfo: Array<{appId: string; publisher: string; name: string; version: string}> = [];
    if (mdcFiles.length > 0) {
      try {
        const firstMdc = path.join(tempDir, mdcFiles[0]);
        const content = await fs.readFile(firstMdc, 'utf-8');
        
        // Parse app metadata from .mdc content
        const appIdMatch = content.match(/App ID[:\s]+([a-f0-9]{32})/i);
        const publisherMatch = content.match(/Publisher[:\s]+([^\n\r]+)/i);
        const appNameMatch = content.match(/App Name[:\s]+([^\n\r]+)/i);
        const versionMatch = content.match(/Version[:\s]+(\d+\.\d+\.\d+\.\d+)/i);

        if (appIdMatch || publisherMatch) {
          appInfo.push({
            appId: appIdMatch?.[1] || 'unknown',
            publisher: publisherMatch?.[1]?.trim() || 'unknown',
            name: appNameMatch?.[1]?.trim() || 'unknown',
            version: versionMatch?.[1] || bcVersion || 'unknown'
          });
        }
      } catch {
        // MDC file not readable or parseable, skip
      }
    }

    return {
      total_mdc_files: mdcFiles.length,
      total_al_files: alFiles.length,
      bc_version: bcVersion,
      app_info: appInfo
    };
  }

  /**
   * Generate a file tree representation
   */
  private async generateFileTree(tempDir: string): Promise<string> {
    const files = await this.getAllFiles(tempDir);
    
    let tree = `📁 ${path.basename(tempDir)}\n`;
    
    // Group by type
    const mdcFiles = files.filter(f => f.endsWith('.mdc')).sort();
    const alFiles = files.filter(f => f.endsWith('.al')).sort();
    const otherFiles = files.filter(f => !f.endsWith('.mdc') && !f.endsWith('.al')).sort();

    if (mdcFiles.length > 0) {
      tree += `├─ 📊 Debug Traces (${mdcFiles.length} .mdc files)\n`;
      if (mdcFiles.length <= 10) {
        mdcFiles.forEach(f => {
          tree += `│  ├─ ${f}\n`;
        });
      } else {
        tree += `│  ├─ ${mdcFiles[0]}\n`;
        tree += `│  ├─ ... (${mdcFiles.length - 2} more files)\n`;
        tree += `│  └─ ${mdcFiles[mdcFiles.length - 1]}\n`;
      }
    }

    if (alFiles.length > 0) {
      tree += `├─ 📄 AL Source Files (${alFiles.length} files)\n`;
      if (alFiles.length <= 10) {
        alFiles.forEach(f => {
          const decoded = this.decodeAlFileName(f);
          tree += `│  ├─ ${f}${decoded !== f ? ` (${decoded})` : ''}\n`;
        });
      } else {
        const decoded0 = this.decodeAlFileName(alFiles[0]);
        const decodedN = this.decodeAlFileName(alFiles[alFiles.length - 1]);
        tree += `│  ├─ ${alFiles[0]}${decoded0 !== alFiles[0] ? ` (${decoded0})` : ''}\n`;
        tree += `│  ├─ ... (${alFiles.length - 2} more files)\n`;
        tree += `│  └─ ${alFiles[alFiles.length - 1]}${decodedN !== alFiles[alFiles.length - 1] ? ` (${decodedN})` : ''}\n`;
      }
    }

    if (otherFiles.length > 0) {
      tree += `└─ 📋 Other Files (${otherFiles.length})\n`;
      otherFiles.slice(0, 5).forEach(f => {
        tree += `   ├─ ${f}\n`;
      });
      if (otherFiles.length > 5) {
        tree += `   └─ ... (${otherFiles.length - 5} more)\n`;
      }
    }

    return tree;
  }

  /**
   * Find notable files (largest MDC, AL files with decoded names)
   */
  private async findNotableFiles(tempDir: string): Promise<{
    largest_mdc?: string;
    al_files: ALFileInfo[];
  }> {
    const files = await this.getAllFiles(tempDir);

    // Find largest .mdc file
    const mdcFiles = files.filter(f => f.endsWith('.mdc'));
    let largestMdc: string | undefined;
    let largestSize = 0;

    for (const mdcFile of mdcFiles) {
      const fullPath = path.join(tempDir, mdcFile);
      const stats = await fs.stat(fullPath);
      if (stats.size > largestSize) {
        largestSize = stats.size;
        largestMdc = mdcFile;
      }
    }

    // Decode AL file names
    const alFiles = files.filter(f => f.endsWith('.al'));
    const alFileInfo: ALFileInfo[] = alFiles.map(f => {
      const decoded = this.decodeAlFileName(f);
      const objectInfo = this.parseObjectInfo(decoded);
      
      return {
        encoded_name: f,
        decoded_name: decoded,
        object_type: objectInfo?.type,
        object_id: objectInfo?.id
      };
    });

    return {
      largest_mdc: largestMdc,
      al_files: alFileInfo
    };
  }

  /**
   * Decode URL-encoded AL file names
   */
  private decodeAlFileName(fileName: string): string {
    try {
      return decodeURIComponent(fileName);
    } catch {
      return fileName;
    }
  }

  /**
   * Parse object type and ID from decoded AL file name
   */
  private parseObjectInfo(decodedName: string): { type: string; id: string } | null {
    // Match patterns like "CodeUnit 6500.al", "Table 27.al", "Page 7324.al"
    const match = decodedName.match(/^(CodeUnit|Table|Page|Report|Query|XMLPort|Codeunit)[\s%]*(\d+)\.al$/i);
    if (match) {
      return {
        type: match[1].toLowerCase() === 'codeunit' ? 'codeunit' : match[1].toLowerCase(),
        id: match[2]
      };
    }
    return null;
  }

  /**
   * Recursively get all files in a directory
   */
  private async getAllFiles(dirPath: string, arrayOfFiles: string[] = []): Promise<string[]> {
    const files = await fs.readdir(dirPath);

    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = await fs.stat(fullPath);

      if (stat.isDirectory()) {
        await this.getAllFiles(fullPath, arrayOfFiles);
      } else {
        // Store relative path from base directory
        arrayOfFiles.push(path.relative(dirPath, fullPath).replace(/\\/g, '/'));
      }
    }

    return arrayOfFiles;
  }

  /**
   * Clean up temporary directory
   * Called automatically on process exit, or manually via this method
   */
  async cleanup(tempDir: string): Promise<void> {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      SnapshotService.extractedDirectories.delete(tempDir);
    } catch (error) {
      console.warn(`Failed to cleanup temp directory ${tempDir}:`, error);
    }
  }

  /**
   * Get list of currently extracted directories (for debugging/monitoring)
   */
  static getExtractedDirectories(): string[] {
    return Array.from(SnapshotService.extractedDirectories);
  }

  /**
   * Clean up all extracted snapshots immediately
   */
  static async cleanupAll(): Promise<void> {
    const service = new SnapshotService();
    for (const dir of SnapshotService.extractedDirectories) {
      await service.cleanup(dir);
    }
  }
}
