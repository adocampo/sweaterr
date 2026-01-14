# AGENTS.md - Context for AI Agent Interactions with Sweaterr

This document provides a consolidated overview of the Sweaterr project, intended to serve as comprehensive context for AI agents like Gemini.

## Project Overview

Sweaterr is a Next.js web application designed to automate direct downloads from forums by integrating with JDownloader and various AI services. It simplifies the process of finding, extracting, and managing content from direct download forums, offering compatibility with *arr applications (Sonarr, Radarr, Lidarr).

**Key Features:**
*   **Cloudflare Bypass:** Uses FlareSolverr for seamless navigation through Cloudflare-protected forums.
*   **Multi-Forum Management:** Supports multiple configurable forums with individual settings and persistent sessions.
*   **JDownloader Integration:** Automates sending links to JDownloader for download management.
*   **AI-Powered Metadata Extraction:** Utilizes AI to enhance metadata for content found on forums.
*   **Torznab/Newznab Indexer:** Acts as an indexer for *arr applications, allowing them to search and retrieve content.
*   **Comprehensive Testing Tools:** Provides a UI for testing connections, search, link extraction, and metadata parsing.
*   **Internationalization (i18n):** Supports English and Spanish for all UI texts.
*   **Authentication:** JWT-based authentication with user management and roles.

**Core Technologies:**
*   **Frontend:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui
*   **Backend:** Next.js API Routes, Prisma (ORM), SQLite (development), PostgreSQL (production plan)
*   **External Services:** FlareSolverr, JDownloader2, OpenAI/DeepSeek/Perplexity/Ollama
*   **Containerization:** Docker, Docker Compose

## Project Documentation

This project has extensive documentation spread across several markdown files. It is crucial to consult these files for a complete understanding of the project.

*   `ARCHITECTURE.md`: **Most comprehensive document.** Details features, technical decisions, a comprehensive changelog, and the project roadmap. **Always consult this first for in-depth understanding.**
*   `README.md`: User-facing documentation for installation and basic usage.
*   `SETUP.md`: Step-by-step guide for setting up the local development environment.
*   `TODOS.md`: Prioritized list of pending tasks, critical issues, and future features.
*   `FIXES_CHANGELOG.md`: A summary of recent bug fixes and changes, particularly related to the *arr integration.

## Architecture Highlights

The project follows a **monolithic Next.js** architecture, combining frontend and backend within a single application.

*   **Cloudflare Bypass (Core):** `src/lib/services/cloudflare-handler.ts`, `flaresolverr-client.ts`, `flaresolverr-session-manager.ts` are critical for bypassing Cloudflare Turnstile using FlareSolverr.
*   **Database:** Prisma ORM is used with SQLite in development, with a plan to migrate to PostgreSQL for production. The schema is defined in `prisma/schema.prisma`.
*   **API Routes:** Backend logic is handled via Next.js API routes (`src/app/api/`).
*   **Hooks:** Custom React hooks (`src/hooks/use-api.ts`, `src/hooks/use-i18n.ts`) provide reusable logic and data fetching.
*   **Configuration:** Key configurations are managed via environment variables and stored in the database.

For a deep dive into the project's architecture, including detailed feature descriptions, technical decisions, and a comprehensive changelog, refer to `ARCHITECTURE.md`.

## Development Environment

### Setup

To set up the development environment, ensure you have Node.js 18+ installed. The `SETUP.md` file provides a detailed walkthrough.

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Configure environment variables:**
    Create a `.env.local` file with at least the following (refer to `SETUP.md` for more):
    ```env
    DATABASE_URL="file:./dev.db"
    NEXTAUTH_SECRET="your-secret-key-in-development"
    FLARESOLVERR_URL="http://your-flaresolverr-ip:8191" # Critical for Cloudflare bypass
    ```
3.  **Setup database:**
    ```bash
    npx prisma migrate dev --name init
    npx prisma generate
    ```

### Running

*   **Development Server:**
    ```bash
    npm run dev
    ```
    This will start the application at `http://localhost:3000` and output logs to `dev.log`.
*   **Production Build (Local):**
    ```bash
    npm run build
    npm run start
    ```
    The production server will run on `http://localhost:3000` and output logs to `server.log`.

### Docker

The project is Docker-ready for easy deployment.

```bash
docker-compose up -d --build
```
This command will build the Docker image and start the `sweaterr` service, accessible at `http://localhost:3000`.

## Key Files for AI Agent Reference

*   `ARCHITECTURE.md`: **Most comprehensive document**.
*   `TODOS.md`: Current project status and priorities.
*   `SETUP.md`: Detailed development setup instructions.
*   `README.md`: General user guide.
*   `package.json`: Lists project dependencies and NPM scripts.
*   `next.config.ts`: Next.js configuration.
*   `docker-compose.yml`: Defines Docker services.
*   `Dockerfile`: Instructions for building the Docker image.
*   `prisma/schema.prisma`: Database schema definition.
*   `src/lib/services/`: Core business logic.
*   `src/app/api/`: Backend endpoints.
*   `src/components/`: React components.
*   `src/locales/`: Internationalization JSON files.

## Development Guidelines for AI Agents

*   **Adhere to `ARCHITECTURE.md`:** This document contains critical permanent instructions for documentation, workflow, and how to understand the project.
*   **i18n:** All UI texts must be localized using `src/locales/{es,en}.json` files. Never hardcode strings.
*   **Testing:** Manual validation and testing are mandatory after any changes.
*   **Commits:** Descriptive commits in Spanish are preferred, following Conventional Commits where possible.
*   **Logs:** Use the project's logging system (`src/lib/logger.ts`) with descriptive prefixes.
*   **Error Handling:** API errors should consistently return `{ success: false, error: string }`.
*   **TypeScript:** Maintain strict TypeScript practices, avoiding `any` where possible.
*   **CSS:** Utilize Tailwind CSS and shadcn/ui for styling.

This `AGENTS.md` combined with the other markdown files in the repository should provide an excellent foundation for any AI agent interacting with the Sweaterr codebase.