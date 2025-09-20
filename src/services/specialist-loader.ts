/**
 * Specialist Loader Service
 * 
 * Loads and parses specialist persona definitions from markdown files
 * with rich YAML frontmatter including personality traits, collaboration
 * patterns, and roleplay information.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';

export interface SpecialistPersona {
  personality: string[];
  communication_style: string;
  greeting: string;
}

export interface SpecialistExpertise {
  primary: string[];
  secondary: string[];
}

export interface SpecialistCollaboration {
  natural_handoffs: string[];
  team_consultations: string[];
}

export interface SpecialistDefinition {
  title: string;
  specialist_id: string;
  emoji: string;
  role: string;
  team: string;
  persona: SpecialistPersona;
  expertise: SpecialistExpertise;
  domains: string[];
  when_to_use: string[];
  collaboration: SpecialistCollaboration;
  related_specialists: string[];
  content: string; // The markdown content after frontmatter
}

export interface SpecialistCharacterGuide {
  identity_section: string;
  process_section: string;
  examples_section: string;
  collaboration_section: string;
}

export class SpecialistLoader {
  private specialistCache = new Map<string, SpecialistDefinition>();
  private loaded = false;

  constructor(private specialistsPath: string) {}

  /**
   * Load all specialist definitions from the specialists folder
   */
  async loadAllSpecialists(): Promise<Map<string, SpecialistDefinition>> {
    if (this.loaded && this.specialistCache.size > 0) {
      return this.specialistCache;
    }

    console.error('📋 Loading specialist personas...');
    
    try {
      const specialistFiles = await fs.readdir(this.specialistsPath);
      const markdownFiles = specialistFiles.filter(file => file.endsWith('.md'));

      console.error(`📋 Found ${markdownFiles.length} specialist files`);

      for (const file of markdownFiles) {
        const filePath = path.join(this.specialistsPath, file);
        const specialist = await this.loadSpecialist(filePath);
        
        if (specialist) {
          this.specialistCache.set(specialist.specialist_id, specialist);
        }
      }

      this.loaded = true;
      console.error(`🎭 Successfully loaded ${this.specialistCache.size} specialists`);
      
      return this.specialistCache;

    } catch (error) {
      console.error('❌ Failed to load specialists:', error);
      throw error;
    }
  }

  /**
   * Load a single specialist from a markdown file
   */
  async loadSpecialist(filePath: string): Promise<SpecialistDefinition | null> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      return this.parseSpecialistFile(fileContent, filePath);

    } catch (error) {
      console.error(`❌ Failed to load specialist from ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse specialist markdown file with YAML frontmatter
   */
  private parseSpecialistFile(content: string, filePath: string): SpecialistDefinition | null {
    try {
      // Extract frontmatter and content
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      
      if (!frontmatterMatch) {
        console.error(`⚠️ No frontmatter found in ${filePath}`);
        return null;
      }

      const [, frontmatterStr, markdownContent] = frontmatterMatch;
      
      // Parse YAML frontmatter
      const frontmatter = yaml.parse(frontmatterStr) as any;
      
      // Validate required fields
      if (!frontmatter.specialist_id || !frontmatter.title) {
        console.error(`⚠️ Missing required fields in ${filePath}`);
        return null;
      }

      // Create specialist definition
      const specialist: SpecialistDefinition = {
        title: frontmatter.title,
        specialist_id: frontmatter.specialist_id,
        emoji: frontmatter.emoji || '🤖',
        role: frontmatter.role || 'Specialist',
        team: frontmatter.team || 'General',
        persona: {
          personality: frontmatter.persona?.personality || [],
          communication_style: frontmatter.persona?.communication_style || '',
          greeting: frontmatter.persona?.greeting || `${frontmatter.emoji || '🤖'} Hello!`
        },
        expertise: {
          primary: frontmatter.expertise?.primary || [],
          secondary: frontmatter.expertise?.secondary || []
        },
        domains: frontmatter.domains || [],
        when_to_use: frontmatter.when_to_use || [],
        collaboration: {
          natural_handoffs: frontmatter.collaboration?.natural_handoffs || [],
          team_consultations: frontmatter.collaboration?.team_consultations || []
        },
        related_specialists: frontmatter.related_specialists || [],
        content: markdownContent.trim()
      };

      return specialist;

    } catch (error) {
      console.error(`❌ Failed to parse specialist file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Get a specific specialist by ID
   */
  async getSpecialist(specialistId: string): Promise<SpecialistDefinition | null> {
    if (!this.loaded) {
      await this.loadAllSpecialists();
    }

    return this.specialistCache.get(specialistId) || null;
  }

  /**
   * Get all loaded specialists
   */
  async getAllSpecialists(): Promise<SpecialistDefinition[]> {
    if (!this.loaded) {
      await this.loadAllSpecialists();
    }

    return Array.from(this.specialistCache.values());
  }

  /**
   * Get specialists by team
   */
  async getSpecialistsByTeam(team: string): Promise<SpecialistDefinition[]> {
    const specialists = await this.getAllSpecialists();
    return specialists.filter(s => s.team === team);
  }

  /**
   * Get specialists by domain expertise
   */
  async getSpecialistsByDomain(domain: string): Promise<SpecialistDefinition[]> {
    const specialists = await this.getAllSpecialists();
    return specialists.filter(s => s.domains.includes(domain));
  }

  /**
   * Extract character guide sections from specialist content
   */
  extractCharacterGuide(specialist: SpecialistDefinition): SpecialistCharacterGuide {
    const content = specialist.content;
    
    // Extract major sections using markdown headers
    const sections = content.split(/(?=^##\s)/m);
    
    return {
      identity_section: this.extractSection(sections, 'Character Identity') || '',
      process_section: this.extractSection(sections, 'Process') || '',
      examples_section: this.extractSection(sections, 'Examples') || '',
      collaboration_section: this.extractSection(sections, 'Collaboration') || ''
    };
  }

  private extractSection(sections: string[], sectionName: string): string {
    const section = sections.find(s => 
      s.toLowerCase().includes(sectionName.toLowerCase())
    );
    
    return section ? section.trim() : '';
  }

  /**
   * Find specialists who can collaborate with the given specialist
   */
  async getCollaborators(specialistId: string): Promise<{
    handoffs: SpecialistDefinition[];
    consultations: SpecialistDefinition[];
    related: SpecialistDefinition[];
  }> {
    const specialist = await this.getSpecialist(specialistId);
    if (!specialist) {
      return { handoffs: [], consultations: [], related: [] };
    }

    const allSpecialists = await this.getAllSpecialists();
    
    const handoffs = specialist.collaboration.natural_handoffs
      .map(id => allSpecialists.find(s => s.specialist_id === id))
      .filter(s => s) as SpecialistDefinition[];

    const consultations = specialist.collaboration.team_consultations
      .map(id => allSpecialists.find(s => s.specialist_id === id))
      .filter(s => s) as SpecialistDefinition[];

    const related = specialist.related_specialists
      .map(id => allSpecialists.find(s => s.specialist_id === id))
      .filter(s => s) as SpecialistDefinition[];

    return { handoffs, consultations, related };
  }

  /**
   * Get specialist suggestions for a given context or problem
   */
  async suggestSpecialist(
    context: string, 
    problemType?: string
  ): Promise<SpecialistDefinition[]> {
    const specialists = await this.getAllSpecialists();
    const suggestions: { specialist: SpecialistDefinition; score: number }[] = [];

    for (const specialist of specialists) {
      let score = 0;

      // Check when_to_use scenarios
      for (const scenario of specialist.when_to_use) {
        if (context.toLowerCase().includes(scenario.toLowerCase()) ||
            scenario.toLowerCase().includes(context.toLowerCase())) {
          score += 10;
        }
      }

      // Check expertise areas
      for (const expertise of [...specialist.expertise.primary, ...specialist.expertise.secondary]) {
        if (context.toLowerCase().includes(expertise.toLowerCase()) ||
            expertise.toLowerCase().includes(context.toLowerCase())) {
          score += specialist.expertise.primary.includes(expertise) ? 8 : 5;
        }
      }

      // Check domains
      for (const domain of specialist.domains) {
        if (context.toLowerCase().includes(domain.toLowerCase()) ||
            domain.toLowerCase().includes(context.toLowerCase())) {
          score += 6;
        }
      }

      if (score > 0) {
        suggestions.push({ specialist, score });
      }
    }

    // Sort by score and return top suggestions
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(s => s.specialist);
  }

  /**
   * Get statistics about loaded specialists
   */
  getStatistics(): {
    total_specialists: number;
    teams: Record<string, number>;
    domains: Record<string, number>;
    average_collaborators: number;
  } {
    const specialists = Array.from(this.specialistCache.values());
    
    const teams: Record<string, number> = {};
    const domains: Record<string, number> = {};
    let totalCollaborators = 0;

    for (const specialist of specialists) {
      // Count teams
      teams[specialist.team] = (teams[specialist.team] || 0) + 1;

      // Count domains
      for (const domain of specialist.domains) {
        domains[domain] = (domains[domain] || 0) + 1;
      }

      // Count collaborators
      totalCollaborators += 
        specialist.collaboration.natural_handoffs.length +
        specialist.collaboration.team_consultations.length +
        specialist.related_specialists.length;
    }

    return {
      total_specialists: specialists.length,
      teams,
      domains,
      average_collaborators: specialists.length > 0 ? totalCollaborators / specialists.length : 0
    };
  }
}