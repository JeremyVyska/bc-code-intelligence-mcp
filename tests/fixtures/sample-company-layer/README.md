# Sample Company Layer - Test Fixture

This is a **sample company knowledge layer** that serves two purposes:

1. **Test fixture** - Used by integration tests to validate layer loading
2. **Example/template** - Shows the structure of a company layer for reference

## Structure

```
sample-company-layer/
├── specialists/          # Specialist overrides or additions
│   ├── _template.md      # Template for new specialists
│   └── sam-coder-override.md  # Example specialist override
├── domains/              # Knowledge topics organized by domain
│   ├── your-domain/
│   │   └── _template.md  # Template for new topics
│   └── test-value-standards/
│       └── coding-standards.md  # Example domain topic
├── prompts/              # Workflow prompts
│   └── _template.md      # Template for new prompts
├── indexes/              # Optional tag indexes for search
├── layer-config.yaml     # Layer metadata
└── README.md             # This file
```

## Using as a Template

To create your own company layer:

1. Copy this directory to your desired location
2. Rename the folder to match your company/project
3. Update `layer-config.yaml` with your layer name and description
4. Add specialists and domain topics following the templates

### Adding a Specialist Override

1. Copy `specialists/_template.md`
2. Use the same `specialist_id` as an embedded specialist to override it
3. Or use a new `specialist_id` to add a new specialist

### Adding Knowledge Topics

1. Create a domain folder under `domains/`
2. Copy `domains/your-domain/_template.md`
3. Fill in the topic content with your domain knowledge

### Adding Workflow Prompts

1. Copy `prompts/_template.md`
2. Define phases and specialist involvement

## Priority

This sample layer has priority 20.
Higher priority layers override lower priority layers for matching content.
