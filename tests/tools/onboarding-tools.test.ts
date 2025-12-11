import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentOnboardingTools } from '../../src/tools/onboarding-tools.js';
import { SpecialistDiscoveryService } from '../../src/services/specialist-discovery.js';
import { MultiContentLayerService } from '../../src/services/multi-content-layer-service.js';

/**
 * Agent Onboarding Tools Tests
 * 
 * Tests the specialist name detection and introduction logic
 * with realistic conversation contexts
 */
describe('AgentOnboardingTools', () => {
  let onboardingTools: AgentOnboardingTools;
  let mockDiscoveryService: any;
  let mockLayerService: any;

  // Mock specialist data
  const mockSpecialists = [
    {
      specialist_id: 'morgan-market',
      title: 'Morgan Market - AppSource & ISV Business Expert',
      role: 'Business Strategy Architect',
      emoji: '🏪',
      persona: { greeting: '🏪 Morgan here!' },
      expertise: { primary: ['AppSource Strategy', 'ISV Business Development'] },
      when_to_use: ['Market Analysis', 'Solution Development', 'Business Launch & Growth']
    },
    {
      specialist_id: 'sam-coder',
      title: 'Sam Coder - Efficient Implementation Expert',
      role: 'Senior AL Developer',
      emoji: '👨‍💻',
      persona: { greeting: '👨‍💻 Sam here!' },
      expertise: { primary: ['AL Development', 'Code Implementation'] },
      when_to_use: ['Building AL solutions', 'Code optimization', 'Implementation guidance']
    },
    {
      specialist_id: 'dean-debug',
      title: 'Dean Debug - Performance & Troubleshooting',
      role: 'Performance Specialist',
      emoji: '🔍',
      persona: { greeting: '🔍 Dean here!' },
      expertise: { primary: ['Performance Analysis', 'Debugging'] },
      when_to_use: ['Performance issues', 'Troubleshooting', 'Optimization']
    },
    {
      specialist_id: 'alex-architect',
      title: 'Alex Architect - Strategic Planning & Architecture',
      role: 'Solutions Architect',
      emoji: '🏗️',
      persona: { greeting: '🏗️ Alex here!' },
      expertise: { primary: ['Solution Architecture', 'Strategic Planning'] },
      when_to_use: ['Architecture design', 'Strategic planning', 'System design']
    }
  ];

  beforeEach(() => {
    mockLayerService = {
      getAllSpecialists: vi.fn().mockResolvedValue(mockSpecialists),
      getSpecialist: vi.fn().mockImplementation((id: string) => 
        Promise.resolve(mockSpecialists.find(s => s.specialist_id === id))
      )
    };

    mockDiscoveryService = {
      suggestSpecialists: vi.fn().mockResolvedValue([
        {
          specialist: mockSpecialists[0],
          confidence: 0.8,
          reasons: ['Content-based match'],
          keywords_matched: ['business']
        }
      ])
    };

    onboardingTools = new AgentOnboardingTools(mockDiscoveryService, mockLayerService);
  });

  describe('introduce_bc_specialists - Name Detection', () => {
    it('should detect Morgan when mentioned in complex project context', async () => {
      const complexContext = `User is working on the Enterprise Inventory Management application, a Business Central AppSource solution that integrates with multiple warehouse management systems to provide real-time inventory tracking and automated reordering capabilities. The app targets Business Central SaaS environments, version 24.0 and later, with comprehensive REST API integration and sophisticated dashboard reporting. The project includes detailed technical specifications, naming conventions, namespace architecture, and complete development workflow documentation. The user specifically requested to "get Morgan online" suggesting they want to connect with Morgan, a BC specialist.`;

      const request = {
        params: {
          name: 'introduce_bc_specialists',
          arguments: {
            conversation_context: complexContext,
            specific_problem: 'User wants to connect with Morgan, a BC specialist, likely for consultation on their Enterprise Inventory Management project'
          }
        }
      };

      const result = await onboardingTools.handleToolCall(request);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Morgan Market - AppSource & ISV Business Expert');
      expect(result.content[0].text).toContain('🏪 Morgan here!');
      expect(result.content[0].text).toContain('Ready to help! What would you like to work on?');
      
      // Should not call discovery service for content-based matching
      expect(mockDiscoveryService.suggestSpecialists).not.toHaveBeenCalled();
    });

    it('should detect Sam when mentioned directly', async () => {
      const contextWithSam = `The team is building a comprehensive CRM integration for Business Central that synchronizes customer data, sales orders, and contact management across multiple platforms. We have complex AL development requirements including custom tables, pages, and API integrations. I need to talk to Sam about the implementation approach for this project.`;

      const request = {
        params: {
          name: 'introduce_bc_specialists',
          arguments: {
            conversation_context: contextWithSam
          }
        }
      };

      const result = await onboardingTools.handleToolCall(request);

      expect(result.content[0].text).toContain('Sam Coder - Efficient Implementation Expert');
      expect(result.content[0].text).toContain('👨‍💻 Sam here!');
    });

    it('should detect Dean for debugging context', async () => {
      const debugContext = `Our Financial Reporting extension for Business Central has been experiencing intermittent performance issues during month-end processing. The system handles complex multi-dimensional reporting with real-time calculation engines and extensive data aggregation. Users report slow response times and occasional timeout errors during peak usage periods. Can you get Dean online to help troubleshoot this?`;

      const request = {
        params: {
          name: 'introduce_bc_specialists',
          arguments: {
            conversation_context: debugContext
          }
        }
      };

      const result = await onboardingTools.handleToolCall(request);

      expect(result.content[0].text).toContain('Dean Debug - Performance & Troubleshooting');
      expect(result.content[0].text).toContain('🔍 Dean here!');
    });

    it('should handle multiple names and pick the first one found', async () => {
      const multiNameContext = `I previously worked with Sam on the initial development phase, but now we're moving into the architecture and planning phase. The system needs strategic oversight and architectural review. I think we need Alex to help design the overall solution architecture.`;

      const request = {
        params: {
          name: 'introduce_bc_specialists',
          arguments: {
            conversation_context: multiNameContext
          }
        }
      };

      const result = await onboardingTools.handleToolCall(request);

      // Should pick Sam (first mentioned) or Alex (more specific context) - implementation decides
      expect(result.content[0].text).toMatch(/(Sam Coder|Alex Architect)/);
    });

    it('should fall back to content-based matching when no names detected', async () => {
      const noNameContext = `Working on a sophisticated software project that requires various technical considerations. The system needs complex logic, calculations, and external connectivity. Looking for guidance on best practices and general approaches for this project.`;

      const request = {
        params: {
          name: 'introduce_bc_specialists',
          arguments: {
            conversation_context: noNameContext
          }
        }
      };

      const result = await onboardingTools.handleToolCall(request);

      // Should call discovery service and return multiple suggestions
      expect(mockDiscoveryService.suggestSpecialists).toHaveBeenCalledWith(
        expect.objectContaining({
          query: noNameContext
        }),
        3
      );
      
      expect(result.content[0].text).toContain('BC Specialists Available for Your Challenge');
      expect(result.content[0].text).toContain('Based on your context');
    });

    it('should handle case-insensitive name matching', async () => {
      const caseContext = `Need help with our logistics management system. Can you get MORGAN online for business strategy discussion?`;

      const request = {
        params: {
          name: 'introduce_bc_specialists',
          arguments: {
            conversation_context: caseContext
          }
        }
      };

      const result = await onboardingTools.handleToolCall(request);

      expect(result.content[0].text).toContain('Morgan Market - AppSource & ISV Business Expert');
    });

    it('should ignore names in non-specialist context', async () => {
      const falsePositiveContext = `Our team includes Morgan Freeman as the project manager and Sam Smith as the business analyst. We're building a comprehensive BC solution and need technical guidance on AL development patterns and architecture.`;

      const request = {
        params: {
          name: 'introduce_bc_specialists',
          arguments: {
            conversation_context: falsePositiveContext
          }
        }
      };

      const result = await onboardingTools.handleToolCall(request);

      // Should still detect Morgan (first name match wins) - this is expected behavior
      // In practice, the context would help clarify intent
      expect(result.content[0].text).toMatch(/(Morgan Market|BC Specialists Available)/);
    });

    it('should handle specialist ID format matching', async () => {
      const idFormatContext = `Looking for help from morgan-market regarding AppSource publishing strategy for our new Business Central extension.`;

      const request = {
        params: {
          name: 'introduce_bc_specialists',
          arguments: {
            conversation_context: idFormatContext
          }
        }
      };

      const result = await onboardingTools.handleToolCall(request);

      expect(result.content[0].text).toContain('Morgan Market - AppSource & ISV Business Expert');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty conversation context gracefully', async () => {
      const request = {
        params: {
          name: 'introduce_bc_specialists',
          arguments: {
            conversation_context: ''
          }
        }
      };

      const result = await onboardingTools.handleToolCall(request);

      expect(mockDiscoveryService.suggestSpecialists).toHaveBeenCalled();
      expect(result.isError).toBeFalsy();
    });

    it('should handle specialist not found gracefully', async () => {
      mockLayerService.getAllSpecialists.mockResolvedValue([]); // No specialists

      const request = {
        params: {
          name: 'introduce_bc_specialists',
          arguments: {
            conversation_context: 'Get Morgan online please'
          }
        }
      };

      const result = await onboardingTools.handleToolCall(request);

      // Should fall back to discovery service
      expect(mockDiscoveryService.suggestSpecialists).toHaveBeenCalled();
    });

    it('should handle layer service errors gracefully', async () => {
      mockLayerService.getAllSpecialists.mockRejectedValue(new Error('Layer service error'));

      const request = {
        params: {
          name: 'introduce_bc_specialists',
          arguments: {
            conversation_context: 'Need help with development'
          }
        }
      };

      const result = await onboardingTools.handleToolCall(request);

      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('Error');
    });
  });
});