# InsightBoard AI - Backend API

Backend service for the InsightBoard AI Dependency Engine, built with Node.js, TypeScript, Express, and MongoDB.

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **LLM Provider**: Google Gemini Pro
- **Validation**: Express Validator

## Architecture

### Core Components

1. **Models** (`src/models/`)
   - `Transcript.ts`: Stores meeting transcripts with metadata
   - `Task.ts`: Individual tasks with dependencies and status

2. **Services** (`src/services/`)
   - `llmService.ts`: Google Gemini API integration
   - `validationService.ts`: Dependency validation and sanitization
   - `cycleDetectionService.ts`: Circular dependency detection (DFS algorithm)
   - `jobQueue.ts`: Async job processing queue
   - `idempotencyService.ts`: Duplicate submission prevention

3. **Routes** (`src/routes/`)
   - `/api/transcripts`: Transcript submission
   - `/api/jobs`: Job status polling
   - `/api/tasks`: Task completion

## API Endpoints

### 1. Submit Transcript

**POST** `/api/transcripts`

Submit a meeting transcript for processing.

**Request:**
```json
{
  "transcript": "Meeting content here..."
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "jobId": "job_abc123",
  "message": "Transcript submitted successfully",
  "isDuplicate": false
}
```

**Validation:**
- Transcript must be at least 50 characters
- Returns existing `jobId` if duplicate detected (idempotency)

---

### 2. Check Job Status

**GET** `/api/jobs/:jobId`

Poll for job completion and retrieve results.

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job_abc123",
    "status": "completed",
    "transcript": { ... },
    "tasks": [
      {
        "taskId": "uuid-here",
        "description": "Task description",
        "priority": "high",
        "dependencies": ["other-task-id"],
        "status": "ready"
      }
    ],
    "metadata": {
      "taskCount": 10,
      "cyclesDetected": false,
      "processingTime": 3500
    }
  }
}
```

**Status Values:**
- `pending`: Waiting in queue
- `processing`: AI is analyzing transcript
- `completed`: Processing finished
- `failed`: Error occurred

---

### 3. Complete Task

**PATCH** `/api/tasks/:taskId/complete`

Mark a task as completed and unlock dependent tasks.

**Response:**
```json
{
  "success": true,
  "message": "Task marked as completed",
  "data": {
    "completedTask": { ... },
    "allTasks": [ ... ]
  }
}
```

**Behavior:**
- Updates task status to `completed`
- Recalculates dependent task statuses
- Changes `blocked` tasks to `ready` if dependencies are met

---

## Level Implementations

### ✅ Level 1: Robust Backend

1. **Strict Output Schema**
   - LLM prompted to return structured JSON with `id`, `description`, `priority`, `dependencies`
   - See `llmService.ts:buildPrompt()`

2. **Dependency Validation**
   - Invalid dependency IDs (hallucinated by AI) are automatically removed
   - See `validationService.ts:validateAndSanitizeTasks()`
   - Logs warnings when invalid dependencies are found

3. **Cycle Detection**
   - Implements Depth-First Search (DFS) with recursion stack
   - Detects circular dependencies (e.g., A → B → C → A)
   - Tasks in cycles are flagged as `status: 'error'`
   - See `cycleDetectionService.ts`

4. **Data Persistence**
   - All transcripts and tasks stored in MongoDB
   - Indexed for fast retrieval

### ✅ Level 2: Async Processing & Idempotency

1. **Asynchronous Architecture**
   - Frontend receives `jobId` immediately (HTTP 202)
   - Backend processes LLM request in background queue
   - Frontend polls `/api/jobs/:jobId` every 2 seconds
   - See `jobQueue.ts`

2. **Idempotent Submission**
   - Transcript content is hashed (SHA-256)
   - Database checked for existing transcript with same hash
   - If duplicate found, returns existing `jobId` without re-processing
   - Prevents duplicate LLM API calls and costs
   - See `idempotencyService.ts` and `utils/hash.ts`

---

## Cycle Detection Algorithm

**Algorithm**: Depth-First Search (DFS) with Recursion Stack

**How it works:**

1. Build adjacency list from task dependencies
2. For each unvisited node, start DFS traversal
3. Maintain two sets:
   - `visited`: Nodes that have been fully explored
   - `recursionStack`: Nodes in current DFS path
4. If we encounter a node in the recursion stack → cycle detected
5. Mark all nodes in the cycle as `status: 'error'`

**Code Reference**: `src/services/cycleDetectionService.ts`

**Time Complexity**: O(V + E) where V = tasks, E = dependencies

**Example Cycle:**
```
Task A depends on Task B
Task B depends on Task C
Task C depends on A  ← Cycle!
```

All three tasks would be marked as errors.

---

## Idempotency Logic

**Problem**: User accidentally submits the same transcript twice

**Solution**:

1. Generate SHA-256 hash of transcript content (case-insensitive, trimmed)
2. Before processing, query MongoDB for existing transcript with same hash
3. If found:
   - Return existing `jobId`
   - Skip LLM API call
   - Frontend receives same results
4. If not found:
   - Create new transcript record with hash
   - Process normally

**Code Reference**: `src/services/idempotencyService.ts`

**Benefits**:
- Saves LLM API costs
- Ensures consistency
- Prevents duplicate database entries

---

## Environment Variables

Create a `.env` file in the `backend/` directory:

```env
PORT=5000
NODE_ENV=production

# MongoDB Configuration
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/insightboard

# Google Gemini API
GEMINI_API_KEY=your_api_key_here

# CORS
FRONTEND_URL=https://your-frontend-url.netlify.app
```

---

## Local Setup

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- Google Gemini API key

### Installation

```bash
cd backend
npm install
```

### Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your credentials:
   - MongoDB URI from MongoDB Atlas
   - Gemini API key from Google AI Studio

### Running

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

**Health Check:**
```bash
curl http://localhost:5000/health
```

---

## Deployment (Render)

### Steps:

1. **Create New Web Service** on Render
2. **Connect GitHub Repository**
3. **Configure Build Settings:**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Root Directory: `backend`

4. **Add Environment Variables:**
   - `MONGODB_URI`
   - `GEMINI_API_KEY`
   - `FRONTEND_URL`
   - `NODE_ENV=production`

5. **Deploy** and note the service URL

---

## Project Structure

```
backend/
├── src/
│   ├── models/
│   │   ├── Task.ts           # Task schema
│   │   └── Transcript.ts     # Transcript schema
│   ├── routes/
│   │   ├── transcriptRoutes.ts
│   │   ├── jobRoutes.ts
│   │   └── taskRoutes.ts
│   ├── services/
│   │   ├── llmService.ts            # Gemini integration
│   │   ├── validationService.ts     # Dependency validation
│   │   ├── cycleDetectionService.ts # DFS cycle detection
│   │   ├── jobQueue.ts              # Async processing
│   │   └── idempotencyService.ts    # Duplicate prevention
│   ├── middleware/
│   │   └── errorHandler.ts
│   ├── utils/
│   │   ├── database.ts       # MongoDB connection
│   │   └── hash.ts           # SHA-256 hashing
│   └── index.ts              # Express app entry
├── package.json
├── tsconfig.json
└── README.md
```

---

## Error Handling

All API errors follow this format:

```json
{
  "success": false,
  "error": {
    "message": "Error description"
  }
}
```

**Common HTTP Status Codes:**
- `200 OK`: Success
- `202 Accepted`: Job queued
- `400 Bad Request`: Invalid input
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## Testing

**Manual API Testing:**

```bash
# Submit transcript
curl -X POST http://localhost:5000/api/transcripts \
  -H "Content-Type: application/json" \
  -d '{"transcript": "Your meeting transcript here..."}'

# Check job status
curl http://localhost:5000/api/jobs/job_abc123

# Complete task
curl -X PATCH http://localhost:5000/api/tasks/task-uuid/complete
```

---

## Performance Considerations

- **Async Processing**: LLM calls don't block API responses
- **Database Indexing**: `jobId` and `contentHash` are indexed
- **Job Queue**: In-memory for simplicity (consider Bull/BullMQ with Redis for production scale)
- **Connection Pooling**: Mongoose handles MongoDB connection pooling

---

## Future Enhancements

- [ ] Redis-backed job queue (Bull/BullMQ)
- [ ] WebSocket for real-time job updates
- [ ] Rate limiting per user
- [ ] Task priority-based queue scheduling
- [ ] Retry logic for failed LLM calls
- [ ] Comprehensive unit & integration tests

---

## License

MIT
