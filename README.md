# PRIORIX

## Autonomous Context-Aware Intelligence Engine

Priorix is an AI-powered personal intelligence platform designed to identify, understand, prioritize, and track information that requires action.

Modern users receive important information across email, calendars, tasks, commitments, and follow-ups. Traditional productivity tools primarily organize this information, but they rarely determine what actually deserves attention first.

Priorix addresses this problem by combining **AI-based semantic understanding, deterministic priority scoring, deadline intelligence, persistent state management, and external productivity integrations** into a unified attention system.

---

## Overview

Priorix continuously transforms unstructured information into actionable intelligence.

Instead of requiring users to manually inspect every message or remember every deadline, Priorix analyzes available information and determines:

- What requires attention
- Why it matters
- How urgent it is
- When action is required
- What action can be taken
- Whether the item has already been handled

The system is designed around the principle:

> **Don't just organize information — determine what deserves attention.**

---

## Core Capabilities

### AI-Powered Information Analysis

Priorix uses Gemini-based semantic analysis to extract meaningful information from unstructured content.

The analysis can identify:

- Career opportunities
- Job and internship roles
- Academic opportunities
- Examinations and registrations
- Deadlines and time constraints
- Application links
- Compensation and stipend information
- Action requirements
- Follow-up opportunities
- Low-value promotional content

The extracted information is converted into structured records that can be processed by the rest of the system.

---

### Hybrid Intelligence Engine

Priorix combines two complementary approaches:

**AI semantic analysis**

Used to understand context, meaning, roles, opportunities, and other information that cannot reliably be extracted using simple rules.

**Deterministic analysis**

Used for predictable signals such as:

- Dates
- Times
- Deadline proximity
- Application URLs
- Career-related keywords
- Compensation values
- Message metadata
- Promotional patterns

This hybrid architecture provides both **semantic flexibility and predictable decision logic**.

---

## Explainable Priority Engine

Each actionable item receives a priority score based on multiple signals.

Example signals include:

| Signal | Effect |
|---|---|
| Career opportunity | Increases priority |
| Explicit deadline | Increases priority |
| Deadline approaching | Strong priority increase |
| Application link | Increases actionability |
| Important commitment | Increases priority |
| Follow-up required | Increases priority |
| Promotional/newsletter content | Reduces priority |
| Expired deadline | Changes urgency state |

The resulting score is mapped into priority levels such as:

```text
CRITICAL
HIGH
MEDIUM
LOW
IGNORE
