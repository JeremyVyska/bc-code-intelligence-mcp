---
title: "AL Performance Optimization - Company Standards"
domain: "performance"
difficulty: "intermediate"
bc_versions: "14+"
tags: ["performance", "sift", "company-standard", "project-override"]
related_topics: ["database-optimization", "query-patterns"]
---

# AL Performance Optimization - Company Standards

🏢 **This is a project-specific override** of the standard AL performance optimization topic.

## Company Requirements

Our organization has specific requirements for AL performance optimization:

### Mandatory Performance Rules

1. **SetLoadFields Requirement**: ALL database queries must use `SetLoadFields()`
2. **SIFT Optimization**: All reports and calculations must leverage SIFT optimization
3. **Performance Testing**: Every table operation requires performance testing approval
4. **Code Review Process**: All performance-critical code requires senior developer review

### Company-Specific Examples

```al
// ✅ APPROVED Company Pattern
Customer.SetLoadFields(Name, "Balance (LCY)");
Customer.SetRange("Customer Posting Group", 'STANDARD');
if Customer.FindSet() then
    repeat
        // Process customer with minimal field loading
    until Customer.Next() = 0;
```

### Performance Benchmarks

- Query response time: < 100ms for standard operations
- Report generation: < 5 seconds for month-end reports
- Page load time: < 2 seconds for list pages

## Override Notes

This topic overrides the standard performance optimization guidance with company-specific requirements. The base guidance still applies, but these additional requirements are mandatory for our organization.

## Contact

For questions about these company standards, contact the Performance Team at performance@company.com.