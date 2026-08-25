# AI Client Discovery Assistant Prototype

The **AI Client Discovery Assistant** helps service-based companies analyze potential client requests submitted through a contact form using AI models accessed through **OpenRouter**.

## Features

* Connected client request cards with one active request at a time
* OpenRouter API integration for AI analysis
* Saved generated discovery briefs
* Editable AI-generated brief
* Created and modified timestamps
* Reviewer status updates
* Audit log for generation, edits, errors, resets, and status changes
* Reset buttons for saved briefs and audit logs

## How It Works

1. The company receives multiple potential client requests.
2. The reviewer selects one request.
3. The backend sends the request to OpenRouter.
4. The AI generates a structured internal discovery brief.
5. The brief is saved in `data/briefs.json`.
6. Each brief starts with `Pending Review`.
7. The reviewer can edit the brief and update its status.
8. Activity is recorded in `data/audit-log.json`.

## Model Configuration

The prototype defaults to `minimax/minimax-m2.7:free`. 

If `OPENROUTER_MODEL` is set in PowerShell, that model is used instead.

## Tech Stack

* HTML
* CSS
* JavaScript
* Node.js
* OpenRouter API
* JSON file storage
* Minimax M2

## Run

```powershell
$env:OPENROUTER_API_KEY="your_api_key"

# Optional: choose any OpenRouter model
$env:OPENROUTER_MODEL="provider/model-name"

npm start
```

Then open:

```text
http://localhost:3000
```
