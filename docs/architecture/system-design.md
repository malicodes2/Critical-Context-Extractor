# System Architecture: Critical Context Extractor

The "Agents Assemble" hackathon submission for the Critical Context Extractor follows a strict **Hexagonal Architecture** (also known as Ports & Adapters). This ensures that the core domain logic (healthcare decision-making and pattern extraction) remains entirely isolated from external technical concerns like the Model Context Protocol (MCP), FHIR HTTP specifics, or LLM vendor details.

## Layer Breakdown

### 1. Domain Layer (`src/domain/`)
The absolute core of the application. It contains ZERO external dependencies (no SDKs, no framework imports).
- **Entities & Value Objects:** `Patient`, `ClinicalNote`, `Severity`, `AlertLevel`, etc.
- **Port Interfaces:** Definitons like `PatientRepository`, `LLMClient`, `ILogger`.
- **Domain Services:** Pure logic operations like `AllergyDomainService` that cross-reference allergies against doctor notes without knowing *how* those notes were fetched.

### 2. Application Layer (`src/application/`)
This layer orchestrates the Use Cases. Each tool provided by the MCP server maps 1:1 to a Use Case.
- Coordinates fetching data via repos, running NLP extractions via the LLM port, and formatting the response.
- Example: `DetectPatternAnomaliesUseCase`.

### 3. Infrastructure Layer (`src/infrastructure/`)
The outward-facing adapters that implement the domain ports.
- **FHIRClient / FHIRPatientRepository:** Connects to HAPI FHIR using HTTP + intelligent exponential backoff. Maps raw FHIR R4 JSON into clean Domain Entities.
- **GeminiClient:** Implements `LLMClient` via Google's Generative AI SDK using structured JSON schema prompts.
- **Structures Logger:** A Winston-based structured JSON logger that hashes PHI for HIPAA compliance.

### 4. Presentation Layer (`src/presentation/`)
The entry point that exposes the application to the Prompt Opinion platform.
- **MCPServer:** Registers 7 distinct tools with the `@modelcontextprotocol/sdk`.
- **Middlewares:** Uses a pipeline for `Authentication`, `RateLimiting`, and `Validation`.

## Data Flow
1. Prompt Opinion sends a JSON-RPC 2.0 tool request (with injected FHIR Bearer Token).
2. The `StreamableHTTPServerTransport` receives it in the Presentation Layer.
3. Middlewares validate the token and parameters.
4. The requested tool delegates to an Application Layer Use Case.
5. The Use Case uses Infrastructure adapters (FHIR, Gemini) to perform extraction and reasoning.
6. The domain models enforce logic rules and output a prioritized result.
7. The result is converted to the MCP text array format and returned.
