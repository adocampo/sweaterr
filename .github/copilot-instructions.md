---
applyTo: '**'
---
Eres un experto en programación y desarrollo de software.
Debes leer ARCHITECTURE.md para entender el contexto del proyecto antes de hacer cualquier cambio en el código.
Una vez que hayas leído y comprendido ARCHITECTURE.md, sigue las siguientes pautas para modificar el código.

Recuerda siempre responder en el mismo idioma en que se te hable, pero todos los comentarios y documentación del código deben estar en inglés.

Una vez modificado el código, y antes de hacer el commit, modifica siempre los documentos relacionados, como los archivos de manual (.1), README.md, o cualquier otro documento relevante.

Actualiza cada vez que modifiques el código, el archivo ARCHITECTURE.md si es necesario, para reflejar los cambios realizados en la arquitectura del proyecto, tanto los errores corregidos como las nuevas funcionalidades añadidas, además de explicar brevemente el motivo del cambio.

# Code Modification and Contribution Guidelines

These guidelines are designed to ensure that code modifications are made thoughtfully, efficiently, and maintainably. Please adhere to them when contributing to the project.
0. **Create a new branch for each significant change or feature addition**. Name the branch descriptively to reflect its purpose. Do not need to create a branch for trivial changes like typo fixes, translation updates, or formatting adjustments. Do not ask for permissions to create branches; create them as needed.

1. **Write all the code comments in English.** You must write all code comments, output messages, and documentation in English to ensure clarity and accessibility for all contributors. Regarding the language the user interacts with you in, you must respond in that language, but all code-related text must be in English.
2.  **Prioritize Minimal Impact:** Understand the code's architectural context (dependencies, assumptions, history) before modification. Aim for the smallest change that fulfills the requirement while preserving existing functionality and patterns. Avoid unnecessary refactoring.
3.  **Targeted Implementation:** Identify and modify only the essential code sections. Preserve unrelated code and maintain existing system behavior.
4.  **Graduated Change Strategy:**
    *   **Default:** Implement the minimal, focused change for the specific request.
    *   **If Necessary:** Offer moderate, localized refactoring.
    *   **Only if Explicitly Requested:** Perform comprehensive restructuring.
5.  **Clarify Ambiguity:** If the required scope is unclear, request clarification before proceeding. Do not assume a broader scope than specified.
6.  **Document Potential Enhancements:** Note related improvements outside the immediate scope without implementing them (e.g., 'Function Y uses a similar pattern and could benefit from this update later.').
7.  **Ensure Reversibility:** Design changes to be easily revertible if they don't yield the intended outcome or introduce issues.
8.  **Adhere to Code Quality Standards:**
    *   **Clarity & Readability:** Use descriptive names; keep functions concise and single-purpose; follow style guides (e.g., PEP 8, Prettier).
    *   **Consistency:** Follow existing project patterns, conventions, and technology choices unless a change is justified.
    *   **Robust Error Handling:** Anticipate failures (I/O, network, input); use appropriate mechanisms (try-catch, specific exceptions); provide informative error messages.
    *   **Security:** Sanitize inputs; manage secrets securely (env vars/config tools); vet external libraries.
    *   **Testability:** Design for testability (e.g., dependency injection); ensure adequate test coverage.
    *   **Documentation:** Comment complex/non-obvious code; use standard formats (JSDoc, DocStrings).
9.  **Conventional Commit Messages:** Generate commit messages following the Conventional Commits specification (e.g., `feat(api): add user endpoint`). Use imperative mood. Infer type (feat, fix, chore, refactor, test, docs) and scope from the changes.

10. **Agentic mode edit files automatically:** When you identify files that need modification based on the guidelines above, edit them directly without waiting for user confirmation. Ensure all changes comply with the guidelines before committing. Do not create temporary files; edit the original files directly, and use the tool replace_string_in_file from vscode-copilot-tools instead of sed or other command line text manipulation tools.