/**
 * Integration tests for user+project configuration merge behavior
 * Tests the priority-based merge strategy with actual config files
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigurationLoader } from '../../src/config/config-loader.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { LayerSourceType } from '../../src/types/config-types.js';

describe('User + Project Config Merge Integration', () => {
  let testDir: string;
  let userConfigPath: string;
  let projectDir: string;
  let projectConfigPath: string;
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;

  beforeEach(async () => {
    // Create temporary test directories
    testDir = join(tmpdir(), `bckb-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // User config goes in "home" directory
    const userDir = join(testDir, 'home', '.bc-code-intel');
    await mkdir(userDir, { recursive: true });
    userConfigPath = join(userDir, 'config.json');

    // Project config goes in "workspace" directory
    projectDir = join(testDir, 'workspace');
    await mkdir(projectDir, { recursive: true });
    projectConfigPath = join(projectDir, 'bc-code-intel-config.json');

    // Mock homedir for testing (both Unix and Windows)
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    process.env.HOME = join(testDir, 'home');
    process.env.USERPROFILE = join(testDir, 'home');
  });

  afterEach(async () => {
    // Restore original home variables
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }
    if (originalUserProfile !== undefined) {
      process.env.USERPROFILE = originalUserProfile;
    } else {
      delete process.env.USERPROFILE;
    }

    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  it('should merge user [20,30,80] + project [30,40,50] = [20, 30(project), 40, 50, 80]', async () => {
    // User config with layers at priorities 20, 30, 80
    const userConfig = {
      layers: [
        {
          name: 'user-company',
          priority: 20,
          source: { type: LayerSourceType.EMBEDDED, path: '/user/company' },
          enabled: true
        },
        {
          name: 'user-team',
          priority: 30,
          source: { type: LayerSourceType.EMBEDDED, path: '/user/team' },
          enabled: true
        },
        {
          name: 'user-personal',
          priority: 80,
          source: { type: LayerSourceType.EMBEDDED, path: '/user/personal' },
          enabled: true
        }
      ]
    };

    // Project config with layers at priorities 30, 40, 50
    const projectConfig = {
      layers: [
        {
          name: 'project-override',
          priority: 30,
          source: { type: LayerSourceType.EMBEDDED, path: '/project/override' },
          enabled: true
        },
        {
          name: 'project-team',
          priority: 40,
          source: { type: LayerSourceType.EMBEDDED, path: '/project/team' },
          enabled: true
        },
        {
          name: 'project-local',
          priority: 50,
          source: { type: LayerSourceType.EMBEDDED, path: '/project/local' },
          enabled: true
        }
      ]
    };

    await writeFile(userConfigPath, JSON.stringify(userConfig, null, 2));
    await writeFile(projectConfigPath, JSON.stringify(projectConfig, null, 2));

    const loader = new ConfigurationLoader();
    const result = await loader.loadConfiguration(projectDir);

    expect(result.config.layers).toBeDefined();
    
    // Extract non-default layers (filter out embedded-knowledge and default project layer)
    const customLayers = result.config.layers.filter(
      layer => !layer.source.path?.includes('embedded-knowledge') && layer.name !== 'project'
    );

    // Should have exactly 5 layers from our configs
    expect(customLayers).toHaveLength(5);

    // Verify priority-based merge: [20, 30(project), 40, 50, 80]
    expect(customLayers[0]).toMatchObject({
      name: 'user-company',
      priority: 20,
      source: { path: '/user/company' }
    });

    expect(customLayers[1]).toMatchObject({
      name: 'project-override',  // Project wins at priority 30
      priority: 30,
      source: { path: '/project/override' }
    });

    expect(customLayers[2]).toMatchObject({
      name: 'project-team',
      priority: 40,
      source: { path: '/project/team' }
    });

    expect(customLayers[3]).toMatchObject({
      name: 'project-local',
      priority: 50,
      source: { path: '/project/local' }
    });

    expect(customLayers[4]).toMatchObject({
      name: 'user-personal',
      priority: 80,
      source: { path: '/user/personal' }
    });
  });

  it('should load user config only when no workspace provided', async () => {
    const userConfig = {
      layers: [
        {
          name: 'user-company',
          priority: 20,
          source: { type: LayerSourceType.EMBEDDED, path: '/user/company' },
          enabled: true
        }
      ]
    };

    await writeFile(userConfigPath, JSON.stringify(userConfig, null, 2));

    const loader = new ConfigurationLoader();
    const result = await loader.loadConfiguration(); // No workspace root

    const customLayers = result.config.layers.filter(
      layer => !layer.source.path?.includes('embedded-knowledge') && layer.name !== 'project'
    );

    expect(customLayers).toHaveLength(1);
    expect(customLayers[0]).toMatchObject({
      name: 'user-company',
      priority: 20
    });
  });

  it('should load project config only when no user config exists', async () => {
    const projectConfig = {
      layers: [
        {
          name: 'project-local',
          priority: 50,
          source: { type: LayerSourceType.EMBEDDED, path: '/project/local' },
          enabled: true
        }
      ]
    };

    await writeFile(projectConfigPath, JSON.stringify(projectConfig, null, 2));

    const loader = new ConfigurationLoader();
    const result = await loader.loadConfiguration(projectDir);

    const customLayers = result.config.layers.filter(
      layer => !layer.source.path?.includes('embedded-knowledge') && layer.name !== 'project'
    );

    expect(customLayers).toHaveLength(1);
    expect(customLayers[0]).toMatchObject({
      name: 'project-local',
      priority: 50
    });
  });

  it('should preserve all layers when no priority conflicts', async () => {
    const userConfig = {
      layers: [
        {
          name: 'user-layer-1',
          priority: 10,
          source: { type: LayerSourceType.EMBEDDED, path: '/user/1' },
          enabled: true
        },
        {
          name: 'user-layer-2',
          priority: 30,
          source: { type: LayerSourceType.EMBEDDED, path: '/user/2' },
          enabled: true
        }
      ]
    };

    const projectConfig = {
      layers: [
        {
          name: 'project-layer-1',
          priority: 20,
          source: { type: LayerSourceType.EMBEDDED, path: '/project/1' },
          enabled: true
        },
        {
          name: 'project-layer-2',
          priority: 40,
          source: { type: LayerSourceType.EMBEDDED, path: '/project/2' },
          enabled: true
        }
      ]
    };

    await writeFile(userConfigPath, JSON.stringify(userConfig, null, 2));
    await writeFile(projectConfigPath, JSON.stringify(projectConfig, null, 2));

    const loader = new ConfigurationLoader();
    const result = await loader.loadConfiguration(projectDir);

    const customLayers = result.config.layers.filter(
      layer => !layer.source.path?.includes('embedded-knowledge') && layer.name !== 'project'
    );

    // All 4 layers should be present
    expect(customLayers).toHaveLength(4);
    expect(customLayers.map(l => l.priority)).toEqual([10, 20, 30, 40]);
  });

  it('should apply project overrides for multiple priority conflicts', async () => {
    const userConfig = {
      layers: [
        { name: 'user-A', priority: 10, source: { type: LayerSourceType.EMBEDDED, path: '/user/A' }, enabled: true },
        { name: 'user-B', priority: 20, source: { type: LayerSourceType.EMBEDDED, path: '/user/B' }, enabled: true },
        { name: 'user-C', priority: 30, source: { type: LayerSourceType.EMBEDDED, path: '/user/C' }, enabled: true }
      ]
    };

    const projectConfig = {
      layers: [
        { name: 'project-B', priority: 20, source: { type: LayerSourceType.EMBEDDED, path: '/project/B' }, enabled: true },
        { name: 'project-C', priority: 30, source: { type: LayerSourceType.EMBEDDED, path: '/project/C' }, enabled: true }
      ]
    };

    await writeFile(userConfigPath, JSON.stringify(userConfig, null, 2));
    await writeFile(projectConfigPath, JSON.stringify(projectConfig, null, 2));

    const loader = new ConfigurationLoader();
    const result = await loader.loadConfiguration(projectDir);

    const customLayers = result.config.layers.filter(
      layer => !layer.source.path?.includes('embedded-knowledge') && layer.name !== 'project'
    );

    expect(customLayers).toHaveLength(3);
    
    // Priority 10: user-A (no conflict)
    expect(customLayers[0].name).toBe('user-A');
    
    // Priority 20: project-B wins
    expect(customLayers[1].name).toBe('project-B');
    
    // Priority 30: project-C wins
    expect(customLayers[2].name).toBe('project-C');
  });

  it('should detect legacy config paths with deprecation warnings', async () => {
    // Use legacy path .bckb instead of .bc-code-intel
    const legacyUserDir = join(testDir, 'home', '.bckb');
    await mkdir(legacyUserDir, { recursive: true });
    const legacyUserConfigPath = join(legacyUserDir, 'config.json');

    const userConfig = {
      layers: [
        {
          name: 'legacy-user',
          priority: 20,
          source: { type: LayerSourceType.EMBEDDED, path: '/legacy/user' },
          enabled: true
        }
      ]
    };

    await writeFile(legacyUserConfigPath, JSON.stringify(userConfig, null, 2));

    const loader = new ConfigurationLoader();
    const result = await loader.loadConfiguration();

    // Should load the config
    const customLayers = result.config.layers.filter(
      layer => !layer.source.path?.includes('embedded-knowledge') && layer.name !== 'project'
    );
    expect(customLayers).toHaveLength(1);

    // Should have deprecation warning
    const deprecationWarnings = result.warnings.filter(w => w.type === 'deprecated');
    expect(deprecationWarnings.length).toBeGreaterThan(0);
    expect(deprecationWarnings[0].message).toContain('legacy');
  });

  it('should support YAML config files', async () => {
    const userConfigYaml = `
layers:
  - name: user-yaml-layer
    priority: 20
    source:
      type: embedded
      path: /user/yaml
    enabled: true
`;

    const yamlPath = join(testDir, 'home', '.bc-code-intel', 'config.yaml');
    await writeFile(yamlPath, userConfigYaml);

    const loader = new ConfigurationLoader();
    const result = await loader.loadConfiguration();

    const customLayers = result.config.layers.filter(
      layer => !layer.source.path?.includes('embedded-knowledge') && layer.name !== 'project'
    );

    expect(customLayers).toHaveLength(1);
    expect(customLayers[0]).toMatchObject({
      name: 'user-yaml-layer',
      priority: 20
    });
  });
});
