# GEMINI.md

This file provides a comprehensive overview of the Sweaterr project for Gemini, an AI-powered development assistant.

## Project Overview

Sweaterr is a web application built with Next.js that integrates with download forums, JDownloader, and AI services. Its main purpose is to automate the process of downloading content from direct download forums. It provides a user-friendly interface to search for content across multiple forums, send it to JDownloader, and notify Sonarr/Radarr/Lidarr upon completion.

The project uses the following main technologies:

*   **Frontend:** Next.js, React, Tailwind CSS, shadcn/ui
*   **Backend:** Next.js API Routes, Prisma, SQLite
*   **Deployment:** Docker, Docker Compose

## Building and Running

### Development

To run the application in a development environment, you can use the following commands:

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

The application will be available at `http://localhost:3000`.

### Production

The recommended way to run the application in production is by using Docker and Docker Compose.

```bash
# Build and run the application with Docker Compose
docker-compose up -d --build
```

The application will be available at `http://localhost:3000`.

### Scripts

The `package.json` file contains several scripts for building, running, and managing the application:

*   `dev`: Starts the development server.
*   `build`: Builds the application for production.
*   `start`: Starts the production server.
*   `lint`: Lints the code.
*   `db:push`: Pushes the database schema to the database.
*   `db:generate`: Generates the Prisma client.
*   `db:migrate`: Creates a new migration based on the schema changes.
*   `db:reset`: Resets the database.

## Development Conventions

### Code Style

The project uses ESLint and Prettier to enforce a consistent code style. You can run the linter with the following command:

```bash
npm run lint
```

### Testing

The project has a dedicated testing section in the UI.

### Contribution Guidelines

When contributing to the project, please follow these guidelines:

1.  Fork the repository.
2.  Create a new branch for your feature: `git checkout -b feature/your-feature-name`
3.  Commit your changes: `git commit -m 'Add some feature'`
4.  Push to the branch: `git push origin feature/your-feature-name`
5.  Submit a pull request.
