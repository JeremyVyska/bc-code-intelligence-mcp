/**
 * list_specialists Tool - Handler Implementation
 *
 * Browse available BC specialists
 */

export function createListSpecialistsHandler(services: any) {
  const { layerService } = services;

  return async (args: any) => {
    const { domain, expertise } = args;

    const specialists = await layerService.getAllSpecialists();

    // Apply filters
    let filteredSpecialists = specialists;

    if (domain) {
      filteredSpecialists = specialists.filter((s: any) =>
        s.domains.some((d: string) => d.toLowerCase().includes(domain.toLowerCase()))
      );
    }

    if (expertise) {
      filteredSpecialists = filteredSpecialists.filter((s: any) =>
        [...s.expertise.primary, ...s.expertise.secondary].some((e: string) =>
          e.toLowerCase().includes(expertise.toLowerCase())
        )
      );
    }

    if (filteredSpecialists.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: '❌ No specialists found matching your criteria. Try different filters or remove them to see all specialists.'
        }]
      };
    }

    // Group by domain for better organization
    const specialistsByDomain = new Map();

    filteredSpecialists.forEach((specialist: any) => {
      specialist.domains.forEach((d: string) => {
        if (!specialistsByDomain.has(d)) {
          specialistsByDomain.set(d, []);
        }
        if (!specialistsByDomain.get(d).includes(specialist)) {
          specialistsByDomain.get(d).push(specialist);
        }
      });
    });

    let response = `👥 **BC Code Intelligence Specialists** ${domain || expertise ? '(filtered)' : ''}\\n\\n`;

    // Show specialists organized by domain
    for (const [domainName, domainSpecialists] of specialistsByDomain.entries()) {
      response += `## 🏷️ ${domainName.charAt(0).toUpperCase() + domainName.slice(1)}\\n\\n`;

      for (const specialist of domainSpecialists as any[]) {
        response += `**${specialist.title}** (\`${specialist.specialist_id}\`)\\n`;
        response += `💬 ${specialist.persona.greeting}\\n`;
        response += `🎯 **Primary Expertise:** ${specialist.expertise.primary.join(', ')}\\n`;
        if (specialist.expertise.secondary.length > 0) {
          response += `🔧 **Also helps with:** ${specialist.expertise.secondary.slice(0, 3).join(', ')}\\n`;
        }
        response += `\\n`;
      }
    }

    response += `\\n💡 **Getting Started:**\\n`;
    response += `• Use \`ask_bc_expert\` with preferred_specialist parameter to connect with a specific specialist\\n`;
    response += `• Example: ask_bc_expert({ question: "Help with caching", preferred_specialist: "sam-coder" })\\n`;
    response += `• Or let ask_bc_expert auto-route based on your question`;

    // Check if workspace is configured - company/project specialists might be missing
    const layersInfo = layerService.getLayers();
    const hasProjectOrCompanyLayers = layersInfo.some((layer: any) =>
      layer.name.includes('company') || layer.name.includes('project') || layer.name.includes('team')
    );

    if (!hasProjectOrCompanyLayers) {
      response += `\\n\\n⚠️ **Note:** Only embedded specialists shown. Company/project specialists require workspace configuration.`;
    }

    return {
      content: [{ type: 'text' as const, text: response }]
    };
  };
}
