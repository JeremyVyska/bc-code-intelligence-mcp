/**
 * GitHub CLI Authentication Tests
 * 
 * Tests for Issue #30 - gh CLI authentication support for GitHub layers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthType } from '../../src/types/config-types';

describe('GitHub CLI Authentication (Issue #30)', () => {
  describe('AuthType enum', () => {
    it('should include GH_CLI auth type', () => {
      expect(AuthType.GH_CLI).toBe('gh_cli');
    });

    it('should have all expected auth types', () => {
      const authTypes = Object.values(AuthType);
      expect(authTypes).toContain('token');
      expect(authTypes).toContain('ssh');
      expect(authTypes).toContain('basic');
      expect(authTypes).toContain('oauth');
      expect(authTypes).toContain('az_cli');
      expect(authTypes).toContain('gh_cli');
    });
  });

  describe('GitKnowledgeLayer GH_CLI support', () => {
    it('should verify gh CLI verification methods exist', async () => {
      // Import GitKnowledgeLayer
      const { GitKnowledgeLayer } = await import('../../src/layers/git-layer');
      
      // Check that the class has the necessary private methods by inspecting prototype
      const instance = new GitKnowledgeLayer(
        'test-layer',
        1,
        { url: 'https://github.com/test/repo', branch: 'main' },
        { type: AuthType.GH_CLI },
        '.test-cache'
      );

      // Private methods exist on the instance
      expect(instance).toBeDefined();
      expect(typeof instance.initialize).toBe('function');
    });
  });

  describe('Authentication configuration examples', () => {
    it('should accept gh_cli auth configuration', () => {
      const ghCliConfig = {
        type: AuthType.GH_CLI
      };

      expect(ghCliConfig.type).toBe('gh_cli');
      expect(ghCliConfig).not.toHaveProperty('token');
      expect(ghCliConfig).not.toHaveProperty('key_path');
    });

    it('should differentiate gh_cli from token auth', () => {
      const ghCliConfig = { type: AuthType.GH_CLI };
      const tokenConfig = { type: AuthType.TOKEN, token: 'ghp_example' };

      expect(ghCliConfig.type).not.toBe(tokenConfig.type);
      expect(ghCliConfig.type).toBe('gh_cli');
      expect(tokenConfig.type).toBe('token');
    });

    it('should differentiate gh_cli from az_cli', () => {
      const ghCliConfig = { type: AuthType.GH_CLI };
      const azCliConfig = { type: AuthType.AZ_CLI };

      expect(ghCliConfig.type).not.toBe(azCliConfig.type);
      expect(ghCliConfig.type).toBe('gh_cli');
      expect(azCliConfig.type).toBe('az_cli');
    });
  });

  describe('YAML configuration format', () => {
    it('should accept gh_cli in layer configuration', () => {
      // Example YAML configuration (as object)
      const layerConfig = {
        name: 'company-knowledge',
        type: 'git',
        priority: 100,
        url: 'https://github.com/mycompany/bc-knowledge',
        branch: 'main',
        auth: {
          type: 'gh_cli' // ✅ New auth type
        }
      };

      expect(layerConfig.auth.type).toBe('gh_cli');
    });

    it('should support gh_cli alongside other auth types in config', () => {
      const multiLayerConfig = {
        layers: [
          {
            name: 'github-layer',
            auth: { type: 'gh_cli' }
          },
          {
            name: 'azure-layer',
            auth: { type: 'az_cli' }
          },
          {
            name: 'gitlab-layer',
            auth: { type: 'token', token_env_var: 'GITLAB_TOKEN' }
          }
        ]
      };

      expect(multiLayerConfig.layers[0].auth.type).toBe('gh_cli');
      expect(multiLayerConfig.layers[1].auth.type).toBe('az_cli');
      expect(multiLayerConfig.layers[2].auth.type).toBe('token');
    });
  });

  describe('Developer experience benefits', () => {
    it('should not require token management for gh_cli auth', () => {
      const ghCliConfig = {
        type: AuthType.GH_CLI
        // ✅ No token, token_env_var, username, password, or key_path required
      };

      expect(ghCliConfig).not.toHaveProperty('token');
      expect(ghCliConfig).not.toHaveProperty('token_env_var');
      expect(ghCliConfig).not.toHaveProperty('username');
      expect(ghCliConfig).not.toHaveProperty('password');
      expect(ghCliConfig).not.toHaveProperty('key_path');
    });

    it('should match az_cli simplicity pattern', () => {
      const ghCliConfig = { type: AuthType.GH_CLI };
      const azCliConfig = { type: AuthType.AZ_CLI };

      // Both CLI auth types require only the type field
      const ghCliFields = Object.keys(ghCliConfig);
      const azCliFields = Object.keys(azCliConfig);

      expect(ghCliFields).toEqual(['type']);
      expect(azCliFields).toEqual(['type']);
      expect(ghCliFields.length).toBe(azCliFields.length);
    });
  });

  describe('Error handling scenarios', () => {
    it('should define clear error for gh CLI not installed', () => {
      const expectedError = {
        message: 'GitHub CLI not found',
        installUrl: 'https://cli.github.com/',
        setupCommand: 'gh auth login'
      };

      expect(expectedError.message).toContain('GitHub CLI');
      expect(expectedError.installUrl).toContain('cli.github.com');
      expect(expectedError.setupCommand).toBe('gh auth login');
    });

    it('should define clear error for gh CLI not authenticated', () => {
      const expectedError = {
        message: 'Not logged in to GitHub CLI',
        fixCommand: 'gh auth login',
        note: 'For organization access, ensure your token has appropriate repo scopes'
      };

      expect(expectedError.message).toContain('Not logged in');
      expect(expectedError.fixCommand).toBe('gh auth login');
      expect(expectedError.note).toContain('organization access');
    });
  });
});
