# **# AI Client Discovery Assistant Prototype**

**The AI Client Discovery Assistant helps companies that provide a centain type of service analyze potential client requests submitted through a contact form using open-weight AI models accessed through OpenRouter, such as Kimi, Qwen, MiniMax, etc.**

**For this prototype, MiniMax M3 is used as the primary model because it is well suited for multi-step reasoning, long-context analysis, planning, and agentic workflows. This makes it a good fit for analyzing unstructured client requests, identifying missing information, highlighting risks, and producing a structured internal discovery brief.**

**## Features**

**- Connected client request cards with one active request at a time**

**- OpenRouter API integration for AI analysis**

**- MiniMax M3 as the selected model for the prototype**

**- Saved generated discovery briefs**

**- Editable AI-generated brief with a Save Edited Brief action**

**- Created and modified timestamps for each generated brief**

**- Reviewer status updates**

**- Audit log entries for generated briefs, edited briefs, errors, and status changes**

**- Reset buttons for saved briefs and audit logs**

**## How It Works**

**1. The company receives multiple potential client requests.**

**2. The reviewer selects one client request.**

**3. The backend sends the selected request to MiniMax M3 through OpenRouter.**

**4. MiniMax M3 analyzes the request and generates a structured internal discovery brief.**

**5. The generated brief is saved in** `data/briefs.json`**.**

**6. Each brief receives a timestamp and starts with a** `Pending Review` **status.**

**7. The reviewer can edit the generated brief and update its review status.**

**8. Generation, edits, errors, resets, and status changes are recorded in** `data/audit-log.json`**.**

**## Model Configuration**

**The prototype uses:**

**```text**

**minimax/minimax-m3**

but for testing ... **nvidia/nemotron-3-nano-omni** can be used by replacing the const OPENROUTER_MODEL to : 

```javascript
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';
```

